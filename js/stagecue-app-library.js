angular.module("stageCue").controller("sc.app.library", ['$scope', '$q', 'sc.renderer', 'sc.library', 'sc.cueEngine', '$modal',
function ($scope, $q, renderer, library, cueEngine, $modal) {
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

  var modal;
  $scope.showAddResource = function() {
    renderer.stopPreview();
    modal = $modal.open({
      templateUrl: 'partials/add-resource-modal.html',
      scope: $scope,
    });
  };

  $scope.addResource = function(resource)
  {
    $scope.isResourceLoading = true;
    $q.when(library.addResource(resource)).finally(function() { 
      modal.close();
      $scope.isResourceLoading = false;
    });
  };

  $scope.replaceTarget = null;
  $scope.showReplace = function(item) {
    renderer.stopPreview();
    $scope.replaceTarget = item;
    modal = $modal.open({
      templateUrl: 'partials/replace-resource-modal.html',
      scope: $scope,
    });
  };

  $scope.replaceResource = function(resource)
  {
    $scope.isResourceLoading = true;
    $q.when(library.replaceResource(resource, $scope.replaceTarget)).finally(function() { 
      modal.close();
      $scope.isResourceLoading = false;
    });
  }

  $scope.itemPreviewing = 0;
  $scope.stopPreview = function() {
    renderer.stopPreview();
  };

  $scope.removeAt = function(index) {
    library.removeAt(index);
  };

  $scope.preview = function(item) { 
    if (!(item instanceof AudioItem))
      return;
    $scope.itemPreviewing++;
    item.previewing++;
    renderer.preview(item, function() { 
      $scope.$apply(function() { 
        if ($scope.itemPreviewing > 0) $scope.itemPreviewing--;
        if (item.previewing > 0) item.previewing--; 
      });
    }); 
  };
  
  $scope.addToCueSheet = function (item)
  {
    cueEngine.addCue(item);
  };
}]);

