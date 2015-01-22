var stage = angular.module("stageCue", ["ui.sortable", 'bgDirectives', 'ngContextMenu', 'fileSystem', 'xeditable', 'ui.bootstrap']);

var StageCue = StageCue || {};
StageCue.thawItemsByType = function thawItemsByType(values, types) {
  var typeMap = [];
  var remainingArguments = Array.prototype.slice.call(arguments, 2);
  types.forEach(function (i) { typeMap[i.prototype.type] = i; });
  var results = 
    values
      .filter(function (v) { return !('type' in v) || v.type in typeMap; })
      .map(function (v) { 
        if (!('type' in v)) return {};
        var item = new typeMap[v.type];
        item.thaw.apply(item, [v].concat(remainingArguments));
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

StageCue.raiseJsonDownloadPrompt = function raiseJsonDownloadPrompt(filename, text)
{
  var uriContent = "data:application/json;charset=utf-8;filename="+filename+"," + encodeURIComponent(text);
  window.open(uriContent);
}

stage.run(function(editableThemes, editableOptions) {
  editableOptions.theme = 'bs3'; // bootstrap3 theme. Can be also 'bs2', 'default'
  editableThemes.bs3.inputClass = 'input-sm';
  editableThemes.bs3.buttonsClass = 'btn-sm';  
});

stage.controller("sc.app", ['$q', '$scope', '$timeout', 'sc.userConfig', 'sc.library', 'sc.cueEngine', '$modal',
function ($q, $scope, $timeout, userConfig, library, cueEngine, $modal) {
  $scope.resetConfig = function() {    
    $modal.open({
      templateUrl: 'partials/reset-config-modal.html',
      scope: $scope,
    }).result.then(function () { userConfig.reset(); });
  };
  $scope.downloadConfig = function() {
    StageCue.raiseJsonDownloadPrompt('config.js', JSON.stringify(userConfig.data));
  };

  $scope.cueEngine = cueEngine;
  $scope.stageReady = false;

  $scope.setStageReady = function(workspaceEntry) { 
    $timeout(function() { $scope.stageReady = true; });
    $timeout(function() {
      $q
        .when(library.populateWorkspace(workspaceEntry))
        .then(function() { 
          var res = library.findResourceByName('config.js');
          var configData = null;
          if (res) {
            console.debug("config.js found in workspace and will be used instead");
            res.readAsText()
              .then(function (result) { configData = result; })
              .catch(function () { console.debug("Failed to read config.js"); })
              .finally(function() { userConfig.thaw(configData); });
          } else {
            userConfig.thaw(); 
          }
        })
    });
  }
}]);

var OPTIONAL_NON_NEG_FLOAT_REGEXP = /^[0-9]+(\.[0-9]+)?$|^\.[0-9]+$|^\s*$/;
stage.directive('cuefloat', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.cuefloat = function(modelValue, viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return true;
        if (OPTIONAL_NON_NEG_FLOAT_REGEXP.test(viewValue)) {
          return true;
        }

        return false;
      };
      ctrl.$parsers.push(function (viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return null;
        return parseFloat(viewValue);
      });
    }
  };
});

var OPTIONAL_NON_NEG_FLOAT_PERCENT_REGEXP = /^[0-9]+(\.[0-9]+)?%?$|^\.[0-9]+%?$|^\s*$/;
stage.directive('cuefloatPercent', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.cuefloat = function(modelValue, viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return true;
        if (OPTIONAL_NON_NEG_FLOAT_PERCENT_REGEXP.test(viewValue)) {
          return true;
        }

        return false;
      };
      ctrl.$parsers.push(function (viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return null;
        return viewValue;
      });
    }
  };
});

