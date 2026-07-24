(function (window) {
  'use strict';

  var BRIGHTNESS_MIN = 85;
  var BRIGHTNESS_MAX = 140;
  var OPACITY_MIN = 85;
  var OPACITY_MAX = 100;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function sliderPercentToRange(value, min, max) {
    var percent = clamp(parseFloat(value == null ? 100 : value), 0, 100);
    return Math.round((min + ((max - min) * percent / 100)) * 10) / 10;
  }

  function rangeToSliderPercent(value, min, max) {
    var actual = clamp(parseFloat(value == null ? max : value), min, max);
    if (max === min) return 100;
    return Math.round(((actual - min) / (max - min)) * 100);
  }

  window.CFWDesignStudioWallpaperRange = Object.freeze({
    BRIGHTNESS_MIN: BRIGHTNESS_MIN,
    BRIGHTNESS_MAX: BRIGHTNESS_MAX,
    OPACITY_MIN: OPACITY_MIN,
    OPACITY_MAX: OPACITY_MAX,
    sliderPercentToRange: sliderPercentToRange,
    rangeToSliderPercent: rangeToSliderPercent
  });
}(window));
