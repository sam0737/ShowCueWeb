var AudioContext = window.AudioContext || window.webkitAudioContext;
var a = new AudioContext();
var $q;

function RenderTarget(channel) 
{
  this.id = channel.id;
  this.playingClips = [];
  this.currentClip = null;
  this.masterGain = a.createGain();
  this.masterGain.connect(a.destination);
  this.masterGain.gain.value = channel.masterGain != null ? channel.masterGain : 1;
  if (channel.screen) this.screenId = channel.screen.id;
}

RenderTarget.prototype.stop = function()
{
  this.playingClips.forEach(function (clip) { clip.deferredStop.resolve(); });
};

RenderTarget.prototype.destroy = function()
{
  this.stop();
  this.masterGain.disconnect(a.destination);
};

RenderTarget.prototype.addClip = function addClip(clip)
{
  if (this.currentClip && !this.currentClip.allowOverlap) {
    this.currentClip.deferredStop.resolve();
  }
  this.playingClips.push(clip);
  this.currentClip = clip;
};

RenderTarget.prototype.removeClip = function removeClip(clip)
{
  if (this.currentClip === clip) 
    this.currentClip = null;
  var i = this.playingClips.indexOf(clip);
  if (i >= 0) this.playingClips.splice(i, 1);
};

function RawScreen(screen) 
{
  this.screen = screen;
  this.window = null;  
}

RawScreen.prototype.load = function load(unloadCallback)
{
  var raw = this;
  var def = $q.defer();
  var defLoaded = $q.defer();
  var t = this;

  if (!this.window)
  {
    var options = 'left=20,top=20,dialog=no,resizable=no,scrollbars=no,chrome=no,titlebar=no,close=no';
    if (raw.screen.screenHeight)
      options += ',height=' + raw.screen.screenHeight;
    if (raw.screen.screenWidth)
      options += ',width=' + raw.screen.screenWidth;

    this.window = window.open('screen.html', '_blank', options);
    this.window.onload = function() { defLoaded.resolve(); };
    if (unloadCallback)
      this.window.onbeforeunload = function() { t.window = null; unloadCallback(); };
  } else {
    defLoaded.resolve();
  }
  
  defLoaded.promise.then(function() {
    var body = $('body', raw.window.document);
    if (raw.screen.background)
      body.css('background', raw.screen.background);
    raw.getWrapperSelector()
      .css({width: raw.screen.width || 300, height: raw.screen.height || 300, transform: raw.screen.transform || ''})
      .position({my: raw.screen.positionMy || 'center', at: raw.screen.positionAt || 'center', collision: 'none', of: body});
    def.resolve();
  });
  return def.promise;
}

RawScreen.prototype.getWrapperSelector = function getWrapperNode()
{
  if (this.window)
    return $('#stagecue-wrapper', this.window.document);
  return $();
};

