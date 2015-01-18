angular.module("stageCue").controller("sc.app.cueSheet", ['$scope', '$q', 'sc.cueEngine', '$document',
function ($scope, $q, cueEngine, $document) {
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
  $scope.addAudioChannel = function addAudioChannel() {
    cueEngine.addChannel(new AudioChannel());
  };
  $scope.addHtmlChannel = function addHtmlChannel() {
    cueEngine.addChannel(new HtmlChannel());
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

  $document.on('keydown', ':not(input)', function(e) {
    var processed = function() {
      if (e.keyCode == 32) { // Space
        if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.go();
        else return false;
        return true;
      }
      else if (e.keyCode == 27) { // Esc
        if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.stop();
        else return false;
        return true;
      }
      else if (e.keyCode == 113) { // F2
        if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.showDescriptionField();
        else return false;
        return true;
      }
      else if (e.keyCode == 38) { // Up
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey)
          $scope.moveCueUp(cueEngine.current);
        else if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.setCurrentAt(cueEngine.current - 1);
        else return false;
        return true;
      }
      if (e.keyCode == 40) { // Down
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey)
          $scope.moveCueDown(cueEngine.current);
        else if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.setCurrentAt(cueEngine.current + 1);
        else return false;
        return true;
      }
      if (e.keyCode == 46) { // Delete
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey)
          $scope.removeCueAt(cueEngine.current);
        else return false;
        return true;
      }
      return false;
    }();
    if (processed) {
      e.preventDefault();
      e.stopPropagation();
      $scope.$apply();
    }
  });
}]);

