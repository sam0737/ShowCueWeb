var $q;
var $renderer;
var $userConfig;
var $library;
var $rootScope;

function Screen()
{
  this.id = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  this.name = 'New Screen';
  this.transform = '';
  this.screenWidth = 0;
  this.screenHeight = 0;
  this.width = null;
  this.height = null;
  this.positionMy = null;
  this.positionAt = null;
  this.background = '#000000';
}

Screen.prototype.extendedProperties = ['id','name','transform','screenWidth','screenHeight','width','height','positionMy','positionAt','background'];
Screen.prototype.persist = function persist() {
  var c = {};
  this.extendedProperties.forEach(function (key) {
    c[key] = angular.copy(this[key]);
  }, this);
  return c;
};

Screen.prototype.thaw = function thaw(v) {
  this.extendedProperties.forEach(function (key) {
    if (v[key] != null) this[key] = v[key];
  }, this);
};

function CueConfig()
{
}

CueConfig.prototype.type = null;
CueConfig.prototype.persist = function persist() {
  var c = { type: this.type };
  this.extendedProperties.forEach(function (key) {
    c[key] = angular.copy(this[key]);
  }, this);
  return c;
};

CueConfig.prototype.thaw = function thaw(v) {
  this.extendedProperties.forEach(function (key) {
    if (v[key] != null) this[key] = v[key];
  }, this);
};

AudioCueConfig.prototype = new CueConfig();
AudioCueConfig.prototype.constructor = AudioCueConfig;
AudioCueConfig.prototype.type = 'audio';
AudioCueConfig.prototype.extendedProperties = ['gain','allowOverlap','loop','range','delay'];
function AudioCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.gain = null;
  this.delay = null;
  this.range = [null, null];
  this.loop = [null, null];
  this.allowOverlap = false;
}

AudioControlCueConfig.prototype = new CueConfig();
AudioControlCueConfig.prototype.constructor = AudioControlCueConfig;
AudioControlCueConfig.prototype.type = 'audio-control';
AudioControlCueConfig.prototype.extendedProperties = ['waitActive','killActive','killAll','fadeTo','fadeRange'];
function AudioControlCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.waitActive = false;
  this.killActive = false;
  this.killAll = false;
  this.fadeTo = null;
  this.fadeRange = [null, null];
}

VideoCueConfig.prototype = new CueConfig();
VideoCueConfig.prototype.constructor = VideoCueConfig;
VideoCueConfig.prototype.type = 'video';
VideoCueConfig.prototype.extendedProperties = ['gain','opacity','width','height','positionMy','positionAt','allowOverlap'];
function VideoCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.gain = null;
  this.opacity = null;
  this.width = null;
  this.height = null;
  this.positionMy = null;
  this.positionAt = null;
  this.allowOverlap = false;
}

ImageCueConfig.prototype = new CueConfig();
ImageCueConfig.prototype.constructor = ImageCueConfig;
ImageCueConfig.prototype.type = 'image';
ImageCueConfig.prototype.extendedProperties = ['opacity','width','height','positionMy','positionAt','allowOverlap'];
function ImageCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.opacity = null;
  this.width = null;
  this.height = null;
  this.positionMy = null;
  this.positionAt = null;
  this.allowOverlap = false;
}

HtmlCueConfig.prototype = new CueConfig();
HtmlCueConfig.prototype.constructor = ImageCueConfig;
HtmlCueConfig.prototype.type = 'html';
HtmlCueConfig.prototype.extendedProperties = ['opacity','width','height','positionMy','positionAt','allowOverlap'];
function HtmlCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.opacity = null;
  this.width = null;
  this.height = null;
  this.positionMy = null;
  this.positionAt = null;
  this.allowOverlap = false;
}

