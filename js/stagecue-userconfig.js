var $fileSystem;
function UserConfig(fileSystem)
{
  $fileSystem = fileSystem;   
  fileSystem.requestQuota(10);
}

UserConfig.prototype.readConfig = function readConfig(key)
{
  return $fileSystem.readFile("stagecue-" + key).then(function (v) {
      console.debug('Config ' + key + ' loaded');
      v = JSON.parse(v);
      console.debug('Saved ' + key + ' parsed');
      return v;
  }).catch(function(e) { console.info('Failed to read config ' + key, e); });
};

UserConfig.prototype.saveConfig = function saveConfig(key, value)
{
  $fileSystem.writeText("stagecue-" + key, value)
    .catch(function(e) { console.warn('Failed to save config ' + key, e); });
};

angular.module("stageCue").service("sc.userConfig", ['fileSystem', UserConfig]);
