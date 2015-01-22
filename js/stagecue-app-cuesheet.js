angular.module("stageCue").controller("sc.app.cueSheet", ['$scope', '$q', 'sc.cueEngine', '$document', '$modal', '$modalStack',
function ($scope, $q, cueEngine, $document, $modal, $modalStack) {
  $scope.cues = cueEngine.cues;
  $scope.channels = cueEngine.channels;
  $scope.engine = cueEngine;

  $scope.go = function go() {
    cueEngine.go();
  };
  $scope.stop = function stop() {
    cueEngine.stop();
  };

  $scope.channelDragOptions = {
    accept: function (sourceItemHandleScope, destSortableScope) {
      if (cueEngine.running) return false;
      return sourceItemHandleScope.itemScope.sortableScope.$id == destSortableScope.$id;
    },
    orderChanged: function (e) {
      cueEngine.channelReordered(e.source.index, e.dest.index);
    }
  }
  $scope.cueDragOptions = {
    accept: function (sourceItemHandleScope, destSortableScope) {
      if (cueEngine.running) return false;
      return sourceItemHandleScope.itemScope.sortableScope.$id == destSortableScope.$id;
    }
  };
  $scope.cueItemDragOptions = {
    accept: function (sourceItemHandleScope, destSortableScope) {
      if (cueEngine.running) return false;
      return sourceItemHandleScope.itemScope.sortableScope.$id == destSortableScope.$id;
    },
    orderChanged: function (e) {
      e.dest.sortableScope.$parent.c.itemReordered(e.source.index, e.dest.index);
      cueEngine.flush();
    }
  };
  $scope.addShowChannel = function addShowChannel() {
    cueEngine.addChannel(new ShowChannel());
  };
  $scope.setCurrentAt = function setCurrentAt(index) {
    cueEngine.setCurrentAt(index);
  };
  $scope.removeChannelAt = function removeChannelAt(index) {
    cueEngine.removeChannelAt(index);
  };
  $scope.removeCueAt = function removeCueAt(index) {
    cueEngine.removeCueAt(index);
  };
  $scope.duplicateCue = function duplicateCue() {
    cueEngine.duplicateCue();
  }
  $scope.moveCueUp = function moveCueUp(index) {
    cueEngine.moveCueAt(index, -1);
  };
  $scope.moveCueDown = function moveCueDown(index) {
    cueEngine.moveCueAt(index, +1);
  };
  $scope.removeCueItemAt = function removeCueItemAt(cueIndex, index) {
    cueEngine.removeCueItemAt(cueIndex, index);
  };
  $scope.showDescriptionField = function showDescriptionField() {
    var index = cueEngine.current;
    if (index < 0 || index >= cueEngine.cues.length) return;
    // TODO.
  };
  $scope.flush = function flush() {
      cueEngine.flush();
  };

  $scope.cueConfig = null;
  $scope.config = null;
  $scope.target = null;

  $scope.configureActiveCueItem = function configureActiveCueItem() {
    var index = cueEngine.current;
    if (index < 0 || index >= cueEngine.cues.length) return;
    var cue = cueEngine.cues[index];
    for (var i = 0; i < cue.items.length; i++)
    {
      if (cue.items[i] instanceof LibraryItem) {
        $scope.configureCueItem(cue, i);
        return;
      }
    }
  };

  $scope.configureChannel = function configureChannel(channel) {
    if (cueEngine.running) return;

    $scope.target = channel;
    var c = $scope.config = channel.persist();
    c.screen = channel.screen;

    $modal.open({
      templateUrl: 'partials/configure-' + channel.type + '-channel-modal.html',
      scope: $scope
    }).result.then(function () { 
      channel.thaw(c, cueEngine.screens); 
      cueEngine.reapplyChannels(); 
      cueEngine.flush(); 
    });
  };

  $scope.newScreenForChannel = function newScreenForChannel() {
    var screen = new Screen();
    $scope.configureScreen(screen).then(function () {
      cueEngine.addScreen(screen);
      $scope.config.screen = screen;
      $scope.config.screenId = screen.id;
    });
  };

  $scope.configureScreen = function configureScreen(screen) {
    return $modal.open({
      templateUrl: 'partials/configure-screen-modal.html',
      controller: 'sc.app.configure.screen',
      resolve: {
        screen: function() { return screen; }
      }
    }).result.then(function () {
      cueEngine.reapplyChannels(); 
      cueEngine.flush(); 
      return screen;
    });      
  };

  $scope.reapplyChannels = function reapplyChannels() {
    cueEngine.reapplyChannels();
  };

  $scope.configureCueItem = function configureCueItem(cue, itemIndex) {
    if (!(cue.items[itemIndex] instanceof LibraryItem)) 
      return;
    var c = $scope.cueConfig = cue.persist();
    $scope.target = cue.items[itemIndex];
    $scope.config = c.configs[itemIndex];
    $modal.open({
      templateUrl: 'partials/configure-' + $scope.target.type + '-item-modal.html',
      scope: $scope
    }).result.then(function () { cue.thaw(c); cueEngine.flush(); });      
  };

  $document.on('keydown', ':not(input)', function(e) {
    if (!$(e.target).is(':not(input)'))
      return;
    var processed = function() {
      if ($modalStack.getTop()) return false;
      switch (e.keyCode)
      {
        case 13: // Enter
          if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.configureActiveCueItem();
          else return false;
          break;
        case 32: // Space
          if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.go();
          else return false;
          break;
        case 27: // Esc
          if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.stop();
          else return false;
          break;
        case 68: // D (Duplicate)
          if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.duplicateCue();
          else return false;
          break;
        case 113: // F2
          if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.showDescriptionField();
          else return false;
          break;
        case 38: // Up
          if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey)
            $scope.moveCueUp(cueEngine.current);
          else if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.setCurrentAt(cueEngine.current - 1);
          else return false;
          break;
        case 40: // Down
          if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey)
            $scope.moveCueDown(cueEngine.current);
          else if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.setCurrentAt(cueEngine.current + 1);
          else return false;
          break;
        case 46: // Delete
          if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
            $scope.removeCueAt(cueEngine.current);
          else return false;
          break;
        default:
          return false;
      }
      return true;
    }();
    if (processed) {
      e.preventDefault();
      e.stopPropagation();
      $scope.$apply();
    }
  });
}]);

angular.module("stageCue").controller("sc.app.configure.screen", ['$scope', '$modalInstance', 'screen',
function ($scope, $modalInstance, screen) {
  $scope.target = screen;
  $scope.config = screen.persist();

  $scope.ok = function () {
    screen.thaw($scope.config); 
    $modalInstance.close();
  };
}]);
