/* ============================================================================
 * LoxBerry CSS Framework Studio - optional Liquid Glass Preview runtime
 * ----------------------------------------------------------------------------
 * Progressive enhancement for the shared Preview page.
 *
 * - The Preview remains fully styled and usable through CSS when this file is
 *   absent, blocked or JavaScript is disabled.
 * - The renderer includes this file only when the CSS Framework Studio is
 *   installed and the file exists.
 * - Sonos4Lox is intentionally independent and is not referenced here.
 * - The runtime activates only for theme-user-liquid-glass/theme-liquid-glass.
 * - Live theme changes are observed and all generated DOM is removed again
 *   when another theme becomes active.
 * - Action buttons are intentionally excluded; their normal theme CSS remains
 *   responsible for button rendering.
 * - Single-line native selects use the same real-glass shell as the Sonos UI.
 *   Browser-rendered option popups and native multiple listboxes remain light
 *   surfaces with dark text for reliable readability.
 * - Preview cards, notes and collapsible surfaces are enhanced without changing
 *   their CSS-only fallback when this optional runtime is unavailable.
 * - Tables and controls embedded in tables are intentionally excluded; Core
 *   table geometry, dropdown layers and overflow behavior remain untouched.
 * ========================================================================== */
(function (window, document) {
  'use strict';

  if (window.LbLiquidGlassPreviewRuntime) {
    window.LbLiquidGlassPreviewRuntime.refresh(document);
    return;
  }

  var FILTER_ID = 'lb-lg-distort';
  var SVG_CLASS = 'lb-liquid-glass-svg-filters';
  var OWNER_ATTRIBUTE = 'data-lb-lg-preview-owner';
  var OWNER_VALUE = 'cssframework-preview';
  var WRAPPER_ATTRIBUTE = 'data-lb-lg-preview-wrapper';
  var CONTAINER_ATTRIBUTE = 'data-lb-lg-preview-container';
  var CONTENT_ATTRIBUTE = 'data-lb-lg-preview-content';

  var LAYER_CLASS_FILTER = 'lb-lg-glass-filter';
  var LAYER_CLASS_OVERLAY = 'lb-lg-glass-overlay';
  var LAYER_CLASS_SPECULAR = 'lb-lg-glass-specular';

  var active = false;
  var observer = null;
  var refreshRaf = null;
  var refreshRoot = document;
  var activeGlassElements = [];
  var elementMotionRaf = null;
  var originalControlStyles = new WeakMap();

  function isLiquidGlassTheme() {
    return !!(document.body && (
      document.body.classList.contains('theme-user-liquid-glass') ||
      document.body.classList.contains('theme-liquid-glass')
    ));
  }

  function isOwnedNode(node) {
    return !!(node && node.nodeType === 1 && node.getAttribute(OWNER_ATTRIBUTE) === OWNER_VALUE);
  }

  function ensureLiquidGlassSvgFilter() {
    var existingFilter = document.getElementById(FILTER_ID);

    if (
      existingFilter &&
      document.getElementById('lb-lg-turbulence') &&
      document.getElementById('lb-lg-offset') &&
      document.getElementById('lb-lg-displace')
    ) {
      return;
    }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', SVG_CLASS);
    svg.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;');
    svg.innerHTML =
      '<filter id="' + FILTER_ID + '" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">' +
        '<feTurbulence id="lb-lg-turbulence" type="fractalNoise" baseFrequency="0.016 0.021" numOctaves="2" seed="92" result="noise"></feTurbulence>' +
        '<feOffset id="lb-lg-offset" in="noise" dx="0" dy="0" result="shiftedNoise"></feOffset>' +
        '<feGaussianBlur in="shiftedNoise" stdDeviation="1.4" result="blurredNoise"></feGaussianBlur>' +
        '<feDisplacementMap id="lb-lg-displace" in="SourceGraphic" in2="blurredNoise" scale="42" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>' +
      '</filter>';

    document.body.insertBefore(svg, document.body.firstChild);
  }

  function removeOwnedSvgFilter() {
    document.querySelectorAll('.' + SVG_CLASS + '[' + OWNER_ATTRIBUTE + '="' + OWNER_VALUE + '"]').forEach(function (node) {
      node.remove();
    });
  }

  function isGlassLayerNode(node) {
    return !!(node && node.nodeType === 1 && (
      node.classList.contains(LAYER_CLASS_FILTER) ||
      node.classList.contains(LAYER_CLASS_OVERLAY) ||
      node.classList.contains(LAYER_CLASS_SPECULAR)
    ));
  }

  function directLayer(el, className) {
    if (!el || !el.children) {
      return null;
    }

    for (var index = 0; index < el.children.length; index += 1) {
      var child = el.children[index];
      if (child.classList.contains(className) && isOwnedNode(child)) {
        return child;
      }
    }

    return null;
  }

  function addGlassLayerNodes(el) {
    if (!el || directLayer(el, LAYER_CLASS_FILTER)) {
      return;
    }

    var filter = document.createElement('div');
    filter.className = LAYER_CLASS_FILTER;
    filter.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    var overlay = document.createElement('div');
    overlay.className = LAYER_CLASS_OVERLAY;
    overlay.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    var specular = document.createElement('div');
    specular.className = LAYER_CLASS_SPECULAR;
    specular.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    el.insertBefore(specular, el.firstChild);
    el.insertBefore(overlay, el.firstChild);
    el.insertBefore(filter, el.firstChild);
  }

  function removeGlassLayerNodes(el) {
    if (!el || !el.children) {
      return;
    }

    Array.prototype.slice.call(el.children).forEach(function (child) {
      if (isOwnedNode(child) && isGlassLayerNode(child)) {
        child.remove();
      }
    });
  }

  function shouldSkipContainerElement(el) {
    if (!el || el.getAttribute(CONTAINER_ATTRIBUTE) === '1') {
      return true;
    }

    if (el.classList.contains('lb-lg-real-glass') && !isOwnedNode(el)) {
      return true;
    }

    if (el.closest('.' + SVG_CLASS + ', .lb-lg-native-glass, .ui-flipswitch, .ui-navbar, .lb-tab-bar, .lb-btn-group')) {
      return true;
    }

    /* Tables keep their normal Core/theme rendering. This also prevents
       multiselect summaries inside table cells from receiving runtime layers.
       A Preview card whose purpose is to contain a table stays CSS-only too. */
    if (el.closest('table, .lb-table-frame') ||
        (el.matches('.lb-card') && el.querySelector('table'))) {
      return true;
    }

    if (el.matches('.ui-btn, .lb-btn, button, input[type="button"], input[type="submit"], input[type="reset"]')) {
      return true;
    }

    if (el.matches('[data-lb-no-real-glass="1"], [data-lb-real-glass="off"]')) {
      return true;
    }

    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      return true;
    }

    return false;
  }

  function initGlassElement(el) {
    if (!el) {
      return;
    }

    el.classList.add('lb-lg-real-glass');
    el.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    if (!el.dataset.lbLgSeed) {
      el.dataset.lbLgSeed = String(Math.random() * 1000);
    }

    addGlassLayerNodes(el);
  }

  function syncContainerGlassState(el) {
    if (!el || !el.matches) {
      return;
    }

    if (el.matches('.lb-multiselect > summary')) {
      var details = el.parentElement;
      var disabled = !!(details && (
        details.classList.contains('lb-disabled') ||
        details.getAttribute('aria-disabled') === 'true'
      ));

      el.classList.toggle('lb-lg-is-disabled', disabled);
    }
  }

  function needsContentWrapper(el) {
    return !!(el && el.matches && el.matches([
      '.ui-btn',
      '.lb-btn',
      'button',
      'summary',
      '.note',
      '.lb-collapsible-content'
    ].join(',')));
  }

  function wrapGlassContent(el) {
    if (!needsContentWrapper(el) || el.querySelector('[' + CONTENT_ATTRIBUTE + '="1"]')) {
      return;
    }

    var content = document.createElement('span');
    content.className = 'lb-lg-glass-content';
    content.setAttribute(CONTENT_ATTRIBUTE, '1');
    content.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (isGlassLayerNode(node)) {
        return;
      }
      content.appendChild(node);
    });

    el.appendChild(content);
  }

  function addGlassLayers(el) {
    if (shouldSkipContainerElement(el)) {
      return;
    }

    initGlassElement(el);
    el.setAttribute(CONTAINER_ATTRIBUTE, '1');
    wrapGlassContent(el);
    syncContainerGlassState(el);
  }

  function isAllowedNativeInputType(type) {
    return [
      'text',
      'password',
      'email',
      'url',
      'number',
      'tel',
      'search',
      'time',
      'date',
      'datetime-local',
      'month',
      'week'
    ].indexOf(String(type || 'text').toLowerCase()) !== -1;
  }

  function isNativeGlassControl(el) {
    if (!el || el.dataset.lbLgPreviewNativeWrapped === '1') {
      return false;
    }

    if (el.closest('.lb-lg-native-glass, .ui-input-text, .ui-input-search, .ui-select, .lb-flipswitch, .ui-flipswitch, .lb-slider-wrap, .lb-liquid-slider-main, .lb-btn-group')) {
      return false;
    }

    /* Controls embedded in Core/Preview tables intentionally stay untouched.
       Their compact layout and overflow helpers must remain stable. */
    if (el.closest('table, .lb-table-frame')) {
      return false;
    }

    if (el.matches('.lb-slider, .no-jqm-flipswitch, [data-lb-no-real-glass="1"], [data-lb-real-glass="off"]')) {
      return false;
    }

    if (el.tagName === 'TEXTAREA') {
      return true;
    }

    if (el.tagName === 'SELECT') {
      var size = parseInt(el.getAttribute('size') || '0', 10) || 0;
      return !el.multiple && size <= 1;
    }

    if (el.tagName === 'INPUT') {
      return isAllowedNativeInputType(el.getAttribute('type'));
    }

    return false;
  }

  function copyNativeLayoutToWrapper(control, wrapper) {
    var style = control.style;

    originalControlStyles.set(control, control.getAttribute('style'));

    [
      'width',
      'minWidth',
      'maxWidth',
      'height',
      'minHeight',
      'maxHeight',
      'flex',
      'flexBasis',
      'alignSelf',
      'verticalAlign'
    ].forEach(function (property) {
      if (style[property]) {
        wrapper.style[property] = style[property];
      }
    });

    [
      'margin',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft'
    ].forEach(function (property) {
      if (style[property]) {
        wrapper.style[property] = style[property];
        style[property] = '0';
      }
    });

    if (!wrapper.style.width && control.matches('.lb-input, .lb-select, .lb-textarea')) {
      wrapper.style.width = '100%';
    }
  }

  function syncNativeGlassState(control, wrapper) {
    if (!control || !wrapper) {
      return;
    }

    var disabled = !!control.disabled ||
      control.getAttribute('aria-disabled') === 'true' ||
      control.classList.contains('ui-disabled');

    wrapper.classList.toggle('lb-lg-is-disabled', disabled);
    wrapper.classList.toggle('lb-lg-is-readonly', !!control.readOnly);
  }

  function wrapNativeGlassControl(control) {
    if (!isNativeGlassControl(control) || !control.parentNode) {
      return;
    }

    var wrapper = document.createElement('span');
    wrapper.className = 'lb-lg-native-glass';
    wrapper.setAttribute(WRAPPER_ATTRIBUTE, '1');
    wrapper.setAttribute(OWNER_ATTRIBUTE, OWNER_VALUE);

    if (control.tagName === 'SELECT') {
      wrapper.classList.add('lb-lg-native-select');
    } else if (control.tagName === 'TEXTAREA') {
      wrapper.classList.add('lb-lg-native-textarea');
    } else if (control.tagName === 'INPUT') {
      wrapper.classList.add('lb-lg-native-input');

      if (String(control.getAttribute('type') || 'text').toLowerCase() === 'time') {
        wrapper.classList.add('lb-lg-native-time');
      }

      if (['button', 'submit', 'reset'].indexOf(String(control.getAttribute('type') || '').toLowerCase()) !== -1) {
        wrapper.classList.add('lb-lg-native-button');
      }
    }

    control.dataset.lbLgPreviewNativeWrapped = '1';
    copyNativeLayoutToWrapper(control, wrapper);

    control.parentNode.insertBefore(wrapper, control);
    wrapper.appendChild(control);

    initGlassElement(wrapper);
    syncNativeGlassState(control, wrapper);
  }

  function clearElementMotion(el) {
    if (!el) {
      return;
    }

    el.classList.remove('lb-lg-is-moving');
    el.style.removeProperty('--lb-lg-wave-x');
    el.style.removeProperty('--lb-lg-wave-y');
    el.style.removeProperty('--lb-lg-wave-rotate');
    el.style.removeProperty('--lb-lg-wave-scale');
    delete el._lbLgPreviewMotionUntil;
  }

  function kickElementWaveMotion(el) {
    if (!active || !el || el.classList.contains('lb-lg-is-disabled')) {
      return;
    }

    el.classList.add('lb-lg-is-moving');
    el._lbLgPreviewMotionUntil = window.performance.now() + 760;

    if (activeGlassElements.indexOf(el) === -1) {
      activeGlassElements.push(el);
    }

    if (!elementMotionRaf) {
      elementMotionRaf = window.requestAnimationFrame(tickElementWaveMotion);
    }
  }

  function tickElementWaveMotion(now) {
    var stillActive = [];

    activeGlassElements.forEach(function (el) {
      var remaining = Math.max(0, (el._lbLgPreviewMotionUntil || 0) - now);

      if (remaining <= 0 || !document.documentElement.contains(el) || el.classList.contains('lb-lg-is-disabled')) {
        clearElementMotion(el);
        return;
      }

      var seed = parseFloat(el.dataset.lbLgSeed || '0') || 0;
      var phase = now / 1000 + seed;
      var strength = Math.min(1, remaining / 320);

      var waveX = Math.sin(phase * 14.0) * 10 * strength;
      var waveY = Math.cos(phase * 11.0) * 8 * strength;
      var waveRotate = Math.sin(phase * 8.0) * 1.8 * strength;
      var waveScale = 1.075 + (0.018 * strength);

      el.style.setProperty('--lb-lg-wave-x', waveX.toFixed(2) + 'px');
      el.style.setProperty('--lb-lg-wave-y', waveY.toFixed(2) + 'px');
      el.style.setProperty('--lb-lg-wave-rotate', waveRotate.toFixed(2) + 'deg');
      el.style.setProperty('--lb-lg-wave-scale', waveScale.toFixed(3));

      stillActive.push(el);
    });

    activeGlassElements = stillActive;

    if (activeGlassElements.length) {
      elementMotionRaf = window.requestAnimationFrame(tickElementWaveMotion);
    } else {
      elementMotionRaf = null;
    }
  }

  function forEachMatch(scope, selector, callback) {
    if (!scope) {
      return;
    }

    if (scope.nodeType === 1 && scope.matches && scope.matches(selector)) {
      callback(scope);
    }

    if (scope.querySelectorAll) {
      scope.querySelectorAll(selector).forEach(callback);
    }
  }

  function enhance(root) {
    if (!active || !isLiquidGlassTheme()) {
      return;
    }

    ensureLiquidGlassSvgFilter();

    var scope = root && root.querySelectorAll ? root : document;
    var containerSelector = [
      '.lb-content .lb-card',
      '.lb-content .note',
      '.lb-content .lb-collapsible > summary',
      '.lb-content .lb-collapsible > .lb-collapsible-content',
      '.lb-content .lb-multiselect > summary',
      '.lb-content .ui-input-text',
      '.lb-content .ui-input-search'
    ].join(',');
    var nativeSelector = [
      '.lb-content input.lb-input',
      '.lb-content input.textfield',
      '.lb-content input.form-control',
      '.lb-content input[type="text"]',
      '.lb-content input[type="password"]',
      '.lb-content input[type="email"]',
      '.lb-content input[type="url"]',
      '.lb-content input[type="number"]',
      '.lb-content input[type="tel"]',
      '.lb-content input[type="search"]',
      '.lb-content input[type="time"]',
      '.lb-content input[type="date"]',
      '.lb-content input[type="datetime-local"]',
      '.lb-content input[type="month"]',
      '.lb-content input[type="week"]',
      '.lb-content textarea',
      '.lb-content select.lb-select',
      '.lb-content select'
    ].join(',');

    forEachMatch(scope, containerSelector, addGlassLayers);
    forEachMatch(scope, nativeSelector, wrapNativeGlassControl);
  }

  function restoreControlStyle(control) {
    if (!control || !originalControlStyles.has(control)) {
      return;
    }

    var originalStyle = originalControlStyles.get(control);

    if (originalStyle === null) {
      control.removeAttribute('style');
    } else {
      control.setAttribute('style', originalStyle);
    }

    originalControlStyles.delete(control);
  }

  function unwrapOwnedNativeControls() {
    document.querySelectorAll('.lb-lg-native-glass[' + WRAPPER_ATTRIBUTE + '="1"][' + OWNER_ATTRIBUTE + '="' + OWNER_VALUE + '"]').forEach(function (wrapper) {
      var control = wrapper.querySelector(':scope > input, :scope > textarea, :scope > select');

      if (control && wrapper.parentNode) {
        delete control.dataset.lbLgPreviewNativeWrapped;
        restoreControlStyle(control);
        wrapper.parentNode.insertBefore(control, wrapper);
      }

      wrapper.remove();
    });
  }

  function restoreOwnedContainers() {
    document.querySelectorAll('[' + CONTAINER_ATTRIBUTE + '="1"][' + OWNER_ATTRIBUTE + '="' + OWNER_VALUE + '"]').forEach(function (el) {
      var content = el.querySelector(':scope > [' + CONTENT_ATTRIBUTE + '="1"]');

      if (content) {
        while (content.firstChild) {
          el.insertBefore(content.firstChild, content);
        }
        content.remove();
      }

      clearElementMotion(el);
      removeGlassLayerNodes(el);
      el.classList.remove('lb-lg-real-glass');
      el.removeAttribute(CONTAINER_ATTRIBUTE);
      el.removeAttribute(OWNER_ATTRIBUTE);
      delete el.dataset.lbLgSeed;
    });
  }

  function deactivate() {
    active = false;

    if (refreshRaf) {
      window.cancelAnimationFrame(refreshRaf);
      refreshRaf = null;
    }

    if (elementMotionRaf) {
      window.cancelAnimationFrame(elementMotionRaf);
      elementMotionRaf = null;
    }

    activeGlassElements.forEach(clearElementMotion);
    activeGlassElements = [];

    unwrapOwnedNativeControls();
    restoreOwnedContainers();
    removeOwnedSvgFilter();

    if (document.body) {
      document.body.removeAttribute('data-lb-liquid-glass-preview-runtime');
    }
  }

  function activate(root) {
    if (!document.body || !isLiquidGlassTheme()) {
      deactivate();
      return;
    }

    active = true;
    document.body.setAttribute('data-lb-liquid-glass-preview-runtime', 'active');
    ensureLiquidGlassSvgFilter();
    enhance(root || document);
  }

  function sync(root) {
    if (isLiquidGlassTheme()) {
      activate(root || document);
    } else {
      deactivate();
    }
  }

  function scheduleRefresh(root) {
    refreshRoot = root && root.querySelectorAll ? root : document;

    if (refreshRaf) {
      return;
    }

    refreshRaf = window.requestAnimationFrame(function () {
      refreshRaf = null;
      sync(refreshRoot);
      refreshRoot = document;
    });
  }

  function findOwnedGlassElement(target) {
    if (!active || !target || !target.closest) {
      return null;
    }

    var el = target.closest('.lb-lg-real-glass[' + OWNER_ATTRIBUTE + '="' + OWNER_VALUE + '"]');
    return el && document.documentElement.contains(el) ? el : null;
  }

  function handlePointerOrFocus(event) {
    var el = findOwnedGlassElement(event.target);
    if (el) {
      kickElementWaveMotion(el);
    }
  }

  function handleKeyboard(event) {
    var key = event.key || '';

    if ([
      'Enter',
      ' ',
      'Spacebar',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight'
    ].indexOf(key) === -1) {
      return;
    }

    handlePointerOrFocus(event);
  }

  function startObserver() {
    if (observer || !window.MutationObserver || !document.body) {
      return;
    }

    observer = new window.MutationObserver(function (records) {
      var bodyThemeChanged = false;
      var addedRoot = null;

      records.forEach(function (record) {
        if (record.type === 'attributes') {
          if (record.target === document.body && record.attributeName === 'class') {
            bodyThemeChanged = true;
            return;
          }

          if (active && record.target && record.target.nodeType === 1) {
            var control = record.target;
            var wrapper = control.closest && control.closest('.lb-lg-native-glass[' + WRAPPER_ATTRIBUTE + '="1"]');
            if (wrapper && control.parentNode === wrapper) {
              syncNativeGlassState(control, wrapper);
            }

            if (control.matches && control.matches('.lb-multiselect')) {
              var summary = control.querySelector(':scope > summary[' + OWNER_ATTRIBUTE + '="' + OWNER_VALUE + '"]');
              if (summary) {
                syncContainerGlassState(summary);
              }
            } else if (control.matches && control.matches('.lb-multiselect > summary')) {
              syncContainerGlassState(control);
            }
          }
          return;
        }

        if (record.type === 'childList' && active && record.addedNodes.length) {
          for (var index = 0; index < record.addedNodes.length; index += 1) {
            if (record.addedNodes[index].nodeType === 1 && !isOwnedNode(record.addedNodes[index])) {
              addedRoot = record.addedNodes[index];
              break;
            }
          }
        }
      });

      if (bodyThemeChanged) {
        scheduleRefresh(document);
      } else if (addedRoot) {
        scheduleRefresh(addedRoot);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'readonly', 'aria-disabled']
    });
  }

  function init() {
    if (!document.body) {
      return;
    }

    startObserver();
    scheduleRefresh(document);

    window.setTimeout(function () {
      scheduleRefresh(document);
    }, 150);

    window.setTimeout(function () {
      scheduleRefresh(document);
    }, 450);
  }

  document.addEventListener('pointerdown', handlePointerOrFocus, true);
  document.addEventListener('focusin', handlePointerOrFocus, true);
  document.addEventListener('keydown', handleKeyboard, true);

  window.LbLiquidGlassPreviewRuntime = {
    activate: function (root) {
      activate(root || document);
    },
    deactivate: deactivate,
    refresh: function (root) {
      scheduleRefresh(root || document);
    },
    isActive: function () {
      return active;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('load', function () {
    scheduleRefresh(document);
  }, { once: true });

})(window, document);