var OPTIONAL_POSITION_STRING = /^(?:(?:left|center|right)(?:[+-][0-9.]+%?)?)?(?:\s*\b(?:top|center|bottom)(?:[+-][0-9.]+%?)?)?$/i;
stage.directive('positionString', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.cuefloat = function(modelValue, viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return true;
        if (OPTIONAL_POSITION_STRING.test(viewValue)) {
          return true;
        }

        return false;
      };
      ctrl.$parsers.push(function (viewValue) {
        if (ctrl.$isEmpty(viewValue))
          return null;
        return viewValue;
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

      scope.$watchGroup([attrs.audioBuffer, attrs.widthRatio], function(values) {
        var buffer = values[0];
        var widthRatio = values[1];
        if (!buffer) return;
        var data = buffer.getChannelData(0); // TODO: Draw at least two channel

        if (widthRatio != null) {
          var newWidth = buffer.duration * widthRatio;
          $(e).width(newWidth);
          e.width = newWidth;
        }

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

stage.directive("drawPicker", ['$document', function($document){
  return {
    restrict: "A",
    link: function(scope, element, attrs){
      var e = element[0];
      var ctx = e.getContext('2d');

      var picks = null;
      var duration = null;

      var pickTarget = null;

      function pixelToTime(value) {
        return value * duration / e.width;
      };

      var dragging = null;
      var fnMouseup = function(e) {
        if (pickTarget == null) return;
        pickTarget = null;
        dragging = null;
        e.preventDefault();
        e.stopPropagation();
      };
      var fnMousedown = function(e) {
        if (!angular.isArray(picks) || !duration) return;
        var time = pixelToTime(e.offsetX);
        time = Math.min(Math.max(time, 0), duration);

        if (pickTarget == null)
        {
          if (picks.length == 1) {
            pickTarget = 0;
          } else if (picks.length == 2) {
            if (picks[0] == null || picks[1] == null) {
              picks[0] = time;
              pickTarget = 1;              
            } else if (time <= picks[0]) {
              pickTarget = 0;
            } else if (time >= picks[1]) {
              pickTarget = 1;
            } else {
              pickTarget = time <= (picks[0] + picks[1]) / 2 ? 0 : 1;
            }
          }
          dragging = { clientX: e.clientX, offsetX: e.offsetX }
          fnMousemove(e);
          e.preventDefault();
          e.stopPropagation();
        }
      };
      var fnMousemove = function(e) {
        scope.$apply(function() { 
          var time = pixelToTime(e.clientX - element.offset().left);
          time = Math.min(Math.max(time, 0), duration);
          scope.graphCursorTime = time;

          if (dragging == null || pickTarget == null) return;
          if (!angular.isArray(picks) || !duration) return;

          if (picks.length == 2)
          {
            if (pickTarget == 1 && time < picks[0]) { picks[1] = picks[0]; pickTarget = 0; }
            if (pickTarget == 0 && time > picks[1]) { picks[0] = picks[1]; pickTarget = 1; }
          }

          picks[pickTarget] = time;
          redrawLine();
          e.preventDefault();
          e.stopPropagation();
        });
      };

      $document.on('mouseup', fnMouseup);
      element.on('mousedown', fnMousedown);
      $document.on('mousemove', fnMousemove);

      scope.$on('$destroy', function () {
        $document.off('mouseup', fnMouseup);
        element.off('mousedown', fnMousedown);
        $document.off('mousemove', fnMousemove);
      });

      function redrawLine()
      {
        var W = e.width;
        var H = e.height;
        ctx.clearRect(0, 0, W, H);

        if (!angular.isArray(picks) || !duration) return;
        if (picks.length == 1)
        {
          if (picks[0] != null)
          {
            var x = W * picks[0] / duration;
            ctx.beginPath();
            ctx.strokeStyle = "#FF0000";
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
          }
        } else if (picks.length == 2)
        {
          if (picks[0] != null && picks[1] != null)
          {
            var x1 = W * picks[0] / duration;
            var x2 = W * picks[1] / duration;
            ctx.beginPath();
            ctx.fillStyle = "rgba(255,128,128,0.5)";
            ctx.moveTo(x1, 0);
            ctx.lineTo(x1, H);
            ctx.lineTo(x2, H);
            ctx.lineTo(x2, 0);
            ctx.fill();
          }
        }
      }

      scope.$watch(attrs.picks, function(value) { picks = value; redrawLine(); });

      scope.$watchGroup([attrs.duration, attrs.widthRatio], function(values) {
        duration = values[0];
        var widthRatio = values[1];
        if (!duration) return;
        if (widthRatio == null) return;

        var newWidth = duration * widthRatio;
        $(e).width(newWidth);
        e.width = newWidth;
        redrawLine();
      });
    }
  };
}]);

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

stage.directive('bufferTimePicker', ['$modal', '$filter', function($modal, $filter) {
  return {
    restrict: 'A',
    require: 'ngModel',
    scope: true,
    link: function($scope, elm, attrs, ctrl) {
      $scope.widthRatio = 10;
      $scope.graphCursorTime = 0;

      $scope.picks = [];
      $scope.graphPicks = [];
      ctrl.$render = function () {
        $scope.picks = angular.isArray(ctrl.$modelValue) ? ctrl.$modelValue : [ ctrl.$modelValue ];
      };      

      $scope.$pick = function () {
        $scope.graphPicks = [].concat($scope.picks);
        $modal.open({
          templateUrl: 'partials/buffer-time-picker-modal.html',
          scope: $scope
        }).result.then(function (value) { 
          for (var i = 0; i < $scope.graphPicks.length; i++)
          {
            $scope.picks[i] = $filter('number')($scope.graphPicks[i], 2);
          }
        });
      };
    }
  };
}]);

$(function(){
    $.extend($.fn.disableTextSelect = function() {
        return this.each(function(){
            $(this).css('MozUserSelect','none');
            $(this).bind('selectstart',function(){return false;});
            $(this).mousedown(function(){return false;});
        });
    });
    $('.no-select').disableTextSelect();//No text selection on elements with a class of 'noSelect'
});

