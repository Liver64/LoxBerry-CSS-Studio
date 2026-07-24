(function (window) {
  'use strict';

  function normalizeDisplayName(name) {
    name = String(name || '').trim();
    name = name.replace(/^loxberry[\s_-]*/i, '').trim();
    return name || 'User Theme';
  }

  function slugify(name) {
    var slug = normalizeDisplayName(name)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return 'theme-user-' + (slug || 'theme');
  }

  window.CFWDesignStudioThemeIdentity = Object.freeze({
    normalizeDisplayName: normalizeDisplayName,
    slugify: slugify
  });
}(window));
