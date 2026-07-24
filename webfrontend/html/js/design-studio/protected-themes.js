(function (window) {
  'use strict';

  var LIQUID_GLASS_ID = 'theme-user-liquid-glass';
  var CLASSIC_MAC_ID = 'theme-user-classic-mac';

  function normalizeId(id) {
    return String(id || '').trim().toLowerCase();
  }

  function isLiquidGlass(id) {
    return normalizeId(id) === LIQUID_GLASS_ID;
  }

  function isReadOnly(id) {
    return normalizeId(id) === CLASSIC_MAC_ID;
  }

  function isProtected(id) {
    return isLiquidGlass(id) || isReadOnly(id);
  }

  function displayName(id, translate) {
    if (isLiquidGlass(id)) return translate ? translate('saveModal.baseLiquidGlass') : 'Liquid Glass';
    if (isReadOnly(id)) return 'Classic Mac';
    return String(id || 'Package Theme');
  }

  function message(id, translate) {
    var theme = displayName(id, translate);
    if (translate) {
      return translate('messages.protectedPackageTheme', {
        theme: theme,
        id: id || 'protected-package-theme'
      });
    }
    return 'Protected package theme: ' + theme;
  }

  window.CFWDesignStudioProtectedThemes = Object.freeze({
    LIQUID_GLASS_ID: LIQUID_GLASS_ID,
    CLASSIC_MAC_ID: CLASSIC_MAC_ID,
    isLiquidGlass: isLiquidGlass,
    isReadOnly: isReadOnly,
    isProtected: isProtected,
    displayName: displayName,
    message: message
  });
}(window));
