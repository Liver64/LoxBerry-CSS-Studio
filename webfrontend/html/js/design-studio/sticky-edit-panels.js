/* LoxBerry CSS Framework Design Studio
 * V462: only "Vorschaufarben" follows the vertical document scroll.
 * "Arbeitsbereich / Vorschau" and the Studio status block remain at their
 * natural document positions. The palette still stops above the status block.
 */
(function (global) {
  'use strict';

  var EDGE_GAP = 12;
  var MIN_VIEWPORT_WIDTH = 761;
  var MIN_VIEWPORT_HEIGHT = 480;
  var CENTERING_SCROLL_DISTANCE = 160;
  var STATUS_COLLISION_GAP = 16;

  var workbench = null;
  var tabPanel = null;
  var page = null;
  var palette = null;
  var preview = null;
  var statusBar = null;
  var frameId = 0;
  var resizeObserver = null;
  var mutationObserver = null;

  function scrollingElement() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function scrollTop() {
    var root = scrollingElement();
    return Math.max(
      0,
      global.pageYOffset || global.scrollY || (root && root.scrollTop) || 0
    );
  }

  function viewportHeight() {
    return Math.max(
      document.documentElement.clientHeight || 0,
      global.innerHeight || 0
    );
  }

  function isVisible(element) {
    if (!element || element.hidden) return false;
    var style = global.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function currentShift(element) {
    var value = parseFloat(element.dataset.cfwScrollFollowY || '0');
    return Number.isFinite(value) ? value : 0;
  }

  function setShift(element, value) {
    var rounded = Math.round(value * 10) / 10;
    element.dataset.cfwScrollFollowY = String(rounded);
    element.style.setProperty('--cfw-scroll-follow-y', rounded + 'px');
    element.classList.add('cfw-scroll-follow-target');
  }

  function clearShift(element) {
    if (!element) return;
    element.classList.remove('cfw-scroll-follow-target');
    element.style.removeProperty('--cfw-scroll-follow-y');
    delete element.dataset.cfwScrollFollowY;
  }

  function isTwoColumnWorkbench() {
    if (!workbench || !palette || !preview) return false;

    var workbenchRect = workbench.getBoundingClientRect();
    var paletteRect = palette.getBoundingClientRect();
    var previewRect = preview.getBoundingClientRect();

    /* Geometry is more reliable than a fixed media-query threshold because
     * the available LoxBerry content width can differ from window.innerWidth. */
    return previewRect.left > (workbenchRect.left + 40) &&
      paletteRect.right < (previewRect.left - 4);
  }

  function updatePalette(y, viewHeight, workbenchBottom) {
    if (!isVisible(palette)) {
      clearShift(palette);
      return;
    }

    var oldShift = currentShift(palette);
    var rect = palette.getBoundingClientRect();
    var elementHeight = palette.offsetHeight || rect.height;

    /* Remove the existing visual translation from the measured document
     * position to recover the palette's stable grid position. */
    var naturalTop = rect.top + y - oldShift;

    var availableHeight = Math.max(0, viewHeight - (EDGE_GAP * 2));
    var visibleHeight = Math.min(elementHeight, availableHeight);
    var viewportTop = Math.max(
      EDGE_GAP,
      Math.round((viewHeight - visibleHeight) / 2)
    );

    var requiredShift = Math.max(0, (y + viewportTop) - naturalTop);
    var progress = Math.min(1, Math.max(0, y / CENTERING_SCROLL_DISTANCE));
    var softenedShift = requiredShift * progress;

    /* Never leave the Workbench. Its height grows automatically with the
     * taller left inspector, so the palette can follow only inside that area. */
    var maxShift = Math.max(
      0,
      workbenchBottom - naturalTop - elementHeight
    );

    setShift(palette, Math.min(softenedShift, maxShift));
  }

  function constrainPaletteAgainstStatus(y) {
    if (!palette || !statusBar || !isVisible(palette) || !isVisible(statusBar)) return;

    var paletteShift = currentShift(palette);
    var paletteRect = palette.getBoundingClientRect();
    var statusRect = statusBar.getBoundingClientRect();

    /* Only apply the vertical collision guard where both blocks actually share
     * horizontal screen space. */
    var overlapsHorizontally = paletteRect.right > statusRect.left + 1 &&
      paletteRect.left < statusRect.right - 1;
    if (!overlapsHorizontally) return;

    var paletteHeight = palette.offsetHeight || paletteRect.height;
    var paletteNaturalTop = paletteRect.top + y - paletteShift;
    var statusNaturalTop = statusRect.top + y;

    /* V462: Status no longer follows the viewport. Cap only the palette's
     * translation so its lower edge stays above the static status block. */
    var collisionLimitedShift = statusNaturalTop - STATUS_COLLISION_GAP -
      paletteNaturalTop - paletteHeight;

    if (paletteShift > collisionLimitedShift) {
      setShift(palette, Math.max(0, collisionLimitedShift));
    }
  }

  function update() {
    frameId = 0;

    if (!page || !workbench || !tabPanel || !palette || !preview) return;

    /* V462: explicitly remove any old follow state from the two blocks that
     * must remain at their natural document positions. */
    clearShift(preview);
    clearShift(statusBar);

    var viewHeight = viewportHeight();
    var enabled = global.innerWidth >= MIN_VIEWPORT_WIDTH &&
      viewHeight >= MIN_VIEWPORT_HEIGHT &&
      isVisible(workbench) &&
      !page.classList.contains('cfw-liquid-glass-wallpaper-only') &&
      isTwoColumnWorkbench();

    if (!enabled) {
      clearShift(palette);
      return;
    }

    var y = scrollTop();
    var workbenchRect = workbench.getBoundingClientRect();
    var workbenchTop = workbenchRect.top + y;
    var workbenchBottom = workbenchTop + workbench.offsetHeight;

    updatePalette(y, viewHeight, workbenchBottom);
    constrainPaletteAgainstStatus(y);
  }

  function scheduleUpdate() {
    if (frameId) return;
    frameId = global.requestAnimationFrame(update);
  }

  function init() {
    page = document.querySelector('.cfw-page.cfw-design-studio');
    tabPanel = document.getElementById('cfwTabWorkbench');
    workbench = document.querySelector('#cfwTabWorkbench .cfw-workbench');
    statusBar = document.getElementById('studioStatusBar');
    palette = document.querySelector('#cfwTabWorkbench .cfw-left-secondary-stack .cfw-palette-panel');
    preview = document.querySelector('#cfwTabWorkbench .cfw-right');

    if (!page || !tabPanel || !workbench || !statusBar || !palette || !preview) return;

    clearShift(preview);
    clearShift(statusBar);

    global.addEventListener('scroll', scheduleUpdate, { passive: true });
    global.addEventListener('resize', scheduleUpdate, { passive: true });
    document.addEventListener('scroll', scheduleUpdate, true);
    document.addEventListener('toggle', scheduleUpdate, true);
    document.addEventListener('click', scheduleUpdate, true);
    document.addEventListener('change', scheduleUpdate, true);

    if ('ResizeObserver' in global) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(tabPanel);
      resizeObserver.observe(workbench);
      resizeObserver.observe(document.querySelector('.cfw-left-primary-stack'));
      resizeObserver.observe(palette);
      resizeObserver.observe(preview);
      resizeObserver.observe(statusBar);
    }

    if ('MutationObserver' in global) {
      mutationObserver = new MutationObserver(scheduleUpdate);
      mutationObserver.observe(tabPanel, {
        attributes: true,
        attributeFilter: ['hidden', 'class']
      });
      mutationObserver.observe(page, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    scheduleUpdate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  global.CFWStickyEditPanels = {
    refresh: scheduleUpdate
  };
})(window);
