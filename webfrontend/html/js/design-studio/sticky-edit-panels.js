/* LoxBerry CSS Framework Design Studio
 * V370: vertical document-scroll follow for "Vorschaufarben",
 * "Arbeitsbereich / Vorschau" and the Studio status block.
 */
(function (global) {
  'use strict';

  var EDGE_GAP = 12;
  var MIN_VIEWPORT_WIDTH = 761;
  var MIN_VIEWPORT_HEIGHT = 480;
  var CENTERING_SCROLL_DISTANCE = 160;
  var STATUS_ENTRY_SCROLL_DISTANCE = 96;

  var workbench = null;
  var tabPanel = null;
  var page = null;
  var statusBar = null;
  var targets = [];
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
    if (!workbench || targets.length < 2) return false;

    var workbenchRect = workbench.getBoundingClientRect();
    var paletteRect = targets[0].getBoundingClientRect();
    var previewRect = targets[1].getBoundingClientRect();

    /* Geometry is more reliable than a fixed media-query threshold because
     * the available LoxBerry content width can differ from window.innerWidth. */
    return previewRect.left > (workbenchRect.left + 40) &&
      paletteRect.right < (previewRect.left - 4);
  }

  function updateMainTargets(y, viewHeight, workbenchTop, workbenchBottom) {
    var progress = Math.min(1, Math.max(0, y / CENTERING_SCROLL_DISTANCE));

    targets.forEach(function (element) {
      if (!isVisible(element)) {
        clearShift(element);
        return;
      }

      var oldShift = currentShift(element);
      var rect = element.getBoundingClientRect();
      var elementHeight = element.offsetHeight || rect.height;

      /* Remove the existing visual translation from the measured document
       * position to recover the element's stable grid position. */
      var naturalTop = rect.top + y - oldShift;

      /* Short panels are centered vertically. A panel almost as tall as the
       * viewport (the Preview) is kept at the safe top edge instead. */
      var availableHeight = Math.max(0, viewHeight - (EDGE_GAP * 2));
      var visibleHeight = Math.min(elementHeight, availableHeight);
      var viewportTop = Math.max(
        EDGE_GAP,
        Math.round((viewHeight - visibleHeight) / 2)
      );

      var requiredShift = Math.max(0, (y + viewportTop) - naturalTop);
      var softenedShift = requiredShift * progress;

      /* Never leave the Workbench. When the left inspector becomes taller,
       * this range grows automatically and both requested blocks can follow
       * the vertical browser scroll through the newly available space. */
      var maxShift = Math.max(
        0,
        workbenchBottom - naturalTop - elementHeight
      );

      setShift(element, Math.min(softenedShift, maxShift));
    });
  }

  function updateStatus(y, viewHeight, workbenchTop) {
    if (!statusBar || !tabPanel || !isVisible(statusBar)) {
      clearShift(statusBar);
      return;
    }

    var oldShift = currentShift(statusBar);
    var rect = statusBar.getBoundingClientRect();
    var elementHeight = statusBar.offsetHeight || rect.height;
    var naturalTop = rect.top + y - oldShift;

    var tabRect = tabPanel.getBoundingClientRect();
    var tabTop = tabRect.top + y;
    var tabBottom = tabTop + tabPanel.offsetHeight;

    /* Keep Status horizontally in its existing 50vw layout and move only on
     * the Y axis. It follows close to the lower viewport edge so it does not
     * cover the centered Preview and palette panels. */
    var viewportTop = Math.max(
      EDGE_GAP,
      viewHeight - elementHeight - EDGE_GAP
    );
    var requiredShift = (y + viewportTop) - naturalTop;
    var progress = Math.min(1, Math.max(0, y / STATUS_ENTRY_SCROLL_DISTANCE));
    var softenedShift = requiredShift * progress;

    /* The status bar may move upward from its natural position, but never
     * above the Workbench start and never below the active tab panel. */
    var minShift = Math.min(0, (workbenchTop + EDGE_GAP) - naturalTop);
    var maxShift = Math.max(0, tabBottom - naturalTop - elementHeight);
    var boundedShift = Math.max(minShift, Math.min(softenedShift, maxShift));

    setShift(statusBar, boundedShift);
  }

  function update() {
    frameId = 0;

    if (!page || !workbench || !tabPanel || targets.length !== 2) return;

    var viewHeight = viewportHeight();
    var enabled = global.innerWidth >= MIN_VIEWPORT_WIDTH &&
      viewHeight >= MIN_VIEWPORT_HEIGHT &&
      isVisible(workbench) &&
      !page.classList.contains('cfw-liquid-glass-wallpaper-only') &&
      isTwoColumnWorkbench();

    if (!enabled) {
      targets.forEach(clearShift);
      clearShift(statusBar);
      return;
    }

    var y = scrollTop();
    var workbenchRect = workbench.getBoundingClientRect();
    var workbenchTop = workbenchRect.top + y;
    var workbenchBottom = workbenchTop + workbench.offsetHeight;

    updateMainTargets(y, viewHeight, workbenchTop, workbenchBottom);
    updateStatus(y, viewHeight, workbenchTop);
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

    var palette = document.querySelector('#cfwTabWorkbench .cfw-left-secondary-stack .cfw-palette-panel');
    var preview = document.querySelector('#cfwTabWorkbench .cfw-right');
    targets = [palette, preview].filter(Boolean);

    if (!page || !tabPanel || !workbench || !statusBar || targets.length !== 2) return;

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
      resizeObserver.observe(statusBar);
      targets.forEach(function (element) {
        resizeObserver.observe(element);
      });
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
