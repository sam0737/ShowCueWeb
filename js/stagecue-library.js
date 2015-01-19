var $q;
var $userConfig;
var $audio;
var $cueEngine;

function FileResource(fileEntry)
{
  this.entry = fileEntry;
  this.name = fileEntry.name;
};

function LibraryItem() {
  this.id = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  this.isBuiltin = false;
}

LibraryItem.prototype.type = null;
LibraryItem.prototype.persist = function persist() {
  return { type: this.type, name: this.name, id: this.id };
};

LibraryItem.prototype.thaw = function thaw(v) {
  this.id = v.id;
  this.name = v.name;
};

LibraryItem.thawItems = function thawItems(values) {
  return StageCue.thawItemsByType(values, [AudioItem]);
};

function MapToResources(fileEntries)
{
  var r = 
    fileEntries.map(function(e) {
      return new FileResource(e);
    });
  return r;
};

AudioItem.prototype = new LibraryItem();
AudioItem.prototype.type = 'audio';
AudioItem.prototype.constructor = AudioItem;
function AudioItem() {
  LibraryItem.prototype.constructor.apply(this);  
  this.previewing = false;
};

AudioItem.prototype.loadFromResource = function loadFromResource(resource) {
  this.name = resource.name;

  var item = this;
  var def = $q.defer();

  resource.entry.file(function (file) {
    var reader = new FileReader();

    reader.onload = function(e) {
      $audio.decodeAudioData(this.result, 
        function (buffer) {
          item.buffer = buffer;
          def.resolve();
        }, 
        def.reject
      );
    };
    reader.onerror = def.reject;
    reader.readAsArrayBuffer(file);
  }, def.reject);

  return def.promise;
};

AudioControlItem.prototype = new LibraryItem();
AudioControlItem.prototype.type = 'audio-control';
AudioControlItem.prototype.constructor = AudioControlItem;
function AudioControlItem(resource, callback) {
  LibraryItem.prototype.constructor.apply(this);  
  this.name = '[Audio Control]';
  this.id = '__audio-control';
  this.isBuiltin = true;
};

function Library(audio, q, userConfig, cueEngine) {
  this.items = [ new AudioControlItem() ];
  $audio = audio;
  $q = q;
  
  $userConfig = userConfig;
  userConfig.onPersist('library', this.persist, this);
  userConfig.onThaw('library', this.thaw, this);

  $cueEngine = cueEngine;

  this.dragListeners = {
    itemMoved: function (e) {},
    orderChanged: function (e) {}
  };
  this.rawResources = [];
};

Library.prototype.populateWorkspace = function(entry)
{
  var pending = 1;
  var entries = [];

  var def = $q.defer();
  var library = this;

  var readEntries = function(reader) {
     reader.readEntries(function(results) {
       results.forEach(function (entry) {
         if (entry.isDirectory) {
           pending++;
           readEntries(entry.createReader());
         } else {
           entries.push(entry);
         }
       });
       pending--;
       if (pending == 0) {
         def.resolve(MapToResources(entries));
       }
    });
  };
  readEntries(entry.createReader());

  return def.promise.then(function (resources) { 
    library.rawResources.push.apply(library.rawResources, resources);
  });
}

Library.prototype.flush = function flush() {
  $userConfig.raiseDirty('library');
};

Library.prototype.persist = function persist() {
  var result =
    {
      items: this.items
        .filter(function (i) { return !i.isBuiltin; })
        .map(function (i) { return i.persist(); })
    };
  return result;
};

Library.prototype.thaw = function thaw(v) {
  if (v && v.items)
  {
    var library = this;
    this.items.push.apply(this.items, LibraryItem.thawItems(v.items));
    this.items.forEach(function (i) {
      if ('loadFromResource' in i)
      {
        var res = StageCue.arrayFind.call(library.rawResources, function (r) { return r.name == i.name; });
        if (!res) return;
        $q.when(i.loadFromResource(res)).finally();
      }
    });
  }
};

Library.prototype.addResource = function (resource, callback)
{
  var library = this;

  var i = new AudioItem();
  return $q.when(i.loadFromResource(resource)).then(function () {
    library.items.push(i);
    library.flush();
    return i;
  });
};

Library.prototype.removeAt = function (index)
{
  this.items.splice(index, 1);
  this.flush();
};

angular.module("stageCue").service("sc.library", ['sc.audio', '$q', 'sc.userConfig', Library]);
