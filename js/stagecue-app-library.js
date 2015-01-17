angular.module("stageCue").controller("sc.app.library", ['$scope', '$q', 'sc.audio', 'sc.library',
function ($scope, $q, audio, library) {
  $scope.rawResources = library.rawResources;
  $scope.items = library.items;

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

  $scope.remove = function(item) {
    library.remove(item);
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
  
  $scope.libraryDragOptions = {};
  $scope.addResource = function(resource)
  {
    $scope.isAddResourceLoading = true;
    $q.when(library.addResource(resource)).finally(function() { 
      $scope.isAddResourceLoading = false;
      $scope.isAddResourceVisible = false;
    });
  };
}]);