VisualControlCueConfig.prototype = new CueConfig();
VisualControlCueConfig.prototype.constructor = VisualControlCueConfig;
VisualControlCueConfig.prototype.type = 'visual-control';
VisualControlCueConfig.prototype.extendedProperties = ['waitActive','killActive','killAll','delay','script'];
function VisualControlCueConfig()
{
  CueConfig.prototype.constructor.apply(this);  
  this.waitActive = false;
  this.killActive = false;
  this.killAll = false;
  this.delay = null;
  this.script = null;
}

CueConfig.thawItems = function thawItems(values) {
  return StageCue.thawItemsByType(values, [
      AudioCueConfig, AudioControlCueConfig, 
      VideoCueConfig, ImageCueConfig, HtmlCueConfig, 
      VisualControlCueConfig]);
};

Channel.prototype.type = null;
Channel.prototype.extendedProperties = ['type', 'name'];
function Channel()
{
  this.id = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  this.name = 'Ch';
}

Channel.prototype.persist = function persist() {
  var c = {};
  this.extendedProperties.forEach(function (key) {
    c[key] = angular.copy(this[key]);
  }, this);
  return c;
};

Channel.prototype.thaw = function thaw(v) {
  this.extendedProperties.forEach(function (key) {
    if (v[key] != null) this[key] = v[key];
  }, this);
};

ShowChannel.prototype = new Channel();
ShowChannel.prototype.constructor = ShowChannel;
ShowChannel.prototype.type = 'show';
ShowChannel.prototype.extendedProperties = 
  Channel.prototype.extendedProperties.concat(['masterGain']);

function ShowChannel()
{
  Channel.prototype.constructor.apply(this);  
  this.masterGain = null;
  this.screen = null;
}
ShowChannel.prototype.persist = function persist() {
  var c = Channel.prototype.persist.call(this);  
  if (this.screen) {
    c.screenId = this.screen.id;
    c.screenName = this.screen.name;
  }
  return c;
};

ShowChannel.prototype.thaw = function thaw(v, screens) {
  Channel.prototype.thaw.call(this, v);  
  if (v.screenId != null)
  {
    this.screen = StageCue.arrayFind.call(screens, function (s) { return s.id == v.screenId; });
  }
};

Channel.thawItems = function thawItems(values, screens) {
  return StageCue.thawItemsByType(values, [ShowChannel], screens);
};

Cue.GO_NORMAL = 0;
Cue.GO_WITH_NEXT = 1;
Cue.GO_AFTER_THIS = 2;

function Cue(channelCount)
{
  if (channelCount == null)
    channelCount = 0;
  this.items = [];
  this.configs = [];
  for (var i = 0; i < channelCount; i++)
    this.addChannel();
  this.description = 'New Cue';
  this.goMode = Cue.GO_NORMAL;
}

Cue.prototype.persist = function persist() {
  var r = { 
    description: this.description,
    goMode: this.goMode,
    items: this.items.map(function (i) { return i instanceof LibraryItem ? { id: i.id } : {}; }),
    configs: this.configs.map(function (i) { return i instanceof CueConfig ? i.persist() : {}; }),
  };
  return r;
};

Cue.prototype.thaw = function thaw(v, libraryItemMap) {  
  if (v.description != null)
    this.description = v.description;
  if (v.goMode != null)
    this.goMode = v.goMode;
  if (libraryItemMap !== undefined)
    this.items = v.items.map(function (i) { return libraryItemMap[i.id] || {} });
  this.configs = CueConfig.thawItems(v.configs);
};

Cue.prototype.addChannel = function addChannel()
{
  this.items.push({});
  this.configs.push({});
};

Cue.prototype.channelReordered = function channelReordered(x, y)
{
  var a = this.items[y];
  var b = this.items[x];
  this.items[y] = {};
  this.items[x] = a;
  this.items[y] = b;
  this.itemReordered(x, y);
};

Cue.prototype.itemReordered = function itemReordered(x, y)
{
  var a = this.configs[y];
  var b = this.configs[x];
  this.configs[y] = {};
  this.configs[x] = a;
  this.configs[y] = b;
};

