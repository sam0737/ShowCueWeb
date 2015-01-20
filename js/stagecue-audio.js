angular.module("stageCue").service("sc.audio", ['$q', function ($q) {
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var a = new AudioContext();

  var previewNode = null;
  this.preview = function (item, endedCallback)
  {
    var buffer = item instanceof AudioItem ? item.buffer : item;
    if (previewNode != null) previewNode.stop();
    previewNode = a.createBufferSource();
    previewNode.buffer = buffer;
    previewNode.connect(a.destination);
    if (endedCallback) previewNode.onended = endedCallback;
    previewNode.start();
  }

  this.stopPreview = function() {
    if (previewNode != null) previewNode.stop();
    previewNode = null;
  };

  this.decodeAudioData = function() { return a.decodeAudioData.apply(a, arguments); };

  var channelNodes = {};

  this.go = function go(channel, item, config, endCallback, context)
  {
    if (item instanceof AudioItem)
      return this.goAudio.apply(this, arguments);
    if (item instanceof AudioControlItem)
      return this.goControl.apply(this, arguments);
  }

  this.goControl = function goControl(channel, item, config)
  {
    var def = $q.defer();
    var channel = channelNodes[channel.id];

    var currentActive = channel.currentClip;

    function ends() {
      if (config.killAll) {
        this.stop(channel);
      } else if (config.killActive) {
        if (currentActive) {
          currentActive.source.stop();
        }
      }

      if (config.waitActive && currentActive) {
        $q.when(currentActive.endPromise).then(function() { def.resolve(); });
      } else {
        def.resolve();
      }
    }

    var endNow = true;
    if (config.fadeTo != null && config.fadeRange[0] != null && config.fadeRange[1] != null)
    {
      endNow = false;
      if (channel.currentClip != null)
      {
        var param = channel.currentClip.gain.gain;
        param.cancelScheduledValues(0);
        param.setValueAtTime(param.value, a.currentTime + config.fadeRange[0]);
        param.exponentialRampToValueAtTime(config.fadeTo || 0.01, a.currentTime + config.fadeRange[1]);
        param.linearRampToValueAtTime(config.fadeTo, a.currentTime + config.fadeRange[1]);
      }
      setTimeout(ends, config.fadeRange[1] * 1000);
    }

    if (endNow)
      ends();

    return def.promise;
  };

  this.goAudio = function goAudio(channel, item, config, endCallback, context)
  {
    var def = $q.defer();
    if (item.buffer == null)
    {
      def.resolve();
      return def.promise;
    }

    var channel = channelNodes[channel.id];

    var clip = { source: a.createBufferSource(), gain: a.createGain(), endPromise: def.promise };
    clip.source.buffer = item.buffer;
    clip.source.onended = function() {
      clip.source.disconnect(clip.gain);
      clip.source.disconnect(channel.masterGain);
      if (channel.currentClip === clip) 
        channel.currentClip = null;
      var i = channel.playingClips.indexOf(clip);
      if (i >= 0) channel.playingClips.splice(i, 1);
      def.resolve();
    };

    clip.source.connect(clip.gain);
    clip.gain.connect(channel.masterGain);
    clip.gain.gain.value = config.gain != null ? config.gain : 1;
    clip.config = config;
    if (config.loop[0] != null && config.loop[1] != null) {
      clip.source.loop = true;
      clip.source.loopStart = config.loop[0];
      clip.source.loopEnd = config.loop[1];
    } else {
      clip.source.loop = false;
    }
    clip.source.start(
      config.delay != null ? a.currentTime + config.delay : 0,
      config.range[0] != null ? config.range[0] : 0,
      config.range[1] && config.range[0] != null ?
        config.range[1] - config.range[0] : 
        clip.source.buffer.duration - (config.range[0] || 0)
    );
    if (channel.currentClip && 
        (!channel.currentClip.config || !channel.currentClip.config.allowOverlap)) {
      channel.currentClip.source.stop();
    }
    channel.playingClips.push(clip);
    channel.currentClip = clip;
    
    return def.promise;
  };

  this.stop = function stop(channel)
  {
    var c = channelNodes[channel.id];
    c.playingClips.forEach(function (clip) { clip.source.stop(); });
  };

  this.addChannel = function addChannel(channel)
  {
    if (!(channel instanceof ShowChannel)) return;

    var c = channelNodes[channel.id] = 
    channelNodes[channel.id] ||
    {
      playingClips: [],
      currentClip: null,
      masterGain: a.createGain()
    };
    c.masterGain.connect(a.destination);
    c.masterGain.gain.value = channel.masterGain != null ? channel.masterGain : 1;
  };

  this.removeChannel = function removeChannel(channel)
  {
    this.stop(channel);

    var c = channelNodes[channel.id];
    c.masterGain.disconnect(a.destination);
    delete channelNodes[channel.id];
  };
}]);