angular.module("stageCue").service("sc.renderer", ['$q', function (q) {
  $q = q;
  var renderTargets = {};
  var rawScreens = {};

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


  this.go = function go(channel, item, config, endCallback, context)
  {
    if (item instanceof AudioItem)
      return this.goAudio.apply(this, arguments);
    if (item instanceof AudioControlItem || item instanceof VisualControlItem)
      return this.goControl.apply(this, arguments);
    if (item instanceof VideoItem)
      return this.goVideo.apply(this, arguments);
    if (item instanceof ImageItem)
      return this.goImage.apply(this, arguments);
    if (item instanceof HtmlItem)
      return this.goHtml.apply(this, arguments);
  }

  this.goControl = function goControl(channel, item, config)
  {
    var def = $q.defer();
    var channel = renderTargets[channel.id];

    var currentActive = channel.currentClip;

    function ends() {
      if (config.killAll) {
        this.stop(channel);
      } else if (config.killActive) {
        if (currentActive) {
          currentActive.deferredStop.resolve();
        }
      }

      if (config.waitActive && currentActive) {
        $q.when(currentActive.endPromise).then(function() { def.resolve(); });
      } else {
        def.resolve();
      }
    }

    var defDelay = $q.defer();
    if (config.delay)
    {
      setTimeout(function() { defDelay.resolve(); }, config.delay * 1000);
    } else {
      defDelay.resolve();
    }

    defDelay.promise.then(function() {
      var endNow = true;
      if (config.fadeTo != null && config.fadeRange[0] != null && config.fadeRange[1] != null)
      {
        endNow = false;
        if (channel.currentClip != null && channel.currentClip.gain != null)
        {
          var param = channel.currentClip.gain.gain;
          param.cancelScheduledValues(0);
          param.setValueAtTime(param.value, a.currentTime + config.fadeRange[0]);
          param.exponentialRampToValueAtTime(config.fadeTo || 0.01, a.currentTime + config.fadeRange[1]);
          param.linearRampToValueAtTime(config.fadeTo, a.currentTime + config.fadeRange[1]);
        }
        setTimeout(ends, config.fadeRange[1] * 1000);
      }
      if (config.script != null)
      {
        if (channel.currentClip != null && channel.currentClip.visualNode != null)
        {
          var ret =
            (function() { 
              try { 
                return eval(config.script);
              } catch (e) {
                console.warn('Failure in executing user script', e);
              }
            }).call(visualNode);
          $q.when(ret).finally(ends);
        }
      }

      if (endNow)
        ends();
    });

    return def.promise;
  };

  this.goAudio = function goAudio(channel, item, config, endCallback, context)
  {
    var def = $q.defer();
    var defStop = $q.defer();

    if (item.buffer == null) return;

    var target = renderTargets[channel.id];

    var clip = { 
      source: a.createBufferSource(), gain: a.createGain(), 
      endPromise: def.promise, deferredStop: defStop, allowOverlap: config.allowOverlap
    };
    clip.source.buffer = item.buffer;
    clip.source.onended = function() {
      clip.source.disconnect(clip.gain);
      clip.gain.disconnect(target.masterGain);
      target.removeClip(clip);
      def.resolve();
    };
    defStop.promise.then(function() { clip.source.stop(); });

    clip.source.connect(clip.gain);
    clip.gain.connect(target.masterGain);
    clip.gain.gain.value = config.gain != null ? config.gain : 1;
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

    target.addClip(clip);    
    return def.promise;
  };

  this.goVideo = function goVideo(channel, item, config)
  {
    if (!channel.screen) return;

    var def = $q.defer();
    var defStop = $q.defer();
    
    var screen = rawScreens[channel.screen.id];
    var target = renderTargets[channel.id];

    var node = $('<video>');
    node[0].src = item.blobUrl;
    if (config.width != null)
      node.css({width: config.width});
    if (config.height != null)
      node.css({height: config.height});
    node.css({position: 'absolute'});
    node.position({my: config.positionMy || 'center', at: config.positionAt || 'center', collision: 'none', of: screen.getWrapperSelector()});

    var clip = { 
      source: a.createMediaElementSource(node[0]), gain: a.createGain(), visualNode: node,
      endPromise: def.promise, deferredStop: defStop, allowOverlap: config.allowOverlap
    };
    var removal = function() {
      node.remove();
      target.removeClip(clip);
      def.resolve();
    };
    node.on('ended', removal);
    defStop.promise.then(removal);

    clip.source.connect(clip.gain);
    clip.gain.connect(target.masterGain);
    clip.gain.gain.value = config.gain != null ? config.gain : 1;

    if (config.opacity)
      node.css({opacity: config.opacity});
    node[0].play();
    screen.getWrapperSelector().append(node);
    target.addClip(clip);

    return def.promise;
  };

  this.goImage = function goImage(channel, item, config)
  {
    if (!channel.screen) return;

    var def = $q.defer();
    var defStop = $q.defer();
    
    var screen = rawScreens[channel.screen.id];
    var target = renderTargets[channel.id];

    var node = $('<img>');
    node[0].src = item.blobUrl;
    if (config.width != null)
      node.css({width: config.width});
    if (config.height != null)
      node.css({height: config.height});
    node.css({position: 'absolute'});
    node.position({my: config.positionMy || 'center', at: config.positionAt || 'center', collision: 'none', of: screen.getWrapperSelector()});

    var clip = { 
      endPromise: def.promise, deferredStop: defStop, allowOverlap: config.allowOverlap, visualNode: node
    };
    var removal = function() {
      node.remove();
      target.removeClip(clip);
      def.resolve();
    };
    defStop.promise.then(removal);
    if (config.opacity)
      node.css({opacity: config.opacity});

    screen.getWrapperSelector().append(node);
    target.addClip(clip);

    return def.promise;
  };

  this.goHtml = function goHtml(channel, item, config)
  {
    if (!channel.screen) return;

    var def = $q.defer();
    var defStop = $q.defer();
    
    var screen = rawScreens[channel.screen.id];
    var target = renderTargets[channel.id];

    var node = $('<div>');
    node.load(item.blobUrl);
    if (config.width != null)
      node.css({width: config.width});
    if (config.height != null)
      node.css({height: config.height});
    node.css({position: 'absolute'});
    node.position({my: config.positionMy || 'center', at: config.positionAt || 'center', collision: 'none', of: screen.getWrapperSelector()});

    var clip = { 
      endPromise: def.promise, deferredStop: defStop, allowOverlap: config.allowOverlap, visualNode: node
    };
    var removal = function() {
      node.remove();
      target.removeClip(clip);
      def.resolve();
    };
    defStop.promise.then(removal);
    if (config.opacity)
      node.css({opacity: config.opacity});

    screen.getWrapperSelector().append(node);
    target.addClip(clip);

    return def.promise;
  };

  this.stop = function stop(channel)
  {
    renderTargets[channel.id].stop();
  };

  this.addChannel = function addChannel(channel)
  {
    if (!(channel instanceof ShowChannel)) return;

    var t = renderTargets[channel.id] = 
      renderTargets[channel.id] || new RenderTarget(channel);

    if (channel.screen) {
      var s = rawScreens[channel.screen.id] =
        rawScreens[channel.screen.id] || new RawScreen(channel.screen);

      var unloadCallback = function() { 
          for (var i in renderTargets)
          {
            if (renderTargets[i].screenId == s.id)
              renderTargets[i].stop();
          }
        };
      return s.load(unloadCallback);
    }
  };

  this.removeChannel = function removeChannel(channel)
  {
    renderTargets[channel.id].destroy();
    delete renderTargets[channel.id];
  };
}]);