Cue.prototype.setItem = function setItem(channelIndex, item)
{
  if (channelIndex < 0 || channelIndex >= this.items.length) return;
  this.items[channelIndex] = item;
  var configs = CueConfig.thawItems([{type: item.type}]);
  this.configs[channelIndex] = configs[0];
};

Cue.prototype.removeChannelAt = function removeChannelAt(index)
{
  if (index < 0 || index >= this.items.length) return;
  this.items.splice(index, 1);
  this.configs.splice(index, 1);
};

function CueEngine(renderer, userConfig, library, rootScope, q)
{
  $library = library;
  $renderer = renderer;
  $userConfig = userConfig;
  $rootScope = rootScope;
  $q = q;
  userConfig.onPersist('cueEngine', this.persist, this);
  userConfig.onThaw('cueEngine', this.thaw, this);

  this.current = -1;
  this.running = false;
  this.runningEra = 0;

  this.cues = [];
  this.channels = [];
  this.screens = [];

  this.loaded = false;
  this.addChannel(new ShowChannel());
}

CueEngine.prototype.addScreen = function addScreen(screen)
{
  this.screens.push(screen)
  this.flush();
};

CueEngine.prototype.addChannel = function addChannel(channel)
{
  if (this.running) return;
  channel.name = 'Ch ' + this.channels.length;
  this.channels.push(channel);
  
  $renderer.addChannel(channel);

  this.cues.forEach(function (cue) {
    cue.addChannel();
  });
  this.flush();
};

CueEngine.prototype.reapplyChannels = function reapplyChannels(channel)
{
  var promises = [];
  for (var i = 0; i < this.channels.length; i++)
  {
    var channel = this.channels[i];
    promises.push($q.when($renderer.addChannel(channel)));
  }
  return $q.all(promises);
};

CueEngine.prototype.removeChannelAt = function removeChannelAt(index)
{
  if (this.running) return;
  var channels = this.channels.splice(index, 1);
  var channel = channels[0];

  $renderer.removeChannel(channel);

  this.cues.forEach(function (cue) {
    cue.removeChannelAt(index);
  });
  this.flush();
};

CueEngine.prototype.channelReordered = function channelReordered(x, y)
{
  if (this.running) return;
  this.cues.forEach(function (cue) {
    cue.channelReordered(x, y);
  });
  this.flush();
};

CueEngine.prototype.addCue = function addCue(item)
{
  if (this.running) return;
  var cue = new Cue(this.channels.length);
  cue.description = item.name;
  this.cues.push(cue);
  if (item != null)
    cue.setItem(0 /* First matching channel? */, item);
  if (this.cues.length == 1)
    this.current = 0;
  this.flush();
  return cue;
};

CueEngine.prototype.removeCueAt = function removeCueAt(index)
{
  if (this.running) return;
  if (index < 0 || index >= this.cues.length) return;
  this.cues.splice(index, 1);
  if (this.current >= this.cues.length)
    this.current--;
  this.flush();
};

CueEngine.prototype.moveCueAt = function moveCueAt(index, offset)
{
  if (this.running) return;
  if (index < 0 || index >= this.cues.length) return;
  if (index + offset < 0) return;
  if (index + offset >= this.cues.length) return;
  if (offset > 1) offset--;
  var removed = this.cues.splice(index, 1);
  this.cues.splice(index + offset, 0, removed[0]);
  this.current = index + offset;
  this.flush();
};

CueEngine.prototype.duplicateCue = function duplicateCue()
{
  if (this.running) return;
  var index = this.current;
  if (index < 0 || index >= this.cues.length) return;

  var data = this.cues[index].persist();
  var libraryItemMap = this.getLibraryItemMap();

  var newCue = new Cue(); 
  newCue.thaw(data, libraryItemMap); 
  this.cues.splice(index, 0, newCue);
  this.flush();
};

