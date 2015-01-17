var $q;
var $fileSystem;
var $audio;

Array.prototype.scFind = function find(callback, thisArg)
{
  for (var i = 0; i < this.length; i++) {
    if (callback.call(thisArg, this[i])) return this[i];
  }
  return undefined;
}

function FileResource(fileEntry)
{
  this.entry = fileEntry;
  this.name = fileEntry.name;
};

function LibraryItem() {
  this.type = null;
  this.id = Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  this.isBuiltin = false;
}

LibraryItem.prototype.persist = function persist() {
  return { type: this.type, name: this.name, id: this.id };
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
AudioItem.prototype.constructor = AudioItem;
function AudioItem() {
  this.type = 'audio';
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

FadeItem.prototype = new LibraryItem();
FadeItem.prototype.constructor = FadeItem;
function FadeItem(resource, callback) {
  this.type = 'fade';
  this.isBuiltin = true;
};

function Library(audio, q, fileSystem) {
  this.items = [ new FadeItem() ];
  $audio = audio;
  $q = q;
  $fileSystem = fileSystem;

  fileSystem.requestQuota(10);

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

  def.promise.then(function (resources) { 
    library.rawResources.push.apply(library.rawResources, resources);

    $fileSystem.readFile("stagecue-library.js").then(function (v) {
      console.debug('Saved settings loaded');
      v = JSON.parse(v);
      console.debug('Saved settings parsed');
      if (v && v.items) {
        v.items.forEach(function (c) {
          if (c.type === 'audio') {

            var i = new AudioItem();
            i.name = c.name;

            library.items.push(i);
            var res = library.rawResources.scFind(function (r) { return r.name == c.name; });
            if (!res) return;
            $q.when(i.loadFromResource(res)).finally();
          }
        });
      }
    }, function (err) {
      console.info('Failed to load saved settings', err);
    });
  });
}

Library.prototype.flush = function flush() {
  $fileSystem.writeText("stagecue-library.js", 
    JSON.stringify(
      {
        items: this.items
          .filter(function (i) { return !i.isBuiltin; })
          .map(function (i) { return i.persist(); })
      }
    )
  ).catch(function(e) { console.log('Failed to flush', e); });
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

Library.prototype.remove = function (item)
{
  var i = this.items.indexOf(item);
  if (i > -1) {
    this.items.splice(i, 1);
    this.flush();
  }
};

angular.module("stageCue").service("sc.library", ['sc.audio', '$q', 'fileSystem', Library]);
