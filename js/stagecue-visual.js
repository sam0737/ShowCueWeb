angular.module("stageCue").service("sc.visual", ['$q', function ($q) {
  var channelNodes = {};
  var screenNodes = {};

  this.go = function go(channel, item, config, endCallback, context)
  {
    if (item instanceof HtmlItem)
      return this.goHtml.apply(this, arguments);
    if (item instanceof VideoItem)
      return this.goVideo.apply(this, arguments);
    if (item instanceof VisualControlItem)
      return this.goControl.apply(this, arguments);
  }

  this.goHtml = function goControl(channel, item, config)
  {
    var def = $q.defer();
    def.resolve();
    return def.promise;
  };

  this.goVideo = function goControl(channel, item, config)
  {
    var def = $q.defer();
    def.resolve();
    return def.promise;
  };

  this.goControl = function goControl(channel, item, config)
  {
    var def = $q.defer();
    def.resolve();
    return def.promise;
  };

  this.stop = function stop(channel)
  {
    var c = channelNodes[channel.id];
    // c.playingClips.forEach(function (clip) { clip.source.stop(); });
  };

  this.addChannel = function addChannel(channel)
  {
    var c = channelNodes[channel.id] = 
    {
    };
  };

  this.removeChannel = function removeChannel(channel)
  {
    this.stop(channel);
    delete channelNodes[channel.id];
  };
}]);