CueEngine.prototype.removeCueItemAt = function removeCueItemAt(cueIndex, index)
{
  if (this.running) return;
  if (cueIndex < 0 || cueIndex >= this.cues.length) return;
  this.cues[cueIndex].setItem(index, {});
  this.flush();
};

CueEngine.prototype.setCurrentAt = function setCurrentAt(index)
{
  if (index < 0 || index >= this.cues.length) return;
  this.current = index;
};

CueEngine.prototype.go = function go()
{
  var cueEngine = this;
    var fn = 
      (function() {
        if (this.running) this.current++;
        if (this.current < 0 || this.current >= this.cues.length)
        {
          if (this.running) {
            this.softStop();
            this.current = 0;
          }
          return;
        }
        this.running = true;
        var era = ++this.runningEra;
        this.runningItemCount = 0;

        var cueEngine = this;

        var cue = this.cues[this.current];
        for (var i = 0; i < cue.items.length; i++)
        {
          var item = cue.items[i];
          this.runningItemCount++;
          $q.when($renderer.go(this.channels[i], item, cue.configs[i]))
            .then(function() { cueEngine.cueItemEndCallback(cue, era); });
        }
        return cue;
      });
    
    var cue;    

    $q.when(!this.running ? this.reapplyChannels() : null).then(function() {
  do 
  {
        cue = fn.call(cueEngine); 
        
          
  }while (cue && cue.goMode == Cue.GO_WITH_NEXT);
    });

};

CueEngine.prototype.cueItemEndCallback = function cueItemEndCallback(cue, era)
{
  if (era == this.runningEra)
  {
    if (--this.runningItemCount <= 0)
    {
      if (cue.goMode == Cue.GO_AFTER_THIS) {
        this.go();
      } else {
        this.softStop();
      }
    }
  }
};

CueEngine.prototype.softStop = function softStop()
{
  this.runningEra++;
  if (!this.running) return;
  this.running = false;
  if (this.current < this.cues.length - 1) this.current++; else this.current=0;
};

CueEngine.prototype.stop = function stop()
{
  this.softStop();
  for (var i = 0; i < this.channels.length; i++)
  {
    var channel = this.channels[i];
    $renderer.stop(channel);
  }
};

CueEngine.prototype.flush = function flush()
{
  if (!this.loaded) return
  $userConfig.raiseDirty('cueEngine');
}

CueEngine.prototype.persist = function persist() {
  var result =
    {
      screens: this.screens.map(function (i) { return i.persist(); }),
      channels: this.channels.map(function (i) { return i.persist(); }),
      cues: this.cues.map(function (i) { return i.persist(); })
    };
  return result;
};

CueEngine.prototype.thaw = function thaw(v)
{
  this.loaded = true;
  if (v == null) return;

  var libraryItemMap = this.getLibraryItemMap();

  this.screens.splice(0);
  this.screens.push.apply(this.screens, (v.screens || []).map(function (i) {
    var screen = new Screen();
    screen.thaw(i);
    return screen;
  }));

  this.channels.splice(0);
  var newChannels = Channel.thawItems(v.channels || [], this.screens);
  this.channels.push.apply(this.channels, newChannels);
  this.reapplyChannels();
  
  this.cues.splice(0);
  this.cues.push.apply(this.cues, v.cues.map(function (i) {
    var item = new Cue(); 
    item.thaw(i, libraryItemMap); 
    return item; 
  }));

  this.setCurrentAt(0);
};

CueEngine.prototype.getLibraryItemMap = function getLibraryItemMap(v)
{
  var libraryItemMap = [];
  $library.items.forEach(function (i) { libraryItemMap[i.id] = i; });
  return libraryItemMap;
}

angular.module("stageCue").service("sc.cueEngine", ['sc.renderer', 'sc.userConfig', 'sc.library', '$rootScope', '$q', CueEngine]);
