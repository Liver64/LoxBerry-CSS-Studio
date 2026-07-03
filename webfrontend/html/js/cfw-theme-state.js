(function () {
  'use strict';

  /**
   * LoxBerry CSS Framework Design Studio - Theme State Manager / Event Bus
   * V45
   *
   * This file is intentionally small and independent from design-studio.js.
   * It provides a single shared state for the current working theme and a
   * central event bus for Preview, Documentation, AI Designer and future views.
   */

  function clone(value) {
    if (value === null || typeof value !== 'object') return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }

  function createEventBus() {
    var listeners = {};

    function on(eventName, handler) {
      if (!eventName || typeof handler !== 'function') return function () {};
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(handler);
      return function () { off(eventName, handler); };
    }

    function off(eventName, handler) {
      var list = listeners[eventName];
      if (!list) return;
      listeners[eventName] = list.filter(function (item) { return item !== handler; });
    }

    function emit(eventName, payload) {
      var list = (listeners[eventName] || []).slice();
      list.forEach(function (handler) {
        try { handler(payload || {}); } catch (e) {
          if (window.console && console.warn) console.warn('CFWEventBus handler failed:', eventName, e);
        }
      });
    }

    return {
      on: on,
      off: off,
      emit: emit
    };
  }

  var bus = window.CFWEventBus || createEventBus();
  window.CFWEventBus = bus;

  var state = {
    themeId: '',
    themeName: '',
    version: '',
    tokens: {},
    customCss: '',
    importMeta: null,
    wallpaper: null,
    dirty: false,
    revision: 0,
    source: 'initial'
  };

  var frameIds = [];

  function getFrameWindow(id) {
    var frame = document.getElementById(id);
    return frame && frame.contentWindow ? frame.contentWindow : null;
  }

  function postToFrames(message) {
    frameIds.forEach(function (id) {
      var target = getFrameWindow(id);
      if (!target) return;
      try { target.postMessage(message, window.location.origin); } catch (e) {}
    });
  }

  function buildTokensMessage() {
    return {
      type: 'CFW_STUDIO_TOKENS',
      tokens: clone(state.tokens) || {},
      meta: {
        themeId: state.themeId,
        themeName: state.themeName,
        revision: state.revision,
        source: state.source
      },
      wallpaper: clone(state.wallpaper)
    };
  }

  function syncFrames() {
    postToFrames(buildTokensMessage());
  }

  function attachFrames(ids) {
    frameIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    frameIds.forEach(function (id) {
      var frame = document.getElementById(id);
      if (!frame || frame.getAttribute('data-cfw-theme-state-bound') === '1') return;
      frame.setAttribute('data-cfw-theme-state-bound', '1');
      frame.addEventListener('load', function () { syncFrames(); });
    });
    syncFrames();
  }

  function update(partial, options) {
    options = options || {};
    partial = partial || {};

    if (partial.themeId !== undefined) state.themeId = String(partial.themeId || '');
    if (partial.themeName !== undefined) state.themeName = String(partial.themeName || '');
    if (partial.version !== undefined) state.version = String(partial.version || '');
    if (partial.tokens !== undefined) state.tokens = clone(partial.tokens) || {};
    if (partial.customCss !== undefined) state.customCss = String(partial.customCss || '');
    if (partial.importMeta !== undefined) state.importMeta = clone(partial.importMeta);
    if (partial.wallpaper !== undefined) state.wallpaper = clone(partial.wallpaper);
    if (partial.dirty !== undefined) state.dirty = !!partial.dirty;
    else if (options.markDirty) state.dirty = true;
    state.source = options.source || partial.source || state.source || 'unknown';
    state.revision += 1;

    var snapshot = getState();
    bus.emit('theme:changed', snapshot);

    if (partial.tokens !== undefined) {
      bus.emit('theme:tokensChanged', snapshot);
    }
    if (partial.tokens !== undefined || partial.wallpaper !== undefined) {
      syncFrames();
    }

    return snapshot;
  }

  function updateTokens(tokens, options) {
    options = options || {};
    return update({ tokens: tokens || {}, dirty: options.dirty }, {
      source: options.source || 'tokens',
      markDirty: options.markDirty
    });
  }

  function setIdentity(identity, options) {
    identity = identity || {};
    return update({
      themeId: identity.themeId,
      themeName: identity.themeName,
      version: identity.version
    }, options || { source: 'identity' });
  }

  function getState() {
    return clone(state);
  }

  window.CFWThemeStateManager = {
    getState: getState,
    update: update,
    updateTokens: updateTokens,
    setIdentity: setIdentity,
    attachFrames: attachFrames,
    syncFrames: syncFrames,
    on: bus.on,
    off: bus.off,
    emit: bus.emit
  };
}());
