angular.module("stageCue").controller("sc.app.library", ['$scope', '$q', 'sc.audio', 'sc.library', 'sc.cueEngine', 
function ($scope, $q, audio, library, cueEngine) {
  $scope.rawResources = library.rawResources;
  $scope.items = library.items;
  $scope.libraryDragOptions = {
    accept: function (sourceItemHandleScope, destSortableScope) {
      return sourceItemHandleScope.itemScope.sortableScope.$id == destSortableScope.$id;
    },
    orderChanged: function (e) {
      library.flush();
    }
  }

  $scope.addLibraryLoading = false;
  $scope.isAddResourceVisible = false;
  $scope.showAddResource = function() {
    audio.stopPreview();
    $scope.isAddResourceVisible = true; 
  };

  $scope.itemPreviewing = 0;
  $scope.stopPreview = function() {
    audio.stopPreview();
  };

  $scope.removeAt = function(index) {
    library.removeAt(index);
  };

  $scope.preview = function(item) { 
    $scope.itemPreviewing++;
    item.previewing++;
    audio.preview(item, function() { 
      $scope.$apply(function() { 
        if ($scope.itemPreviewing > 0) $scope.itemPreviewing--;
        if (item.previewing > 0) item.previewing--; 
      });
    }); 
  };
  
  $scope.addResource = function(resource)
  {
    $scope.isAddResourceLoading = true;
    $q.when(library.addResource(resource)).finally(function() { 
      $scope.isAddResourceLoading = false;
      $scope.isAddResourceVisible = false;
    });
  };
  
  $scope.addToCueSheet = function (item)
  {
    cueEngine.addCue(item);
  };
}]);

