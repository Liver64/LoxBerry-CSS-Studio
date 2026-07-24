(function (window) {
  'use strict';

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function hexToRgb(hex) {
    hex = String(hex || '#007aff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex || '007aff', 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (v) {
      return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    }).join('');
  }

  function adjustBrightness(hex, amount) {
    var rgb = hexToRgb(hex);
    return rgbToHex({ r: rgb.r + amount * 2.2, g: rgb.g + amount * 2.2, b: rgb.b + amount * 2.2 });
  }

  function rgba(hex, alpha, brightness) {
    var adjusted = adjustBrightness(hex, parseInt(brightness || 0, 10));
    var rgb = hexToRgb(adjusted);
    if (alpha >= 100) return adjusted;
    return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + (alpha / 100).toFixed(2) + ')';
  }

  function makeCssColorOpaque(value) {
    value = String(value || '').trim();
    if (!value) return value;

    var hex8 = value.match(/^#([0-9a-f]{8})$/i);
    if (hex8) return '#' + hex8[1].slice(0, 6).toLowerCase();

    var hex4 = value.match(/^#([0-9a-f]{4})$/i);
    if (hex4) {
      var h = hex4[1];
      return ('#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toLowerCase();
    }

    var rgbaMatch = value.match(/^rgba?\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
    if (rgbaMatch) {
      return 'rgb(' + Math.round(parseFloat(rgbaMatch[1])) + ', ' + Math.round(parseFloat(rgbaMatch[2])) + ', ' + Math.round(parseFloat(rgbaMatch[3])) + ')';
    }

    var hslaMatch = value.match(/^hsla?\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)/i);
    if (hslaMatch) {
      return 'hsl(' + hslaMatch[1].trim() + ', ' + hslaMatch[2].trim() + ', ' + hslaMatch[3].trim() + ')';
    }

    return value;
  }

  function normalizeHexColor(value) {
    value = String(value || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return '#' + value.slice(1).split('').map(function (c) { return c + c; }).join('').toLowerCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
    var rgb = value.match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgb) return rgbToHex({ r: parseInt(rgb[1], 10), g: parseInt(rgb[2], 10), b: parseInt(rgb[3], 10) }).toLowerCase();
    return '';
  }

  window.CFWDesignStudioColorUtils = Object.freeze({
    clamp: clamp,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    adjustBrightness: adjustBrightness,
    rgba: rgba,
    makeCssColorOpaque: makeCssColorOpaque,
    normalizeHexColor: normalizeHexColor
  });
}(window));
