var stage = angular.module("stageCue", ["ui.sortable", 'bgDirectives', 'ngContextMenu', 'fileSystem', 'xeditable']);

var StageCue = StageCue || {};
StageCue.thawItemsByType = function thawItemsByType(values, types) {
  var typeMap = [];
  types.forEach(function (i) { typeMap[i.prototype.type] = i; });
  var results = 
    values
      .filter(function (v) { return !('type' in v) || v.type in typeMap; })
      .map(function (v) { 
        if (!('type' in v)) return {};
        var item = new typeMap[v.type];
        item.thaw(v);
        return item;
      });
  return results;
};

StageCue.arrayFind = function arrayFind(callback, thisArg)
{
  for (var i = 0; i < this.length; i++) {
    if (callback.call(thisArg, this[i])) return this[i];
  }
  return undefined;
};


stage.run(function(editableThemes, editableOptions) {
  editableOptions.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
  editableThemes.bs3.inputClass = 'input-sm';
  editableThemes.bs3.buttonsClass = 'btn-sm';  
});

stage.controller("sc.app", ['$q', '$scope', '$timeout', 'sc.audio', 'sc.library', 'sc.cueEngine',
function ($q, $scope, $timeout, audioService, library, cueEngine) {
  $scope.stageReady = false;

  $scope.setStageReady = function(workspaceEntry) { 
    $timeout(function() { $scope.stageReady = true; });
    $timeout(function() {
      $q
        .when(library.populateWorkspace(workspaceEntry))
        .then(function() { cueEngine.thaw(library.items) });
    });
  }
}]);

stage.directive('modal', function () {
  return {
    templateUrl: 'partials/modal.html',
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

stage.directive('scrollIntoViewIf', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      scope.$watch(attrs.scrollIntoViewIf, function action(value) {
        if (value) {
          var pos = element.position().top;
          var height = element.outerHeight();
          var parent = element.scrollParent();
          if (pos < 0) {
            parent.scrollTop(parent.scrollTop() + pos - height);
          } else {
            if (pos + height > parent.innerHeight())
            {
              parent.scrollTop(parent.scrollTop() + pos - height);
            }
          }
        }
      });
    }
  }
});

function initStage(workspaceEntry)
{
  angular.element($('html')[0]).scope().setStageReady(workspaceEntry);
}
