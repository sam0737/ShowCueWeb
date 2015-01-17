var stage = angular.module("stageCue", ["ui.sortable", 'bgDirectives', 'ngContextMenu', 'fileSystem']);

stage.controller("sc.app", ['$scope', 'sc.audio', 'sc.library',
function ($scope, audioService, library) {
  $scope.stageReady = false;

  $scope.setStageReady = function(workspaceEntry) { 
    $scope.$apply(function() {
      $scope.stageReady = true; 
      library.populateWorkspace(workspaceEntry);
    });
  }
}]);

stage.directive('modal', function () {
  return {
    templateUrl: 'js/modal.html',
    restrict: 'E',
    transclude: true,
    replace:true,
    scope:true,
    link: function postLink(scope, element, attrs) {
      scope.title = attrs.title;

      scope.$watch(attrs.visible, function(value){
        if(value == true)
          $(element).modal('show');
        else
          $(element).modal('hide');
      });

      $(element).on('shown.bs.modal', function(){
        scope.$apply(function(){
          scope.$parent[attrs.visible] = true;
        });
      });

      $(element).on('hidden.bs.modal', function(){
        scope.$apply(function(){
          scope.$parent[attrs.visible] = false;
        });
      });
    }
  };
});

stage.directive("drawAudio", function(){
  return {
    restrict: "A",
    link: function(scope, element, attrs){
      var e = element[0];
      var ctx = e.getContext('2d');
      e.width = $(e).width();
      e.height = $(e).height();

      scope.$watch(attrs.audioBuffer, function(buffer) {
        if (!buffer) return;
        var data = buffer.getChannelData(0);
        var W = e.width;
        var H = e.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgb(200, 200, 200)';
        ctx.moveTo(0, H);
        for (var i = 0; i <= W; i++) {
          y = H - Math.abs(data[parseInt(data.length * i / W )]) * H;
          ctx.lineTo(i, y);
        }
        ctx.lineTo(W, H);
        ctx.fill();
      });

      // canvas reset
      function reset(){
       element[0].width = element[0].width; 
      }

      function draw(lX, lY, cX, cY){
        // line from
        ctx.moveTo(lX,lY);
        // to
        ctx.lineTo(cX,cY);
        // color
        ctx.strokeStyle = "#4bf";
        // draw it
        ctx.stroke();
      }
    }
  };
});

function initStage(workspaceEntry)
{
  angular.element($('html')[0]).scope().setStageReady(workspaceEntry);
}
