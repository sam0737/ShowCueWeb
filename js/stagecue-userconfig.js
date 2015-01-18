var $fileSystem;
var $q;

function UserConfig(q, fileSystem)
{
  $q = q;
  $fileSystem = fileSystem;   
  fileSystem.requestQuota(10);
  this.filename = 'stagecue-default';
  this.data = {};
  this.persistCallbacks = {};
  this.thawCallbacks = [];
  this.dirty = false;
  this.dirtyKeys = {};
}

UserConfig.prototype.setPrefix = function setPrefix(prefix)
{
  this.filename = 'stagecue-' + prefix;
}

UserConfig.prototype.readConfig = function readConfig(filename)
{
  return $fileSystem.readFile(filename).then(function (v) {
      console.debug('Config ' + filename + ' loaded');
      v = JSON.parse(v);
      console.debug('Saved ' + filename + ' parsed');
      return v;
  }).catch(function(e) { console.info('Failed to read config ' + filename, e); });
};

UserConfig.prototype.saveConfig = function saveConfig(filename, value)
{
  return $fileSystem.writeText(filename, JSON.stringify(value))
      .then(function (e) { console.debug('Config ' + filename + ' saved') })
      .catch(function(e) { console.warn('Failed to save config ' + filename, e); });
};

UserConfig.prototype.onPersist = function onPersist(key, callback, context)
{
  this.dirtyKeys[key] = 1;
  this.persistCallbacks[key] = function () { return callback.call(context); };
}

UserConfig.prototype.onThaw = function onThaw(key, callback, context)
{
  this.thawCallbacks.push(
  {
    key: key,
    callback: function (v) { return callback.call(context, v); }
  });
}

UserConfig.prototype.thaw = function thaw()
{
  var uc = this;
  var p =
    $q.when(this.readConfig(this.filename))
      .then(function (v) {
        if (v != null) uc.data = v;
        for (var i = 0; i < uc.thawCallbacks.length; i++)
        {
          var exists = v != null && uc.thawCallbacks[i].key in v;
          uc.thawCallbacks[i].callback(
            exists ? v[uc.thawCallbacks[i].key] : undefined
          );
        }
      });
  return p;
}

UserConfig.prototype.raiseDirty = function raiseDirty(key)
{
  this.dirty = true;
  this.dirtyKeys[key] = 1;
  this.save();
}

UserConfig.prototype.save = function save()
{
  this.dirty = false;
  for (var key in this.dirtyKeys)
  {
    this.data[key] = this.persistCallbacks[key]();
  }
  this.dirtyKeys = {};
  return UserConfig.prototype.saveConfig(this.filename, this.data);
}

UserConfig.prototype.reset = function reset()
{
  var uc = this;
  return $fileSystem.deleteFile(uc.filename)
      .then(function (e) { console.debug('Config ' + uc.filename + ' deleted') })
      .catch(function(e) { console.warn('Failed to delete config ' + uc.filename, e); });
}

angular.module("stageCue").service("sc.userConfig", ['$q', 'fileSystem', UserConfig]);
