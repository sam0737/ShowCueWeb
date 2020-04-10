var AudioContext = window.AudioContext || window.webkitAudioContext;
var a = new AudioContext();
var $q;
var seq = 0;

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

RenderTarget.prototype.stop = function(targetSeq)
{
  this.playingClips.forEach(function (clip) { 
    if (targetSeq == null || clip.seq < targetSeq)
      clip.deferredStop.resolve(); 
  });
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
    if (this.window) // If pop-up is blocked, window is undefined.
    {
      this.window.onload = function() { defLoaded.resolve(); };
      if (unloadCallback)
        this.window.onbeforeunload = function() { t.window = null; unloadCallback(); };
    }
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
    raw.window.document.title = raw.screen.name;
    def.resolve();
  });
  return def.promise;
}

RawScreen.prototype.getHead = function getWrapperNode()
{
  if (this.window)
    return $('head', this.window.document);
  return $();
};

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
    if (item instanceof VideoItem || item instanceof ImageItem || item instanceof HtmlItem)
      return this.goHtmlBasedElement.apply(this, arguments);
  }

  this.goControl = function goControl(channel, item, config)
  {
    var def = $q.defer();
    var target = renderTargets[channel.id];
    var targetSeq = seq;

    var currentActive = target.currentClip;

    function ends() {
      if (config.killAll) {
        target.stop(targetSeq);
      } else if (config.killActive) {
        if (currentActive) {
          currentActive.deferredStop.resolve();
        }
      }

      def.resolve();
    }

    var defDelay = $q.defer();
    if (config.delay)
    {
      setTimeout(function() {
        defDelay.resolve(); 
      }, config.delay * 1000);
    } else {
      defDelay.resolve();
    }

    defDelay.promise.then(function() {
      var endNow = true;
      if (config.fadeTo != null && config.fadeRange[0] != null && config.fadeRange[1] != null)
      {
        endNow = false;
        if (currentActive != null && currentActive.gain != null)
        {
          var param = currentActive.gain.gain;
          param.cancelScheduledValues(0);
          param.setValueAtTime(param.value, a.currentTime + config.fadeRange[0]);
          param.exponentialRampToValueAtTime(config.fadeTo || 0.01, a.currentTime + config.fadeRange[1]);
          param.linearRampToValueAtTime(config.fadeTo, a.currentTime + config.fadeRange[1]);
        }
        setTimeout(ends, config.fadeRange[1] * 1000);
      }
      if (config.style != null && config.style != "") 
      {
        if (currentActive != null && channel.screen)
        {
          var screen = rawScreens[channel.screen.id];
          var styleString = config.style.replace(/\$ID\$/g, currentActive.elementId);
          var style = $("<style>" + styleString + "</style>");
          window.StyleFix.styleElement(style[0]);
          screen.getHead().append(style);
          currentActive.styles.push(style);
        }
      }
      if (config.script != null && config.script != "")
      {
        if (currentActive != null && currentActive.visualNode != null)
        {
          endNow = false;
          var ret = null;
          try { 
            ret = new Function(config.script).call(currentActive.visualNode);
          } catch (e) {
            console.warn('Failure in executing user script', e);
          }
          $q.when(ret).finally(ends);
        }
      }
      if (config.waitAnimation)
      {
        if (currentActive != null && currentActive.visualNode != null)
        {
          endNow = false;
          currentActive.visualNode.one('animationend', ends);
          currentActive.visualNode.one('webkitAnimationEnd', ends);
        }
      }
      if (config.waitActive && currentActive) {
        endNow = false;
        $q.when(currentActive.endPromise).then(function() { ends(); });
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
      source: a.createBufferSource(), gain: a.createGain(), seq: seq++,
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

  this.goHtmlBasedElement = function goHtmlBasedElement(channel, item, config)
  {
    if (!channel.screen) return;

    var def = $q.defer();
    var defStop = $q.defer();
    
    var screen = rawScreens[channel.screen.id];
    var target = renderTargets[channel.id];

    var node;
    var removal;

    var elementId = 
      'id' +
      Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1) +
      Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);

    if (item instanceof VideoItem)
    {
      node = $('<video>').attr({ id: elementId });
    } else if (item instanceof ImageItem)
    {
      node = $('<img>').attr({ id: elementId });
    } else if (item instanceof HtmlItem)
    {
      node = $('<div>').attr({ id: elementId });
    }

    var clip = { 
      visualNode: node, styles: [], elementId: elementId, seq: seq++,
      endPromise: def.promise, deferredStop: defStop, allowOverlap: config.allowOverlap
    };

    var defDelay = $q.defer();
    if (config.delay)
    {
      setTimeout(function() {
        defDelay.resolve(); 
      }, config.delay * 1000);
    } else {
      defDelay.resolve();
    }

    target.addClip(clip);
    defDelay.promise.then(function() {
      var removal = function() {
        clip.styles.forEach(function(i) { i.remove(); });
        node.remove();
        target.removeClip(clip);
        def.resolve();
      };
      if (item instanceof VideoItem)
      {
        node[0].src = item.blobUrl;
      } else if (item instanceof ImageItem)
      {
        node[0].src = item.blobUrl + '#' + seq;
        node.one('load', function() { def.resolve(); });
      } else if (item instanceof HtmlItem)
      {
        node.load(item.blobUrl, function() {
          def.resolve();
        });
      }
      node.css({ 
        width: config.width || item.width || 100, 
        height: config.height || item.height || 100,
        position: 'absolute', 
        opacity: (config.opacity == null || config.opacity === "" ? undefined : config.opacity),
        zIndex: channel.index + 10
      });
      node.position({my: config.positionMy || 'center', at: config.positionAt || 'center', collision: 'none', of: screen.getWrapperSelector()});

      if (config.style != null && config.style != "") 
      {
        var styleString = config.style.replace(/\$ID\$/g, elementId);
        var style = $("<style>" + styleString + "</style>");
        window.StyleFix.styleElement(style[0]);
        screen.getHead().append(style);
        clip.styles.push(style);
      }
      if (item instanceof VideoItem)
      {
        clip.source = a.createMediaElementSource(node[0]);
        clip.gain = a.createGain();
        clip.source.connect(clip.gain);
        clip.gain.connect(target.masterGain);
        clip.gain.gain.value = config.gain != null ? config.gain : 1;
        defDelay.promise.then(function() {
          node[0].play(); 
          if (config.doNotRemoveAtTheEnd) {
            node.one('ended', function() { def.resolve(); });
          } else {
            node.one('ended', removal);
          }
        });
      }
      defStop.promise.then(removal);

      screen.getWrapperSelector().append(node);
    });

    return def.promise;
  };

  this.stop = function stop(channel)
  {
    renderTargets[channel.id].stop();
  };

  this.addChannel = function addChannel(channel)
  {
    if (!(channel instanceof ShowChannel)) return;
    a.resume();

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

