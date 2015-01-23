var $q;
var $userConfig;
var $renderer;
var $cueEngine;

function FileResource(fileEntry)
{
  this.entry = fileEntry;
  this.name = fileEntry.name;
};

FileResource.prototype.readAsBlob = function readAsBlob() {
  var def = $q.defer();
  this.entry.file(function (file) {
    def.resolve(file);
  }, def.reject);
  return def.promise;
};

FileResource.prototype.readAsAudioBuffer = function readAsAudioBuffer() {
  var def = $q.defer();
  this.entry.file(function (file) {
    var reader = new FileReader();

    reader.onload = function(e) {
      $renderer.decodeAudioData(reader.result, 
        function (buffer) {
          def.resolve(buffer);
        }, 
        def.reject
      );
    };
    reader.onerror = def.reject;
    reader.readAsArrayBuffer(file);
  }, def.reject);
  return def.promise;
};

FileResource.prototype.readAsText = function readAsText() {
  var def = $q.defer();
  this.entry.file(function (file) {
    var reader = new FileReader();

    reader.onload = function(e) {
      def.resolve(reader.result);
    };
    reader.onerror = def.reject;
    reader.readAsText(file);
  }, def.reject);
  return def.promise;
};

function LibraryItem() {
  this.id = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  this.isBuiltin = false;
  this.previewing = false;
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
  return StageCue.thawItemsByType(values, [AudioItem, VideoItem, ImageItem, HtmlItem]);
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

  return $q.when(resource.readAsAudioBuffer())
    .then(function (buffer) { item.buffer = buffer; })
    .catch(function (result) { console.log('Failed to load as audio', resource.name, result); });
};

BlobItem.prototype = new LibraryItem();
BlobItem.prototype.constructor = BlobItem;
function BlobItem() {
  LibraryItem.prototype.constructor.apply(this);  
}
BlobItem.prototype.loadFromResource = function loadFromResource(resource) {
  this.name = resource.name;
  var item = this;

  return $q.when(resource.readAsBlob())
    .then(function (blob) { 
      item.blob = blob; 
      item.blobUrl = URL.createObjectURL(item.blob); 
    })
    .catch(function (result) { console.log('Failed to load file', resource.name, result); });
};
BlobItem.prototype.destroy = function destroy() {
  if (this.blobUrl)
    URL.revokeObjectURL(this.blobUrl);
};

VideoItem.prototype = new BlobItem();
VideoItem.prototype.type = 'video';
VideoItem.prototype.constructor = VideoItem;
function VideoItem() {
  BlobItem.prototype.constructor.apply(this);  
}
VideoItem.prototype.loadFromResource = function loadFromResource(resource) {
  var item = this;
  return $q.when(BlobItem.prototype.loadFromResource.apply(this, arguments))
    .then(function () {
      var node = $('<video>');
      node.one('loadedmetadata', function() { 
        item.width = node[0].videoWidth;
        item.height = node[0].videoHeight;
      });
      node[0].src = item.blobUrl;
      node[0].preload = 'metadata';
    });
};

ImageItem.prototype = new BlobItem();
ImageItem.prototype.type = 'image';
ImageItem.prototype.constructor = ImageItem;
function ImageItem() {
  BlobItem.prototype.constructor.apply(this);  
}
ImageItem.prototype.loadFromResource = function loadFromResource(resource) {
  var item = this;
  return $q.when(BlobItem.prototype.loadFromResource.apply(this, arguments))
    .then(function () {
      var node = $('<img>');
      node.one('load', function() { 
        item.width = node[0].naturalWidth;
        item.height = node[0].naturalHeight;
      });
      node[0].src = item.blobUrl;
    });
};

HtmlItem.prototype = new BlobItem();
HtmlItem.prototype.type = 'html';
HtmlItem.prototype.constructor = HtmlItem;
function HtmlItem() {
  BlobItem.prototype.constructor.apply(this);  
}

AudioControlItem.prototype = new LibraryItem();
AudioControlItem.prototype.type = 'audio-control';
AudioControlItem.prototype.constructor = AudioControlItem;
function AudioControlItem(resource, callback) {
  LibraryItem.prototype.constructor.apply(this);  
  this.name = '[Audio Control]';
  this.id = '__audio-control';
  this.isBuiltin = true;
};

VisualControlItem.prototype = new LibraryItem();
VisualControlItem.prototype.type = 'visual-control';
VisualControlItem.prototype.constructor = VisualControlItem;
function VisualControlItem(resource, callback) {
  LibraryItem.prototype.constructor.apply(this);  
  this.name = '[Visual Control]';
  this.id = '__visual-control';
  this.isBuiltin = true;
};

function Library(renderer, q, userConfig, cueEngine) {
  this.items = [ new AudioControlItem(), new VisualControlItem() ];
  $renderer = renderer;
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
        var res = this.findResourceByName(i.name);
        if (!res) return;
        $q.when(i.loadFromResource(res)).finally();
      }
    }, this);
  }
};

Library.prototype.findResourceByName = function (name)
{
  return StageCue.arrayFind.call(this.rawResources, function (r) { return r.name == name; });
};

Library.prototype.addResource = function (resource)
{
  var library = this;

  var i = 
    /\.(?:ogv|mp4|avi|webm|wbm|3gp)$/.test(resource.name) ? new VideoItem() :
    /\.(?:htm|html)$/.test(resource.name) ? new HtmlItem() :
    /\.(?:png|jpg|gif)$/.test(resource.name) ? new ImageItem() :
    new AudioItem();
  return $q.when(i.loadFromResource(resource)).then(function () {
    library.items.push(i);
    library.flush();
    return i;
  });
};

Library.prototype.replaceResource = function (resource, item)
{
  var library = this;
  return $q.when(item.loadFromResource(resource)).then(function () {
    library.flush();
    return item;
  });
};

Library.prototype.removeAt = function (index)
{
  var removedItems = this.items.splice(index, 1);
  removedItems.forEach(function (i) { if (i.destroy) i.destroy(); });
  this.flush();
};

angular.module("stageCue").service("sc.library", ['sc.renderer', '$q', 'sc.userConfig', Library]);
