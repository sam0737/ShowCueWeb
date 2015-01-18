angular.module("stageCue").service("sc.audio", function () {
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
    if (item.buffer == null)
    {
      endCallback.call(context);
      return;
    }

    var channel = channelNodes[channel.id];

    var clip = { source: a.createBufferSource(), gain: a.createGain() };
    clip.source.buffer = item.buffer;
    clip.source.onended = function() {
      clip.source.disconnect(clip.gain);
      clip.source.disconnect(channel.masterGain);
      if (channel.currentClip === clip) 
        channel.currentClip = null;
      var i = channel.playingClips.indexOf(clip);
      if (i >= 0) channel.playingClips.splice(i, 1);
      endCallback.call(context);
    };

    clip.source.connect(clip.gain);
    clip.gain.connect(channel.masterGain);
    clip.gain.value = 1;
    clip.source.start(
      config.delay || 0,
      config.offset || 0,
      config.duration || clip.source.buffer.duration - (config.offset || 0)
    );
    if (channel.currentClip) {
      channel.currentClip.source.stop();
    }
    channel.playingClips.push(clip);
    channel.currentClip = clip;
  };

  this.stop = function stop(channel)
  {
    var c = channelNodes[channel.id];
    c.playingClips.forEach(function (clip) { clip.source.stop(); });
  };

  this.addChannel = function addChannel(channel)
  {
    var c = channelNodes[channel.id] = 
    {
      playingClips: [],
      currentClip: null,
      masterGain: a.createGain()
    };
    c.masterGain.connect(a.destination);
    c.masterGain.gain.value = 1;
  };

  this.removeChannel = function removeChannel(channel)
  {
    this.stop(channel);

    var c = channelNodes[channel.id];
    c.masterGain.disconnect(a.destination);
    delete channelNodes[channel.id];
  };
});

