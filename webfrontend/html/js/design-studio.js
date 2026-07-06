(function () {
  'use strict';

  var coreTokens = window.CFW_CORE_TOKENS || {};
  var coreData = window.CFW_CORE_DATA || {};
  var userThemes = Array.isArray(window.CFW_USER_THEMES) ? window.CFW_USER_THEMES : [];
  var themeState = window.CFWThemeStateManager || null;

  var previewRoot = document.getElementById('previewRoot');
  var statusBox = document.getElementById('status');
  var statusModal = document.getElementById('statusModal');
  var statusModalCard = statusModal ? statusModal.querySelector('.cfw-status-modal-card') : null;
  var statusModalTitle = document.getElementById('statusModalTitle');
  var statusModalMessage = document.getElementById('statusModalMessage');
  var statusModalHint = document.getElementById('statusModalHint');
  var statusModalIcon = document.getElementById('statusModalIcon');
  var statusModalBack = document.getElementById('statusModalBack');
  var statusModalActions = document.getElementById('statusModalActions');
  var statusModalTimer = null;
  var areaSelect = document.getElementById('areaSelect');
  var elementSelect = document.getElementById('elementSelect');
  var colorGroupSelect = document.getElementById('colorGroupSelect');
  var selectedElementTitle = document.getElementById('selectedElementTitle');
  var selectedComponentCard = document.querySelector('.cfw-selected-component-card');
  var selectedElementMeta = document.getElementById('selectedElementMeta');
  var propertyInspector = document.getElementById('propertyInspector');
  var selectedTokenList = document.getElementById('selectedTokenList');
  var paletteGrid = document.getElementById('paletteGrid');
  var monoPreview = document.getElementById('monoPreview');
  var colorPicker = document.getElementById('colorPicker');
  var colorPresetPalette = document.getElementById('colorPresetPalette');
  var alphaRange = document.getElementById('alphaRange');
  var brightnessRange = document.getElementById('brightnessRange');
  var radiusRange = document.getElementById('radiusRange');
  var borderWidthRange = document.getElementById('borderWidthRange');
  var borderWidthValue = document.getElementById('borderWidthValue');
  var borderWidthSetting = document.querySelector('.cfw-border-width-setting');
  var shadowRange = document.getElementById('shadowRange');
  var alphaValue = document.getElementById('alphaValue');
  var brightnessValue = document.getElementById('brightnessValue');
  var radiusValue = document.getElementById('radiusValue');
  var shadowValue = document.getElementById('shadowValue');
  var wallpaperControls = document.getElementById('wallpaperControls');
  var wallpaperAdvancedControls = document.getElementById('wallpaperAdvancedControls');
  var wallpaperEnabled = document.getElementById('wallpaperEnabled');
  var wallpaperImage = document.getElementById('wallpaperImage');
  var wallpaperFile = document.getElementById('wallpaperFile');
  var wallpaperFileButton = document.getElementById('wallpaperFileButton');
  var wallpaperFileName = document.getElementById('wallpaperFileName');
  var wallpaperMode = document.getElementById('wallpaperMode');
  var wallpaperBrightness = document.getElementById('wallpaperBrightness');
  var wallpaperOpacity = document.getElementById('wallpaperOpacity');
  var wallpaperBrightnessValue = document.getElementById('wallpaperBrightnessValue');
  var wallpaperOpacityValue = document.getElementById('wallpaperOpacityValue');
  var customCss = document.getElementById('customCss');
  var cssImport = document.getElementById('cssImport');
  var cssImportButton = document.getElementById('cssImportButton');
  var cssImportFileName = document.getElementById('cssImportFileName');
  var importSummary = document.getElementById('importSummary');
  var saveModal = document.getElementById('saveModal');
  var userThemeSelect = document.getElementById('userThemeSelect');
  var deleteThemeButton = document.getElementById('deleteTheme');
  var undoThemeButton = document.getElementById('undoTheme');
  var deleteModal = document.getElementById('deleteModal');
  var cancelDeleteButton = document.getElementById('cancelDelete');
  var confirmDeleteButton = document.getElementById('confirmDelete');
  var pendingDeleteTheme = null;
  var themeId = document.getElementById('themeId');
  var themeName = document.getElementById('themeName');
  var themeVersion = document.getElementById('themeVersion');
  var mappedTokenCount = document.getElementById('mappedTokenCount');
  var previewCaption = document.getElementById('previewCaption');
  var aiColorPresetPalette = document.getElementById('aiColorPresetPalette');
  var aiImportedTokens = {};
  var colorPresetValues = [
    // V141: 3 rows × 7 colors. Swatch size/spacing remains CSS-controlled.
    '#ffffff', '#f5ead7', '#111827', '#ef4444', '#f97316', '#facc15', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207', '#78350f', '#6b7280',
    '#000000', '#f8fafc', '#fde68a', '#dc2626', '#16a34a', '#0891b2', '#7c3aed'
  ];
  var aiColorPresetMeta = [
    // V170: 2 rows × 15 visible color directions, based on the Studio coarse palette.
    { color: '#ffffff', de: 'klares Weiß', en: 'clear white' },
    { color: '#f5ead7', de: 'warmes Beige', en: 'warm beige' },
    { color: '#111827', de: 'dunkles Anthrazit', en: 'dark anthracite' },
    { color: '#ef4444', de: 'kräftiges Rot', en: 'strong red' },
    { color: '#f97316', de: 'warmes Orange', en: 'warm orange' },
    { color: '#facc15', de: 'sonniges Gelb', en: 'sunny yellow' },
    { color: '#22c55e', de: 'frisches Grün', en: 'fresh green' },
    { color: '#06b6d4', de: 'klares Cyan', en: 'clear cyan' },
    { color: '#3b82f6', de: 'ruhiges Blau', en: 'calm blue' },
    { color: '#8b5cf6', de: 'weiches Violett', en: 'soft violet' },
    { color: '#ec4899', de: 'kräftiges Pink', en: 'strong pink' },
    { color: '#a16207', de: 'warmes Ocker', en: 'warm ochre' },
    { color: '#78350f', de: 'dunkles Braun', en: 'dark brown' },
    { color: '#6b7280', de: 'neutrales Grau', en: 'neutral gray' },
    { color: '#000000', de: 'tiefes Schwarz', en: 'deep black' },
    { color: '#f8fafc', de: 'helles Eisgrau', en: 'light ice gray' },
    { color: '#fde68a', de: 'sanftes Cremegelb', en: 'soft cream yellow' },
    { color: '#dc2626', de: 'dunkles Rot', en: 'dark red' },
    { color: '#16a34a', de: 'sattes Grün', en: 'rich green' },
    { color: '#0891b2', de: 'tiefes Türkis', en: 'deep turquoise' },
    { color: '#7c3aed', de: 'dunkles Violett', en: 'dark violet' },
    { color: '#fbcfe8', de: 'helles Rosé', en: 'light rose' },
    { color: '#bbf7d0', de: 'helles Mintgrün', en: 'light mint green' },
    { color: '#bae6fd', de: 'helles Himmelblau', en: 'light sky blue' },
    { color: '#e9d5ff', de: 'helles Lavendel', en: 'light lavender' },
    { color: '#cbd5e1', de: 'kühles Grau', en: 'cool gray' },
    { color: '#fef3c7', de: 'warmes Creme', en: 'warm cream' },
    { color: '#991b1b', de: 'tiefes Weinrot', en: 'deep wine red' },
    { color: '#166534', de: 'dunkles Waldgrün', en: 'dark forest green' },
    { color: '#1e3a8a', de: 'dunkles Marineblau', en: 'dark navy blue' }
  ];  var aiImportedCss = '';
  var lastImportMeta = null;
  // V129: Color swatches only edit an explicitly selected Preview/Inspector target.
  var hasActiveEditorSelection = false;
  var aiValidatedDraft = null;
  var aiResultSignature = '';
  var selectedComponentTarget = null;
  var componentInspector = document.getElementById('componentInspector');
  var componentInspectorTitle = document.getElementById('componentInspectorTitle');
  var componentInspectorMeta = document.getElementById('componentInspectorMeta');
  var previewHoverCard = null;
  var previewHoverTarget = null;
  var appliedPreviewVars = [];
  var wallpaperState = { enabled: false, image: '', mode: 'cover', brightness: 100, opacity: 100 };

  var i18nLanguage = (window.CFW_LANGUAGE || window.LBLANG || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  var i18nDictionary = (window.LBDesignStudioLangs && (window.LBDesignStudioLangs[i18nLanguage] || window.LBDesignStudioLangs.de || window.LBDesignStudioLangs.en)) || {};

  function i18nGet(path) {
    var parts = String(path || '').split('.');
    var current = i18nDictionary;
    for (var i = 0; i < parts.length; i += 1) {
      if (!current || !Object.prototype.hasOwnProperty.call(current, parts[i])) return '';
      current = current[parts[i]];
    }
    return typeof current === 'string' ? current : '';
  }

  function t(path, fallback, values) {
    var text = i18nGet(path) || fallback || path || '';
    if (values) {
      Object.keys(values).forEach(function (key) {
        text = text.replace(new RegExp('\\{' + key + '\\}', 'g'), values[key]);
      });
    }
    return text;
  }

  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.getAttribute('data-i18n'), node.textContent || '');
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (node) {
      node.innerHTML = t(node.getAttribute('data-i18n-html'), node.innerHTML || '');
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (node) {
      String(node.getAttribute('data-i18n-attr') || '').split(';').forEach(function (part) {
        var pair = part.split(':');
        if (pair.length !== 2) return;
        var attr = pair[0].trim();
        var key = pair[1].trim();
        if (attr && key) node.setAttribute(attr, t(key, node.getAttribute(attr) || ''));
      });
    });
  }

  var studioModel = {};

  var blockedTokenPatterns = [
    /^--lb-table-status-/,
    /^--lb-(?:success|ok|warning|warn|danger|error|critical|info|notice|alert)(?:-|$)/,
    /^--lb-tooltip-/
  ];

  function isBlockedToken(name) {
    return blockedTokenPatterns.some(function (pattern) { return pattern.test(name); });
  }


  var areas = {
    'Input': {
      'Input Text': {
        'Grundfarbe': ['--lb-input-bg'],
        'Textfarbe': ['--lb-input-text'],
        'Rahmen': ['--lb-input-border'],
        'Focus': ['--lb-input-focus-border', '--lb-input-focus-shadow'],
        'Disabled': ['--lb-input-disabled-bg', '--lb-input-disabled-text'],
        'Radius': ['--lb-input-radius', '--lb-radius-input', '--lb-radius-sm']
      },
      'Textarea': {
        'Grundfarbe': ['--lb-textarea-bg', '--lb-input-bg'],
        'Textfarbe': ['--lb-textarea-text', '--lb-input-text'],
        'Rahmen': ['--lb-textarea-border', '--lb-input-border'],
        'Radius': ['--lb-textarea-radius', '--lb-input-radius', '--lb-radius-input']
      },
      'Input mit Fokus': {
        'Grundfarbe': ['--lb-input-focus-bg', '--lb-input-bg'],
        'Rahmen': ['--lb-input-focus-border'],
        'Schatten': ['--lb-input-focus-shadow']
      }
    },
    'Selects': {
      'Standard Select': {
        'Grundfarbe': ['--lb-select-bg', '--lb-input-bg'],
        'Textfarbe': ['--lb-select-text', '--lb-input-text'],
        'Rahmen': ['--lb-select-border', '--lb-input-border'],
        'Hover': ['--lb-select-hover-bg'],
        'Radius': ['--lb-select-radius', '--lb-radius-select', '--lb-input-radius', '--lb-radius-input']
      },
      'Native Select': {
        'Grundfarbe': ['--lb-native-select-bg', '--lb-input-bg'],
        'Textfarbe': ['--lb-native-select-text', '--lb-input-text'],
        'Rahmen': ['--lb-native-select-border', '--lb-input-border']
      },
      'Select Menü offen': {
        'Grundfarbe': ['--lb-select-menu-bg'],
        'Textfarbe': ['--lb-select-menu-text'],
        'Hover': ['--lb-select-menu-hover-bg'],
        'Rahmen': ['--lb-select-menu-border']
      }
    },
    'Checkboxen': {
      'Standard Checkbox': {
        'Grundfarbe': ['--lb-checkbox-bg'],
        'Active': ['--lb-checkbox-checked-bg'],
        'Rahmen': ['--lb-checkbox-border'],
        'Textfarbe': ['--lb-checkbox-text']
      },
      'Checkbox Gruppe': {
        'Grundfarbe': ['--lb-checkbox-group-bg', '--lb-card-bg'],
        'Rahmen': ['--lb-checkbox-group-border', '--lb-card-border'],
        'Radius': ['--lb-radius-card']
      }
    },
    'Radio': {
      'Standard Radio': {
        'Grundfarbe': ['--lb-radio-bg'],
        'Active': ['--lb-radio-checked-bg'],
        'Rahmen': ['--lb-radio-border'],
        'Textfarbe': ['--lb-radio-text']
      },
      'Radio Gruppe': {
        'Grundfarbe': ['--lb-radio-group-bg', '--lb-card-bg'],
        'Rahmen': ['--lb-radio-group-border', '--lb-card-border'],
        'Radius': ['--lb-radius-card']
      }
    },
    'Dropdowns': {
      'Dropdown Menü': {
        'Grundfarbe': ['--lb-dropdown-bg'],
        'Textfarbe': ['--lb-dropdown-text'],
        'Hover': ['--lb-dropdown-hover-bg'],
        'Rahmen': ['--lb-dropdown-border'],
        'Schatten': ['--lb-dropdown-shadow']
      },
      'Dropdown Button': {
        'Grundfarbe': ['--lb-dropdown-button-bg', '--lb-btn-bg'],
        'Textfarbe': ['--lb-dropdown-button-text', '--lb-btn-text'],
        'Rahmen': ['--lb-dropdown-button-border', '--lb-btn-border']
      }
    },
    'Slider': {
      'Standard Slider': {
        'Grundfarbe': ['--lb-slider-active-bg', '--lb-slider-fill-bg', '--lb-range-active-bg'],
        'Hintergrund': ['--lb-slider-bg', '--lb-slider-track-bg', '--lb-range-track-bg'],
        'Knopf': ['--lb-slider-thumb-bg', '--lb-slider-thumb-border']
      },
      'Compact Slider': {
        'Grundfarbe': ['--lb-slider-compact-active-bg', '--lb-slider-active-bg', '--lb-slider-fill-bg', '--lb-range-active-bg'],
        'Hintergrund': ['--lb-slider-compact-bg', '--lb-slider-bg', '--lb-slider-track-bg', '--lb-range-track-bg'],
        'Knopf': ['--lb-slider-compact-thumb-bg', '--lb-slider-compact-thumb-border', '--lb-slider-thumb-bg', '--lb-slider-thumb-border']
      }
    },
    'Toggle': {
      'Standard Toggle': {
        'Active': ['--lb-switch-on-bg', '--lb-toggle-active-bg'],
        'Hintergrund': ['--lb-switch-off-bg', '--lb-toggle-bg'],
        'Rahmen': ['--lb-switch-border', '--lb-toggle-border'],
        'Knopf': ['--lb-switch-thumb-bg', '--lb-toggle-thumb-bg', '--lb-toggle-knob-bg'],
        'Radius': ['--lb-switch-radius', '--lb-toggle-radius', '--lb-toggle-slider-radius', '--lb-toggle-thumb-radius', '--lb-toggle-knob-radius']
      },
      'Toggle Disabled': {
        'Grundfarbe': ['--lb-switch-disabled-bg'],
        'Knopf': ['--lb-switch-disabled-thumb-bg'],
        'Textfarbe': ['--lb-disabled-text']
      }
    },
    'Buttons': {
      'Standard Button': {
        'Grundfarbe': ['--lb-btn-bg'],
        'Textfarbe': ['--lb-btn-text'],
        'Rahmen': ['--lb-btn-border'],
        'Hover': ['--lb-btn-hover-bg', '--lb-btn-hover-border'],
        'Radius': ['--lb-radius-button', '--lb-btn-radius'],
        'Schatten': ['--lb-btn-shadow']
      },
      'Active Button': {
        'Grundfarbe': ['--lb-active-bg', '--lb-btn-primary-bg'],
        'Textfarbe': ['--lb-active-text', '--lb-btn-primary-text'],
        'Rahmen': ['--lb-active-border', '--lb-btn-primary-border'],
        'Hover': ['--lb-active-hover-bg']
      },
      'Button Gruppe': {
        'Grundfarbe': ['--lb-btn-group-inactive-bg'],
        'Textfarbe': ['--lb-btn-group-inactive-text'],
        'Rahmen': ['--lb-btn-group-border', '--lb-btn-group-inactive-border', '--lb-btn-group-active-border'],
        'Hover': ['--lb-btn-group-hover-bg'],
        'Hover Textfarbe': ['--lb-btn-group-hover-text'],
        'Active': ['--lb-btn-group-active-bg'],
        'Active Textfarbe': ['--lb-btn-group-active-text'],
        'Active Hover': ['--lb-btn-group-active-hover-bg'],
        'Active Hover Textfarbe': ['--lb-btn-group-active-hover-text'],
        'Radius': ['--lb-btn-group-radius', '--lb-btn-group-item-radius', '--lb-btn-radius', '--lb-radius-button']
      },
      'Header Buttons': {
        'Grundfarbe': ['--lb-header-btn-bg'],
        'Textfarbe': ['--lb-header-btn-text'],
        'Hover': ['--lb-header-btn-hover-bg', '--lb-header-btn-hover-text'],
        'Radius': ['--lb-btn-radius'],
        'Rahmen': ['--lb-btn-border']
      }
    },
    'Cards/Notes': {
      'Standard Card': {
        'Grundfarbe': ['--lb-card-bg'],
        'Textfarbe': ['--lb-card-text'],
        'Rahmen': ['--lb-card-border'],
        'Hover': ['--lb-card-hover-bg', '--lb-card-hover-border'],
        'Radius': ['--lb-radius-card', '--lb-card-radius'],
        'Schatten': ['--lb-card-shadow']
      },
      'Note / Hinweis': {
        'Grundfarbe': ['--lb-note-bg', '--lb-card-bg'],
        'Textfarbe': ['--lb-note-text', '--lb-card-text'],
        'Rahmen': ['--lb-note-border', '--lb-card-border'],
        'Radius': ['--lb-radius-card']
      },
      'Glass Card': {
        'Grundfarbe': ['--lb-glass-bg', '--lb-card-bg'],
        'Rahmen': ['--lb-glass-border', '--lb-card-border'],
        'Transparenz': ['--lb-glass-opacity'],
        'Schatten': ['--lb-glass-shadow', '--lb-card-shadow']
      }
    },
    'tabellen': {
      'Standard Tabelle': {
        'Grundfarbe': ['--lb-table-bg', '--lb-table-row-bg', '--lb-table-body-bg'],
        'Textfarbe': ['--lb-table-text', '--lb-table-row-text'],
        'Header': ['--lb-table-header-bg'],
        'Header Textfarbe': ['--lb-table-header-text'],
        'Rahmen': ['--lb-table-border-color', '--lb-table-header-border-color', '--lb-table-row-border-color', '--lb-table-border'],
        'Rahmenstärke': ['--lb-table-border-width', '--lb-table-outer-border-width'],
        'Hover': ['--lb-table-row-hover-bg', '--lb-table-hover-bg'],
        'Hover Textfarbe': ['--lb-table-row-hover-text', '--lb-table-hover-text'],
        'Radius': ['--lb-table-radius', '--lb-radius-table']
      },
      'Compact Tabelle': {
        'Grundfarbe': ['--lb-table-compact-bg', '--lb-table-bg'],
        'Textfarbe': ['--lb-table-compact-text', '--lb-table-text'],
        'Header': ['--lb-table-compact-header-bg', '--lb-table-header-bg'],
        'Header Textfarbe': ['--lb-table-compact-header-text', '--lb-table-header-text'],
        'Rahmen': ['--lb-table-compact-border-color', '--lb-table-border-color', '--lb-table-border'],
        'Rahmenstärke': ['--lb-table-compact-border-width', '--lb-table-border-width', '--lb-table-outer-border-width'],
        'Hover': ['--lb-table-compact-hover-bg', '--lb-table-row-hover-bg', '--lb-table-hover-bg'],
        'Hover Textfarbe': ['--lb-table-compact-hover-text', '--lb-table-row-hover-text', '--lb-table-hover-text'],
        'Radius': ['--lb-table-compact-radius', '--lb-table-radius', '--lb-radius-table']
      },
      'Tabelle mit Selects': {
        'Grundfarbe': ['--lb-table-bg', '--lb-table-row-bg'],
        'Textfarbe': ['--lb-table-text', '--lb-table-row-text'],
        'Rahmen': ['--lb-table-border-color', '--lb-table-border'],
        'Rahmenstärke': ['--lb-table-border-width', '--lb-table-outer-border-width'],
        'Hover': ['--lb-table-row-hover-bg', '--lb-table-hover-bg'],
        'Hover Textfarbe': ['--lb-table-row-hover-text', '--lb-table-hover-text'],
        'Select Grundfarbe': ['--lb-select-bg', '--lb-input-bg'],
        'Select Textfarbe': ['--lb-select-text', '--lb-input-text'],
        'Select Rahmen': ['--lb-select-border', '--lb-input-border'],
        'Select Hover': ['--lb-select-hover-bg'],
        'Radius': ['--lb-table-radius', '--lb-radius-table']
      },
      'Tabelle mit Buttons': {
        'Grundfarbe': ['--lb-table-bg', '--lb-table-row-bg'],
        'Textfarbe': ['--lb-table-text', '--lb-table-row-text'],
        'Rahmen': ['--lb-table-border-color', '--lb-table-border'],
        'Rahmenstärke': ['--lb-table-border-width', '--lb-table-outer-border-width'],
        'Hover': ['--lb-table-row-hover-bg', '--lb-table-hover-bg'],
        'Hover Textfarbe': ['--lb-table-row-hover-text', '--lb-table-hover-text'],
        'Buttonfarbe': ['--lb-btn-bg'],
        'Button-Textfarbe': ['--lb-btn-text'],
        'Button Rahmen': ['--lb-btn-border'],
        'Button Hover': ['--lb-btn-hover-bg'],
        'Button Hover Textfarbe': ['--lb-btn-hover-text'],
        'Radius': ['--lb-table-radius', '--lb-radius-table']
      }
    },
    'Layout': {
      'Seitenlayout': {
        'Grundfarbe': ['--lb-bg', '--lb-page-bg', '--lb-content-bg'],
        'Textfarbe': ['--lb-text'],
        'Rahmen': ['--lb-border'],
        'Radius': ['--lb-radius']
      },
      'Header': {
        'Grundfarbe': ['--lb-header-bg'],
        'Textfarbe': ['--lb-header-text'],
        'Rahmen': ['--lb-header-border']
      },
      'Sidebar': {
        'Grundfarbe': ['--lb-sidebar-bg'],
        'Textfarbe': ['--lb-sidebar-text'],
        'Active': ['--lb-sidebar-active-bg', '--lb-nav-active-bg'],
        'Hover': ['--lb-sidebar-link-hover-bg', '--lb-nav-hover-bg']
      },
      'Sidebar Einträge': {
        'Textfarbe': ['--lb-sidebar-text'],
        'Buttonfarbe': ['--lb-sidebar-active-bg'],
        'Button-Textfarbe': ['--lb-sidebar-active-text'],
        'Hover': ['--lb-sidebar-link-hover-bg', '--lb-sidebar-hover-bg', '--lb-nav-hover-bg'],
        'Hover Textfarbe': ['--lb-sidebar-link-hover-text', '--lb-sidebar-hover-text', '--lb-nav-hover-text'],
        'Radius': ['--lb-sidebar-link-radius']
      }
    },
    'hover': {
      'Global Hover': {
        'Grundfarbe': ['--lb-hover-bg'],
        'Textfarbe': ['--lb-hover-text'],
        'Rahmen': ['--lb-hover-border'],
        'Schatten': ['--lb-hover-shadow']
      },
      'Card Hover': {
        'Grundfarbe': ['--lb-card-hover-bg'],
        'Rahmen': ['--lb-card-hover-border'],
        'Schatten': ['--lb-card-hover-shadow']
      },
      'Table Hover': {
        'Grundfarbe': ['--lb-table-row-hover-bg', '--lb-table-hover-bg'],
        'Textfarbe': ['--lb-table-hover-text']
      }
    },
    'Validation': {
      'Success': {
        'Grundfarbe': ['--lb-success-bg'],
        'Textfarbe': ['--lb-success-text'],
        'Rahmen': ['--lb-success-border']
      },
      'Warning': {
        'Grundfarbe': ['--lb-warning-bg'],
        'Textfarbe': ['--lb-warning-text'],
        'Rahmen': ['--lb-warning-border']
      },
      'Error': {
        'Grundfarbe': ['--lb-error-bg'],
        'Textfarbe': ['--lb-error-text'],
        'Rahmen': ['--lb-error-border']
      }
    },
    'Modal': {
      'Standard Modal': {
        'Grundfarbe': ['--lb-modal-bg', '--lb-dialog-bg'],
        'Textfarbe': ['--lb-modal-text', '--lb-dialog-text'],
        'Rahmen': ['--lb-modal-border', '--lb-dialog-border'],
        'Radius': ['--lb-dialog-radius', '--lb-radius-card'],
        'Schatten': ['--lb-modal-shadow', '--lb-dialog-shadow']
      },
      'Modal Overlay': {
        'Grundfarbe': ['--lb-modal-overlay-bg'],
        'Transparenz': ['--lb-modal-overlay-opacity']
      }
    },
    'Background': {
      'System Hintergrund': {
        'Grundfarbe': ['--lb-bg', '--lb-page-bg'],
        'Textfarbe': ['--lb-text'],
        'Transparenz': ['--lb-bg-opacity']
      },
      'Wallpaper': {
        'Grundfarbe': ['--lb-wallpaper-bg', '--lb-bg'],
        'Abdunklung': ['--lb-wallpaper-dim'],
        'Unschärfe': ['--lb-wallpaper-blur']
      },
      'Glass Background': {
        'Grundfarbe': ['--lb-glass-bg', '--lb-card-bg'],
        'Transparenz': ['--lb-glass-opacity'],
        'Schatten': ['--lb-glass-shadow']
      }
    }
  };

  var propertyPaletteDefaults = {
    'Grundfarbe': ['#f7f7f7', '#ffffff', '#e5e5e5', '#6dac20', '#3d3d3d', '#171717'],
    'Textfarbe': ['#171717', '#404040', '#737373', '#ffffff', '#f5f5f5', '#000000'],
    'Hintergrund': ['#ffffff', '#f7f7f7', '#f5f5f5', '#e5e5e5', '#3d3d3d', '#171717'],
    'Rahmen': ['#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#6dac20', '#404040'],
    'Hover': ['#f5f5f5', '#e5e5e5', '#edf6e7', '#d4d4d4', '#5a9418', '#404040'],
    'Active': ['#6dac20', '#5a9418', '#4a7a12', '#3d3d3d', '#ffffff', '#171717'],
    'Buttonfarbe': ['#6dac20', '#5a9418', '#4a7a12', '#8b5e34', '#3d3d3d', '#171717'],
    'Button-Textfarbe': ['#ffffff', '#f5f5f5', '#171717', '#000000', '#3d3d3d', '#737373'],
    'Hover Textfarbe': ['#ffffff', '#f5f5f5', '#171717', '#000000', '#3d3d3d', '#737373'],
    'Header': ['#ffffff', '#f7f7f7', '#e5e5e5', '#6dac20', '#3d3d3d', '#171717'],
    'Disabled': ['#f5f5f5', '#eeeeee', '#d4d4d4', '#a3a3a3', '#737373', '#404040'],
    'Focus': ['#6dac20', '#5a9418', '#4a7a12', '#737373', '#404040', '#171717'],
    'Schatten': ['#000000', '#171717', '#404040', '#737373', '#3d3d3d', '#6dac20'],
    'Radius': ['#6dac20', '#5a9418', '#737373', '#404040', '#171717', '#ffffff'],
    'Transparenz': ['#ffffff', '#f7f7f7', '#e5e5e5', '#737373', '#404040', '#171717'],
    'Knopf': ['#e6e6e6', '#d4d4d4', '#6dac20', '#5a9418', '#ffffff', '#171717'],
    'Abdunklung': ['#000000', '#171717', '#3d3d3d', '#404040', '#737373', '#a3a3a3'],
    'Unschärfe': ['#ffffff', '#f7f7f7', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#737373']
  };
  function classifyStatusKind(message, isError, kind) {
    if (isError) return 'error';
    if (kind) return kind;

    var text = String(message || '').toLowerCase();

    // Blue: running, waiting, intermediate, or "please do the next step" states.
    if (
      /\b(speichere|saving|lösche|deleting|lade\b|loading|frage|requesting|warte|waiting|prüfe|checking|validiere|validating|erzeuge|generating)\b/.test(text) ||
      /\.\.\./.test(text) ||
      /bitte\s+(validieren|warten|prüfen|zuerst|danach)/.test(text) ||
      /(please\s+(validate|wait|review|first|then))/.test(text)
    ) {
      return 'info';
    }

    // Green: completed/OK states.
    if (
      /(ok|alles in ordnung|erfolgreich|gültig|valid|geladen|loaded|gelöscht|deleted|gespeichert|saved|importiert|imported|übernommen|applied|erhalten|received|gelesen|read|erstellt|created)/.test(text)
    ) {
      return 'success';
    }

    return 'success';
  }

  function applyStatusKind(box, kind) {
    if (!box) return;
    box.classList.toggle('cfw-status-error', kind === 'error');
    box.classList.toggle('cfw-status-info', kind === 'info');
    box.classList.toggle('cfw-status-success', kind === 'success');
    box.classList.toggle('cfw-status-warning', kind === 'warning');
  }

  function closeStatusModal() {
    if (statusModalTimer) {
      clearTimeout(statusModalTimer);
      statusModalTimer = null;
    }
    if (statusModal) statusModal.hidden = true;
  }

  function statusModalTitleKey(kind) {
    if (kind === 'error') return 'statusModal.errorTitle';
    if (kind === 'success') return 'statusModal.successTitle';
    if (kind === 'warning') return 'statusModal.warningTitle';
    return 'statusModal.infoTitle';
  }

  function statusModalTitleFallback(kind) {
    if (kind === 'error') return 'Fehler';
    if (kind === 'success') return 'OK';
    if (kind === 'warning') return 'Hinweis';
    return 'Hinweis';
  }

  function statusModalIconValue(kind) {
    if (kind === 'error') return '!';
    if (kind === 'success') return '✓';
    if (kind === 'warning') return '!';
    return 'i';
  }

  function showStatusModal(message, kind, options) {
    if (!statusModal || !statusModalCard || !message) return;
    options = options || {};
    closeStatusModal();

    ['cfw-status-error', 'cfw-status-info', 'cfw-status-success', 'cfw-status-warning'].forEach(function (cls) {
      statusModalCard.classList.remove(cls);
    });
    statusModalCard.classList.add('cfw-status-' + kind);

    if (statusModalTitle) {
      statusModalTitle.textContent = t(statusModalTitleKey(kind), statusModalTitleFallback(kind));
    }
    if (statusModalIcon) statusModalIcon.textContent = statusModalIconValue(kind);
    if (statusModalMessage) statusModalMessage.textContent = message;

    var timeout = options.timeout;
    if (timeout == null) timeout = kind === 'error' ? 0 : 5000;

    if (statusModalActions) statusModalActions.hidden = timeout > 0;
    if (statusModalBack) {
      statusModalBack.textContent = t(kind === 'error' ? 'main.buttons.back' : 'main.buttons.ok', kind === 'error' ? 'Zurück' : 'OK');
    }
    if (statusModalHint) {
      statusModalHint.textContent = timeout > 0
        ? t('statusModal.autoCloseHint', 'Diese Meldung schließt automatisch.')
        : t('statusModal.manualCloseHint', 'Bitte bestätigen.');
    }

    statusModal.hidden = false;

    if (timeout > 0) {
      statusModalTimer = setTimeout(function () {
        closeStatusModal();
      }, timeout);
    }
  }

  function shouldShowStatusModal(message, kind, options) {
    if (options && options.modal === false) return false;

    // V135: Errors always use the modal. Selected user guidance may explicitly
    // request a manual info modal with OK button; all other status stays inline.
    if (options && options.modal === 'manual') return true;
    return kind === 'error';
  }

  function setStatus(message, isError, kind, options) {
    if (!statusBox) return;
    options = options || {};
    var resolvedKind = classifyStatusKind(message, isError, kind);
    statusBox.textContent = message || '';
    applyStatusKind(statusBox, resolvedKind);
    if (message && shouldShowStatusModal(message, resolvedKind, options)) {
      showStatusModal(message, resolvedKind, { timeout: 0 });
    }
  }


  function normalizeThemeDisplayName(name) {
    name = String(name || '').trim();
    name = name.replace(/^loxberry[\s_-]*/i, '').trim();
    return name || 'User Theme';
  }

  function slugifyThemeName(name) {
    var slug = normalizeThemeDisplayName(name)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return 'theme-user-' + (slug || 'theme');
  }

  function semverPatchPlus(version) {
    var m = String(version || '0.1.0').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return '0.1.1';
    return [m[1], m[2], String(Number(m[3]) + 1)].join('.');
  }

  function updateThemeIdentityFromName() {
    if (!themeName || !themeId) return;
    themeName.value = normalizeThemeDisplayName(themeName.value);
    themeId.value = slugifyThemeName(themeName.value);
    var existing = userThemes.find(function (theme) { return theme && theme.id === themeId.value; });
    if (existing && themeVersion) themeVersion.value = semverPatchPlus(existing.version || '0.1.0');
    else if (themeVersion && !themeVersion.value) themeVersion.value = '0.1.0';
  }

  function makeOption(value, label, title) {
    var option = document.createElement('option');
    option.value = value;
    option.textContent = label || value;
    if (title) option.title = title;
    return option;
  }

  function formatTokenList(tokens, max) {
    tokens = (tokens || []).filter(function (name, idx, arr) { return arr.indexOf(name) === idx; });
    if (!tokens.length) return '';
    max = max || 3;
    var visible = tokens.slice(0, max).join(', ');
    if (tokens.length > max) visible += ' +' + (tokens.length - max);
    return visible;
  }

  function tokensForVariant(areaName, variantName) {
    var variant = ((areas[areaName] || {})[variantName] || {});
    var out = [];
    Object.keys(variant).forEach(function (property) {
      (variant[property] || []).forEach(function (token) {
        if (out.indexOf(token) < 0) out.push(token);
      });
    });
    return out;
  }

  function currentArea() { return areaSelect.value; }
  function currentElement() { return elementSelect.value; }
  function currentGroup() { return colorGroupSelect.value; }
  function currentKey() { return currentArea() + '|' + currentElement() + '|' + currentGroup(); }

  function currentMapping() {
    var area = areas[currentArea()] || {};
    var element = area[currentElement()] || {};
    return element[currentGroup()] || [];
  }

  function hexToRgb(hex) {
    hex = String(hex || '#007aff').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex || '007aff', 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

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

  function isForcedOpaqueToken(token) {
    return token === '--lb-sidebar-bg';
  }

  function enforceForcedOpaqueTokens(tokens) {
    if (!tokens || typeof tokens !== 'object') return tokens;
    Object.keys(tokens).forEach(function (token) {
      if (isForcedOpaqueToken(token)) {
        tokens[token] = makeCssColorOpaque(tokens[token]);
      }
    });
    return tokens;
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

  function canEditCurrentColorTarget() {
    return !!hasActiveEditorSelection;
  }

  function requireColorEditTarget() {
    if (canEditCurrentColorTarget()) return true;
    setStatus(t('messages.selectElementFirst', 'Bitte zuerst ein Element im Arbeitsbereich / Vorschau oder im Eigenschaftenbereich auswählen.'), false, 'info', { modal: 'manual' });
    return false;
  }

  function updateColorPresetSelection() {
    if (!colorPresetPalette || !colorPicker) return;
    var current = normalizeHexColor(colorPicker.value) || String(colorPicker.value || '').toLowerCase();
    colorPresetPalette.querySelectorAll('.cfw-color-swatch').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-color') === current);
    });
  }

  function openNativeColorPicker() {
    if (!colorPicker) return;
    try {
      if (typeof colorPicker.showPicker === 'function') {
        colorPicker.showPicker();
        return;
      }
    } catch (e) {
      // Browser may block showPicker outside direct user activation.
    }
    try {
      colorPicker.focus();
      colorPicker.click();
    } catch (e2) {}
  }

  function choosePresetColor(color) {
    if (!colorPicker) return;
    if (!requireColorEditTarget()) return;
    var normalized = normalizeHexColor(color);
    if (!normalized) return;
    colorPicker.value = normalized;
    colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
    updateColorPresetSelection();
    openNativeColorPicker();
  }

  function renderColorPresetPalette() {
    if (!colorPresetPalette) return;
    colorPresetPalette.innerHTML = '';
    colorPresetValues.forEach(function (color) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cfw-color-swatch';
      button.setAttribute('data-color', color);
      button.style.setProperty('--cfw-swatch-color', color);
      button.setAttribute('aria-label', 'Farbe ' + color + ' wählen');
      button.title = color;
      button.addEventListener('click', function () {
        choosePresetColor(color);
      });
      colorPresetPalette.appendChild(button);
    });
    updateColorPresetSelection();
  }

  function aiColorDirectionLabel(item) {
    if (!item) return '';
    return i18nLanguage === 'de' ? item.de : item.en;
  }

  function appendAiColorDirection(item) {
    var prompt = document.getElementById('aiPrompt');
    if (!prompt || !item) return;
    var label = aiColorDirectionLabel(item);
    if (!label) return;
    var line = t('ai.colorDirectionPrompt', 'Verwende als Farbrichtung: {color}.', { color: label });
    var text = String(prompt.value || '').trim();
    var deRe = /^Verwende als Farbrichtung: .+\.$/im;
    var enRe = /^Use this color direction: .+\.$/im;
    if (deRe.test(text)) {
      prompt.value = text.replace(deRe, line);
    } else if (enRe.test(text)) {
      prompt.value = text.replace(enRe, line);
    } else {
      prompt.value = (text ? text + '\n\n' : '') + line;
    }
    aiColorPresetPalette && aiColorPresetPalette.querySelectorAll('.cfw-ai-color-swatch').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-color') === item.color);
    });
    prompt.focus();
  }

  function renderAiColorPresetPalette() {
    if (!aiColorPresetPalette) return;
    aiColorPresetPalette.innerHTML = '';
    aiColorPresetMeta.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cfw-ai-color-swatch';
      button.setAttribute('data-color', item.color);
      button.style.setProperty('--cfw-swatch-color', item.color);
      button.style.backgroundColor = item.color;
      var label = aiColorDirectionLabel(item);
      button.setAttribute('aria-label', label);
      button.title = label;
      button.addEventListener('click', function () { appendAiColorDirection(item); });
      aiColorPresetPalette.appendChild(button);
    });
  }

  function pushColorUnique(out, value) {
    var hex = normalizeHexColor(value);
    if (hex && out.indexOf(hex) < 0) out.push(hex);
  }

  var preferredPaletteTokens = [
    '--lb-bg', '--lb-content-bg', '--lb-card-bg', '--lb-card-text', '--lb-primary', '--lb-primary-hover', '--lb-primary-dark',
    '--lb-active-bg', '--lb-active-text', '--lb-btn-primary-bg', '--lb-btn-primary-text', '--lb-btn-bg', '--lb-btn-text',
    '--lb-sidebar-bg', '--lb-sidebar-text', '--lb-sidebar-active-bg', '--lb-sidebar-active-text', '--lb-sidebar-link-hover-bg', '--lb-sidebar-link-hover-text', '--lb-text', '--lb-text-secondary', '--lb-text-muted', '--lb-border-color',
    '--lb-border', '--lb-card-border', '--lb-input-bg', '--lb-input-text', '--lb-input-border', '--lb-table-header-bg',
    '--lb-table-header-text', '--lb-table-bg', '--lb-table-border-color', '--lb-slider-active-bg', '--lb-slider-fill-bg', '--lb-range-active-bg', '--lb-slider-bg', '--lb-slider-track-bg', '--lb-range-track-bg', '--lb-slider-thumb-bg', '--lb-slider-thumb-border', '--lb-slider-compact-active-bg', '--lb-slider-compact-bg', '--lb-slider-compact-thumb-bg', '--lb-slider-compact-thumb-border', '--lb-success', '--lb-warning', '--lb-danger'
  ];

  function uniqueTokenNames(extraNames) {
    var out = [];
    function add(name) {
      name = String(name || '').trim();
      if (/^--lb-[a-z0-9-]+$/i.test(name) && out.indexOf(name) < 0) out.push(name);
    }
    preferredPaletteTokens.forEach(add);
    Object.keys(coreTokens || {}).forEach(add);
    (extraNames || []).forEach(add);
    Object.keys(aiImportedTokens || {}).forEach(add);
    return out;
  }

  function readRuntimeThemeTokens(extraNames) {
    var tokens = {};
    var nodes = [document.documentElement, document.body, document.querySelector('.cfw-page')].filter(Boolean);
    var names = uniqueTokenNames(extraNames);
    nodes.forEach(function (node) {
      var style;
      try { style = window.getComputedStyle(node); } catch (e) { style = null; }
      if (!style) return;
      names.forEach(function (name) {
        var value = String(style.getPropertyValue(name) || '').trim();
        if (value) tokens[name] = value;
      });
    });
    return tokens;
  }

  function effectivePreviewTokens(extraNames) {
    var tokens = {};
    // V75: Initial Working-State colors come from the currently active LoxBerry
    // theme at runtime, not from the historical demo/fallback palette. User/AI
    // tokens and dirty workbench edits override that base afterwards.
    Object.assign(tokens, coreTokens || {});
    Object.assign(tokens, readRuntimeThemeTokens(extraNames) || {});
    Object.assign(tokens, collectTokens() || {});
    return applyDesignRules(tokens);
  }

  function isColorLikeValue(value) {
    value = String(value || '').trim();
    return /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(value);
  }

  function paletteRoleLabel(name) {
    name = String(name || '');
    if (/text/.test(name)) return 'Text';
    if (/border/.test(name)) return 'Rahmen';
    if (/hover/.test(name)) return 'Hover';
    if (/active/.test(name)) return 'Aktiv';
    if (/primary/.test(name)) return 'Primär';
    if (/button|btn/.test(name)) return 'Button';
    if (/input|select|textarea/.test(name)) return 'Eingabe';
    if (/card|panel|surface/.test(name)) return 'Fläche';
    if (/bg|background/.test(name)) return 'Hintergrund';
    if (/table/.test(name)) return 'Tabelle';
    if (/sidebar/.test(name)) return 'Sidebar';
    if (/slider|range/.test(name)) return 'Slider';
    if (/switch|toggle|checkbox|radio/.test(name)) return 'Formular';
    return '';
  }

  function isSemanticPaletteToken(name) {
    var key = String(name || '').toLowerCase();
    return /(^|-)success($|-)|(^|-)warning($|-)|(^|-)error($|-)|(^|-)danger($|-)|(^|-)info($|-)|(^|-)notice($|-)|(^|-)alert($|-)/.test(key);
  }

  function isPreviewPaletteHelperToken(name) {
    var key = String(name || '').toLowerCase();
    // V169: Vorschaufarben zeigen nur echte Theme-/UI-Farben.
    // Hilfsfarben aus Editor, Tooltip, Badge, Label, Code, Help/Hinweis usw.
    // werden direkt an der Quelle ausgeschlossen, damit z. B. das alte
    // gelbe Hinweis-Label (#ffffc0) nicht als Themefarbe erscheint.
    return /(^|-)tooltip($|-)|(^|-)badge($|-)|(^|-)tag($|-)|(^|-)label($|-)|(^|-)code($|-)|(^|-)kbd($|-)|(^|-)mono($|-)|(^|-)help($|-)|(^|-)hint($|-)|(^|-)note($|-)|(^|-)message($|-)|(^|-)modal($|-)|(^|-)status($|-)|(^|-)editor($|-)|(^|-)inspector($|-)|(^|-)chip($|-)|(^|-)pill($|-)/.test(key);
  }

  function isPreviewPaletteHelperColor(value) {
    var normalized = normalizeHexColor(value);
    if (!normalized) return false;
    return {
      '#ffffc0': true,
      '#fffec0': true,
      '#fff8c5': true,
      '#fff7bf': true
    }[normalized] === true;
  }

  function addPaletteSample(out, seen, sourceTokens, name, label) {
    if (!sourceTokens || !name) return;
    // V165: Reine Status-/Semantikfarben gehören nicht in die Vorschaufarben.
    // Der Block dient der nutzerorientierten Farbzuordnung, nicht der Anzeige
    // von OK-/Warn-/Fehlerfarben. Direkt an der Datenquelle filtern, damit
    // keine leeren Kacheln oder CSS-Ausblendungen entstehen.
    if (isSemanticPaletteToken(name) || isPreviewPaletteHelperToken(name)) return;
    var value = sourceTokens[name];
    if (!isColorLikeValue(value) || isPreviewPaletteHelperColor(value)) return;
    var normalized = normalizeHexColor(value) || String(value).trim().toLowerCase();
    if (!normalized) return;
    var role = label || paletteRoleLabel(name) || name;
    if (seen[normalized]) {
      if (role && seen[normalized].roles.indexOf(role) < 0) seen[normalized].roles.push(role);
      return;
    }
    var sample = { token: '', label: role, roles: role ? [role] : [], color: String(value).trim() };
    seen[normalized] = sample;
    out.push(sample);
  }

  function themePaletteSamples(group, mappedTokens) {
    var source = effectivePreviewTokens(mappedTokens || []);
    var samples = [];
    var seen = {};

    // V163: Vorschaufarben sind farbzentriert. Gleiche Farbcodes werden
    // zusammengefasst, weil der Nutzer hier Farben zuordnet, nicht Tokens prüft.
    (mappedTokens || []).forEach(function (name) { addPaletteSample(samples, seen, source, name); });
    preferredPaletteTokens.forEach(function (name) { addPaletteSample(samples, seen, source, name); });
    Object.keys(source || {}).forEach(function (name) {
      if (samples.length < 12) addPaletteSample(samples, seen, source, name);
    });

    samples.forEach(function (sample) {
      if (sample.roles && sample.roles.length) sample.label = sample.roles.slice(0, 3).join(' / ');
    });

    // Fallback only when no real theme colors are available.
    var fallback = propertyPaletteDefaults[group] || propertyPaletteDefaults.Grundfarbe;
    var fallbackIndex = 0;
    while (samples.length < 12 && fallback.length) {
      var fallbackColor = fallback[fallbackIndex % fallback.length];
      var fallbackKey = normalizeHexColor(fallbackColor) || String(fallbackColor).trim().toLowerCase();
      if (!seen[fallbackKey]) {
        samples.push({
          token: '',
          label: t('preview.sampleColor', 'Beispielfarbe') + ' ' + (samples.length + 1),
          color: fallbackColor
        });
        seen[fallbackKey] = true;
      }
      fallbackIndex += 1;
      if (fallbackIndex > fallback.length * 2) break;
    }
    return samples.slice(0, 12);
  }

  function shadowValueToCss(level, color) {
    level = parseInt(level, 10) || 0;
    if (level <= 0) return 'none';
    var rgb = hexToRgb(color || '#000000');
    return '0 ' + (level * 3) + 'px ' + (level * 10) + 'px rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (0.10 + level * 0.03).toFixed(2) + ')';
  }

  function defaultEntry(dirty) {
    return {
      color: colorPicker.value || '#007aff',
      // V127: Opacity, brightness and shadow are no longer visible controls.
      // Keep them stable on defaults for new manual Studio edits.
      alpha: 100,
      brightness: 0,
      radius: parseInt(radiusRange.value || '12', 10),
      borderWidth: borderWidthRange ? parseInt(borderWidthRange.value || '1', 10) : 1,
      shadow: 1,
      dirty: !!dirty
    };
  }

  function editorKey(area, element, group) {
    return area + '|' + element + '|' + group;
  }

  function getEntryForKey(key) {
    if (!studioModel[key]) {
      if (undoRestoring) return defaultEntry(false);
      studioModel[key] = defaultEntry(false);
    }
    return studioModel[key];
  }

  function getEntry() {
    return getEntryForKey(currentKey());
  }

  function elementGroups(area, element) {
    return ((areas[area] || {})[element] || {});
  }

  function groupExistsForCurrentElement(group) {
    return !!elementGroups(currentArea(), currentElement())[group];
  }

  function resolveRadiusGroupForCurrentElement() {
    if (groupExistsForCurrentElement('Radius')) return 'Radius';
    var groups = elementGroups(currentArea(), currentElement());
    var names = Object.keys(groups);
    for (var i = 0; i < names.length; i += 1) {
      var name = names[i];
      var mapped = groups[name] || [];
      if (name === 'Radius' || mapped.some(function (token) { return /radius/.test(token); })) return name;
    }
    return '';
  }

  function isBorderWidthGroup(group) {
    return group === 'Rahmenstärke' || group === 'Border Width';
  }

  function resolveBorderWidthGroupForCurrentElement() {
    if (groupExistsForCurrentElement('Rahmenstärke')) return 'Rahmenstärke';
    if (groupExistsForCurrentElement('Border Width')) return 'Border Width';
    var groups = elementGroups(currentArea(), currentElement());
    var names = Object.keys(groups);
    for (var i = 0; i < names.length; i += 1) {
      var name = names[i];
      var mapped = groups[name] || [];
      if (isBorderWidthGroup(name) || mapped.some(function (token) { return /border-width/.test(token); })) return name;
    }
    return '';
  }

  function updateConditionalSettingVisibility() {
    var showBorderWidth = isBorderWidthGroup(currentGroup());
    if (borderWidthSetting) borderWidthSetting.hidden = !showBorderWidth;
  }

  function saveControlsToEntry(field) {
    field = field || 'all';

    if (field === 'radius') {
      var radiusGroup = resolveRadiusGroupForCurrentElement();
      if (!radiusGroup) {
        setStatus(t('messages.noRadiusForElement', 'Dieses Element besitzt keine Radius-Tokens.'), false, 'info', { modal: 'manual' });
        return false;
      }

      var radiusKey = editorKey(currentArea(), currentElement(), radiusGroup);
      var radiusEntry = getEntryForKey(radiusKey);
      radiusEntry.radius = parseInt(radiusRange.value || '12', 10);
      radiusEntry.dirty = true;

      // Make the implicit target visible in the inspector, but do not touch
      // background/text color tokens while the radius slider is moved.
      if (colorGroupSelect && colorGroupSelect.value !== radiusGroup) {
        colorGroupSelect.value = radiusGroup;
        loadEntryToControls(radiusEntry);
      }
      return true;
    }

    if (field === 'borderWidth') {
      var borderWidthGroup = resolveBorderWidthGroupForCurrentElement();
      if (!borderWidthGroup) {
        setStatus(t('messages.noBorderWidthForElement', 'Dieses Element besitzt keine Rahmenstärke-Tokens.'), false, 'info', { modal: 'manual' });
        return false;
      }

      var borderWidthKey = editorKey(currentArea(), currentElement(), borderWidthGroup);
      var borderWidthEntry = getEntryForKey(borderWidthKey);
      borderWidthEntry.borderWidth = borderWidthRange ? parseInt(borderWidthRange.value || '1', 10) : 1;
      borderWidthEntry.dirty = true;

      if (colorGroupSelect && colorGroupSelect.value !== borderWidthGroup) {
        colorGroupSelect.value = borderWidthGroup;
        loadEntryToControls(borderWidthEntry);
      }
      return true;
    }

    if (field === 'color') {
      var colorEntry = getEntry();
      colorEntry.color = colorPicker.value || colorEntry.color || '#007aff';
      colorEntry.alpha = 100;
      colorEntry.brightness = 0;
      colorEntry.shadow = 1;
      colorEntry.dirty = true;
      return true;
    }

    studioModel[currentKey()] = defaultEntry(true);
    return true;
  }

  function loadEntryToControls(entryOverride) {
    var entry = entryOverride || getEntry();
    colorPicker.value = entry.color || '#007aff';
    // V127: Hidden advanced channels stay deterministic instead of carrying
    // stale values between loaded themes and new manual edits.
    alphaRange.value = 100;
    brightnessRange.value = 0;
    radiusRange.value = entry.radius == null ? 12 : entry.radius;
    if (borderWidthRange) borderWidthRange.value = entry.borderWidth == null ? 1 : entry.borderWidth;
    shadowRange.value = 1;
    updateLabels();
  }

  function normalizeWallpaperMode(value) {
    value = String(value || 'cover').toLowerCase();
    return ['cover', 'contain', 'repeat', 'center'].indexOf(value) >= 0 ? value : 'cover';
  }

  function isBackgroundWallpaperEditable() {
    // V139: Wallpaper Editor is contextual. Show it only after the user
    // explicitly selects the real background target.
    return hasActiveEditorSelection && currentArea() === 'Background' && currentElement() === 'System Hintergrund';
  }

  function syncWallpaperStateFromControls() {
    if (!wallpaperEnabled || !wallpaperImage || !wallpaperMode || !wallpaperBrightness || !wallpaperOpacity) return;
    wallpaperState.enabled = !!wallpaperEnabled.checked;
    wallpaperState.image = String(wallpaperImage.value || '').trim();
    wallpaperState.mode = normalizeWallpaperMode(wallpaperMode.value);
    wallpaperState.brightness = clamp(parseInt(wallpaperBrightness.value || '100', 10), 0, 150);
    wallpaperState.opacity = clamp(parseInt(wallpaperOpacity.value || '100', 10), 0, 100);
  }

  function loadWallpaperStateToControls() {
    if (!wallpaperEnabled || !wallpaperImage || !wallpaperMode || !wallpaperBrightness || !wallpaperOpacity) return;
    wallpaperEnabled.checked = !!wallpaperState.enabled;
    wallpaperImage.value = wallpaperState.image || '';
    wallpaperMode.value = normalizeWallpaperMode(wallpaperState.mode);
    wallpaperBrightness.value = wallpaperState.brightness == null ? 100 : wallpaperState.brightness;
    wallpaperOpacity.value = wallpaperState.opacity == null ? 100 : wallpaperState.opacity;
  }

  function updateWallpaperLabels() {
    if (wallpaperBrightnessValue && wallpaperBrightness) wallpaperBrightnessValue.textContent = wallpaperBrightness.value + '%';
    if (wallpaperOpacityValue && wallpaperOpacity) wallpaperOpacityValue.textContent = wallpaperOpacity.value + '%';
  }

  function updateWallpaperFileName(file) {
    if (!wallpaperFileName) return;
    var fallback = t('wallpaper.noFile', 'No file selected');
    wallpaperFileName.textContent = file && file.name ? file.name : fallback;
    wallpaperFileName.title = wallpaperFileName.textContent;
  }

  function updateCssImportFileName(file) {
    if (!cssImportFileName) return;
    var fallback = t('wallpaper.noFile', 'No file selected');
    cssImportFileName.textContent = file && file.name ? file.name : fallback;
    cssImportFileName.title = cssImportFileName.textContent;
  }

  function updateWallpaperControlVisibility() {
    if (!wallpaperControls) return;
    var editable = isBackgroundWallpaperEditable();
    var enabled = !!(wallpaperEnabled && wallpaperEnabled.checked);
    var hasWallpaper = !!(wallpaperState && wallpaperState.enabled && wallpaperState.image);
    var visible = editable || hasWallpaper;

    // V147: When a loaded theme already uses a wallpaper, show the Wallpaper
    // Editor panel automatically, but keep it collapsed until the user selects
    // the real background target. This keeps the state visible without clutter.
    wallpaperControls.hidden = !visible;
    wallpaperControls.setAttribute('aria-hidden', visible ? 'false' : 'true');
    wallpaperControls.classList.toggle('cfw-wallpaper-has-saved', hasWallpaper);
    wallpaperControls.classList.toggle('cfw-wallpaper-context-editable', editable);
    wallpaperControls.classList.toggle('cfw-wallpaper-enabled', editable && enabled);

    if (wallpaperAdvancedControls) {
      var expanded = editable && enabled;
      wallpaperAdvancedControls.hidden = !expanded;
      wallpaperAdvancedControls.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    }
  }

  function wallpaperPreviewUrl(image) {
    image = String(image || '').trim();
    if (!image) return '';
    if (/^data:image\//i.test(image) || /^https?:\/\//i.test(image) || image.charAt(0) === '/') return image;
    if (/^assets\//i.test(image)) {
      return '/admin/plugins/cssframework/theme-file.cgi?file=' + encodeURIComponent(image).replace(/%2F/g, '%2F');
    }
    return image;
  }

  function buildWallpaperPayload() {
    syncWallpaperStateFromControls();
    return {
      enabled: !!wallpaperState.enabled,
      image: wallpaperState.image || '',
      mode: normalizeWallpaperMode(wallpaperState.mode),
      brightness: clamp(parseInt(wallpaperState.brightness == null ? 100 : wallpaperState.brightness, 10), 0, 150),
      opacity: clamp(parseInt(wallpaperState.opacity == null ? 100 : wallpaperState.opacity, 10), 0, 100)
    };
  }

  function applyWallpaperPreview() {
    if (!previewRoot) return;
    var wallpaper = buildWallpaperPayload();
    var hasWallpaper = !!(wallpaper.enabled && wallpaper.image);
    previewRoot.classList.toggle('cfw-wallpaper-enabled', hasWallpaper);
    if (hasWallpaper) {
      previewRoot.style.setProperty('--cfw-wallpaper-image', 'url("' + wallpaperPreviewUrl(wallpaper.image).replace(/"/g, '%22') + '")');
      previewRoot.style.setProperty('--cfw-wallpaper-opacity', String(wallpaper.opacity / 100));
      previewRoot.style.setProperty('--cfw-wallpaper-brightness', String(wallpaper.brightness / 100));
      previewRoot.style.setProperty('--cfw-wallpaper-size', wallpaper.mode === 'contain' ? 'contain' : (wallpaper.mode === 'repeat' || wallpaper.mode === 'center' ? 'auto' : 'cover'));
      previewRoot.style.setProperty('--cfw-wallpaper-repeat', wallpaper.mode === 'repeat' ? 'repeat' : 'no-repeat');
      previewRoot.style.setProperty('--cfw-wallpaper-position', 'center center');
    } else {
      previewRoot.style.removeProperty('--cfw-wallpaper-image');
      previewRoot.style.removeProperty('--cfw-wallpaper-opacity');
      previewRoot.style.removeProperty('--cfw-wallpaper-brightness');
      previewRoot.style.removeProperty('--cfw-wallpaper-size');
      previewRoot.style.removeProperty('--cfw-wallpaper-repeat');
      previewRoot.style.removeProperty('--cfw-wallpaper-position');
    }
  }

  function setWallpaperFromTheme(theme) {
    var wallpaper = theme && typeof theme === 'object' && theme.wallpaper && typeof theme.wallpaper === 'object' ? theme.wallpaper : null;
    wallpaperState = {
      enabled: !!(wallpaper && wallpaper.enabled),
      image: wallpaper && wallpaper.image ? String(wallpaper.image) : '',
      mode: normalizeWallpaperMode(wallpaper && wallpaper.mode),
      brightness: clamp(parseInt(wallpaper && wallpaper.brightness != null ? wallpaper.brightness : 100, 10), 0, 150),
      opacity: clamp(parseInt(wallpaper && wallpaper.opacity != null ? wallpaper.opacity : 100, 10), 0, 100)
    };
    loadWallpaperStateToControls();
    updateWallpaperLabels();
    updateWallpaperControlVisibility();
  }

  function updateLabels() {
    alphaValue.textContent = alphaRange.value + '%';
    brightnessValue.textContent = brightnessRange.value;
    radiusValue.textContent = radiusRange.value + 'px';
    if (borderWidthValue && borderWidthRange) borderWidthValue.textContent = borderWidthRange.value + 'px';
    shadowValue.textContent = shadowRange.value;
    updateConditionalSettingVisibility();
    updateWallpaperLabels();
    updateWallpaperControlVisibility();
    updateColorPresetSelection();
  }


  var undoStack = [];
  var undoLimit = 40;
  var undoRestoring = false;
  var undoArmedControl = null;

  function cloneStudioObject(value) {
    try { return JSON.parse(JSON.stringify(value == null ? null : value)); } catch (e) { return value; }
  }

  function currentControlSnapshot() {
    return {
      color: colorPicker ? (colorPicker.value || '#007aff') : '#007aff',
      alpha: 100,
      brightness: 0,
      radius: radiusRange ? parseInt(radiusRange.value || '12', 10) : 12,
      shadow: 1,
      dirty: false
    };
  }

  function makeUndoSnapshot(label) {
    return {
      label: label || '',
      selection: { area: currentArea(), element: currentElement(), group: currentGroup() },
      controls: currentControlSnapshot(),
      studioModel: cloneStudioObject(studioModel || {}),
      aiImportedTokens: cloneStudioObject(aiImportedTokens || {}),
      aiImportedCss: aiImportedCss || '',
      customCssValue: customCss ? (customCss.value || '') : '',
      lastImportMeta: cloneStudioObject(lastImportMeta || null),
      wallpaperState: cloneStudioObject(wallpaperState || { enabled: false, image: '', mode: 'cover', brightness: 100, opacity: 100 }),
      themeIdValue: themeId ? (themeId.value || '') : '',
      themeNameValue: themeName ? (themeName.value || '') : '',
      themeVersionValue: themeVersion ? (themeVersion.value || '') : ''
    };
  }

  function updateUndoButton() {
    if (!undoThemeButton) return;
    undoThemeButton.disabled = undoStack.length === 0;
    undoThemeButton.title = undoStack.length ? 'Letzte Änderung rückgängig machen' : 'Keine Änderung zum Rückgängigmachen';
  }

  function pushUndoSnapshot(label) {
    if (undoRestoring) return;
    undoStack.push(makeUndoSnapshot(label));
    if (undoStack.length > undoLimit) undoStack.shift();
    updateUndoButton();
  }

  function restoreUndoSnapshot(snapshot) {
    if (!snapshot) return;
    undoRestoring = true;
    studioModel = cloneStudioObject(snapshot.studioModel || {});
    aiImportedTokens = cloneStudioObject(snapshot.aiImportedTokens || {});
    aiImportedCss = snapshot.aiImportedCss || '';
    lastImportMeta = cloneStudioObject(snapshot.lastImportMeta || null);
    wallpaperState = cloneStudioObject(snapshot.wallpaperState || { enabled: false, image: '', mode: 'cover', brightness: 100, opacity: 100 });

    if (themeId) themeId.value = snapshot.themeIdValue || '';
    if (themeName) themeName.value = snapshot.themeNameValue || '';
    if (themeVersion) themeVersion.value = snapshot.themeVersionValue || '';
    if (customCss) customCss.value = snapshot.customCssValue || aiImportedCss || '';

    if (snapshot.selection && areas[snapshot.selection.area]) {
      areaSelect.value = snapshot.selection.area;
      renderElements();
      if ((areas[snapshot.selection.area] || {})[snapshot.selection.element]) {
        elementSelect.value = snapshot.selection.element;
        renderColorGroups();
      }
      if ((((areas[snapshot.selection.area] || {})[snapshot.selection.element] || {})[snapshot.selection.group])) {
        colorGroupSelect.value = snapshot.selection.group;
      }
    }

    loadEntryToControls(snapshot.controls || null);
    loadWallpaperStateToControls();
    updateWallpaperLabels();
    updateWallpaperControlVisibility();
    renderPropertyInspector();
    refreshPreviewAndPalette();
    undoRestoring = false;
    updateUndoButton();
    setStatus('Letzte Änderung rückgängig gemacht.', false);
  }

  function undoLastChange() {
    var snapshot = undoStack.pop();
    restoreUndoSnapshot(snapshot);
  }

  function armUndoForControl(control) {
    if (!control || undoRestoring) return;
    if (undoArmedControl === control) return;
    pushUndoSnapshot('control');
    undoArmedControl = control;
  }

  function disarmUndoForControl(control) {
    if (undoArmedControl === control) undoArmedControl = null;
  }

  function bindUndoControl(control) {
    if (!control) return;
    ['pointerdown', 'focus', 'keydown'].forEach(function (eventName) {
      control.addEventListener(eventName, function () { armUndoForControl(control); });
    });
    ['change', 'blur'].forEach(function (eventName) {
      control.addEventListener(eventName, function () { disarmUndoForControl(control); });
    });
  }


  var componentRegistry = {};

  function registerComponent(definition) {
    if (!definition || !definition.id) return;
    componentRegistry[definition.id] = definition;
  }

  function buildComponentRegistry() {
    Object.keys(areas).forEach(function (area) {
      Object.keys(areas[area] || {}).forEach(function (variant) {
        Object.keys((areas[area] || {})[variant] || {}).forEach(function (property) {
          registerComponent({
            id: [area, variant, property].join('::'),
            area: area,
            variant: variant,
            property: property,
            tokens: ((areas[area] || {})[variant] || {})[property] || []
          });
        });
      });
    });
  }

  function registryLookup(area, variant, property) {
    return componentRegistry[[area, variant, property].join('::')]
      || componentRegistry[[area, variant, 'Grundfarbe'].join('::')]
      || null;
  }

  function renderAreas() {
    areaSelect.innerHTML = '';
    Object.keys(areas).forEach(function (name) { areaSelect.appendChild(makeOption(name)); });
  }

  function primaryToken(tokens) {
    tokens = tokens || [];
    return tokens.length ? tokens[0] : '';
  }


  function relatedTokensForVariant(areaName, variantName) {
    var variant = (areas[areaName] || {})[variantName] || {};
    var out = [];
    Object.keys(variant).forEach(function (property) {
      (variant[property] || []).forEach(function (token) {
        if (out.indexOf(token) === -1) out.push(token);
      });
    });
    return out;
  }

  function propertyIcon(name) {
    var lower = String(name || '').toLowerCase();
    if (lower.indexOf('text') >= 0 || lower.indexOf('schrift') >= 0) return 'Aa';
    if (lower.indexOf('rahmen') >= 0 || lower.indexOf('border') >= 0) return '▢';
    if (lower.indexOf('hover') >= 0) return '✨';
    if (lower.indexOf('active') >= 0 || lower.indexOf('focus') >= 0) return '◎';
    if (lower.indexOf('disabled') >= 0) return '🚫';
    if (lower.indexOf('radius') >= 0) return '◯';
    if (lower.indexOf('schatten') >= 0 || lower.indexOf('shadow') >= 0) return '🌑';
    return '🎨';
  }

  function renderElements() {
    var areaName = currentArea();
    var area = areas[areaName] || {};
    elementSelect.innerHTML = '';
    Object.keys(area).forEach(function (name) {
      var tokens = tokensForVariant(areaName, name);
      elementSelect.appendChild(makeOption(name, name, tokens.join('\n')));
    });
    renderColorGroups();
  }

  function renderColorGroups() {
    var element = (areas[currentArea()] || {})[currentElement()] || {};
    colorGroupSelect.innerHTML = '';
    Object.keys(element).forEach(function (name) {
      var tokens = element[name] || [];
      var first = primaryToken(tokens);
      colorGroupSelect.appendChild(makeOption(name, first ? (name + ' (' + first + ')') : name, tokens.join('\n')));
    });
    loadEntryToControls();
    updateWallpaperControlVisibility();
    renderPropertyInspector();
    updateAll();
  }

  function renderPropertyInspector() {
    if (!propertyInspector) return;
    var areaName = currentArea();
    var variantName = currentElement();
    var element = (areas[areaName] || {})[variantName] || {};
    var props = Object.keys(element);
    var variantTokens = tokensForVariant(areaName, variantName);

    if (selectedElementTitle) selectedElementTitle.textContent = variantName || t('directEditor.noElement', 'Kein Element gewählt');
    if (selectedElementMeta) selectedElementMeta.textContent = props.length + ' ' + t('properties.property', 'Eigenschaften') + ' · ' + variantTokens.length + ' ' + t('tokens.tokens', 'Tokens');
    if (selectedTokenList) {
      selectedTokenList.innerHTML = variantTokens.length
        ? variantTokens.map(function (token) { return '<code>' + token + '</code>'; }).join(' ')
        : '<em>' + t('inspector.noMapping', 'Keine Tokens im Mapping') + '</em>';
    }

    propertyInspector.innerHTML = '';
    props.forEach(function (prop) {
      var tokens = element[prop] || [];
      var isActive = prop === currentGroup();
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'cfw-property-item' + (isActive ? ' is-active' : '');
      item.setAttribute('data-role', 'none');
      item.setAttribute('title', tokens.join('\n'));
      var first = primaryToken(tokens);
      var more = tokens.length > 1 ? '<span class="cfw-property-more">+' + (tokens.length - 1) + ' ' + t('inspector.moreTokens', 'weitere') + '</span>' : '';
      item.innerHTML = '' +
        '<span class="cfw-property-icon">' + propertyIcon(prop) + '</span>' +
        '<span class="cfw-property-body"><strong>' + prop + '</strong><code>' + (first || t('inspector.noToken', 'kein Token')) + '</code>' + more + '</span>';
      item.addEventListener('click', function () {
        hasActiveEditorSelection = true;
        colorGroupSelect.value = prop;
        loadEntryToControls();
        updateAll();
        previewCaption.textContent = areaName + ' → ' + variantName + ' → ' + prop;
      });
      item.addEventListener('dblclick', function (event) {
        event.preventDefault();
        event.stopPropagation();
        hasActiveEditorSelection = true;
        colorGroupSelect.value = prop;
        loadEntryToControls();
        updateAll();
        previewCaption.textContent = areaName + ' → ' + variantName + ' → ' + prop + ' (Direkteditor)';
        openInspectorForCurrentSelection();
      });
      item.setAttribute('title', t('inspector.propertyTitlePrefix', 'Klick: Eigenschaft wählen · Doppelklick: Direkteditor für diese Eigenschaft öffnen') + '\n' + tokens.join('\n'));
      propertyInspector.appendChild(item);
    });
  }

  function renderPalette() {
    paletteGrid.innerHTML = '';
    var group = currentGroup();
    var entry = getEntry();
    var tokens = currentMapping();
    var samples = themePaletteSamples(group, tokens);

    samples.forEach(function (sample) {
      var color = sample.color;
      var value = rgba(color, entry.alpha, entry.brightness);
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'cfw-palette-tile';
      tile.style.background = value;
      tile.setAttribute('data-role', 'none');
      var label = sample.token || sample.label || value;
      tile.innerHTML = '<span class="cfw-palette-token"></span><small class="cfw-palette-value"></small>';
      tile.querySelector('.cfw-palette-token').textContent = label;
      tile.querySelector('.cfw-palette-value').textContent = value;
      tile.addEventListener('click', function () {
        pushUndoSnapshot('palette');
        var normalized = normalizeHexColor(color);
        colorPicker.value = normalized || color;
        saveControlsToEntry();
        updateAll();
      });
      paletteGrid.appendChild(tile);
    });
  }

  function renderMonoPreview() {
    if (!monoPreview) return;
    var area = areas[currentArea()] || {};
    monoPreview.innerHTML = '';
    Object.keys(area).forEach(function (name) {
      var block = document.createElement('div');
      block.className = 'cfw-mono-card';
      block.innerHTML = '<strong>' + name + '</strong>' + monoMarkupFor(currentArea(), name);
      monoPreview.appendChild(block);
    });
  }

  function monoMarkupFor(area, name) {
    var lower = (area + ' ' + name).toLowerCase();
    if (lower.indexOf('tabelle') >= 0 || lower.indexOf('table') >= 0) return '<table><tr><th>Name</th><th>Status</th></tr><tr><td>Demo</td><td>OK</td></tr></table>';
    if (lower.indexOf('button') >= 0) return '<button type="button" data-role="none">Button</button>';
    if (lower.indexOf('select') >= 0 || lower.indexOf('dropdown') >= 0) return '<select data-role="none"><option>Auswahl</option></select>';
    if (lower.indexOf('input') >= 0) return '<input value="Input" data-role="none">';
    if (lower.indexOf('textarea') >= 0) return '<textarea rows="2" data-role="none">Textarea</textarea>';
    if (lower.indexOf('slider') >= 0) return '<input type="range" value="55" data-role="none">';
    if (lower.indexOf('toggle') >= 0 || lower.indexOf('switch') >= 0) return '<span class="cfw-switch"><input type="checkbox" checked><span></span></span>';
    if (lower.indexOf('checkbox') >= 0) return '<label><input type="checkbox" checked> Checkbox</label>';
    if (lower.indexOf('radio') >= 0) return '<label><input type="radio" checked> Radio</label>';
    if (lower.indexOf('modal') >= 0) return '<div class="mini-modal">Modal</div>';
    if (lower.indexOf('validation') >= 0 || lower.indexOf('success') >= 0 || lower.indexOf('warning') >= 0 || lower.indexOf('error') >= 0) return '<div class="mini-note">Hinweis</div>';
    return '<div class="mini-card">Preview</div>';
  }

  function collectTokens() {
    var tokens = {};
    Object.keys(aiImportedTokens || {}).forEach(function (name) {
      if (/^--lb-[a-z0-9-]+$/.test(name) && !isBlockedToken(name)) tokens[name] = aiImportedTokens[name];
    });
    Object.keys(studioModel).forEach(function (key) {
      var parts = key.split('|');
      var area = parts[0];
      var element = parts[1];
      var group = parts[2];
      var entry = studioModel[key];
      // V23: Only explicit user edits are compiled from the workbench.
      // Merely selecting an element or loading default slider values must not
      // override an imported/generated AI theme (this caused blue inputs/selects).
      if (!entry || !entry.dirty) return;
      var mapped = (((areas[area] || {})[element] || {})[group]) || [];
      mapped.forEach(function (token) {
        if (!/^--lb-[a-z0-9-]+$/.test(token) || isBlockedToken(token)) return;
        if (/border-width/.test(token) || isBorderWidthGroup(group)) {
          tokens[token] = (entry.borderWidth == null ? 1 : entry.borderWidth) + 'px';
        } else if (/radius/.test(token) || group === 'Radius') {
          tokens[token] = entry.radius + 'px';
        } else if (/shadow/.test(token) || group === 'Schatten') {
          tokens[token] = shadowValueToCss(entry.shadow, entry.color);
        } else if (/opacity/.test(token)) {
          tokens[token] = (entry.alpha / 100).toFixed(2);
        } else if (/blur/.test(token)) {
          tokens[token] = Math.max(0, Math.round(entry.brightness / 4)) + 'px';
        } else {
          tokens[token] = isForcedOpaqueToken(token)
            ? rgba(entry.color, 100, entry.brightness)
            : rgba(entry.color, entry.alpha, entry.brightness);
        }
      });
    });
    enforceForcedOpaqueTokens(tokens);
    return tokens;
  }

  function previewBridgeVarNames() {
    return [
      '--cfw-preview-button-bg',
      '--cfw-preview-button-text',
      '--cfw-preview-card-bg',
      '--cfw-preview-card-text',
      '--cfw-preview-card-border',
      '--cfw-preview-input-bg',
      '--cfw-preview-input-text',
      '--cfw-preview-input-border',
      '--cfw-preview-select-bg',
      '--cfw-preview-select-text',
      '--cfw-preview-select-border',
      '--cfw-preview-textarea-bg',
      '--cfw-preview-textarea-text',
      '--cfw-preview-textarea-border',
      '--cfw-preview-slider-active',
      '--cfw-preview-slider-track',
      '--cfw-preview-slider-thumb',
      '--cfw-preview-slider-thumb-border',
      '--cfw-preview-checkbox-bg',
      '--cfw-preview-checkbox-border',
      '--cfw-preview-checkbox-checked-bg',
      '--cfw-preview-radio-bg',
      '--cfw-preview-radio-border',
      '--cfw-preview-radio-checked-bg',
      '--cfw-preview-switch-on-bg',
      '--cfw-preview-switch-off-bg',
      '--cfw-preview-switch-border',
      '--cfw-preview-switch-thumb-bg',
      '--cfw-preview-table-bg',
      '--cfw-preview-table-text',
      '--cfw-preview-table-border',
      '--cfw-preview-table-border-width',
      '--cfw-preview-table-hover-bg',
      '--cfw-preview-table-hover-text',
      '--cfw-preview-notify-bg',
      '--cfw-preview-validation-bg'
    ];
  }

  function clearPreviewBridgeVars(root) {
    if (!root) return;
    previewBridgeVarNames().forEach(function (name) { root.style.removeProperty(name); });
  }

  function applyPreviewFallbacks(tokens) {
    var root = previewRoot;
    if (!root) return;
    clearPreviewBridgeVars(root);

    // V155: Rebuild preview bridge variables after every theme load from the
    // same effective token set that is applied to the preview root. This avoids
    // stale values from the initial Current Preview state.
    var fallbackMap = {
      '--cfw-preview-button-bg': tokens['--lb-btn-bg'] || tokens['--lb-active-bg'] || tokens['--lb-btn-primary-bg'],
      '--cfw-preview-button-text': tokens['--lb-btn-text'] || tokens['--lb-active-text'],
      '--cfw-preview-btn-group-border': tokens['--lb-btn-group-border'] || tokens['--lb-btn-group-inactive-border'] || tokens['--lb-btn-group-active-border'] || tokens['--lb-border-color'] || tokens['--lb-border'],
      '--cfw-preview-btn-group-inactive-bg': tokens['--lb-btn-group-inactive-bg'] || tokens['--lb-btn-bg'],
      '--cfw-preview-btn-group-inactive-text': tokens['--lb-btn-group-inactive-text'] || tokens['--lb-btn-text'],
      '--cfw-preview-card-bg': tokens['--lb-card-bg'] || tokens['--lb-note-bg'] || tokens['--lb-glass-bg'],
      '--cfw-preview-card-text': tokens['--lb-card-text'] || tokens['--lb-text'],
      '--cfw-preview-card-border': tokens['--lb-card-border'] || tokens['--lb-border'] || tokens['--lb-border-color'],
      '--cfw-preview-input-bg': tokens['--lb-input-bg'] || tokens['--lb-select-bg'],
      '--cfw-preview-input-text': tokens['--lb-input-text'] || tokens['--lb-text'],
      '--cfw-preview-input-border': tokens['--lb-input-border'] || tokens['--lb-border'] || tokens['--lb-border-color'],
      '--cfw-preview-select-bg': tokens['--lb-select-bg'] || tokens['--lb-input-bg'],
      '--cfw-preview-select-text': tokens['--lb-select-text'] || tokens['--lb-input-text'] || tokens['--lb-text'],
      '--cfw-preview-select-border': tokens['--lb-select-border'] || tokens['--lb-input-border'] || tokens['--lb-border'],
      '--cfw-preview-textarea-bg': tokens['--lb-textarea-bg'] || tokens['--lb-input-bg'] || tokens['--lb-card-bg'],
      '--cfw-preview-textarea-text': tokens['--lb-textarea-text'] || tokens['--lb-input-text'] || tokens['--lb-text'],
      '--cfw-preview-textarea-border': tokens['--lb-textarea-border'] || tokens['--lb-input-border'] || tokens['--lb-border'],
      '--cfw-preview-slider-active': tokens['--lb-slider-fill-bg'] || tokens['--lb-slider-active-bg'] || tokens['--lb-range-active-bg'] || tokens['--lb-primary'] || tokens['--lb-active-bg'],
      '--cfw-preview-slider-track': tokens['--lb-slider-track-bg'] || tokens['--lb-slider-bg'] || tokens['--lb-range-track-bg'],
      '--cfw-preview-slider-thumb': tokens['--lb-slider-thumb-bg'] || tokens['--lb-slider-fill-bg'] || tokens['--lb-slider-active-bg'] || tokens['--lb-primary'],
      '--cfw-preview-slider-thumb-border': tokens['--lb-slider-thumb-border'] || tokens['--lb-slider-thumb-bg'] || tokens['--lb-slider-active-bg'],
      '--cfw-preview-checkbox-bg': tokens['--lb-checkbox-bg'] || tokens['--lb-input-bg'],
      '--cfw-preview-checkbox-border': tokens['--lb-checkbox-border'] || tokens['--lb-border-color'] || tokens['--lb-border'],
      '--cfw-preview-checkbox-checked-bg': tokens['--lb-checkbox-checked-bg'] || tokens['--lb-active-bg'] || tokens['--lb-primary'],
      '--cfw-preview-radio-bg': tokens['--lb-radio-bg'] || tokens['--lb-input-bg'],
      '--cfw-preview-radio-border': tokens['--lb-radio-border'] || tokens['--lb-border-color'] || tokens['--lb-border'],
      '--cfw-preview-radio-checked-bg': tokens['--lb-radio-checked-bg'] || tokens['--lb-active-bg'] || tokens['--lb-primary'],
      '--cfw-preview-switch-on-bg': tokens['--lb-switch-on-bg'] || tokens['--lb-toggle-active-bg'] || tokens['--lb-active-bg'] || tokens['--lb-primary'],
      '--cfw-preview-switch-off-bg': tokens['--lb-switch-off-bg'] || tokens['--lb-toggle-bg'] || tokens['--lb-input-bg'],
      '--cfw-preview-switch-border': tokens['--lb-switch-border'] || tokens['--lb-toggle-border'] || tokens['--lb-border-color'] || tokens['--lb-border'],
      '--cfw-preview-switch-thumb-bg': tokens['--lb-switch-thumb-bg'] || tokens['--lb-toggle-thumb-bg'] || tokens['--lb-toggle-knob-bg'],
      '--cfw-preview-table-bg': tokens['--lb-table-bg'] || tokens['--lb-table-row-bg'] || tokens['--lb-table-body-bg'],
      '--cfw-preview-table-text': tokens['--lb-table-text'] || tokens['--lb-table-row-text'],
      '--cfw-preview-table-border': tokens['--lb-table-border-color'] || tokens['--lb-table-border'],
      '--cfw-preview-table-border-width': tokens['--lb-table-border-width'] || tokens['--lb-table-outer-border-width'],
      '--cfw-preview-table-hover-bg': tokens['--lb-table-row-hover-bg'] || tokens['--lb-table-hover-bg'] || tokens['--lb-hover-bg'],
      '--cfw-preview-table-hover-text': tokens['--lb-table-row-hover-text'] || tokens['--lb-table-hover-text'] || tokens['--lb-table-text'],
      '--cfw-preview-notify-bg': tokens['--lb-success-bg'] || tokens['--lb-notify-bg'] || tokens['--lb-active-bg'],
      '--cfw-preview-validation-bg': tokens['--lb-warning-bg'] || tokens['--lb-error-bg'] || tokens['--lb-card-bg']
    };
    Object.keys(fallbackMap).forEach(function (name) { if (fallbackMap[name]) root.style.setProperty(name, fallbackMap[name]); });
  }



  function setRuleToken(tokens, name, value) {
    if (!value) return;
    if (/^--lb-/.test(name) && coreTokens[name] === undefined) return;
    if (/^--lb-/.test(name) && isBlockedToken(name)) return;
    tokens[name] = value;
  }

  function applyDesignRules(tokens) {
    tokens = Object.assign({}, tokens || {});

    // V27 Design Rules Engine V1:
    // Button groups should be self-consistent. Active uses primary/active
    // colors; inactive preview swaps active background/text. This rule is
    // deterministic and independent from the AI provider.
    var activeBg = tokens['--lb-btn-group-active-bg'] || tokens['--lb-active-bg'] || tokens['--lb-primary'] || tokens['--lb-btn-primary-bg'];
    var activeText = tokens['--lb-btn-group-active-text'] || tokens['--lb-active-text'] || tokens['--lb-btn-primary-text'] || (activeBg ? readableTextFor(activeBg) : '');
    if (activeBg && activeText) {
      setRuleToken(tokens, '--lb-btn-group-active-bg', activeBg);
      setRuleToken(tokens, '--lb-btn-group-active-text', activeText);
      var activeHoverBg = tokens['--lb-btn-group-active-hover-bg'] || tokens['--lb-primary-hover'] || tokens['--lb-btn-primary-hover-bg'] || mixColor(activeBg, 8);

      // V124: Button-group derivation must not overwrite explicit Studio edits.
      // Inactive, hover and active-text states are independent editor targets.
      var inactiveBg = tokens['--lb-btn-group-inactive-bg'] || activeText;
      var inactiveText = tokens['--lb-btn-group-inactive-text'] || activeBg;
      var groupBorder = tokens['--lb-btn-group-border'] || tokens['--lb-btn-group-inactive-border'] || tokens['--lb-btn-group-active-border'] || tokens['--lb-border-color'] || tokens['--lb-border'] || activeBg;
      var inactiveBorder = tokens['--lb-btn-group-inactive-border'] || groupBorder;
      var hoverBg = tokens['--lb-btn-group-hover-bg'] || activeBg;
      var hoverText = tokens['--lb-btn-group-hover-text'] || activeText;
      var activeHoverText = tokens['--lb-btn-group-active-hover-text'] || activeText;

      setRuleToken(tokens, '--lb-btn-group-active-hover-bg', activeHoverBg);
      setRuleToken(tokens, '--lb-btn-group-active-hover-text', activeHoverText);
      tokens['--lb-btn-group-inactive-bg'] = inactiveBg;
      tokens['--lb-btn-group-inactive-text'] = inactiveText;
      tokens['--lb-btn-group-border'] = groupBorder;
      tokens['--lb-btn-group-inactive-border'] = inactiveBorder;
      setRuleToken(tokens, '--lb-btn-group-hover-bg', hoverBg);
      setRuleToken(tokens, '--lb-btn-group-hover-text', hoverText);
      tokens['--cfw-preview-btn-group-inactive-bg'] = inactiveBg;
      tokens['--cfw-preview-btn-group-inactive-text'] = inactiveText;
      tokens['--cfw-preview-btn-group-border'] = groupBorder;
      tokens['--cfw-preview-btn-group-inactive-border'] = inactiveBorder;
    }

    // V102: Slider colors are scoped to slider tokens. Do not derive slider
    // editing from --lb-active-bg, because that also drives toggles and active
    // buttons in many themes.
    var sliderActive = tokens['--lb-slider-active-bg'] || tokens['--lb-primary'] || tokens['--lb-btn-primary-bg'];
    if (sliderActive) {
      setRuleToken(tokens, '--lb-slider-active-bg', sliderActive);
      setRuleToken(tokens, '--lb-slider-fill-bg', tokens['--lb-slider-fill-bg'] || sliderActive);
      setRuleToken(tokens, '--lb-range-active-bg', tokens['--lb-range-active-bg'] || tokens['--lb-slider-fill-bg'] || sliderActive);
      var sliderTrack = tokens['--lb-slider-bg'] || tokens['--lb-slider-track-bg'] || tokens['--lb-range-track-bg'] || tokens['--lb-border-color'] || tokens['--lb-border'] || 'rgba(0,0,0,.22)';
      setRuleToken(tokens, '--lb-slider-bg', sliderTrack);
      setRuleToken(tokens, '--lb-slider-track-bg', tokens['--lb-slider-track-bg'] || sliderTrack);
      setRuleToken(tokens, '--lb-range-track-bg', tokens['--lb-range-track-bg'] || tokens['--lb-slider-track-bg'] || sliderTrack);
      setRuleToken(tokens, '--lb-slider-thumb-bg', tokens['--lb-slider-thumb-bg'] || sliderActive);
      setRuleToken(tokens, '--lb-slider-thumb-border', tokens['--lb-slider-thumb-border'] || sliderActive);
      setRuleToken(tokens, '--lb-slider-compact-active-bg', tokens['--lb-slider-compact-active-bg'] || sliderActive);
      setRuleToken(tokens, '--lb-slider-compact-thumb-bg', tokens['--lb-slider-compact-thumb-bg'] || tokens['--lb-slider-thumb-bg'] || sliderActive);
      setRuleToken(tokens, '--lb-slider-compact-thumb-border', tokens['--lb-slider-compact-thumb-border'] || tokens['--lb-slider-thumb-border'] || tokens['--lb-slider-compact-thumb-bg'] || tokens['--lb-slider-thumb-bg'] || sliderActive);
    }

    // Header buttons derive from primary/active when no dedicated values are present.
    var primary = tokens['--lb-primary'] || tokens['--lb-active-bg'] || tokens['--lb-btn-primary-bg'];
    var onPrimary = tokens['--lb-active-text'] || tokens['--lb-btn-primary-text'] || (primary ? readableTextFor(primary) : '');
    if (primary && onPrimary) {
      setRuleToken(tokens, '--lb-header-btn-bg', tokens['--lb-header-btn-bg'] || primary);
      setRuleToken(tokens, '--lb-header-btn-text', tokens['--lb-header-btn-text'] || onPrimary);
      setRuleToken(tokens, '--lb-header-btn-hover-bg', tokens['--lb-header-btn-hover-bg'] || tokens['--lb-primary-hover'] || mixColor(primary, 8));
      setRuleToken(tokens, '--lb-header-btn-hover-text', tokens['--lb-header-btn-hover-text'] || onPrimary);
    }

    // Always keep focus visible and disabled states calm if the Core exposes these tokens.
    if (primary) {
      setRuleToken(tokens, '--lb-focus-ring', tokens['--lb-focus-ring'] || primary);
      setRuleToken(tokens, '--lb-focus-ring-strong', tokens['--lb-focus-ring-strong'] || primary);
    }
    setRuleToken(tokens, '--lb-input-disabled-opacity', tokens['--lb-input-disabled-opacity'] || '0.60');
    setRuleToken(tokens, '--lb-input-disabled-bg', tokens['--lb-input-disabled-bg'] || tokens['--lb-card-bg'] || tokens['--lb-bg']);
    setRuleToken(tokens, '--lb-input-disabled-text', tokens['--lb-input-disabled-text'] || tokens['--lb-text-muted'] || tokens['--lb-text-secondary']);

    // V28: Tooltip colors are protected from AI creativity but still
    // deterministically themed by the rules engine.
    var tooltipBg = tokens['--lb-primary-hover'] || tokens['--lb-btn-primary-hover-bg'] || tokens['--lb-primary'] || primary;
    var tooltipText = tokens['--lb-sidebar-text'] || tokens['--lb-on-dark-text'] || (tooltipBg ? readableTextFor(tooltipBg) : '');
    if (tooltipBg) tokens['--lb-tooltip-bg'] = tooltipBg;
    if (tooltipText) tokens['--lb-tooltip-text'] = tooltipText;
    return tokens;
  }


  function applyStudioTheme(tokens) {
    var page = document.querySelector('.cfw-page');
    if (!page) return;

    // V25: Strict context separation. The Design Studio chrome is the tool and
    // must always follow the currently active LoxBerry theme. Generated AI /
    // imported / workbench tokens are applied only to the final preview canvas.
    // Remove leftovers from V20-V24 so a generated theme can never recolor the
    // plugin UI itself.
    var rawVars = [
      '--lb-bg','--lb-text','--lb-text-secondary','--lb-text-muted',
      '--lb-border','--lb-border-color','--lb-card-bg','--lb-card-text','--lb-card-border','--lb-card-shadow',
      '--lb-input-bg','--lb-input-text','--lb-input-border','--lb-input-hover-bg','--lb-input-hover-text','--lb-input-hover-border',
      '--lb-select-bg','--lb-select-text','--lb-select-border','--lb-select-hover-bg','--lb-select-hover-text','--lb-select-hover-border',
      '--lb-btn-bg','--lb-btn-text','--lb-btn-border','--lb-btn-hover-bg','--lb-btn-hover-text','--lb-btn-hover-border',
      '--lb-active-bg','--lb-active-text','--lb-primary','--lb-primary-hover','--lb-btn-primary-bg','--lb-btn-primary-text',
      '--lb-header-btn-bg','--lb-header-btn-text','--lb-header-btn-hover-bg','--lb-header-btn-hover-text',
      '--lb-table-bg','--lb-table-row-bg','--lb-table-header-bg','--lb-table-header-text','--lb-table-border','--lb-table-border-color','--lb-table-cell-text','--lb-table-row-hover-bg','--lb-table-row-hover-text',
      '--lb-sidebar-bg','--lb-sidebar-text','--lb-sidebar-link-radius','--lb-sidebar-active-bg','--lb-sidebar-active-text','--lb-sidebar-link-hover-bg','--lb-sidebar-link-hover-text',
      '--lb-slider-active-bg','--lb-slider-fill-bg','--lb-range-active-bg','--lb-slider-bg','--lb-slider-track-bg','--lb-range-track-bg','--lb-slider-thumb-bg','--lb-slider-thumb-border','--lb-slider-compact-active-bg','--lb-slider-compact-bg','--lb-slider-compact-thumb-bg','--lb-slider-compact-thumb-border',
      '--lb-radius','--lb-radius-sm','--lb-btn-radius','--lb-card-radius','--lb-radius-card','--lb-table-radius','--lb-focus-ring','--lb-focus-ring-strong'
    ];
    rawVars.forEach(function (name) { page.style.removeProperty(name); });

    var studioVars = [
      '--cfw-studio-bg','--cfw-studio-text','--cfw-studio-panel-bg','--cfw-studio-panel-text','--cfw-studio-panel-border',
      '--cfw-studio-control-bg','--cfw-studio-control-text','--cfw-studio-control-border',
      '--cfw-studio-button-bg','--cfw-studio-button-text','--cfw-studio-button-border',
      '--cfw-studio-active-bg','--cfw-studio-active-text','--cfw-studio-tab-bg','--cfw-studio-tab-active-bg','--cfw-studio-range-accent'
    ];
    studioVars.forEach(function (name) { page.style.removeProperty(name); });
    page.classList.remove('cfw-theme-applied');
  }


  function broadcastEmbeddedFrameTokens(tokens) {
    if (themeState && typeof themeState.updateTokens === 'function') {
      themeState.update({ tokens: tokens || {}, wallpaper: buildWallpaperPayload(), dirty: true }, { source: 'design-studio.preview' });
      return;
    }
    var payload = {
      type: 'CFW_STUDIO_TOKENS',
      tokens: tokens || {},
      wallpaper: buildWallpaperPayload()
    };
    ['cfwPreviewFrame'].forEach(function (id) {
      var frame = document.getElementById(id);
      if (!frame || !frame.contentWindow) return;
      try { frame.contentWindow.postMessage(payload, window.location.origin); } catch (e) {}
    });
  }

  function updatePreviewRangeFills() {
    if (!previewRoot) return;
    previewRoot.querySelectorAll('.cfw-range').forEach(function (range) {
      var min = parseFloat(range.min || '0');
      var max = parseFloat(range.max || '100');
      var value = parseFloat(range.value || '0');
      var pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
      range.style.setProperty('--lb-slider-fill', clamp(pct, 0, 100) + '%');
    });
  }

  function applyTokensToPreviewRoot(tokens) {
    if (!previewRoot) return;
    tokens = tokens || {};
    appliedPreviewVars.forEach(function (name) { previewRoot.style.removeProperty(name); });
    clearPreviewBridgeVars(previewRoot);
    appliedPreviewVars = Object.keys(tokens);
    appliedPreviewVars.forEach(function (name) { previewRoot.style.setProperty(name, tokens[name]); });
    applyWallpaperPreview();
    applyPreviewFallbacks(tokens);
    updatePreviewRangeFills();
  }

  function updatePreview() {
    if (!previewRoot) return;
    var tokens = effectivePreviewTokens();
    applyTokensToPreviewRoot(tokens);
    broadcastEmbeddedFrameTokens(tokens);
    applyStudioTheme(tokens);
    mappedTokenCount.textContent = Object.keys(tokens).filter(function (name) { return /^--lb-/.test(name); }).length;
    previewCaption.textContent = currentArea() + ' → ' + currentElement() + ' → ' + currentGroup();
  }

  function updatePreviewStateClasses() {
    if (!previewRoot) return;
    var isSidebarHoverTarget = currentArea() === 'Layout'
      && currentElement() === 'Sidebar Einträge'
      && /^Hover/.test(currentGroup());
    var isTableTarget = currentArea() === 'tabellen';
    var isTableHoverTarget = isTableTarget && /^Hover/.test(currentGroup());
    previewRoot.classList.toggle('cfw-preview-show-sidebar-hover', !!isSidebarHoverTarget);
    previewRoot.classList.toggle('cfw-preview-show-table-target', !!isTableTarget);
    previewRoot.classList.toggle('cfw-preview-show-table-hover', !!isTableHoverTarget);
  }

  function refreshPreviewAndPalette() {
    updatePreviewStateClasses();
    updatePreview();
    renderPalette();
  }

  function updateAll(saveCurrent, field) {
    if (saveCurrent && saveControlsToEntry(field) === false) return;
    updateLabels();
    renderPropertyInspector();
    refreshPreviewAndPalette();
  }

  function openSaveModal() { updateThemeIdentityFromName(); saveModal.hidden = false; }
  function closeSaveModal() { saveModal.hidden = true; }

  function normalizeCustomCssValue(value) {
    if (value == null) return '';
    if (typeof value === 'string') {
      return value === '[object Object]' ? '' : value;
    }
    if (Array.isArray(value)) {
      return value.map(normalizeCustomCssValue).filter(Boolean).join('\n');
    }
    if (typeof value === 'object') {
      if (typeof value.css === 'string') return normalizeCustomCssValue(value.css);
      if (typeof value.custom_css === 'string') return normalizeCustomCssValue(value.custom_css);
      if (typeof value.text === 'string') return normalizeCustomCssValue(value.text);
      return '';
    }
    return String(value || '');
  }

  function meaningfulCustomCss(value) {
    var text = String(value || '')
      .replace(/\/\*\s*USER CUSTOM CSS START\s*\*\//ig, '')
      .replace(/\/\*\s*USER CUSTOM CSS END\s*\*\//ig, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    return text;
  }

  function saveTheme() {
    updateThemeIdentityFromName();
    // V31: Save the same effective token set that is visible in the final preview,
    // including Design Rules Engine output. This prevents empty CSS files when the
    // preview was based on AI/imported tokens or rule-derived values.
    var effectiveTokens = applyDesignRules(collectTokens());
    var wallpaperPayload = buildWallpaperPayload();
    if (!Object.keys(effectiveTokens).filter(function (name) { return /^--lb-/.test(name); }).length && !meaningfulCustomCss(normalizeCustomCssValue(customCss && customCss.value)) && !(wallpaperPayload.enabled && wallpaperPayload.image)) {
      setStatus(t('messages.noSaveableContent', 'Nicht gespeichert: Es sind keine Theme-Tokens oder nutzbaren Custom-CSS-Regeln vorhanden. Bitte erst KI-Entwurf laden, CSS importieren oder einen Wert ändern.'), true);
      return;
    }
    var payload = {
      id: themeId.value.trim(),
      name: normalizeThemeDisplayName(themeName.value),
      version: themeVersion.value.trim(),
      tokens: effectiveTokens,
      custom_css: normalizeCustomCssValue(customCss && customCss.value),
      studio_model: studioModel,
      import_meta: lastImportMeta,
      wallpaper: wallpaperPayload,
      studio_version: 'V39_HybridImportTokensPlusCustomCss'
    };
    setStatus(t('messages.savingTheme', 'Speichere Theme und erzeuge CSS ...'), false);
    fetch('theme-save.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (response) { return response.json(); })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || 'Speichern fehlgeschlagen');
        closeSaveModal();
        payload.id = json.id || payload.id;
        payload.name = json.name || payload.name;
        payload.version = json.version || payload.version;
        rememberSavedTheme(payload);
        var msg = 'Gespeichert: ' + (json.name || payload.name) + ' ' + (json.version || payload.version) + '. CSS: ' + (json.css || 'nicht gemeldet');
        if (json.previous_backup) msg += ' Vorherige JSON: ' + json.previous_backup;
        setStatus(msg, false);
      })
      .catch(function (error) { setStatus(error.message, true); });
  }

  function extractThemeTokensFromCss(text) {
    var out = {};
    String(text || '').replace(/(--lb-[a-z0-9-]+)\s*:\s*([^;{}]+)\s*;/ig, function (_, name, value) {
      name = name.trim();
      value = String(value || '').trim();
      if (!/^--lb-[a-z0-9-]+$/.test(name)) return '';
      if (isBlockedToken(name)) return '';
      if (coreTokens[name] === undefined) return '';
      out[name] = value;
      return '';
    });
    return out;
  }

  function countCssRules(text) {
    var stripped = String(text || '').replace(/\/\*[\s\S]*?\*\//g, '');
    var matches = stripped.match(/[^{}]+\{[^{}]*\}/g);
    return matches ? matches.length : 0;
  }

  function extractCssEffects(text) {
    var css = String(text || '');
    var effects = {
      blur: [],
      backdropFilter: /backdrop-filter\s*:/i.test(css) || /-webkit-backdrop-filter\s*:/i.test(css),
      transparency: [],
      wallpaper: /background(?:-image)?\s*:[^;]*url\s*\(/i.test(css),
      shadows: /box-shadow\s*:/i.test(css),
      customProperties: []
    };
    css.replace(/blur\(([^)]+)\)/ig, function (_, value) {
      value = String(value || '').trim();
      if (value && effects.blur.indexOf(value) < 0) effects.blur.push(value);
      return '';
    });
    css.replace(/rgba?\(([^)]+)\)/ig, function (_, value) {
      var parts = String(value || '').split(',').map(function (part) { return part.trim(); });
      if (parts.length === 4 && effects.transparency.indexOf(parts[3]) < 0) effects.transparency.push(parts[3]);
      return '';
    });
    css.replace(/(--[a-z0-9-]+)\s*:/ig, function (_, name) {
      name = String(name || '').trim();
      if (name && effects.customProperties.indexOf(name) < 0) effects.customProperties.push(name);
      return '';
    });
    return effects;
  }

  function classifyCssImport(text, filename) {
    var tokens = extractThemeTokensFromCss(text);
    var effects = extractCssEffects(text);
    var customRuleCount = countCssRules(text);
    return {
      mode: 'hybrid-tokens-plus-custom-css',
      file: filename || '',
      tokenCount: Object.keys(tokens).length,
      customRuleCount: customRuleCount,
      effects: effects,
      tokens: tokens,
      customCssPreserved: true
    };
  }

  function importMetaHasVisibleContent(meta) {
    if (!meta) return false;
    if (meta.file) return true;
    if ((meta.tokenCount || 0) > 0) return true;
    if ((meta.customRuleCount || 0) > 0) return true;
    if (meta.customCssPreserved) return true;
    var effects = meta.effects || {};
    return !!(
      effects.backdropFilter ||
      effects.wallpaper ||
      effects.shadows ||
      (effects.blur && effects.blur.length) ||
      (effects.transparency && effects.transparency.length)
    );
  }

  function hideImportSummary() {
    if (!importSummary) return;
    importSummary.hidden = true;
    importSummary.innerHTML = '';
  }

  function renderImportSummary(meta) {
    if (!importSummary || !importMetaHasVisibleContent(meta)) {
      hideImportSummary();
      return;
    }
    var effectLabels = [];
    if (meta.effects && meta.effects.backdropFilter) effectLabels.push(t('import.effects.backdropFilter', 'Backdrop Filter'));
    if (meta.effects && meta.effects.blur && meta.effects.blur.length) effectLabels.push(t('import.effects.blur', 'Blur') + ' ' + meta.effects.blur.slice(0, 3).join(', '));
    if (meta.effects && meta.effects.transparency && meta.effects.transparency.length) effectLabels.push(t('import.effects.transparency', 'Transparenz') + ' ' + meta.effects.transparency.slice(0, 3).join(', '));
    if (meta.effects && meta.effects.wallpaper) effectLabels.push(t('import.effects.wallpaper', 'Wallpaper'));
    if (meta.effects && meta.effects.shadows) effectLabels.push(t('import.effects.shadows', 'Schatten'));
    importSummary.hidden = false;
    importSummary.innerHTML =
      '<strong>' + t('import.summaryTitle', 'Hybrid-Import') + '</strong><br>' +
      t('import.summaryTokens', '{count} Core-Tokens erkannt', { count: meta.tokenCount }) + '<br>' +
      t('import.summaryCustom', '{count} individuelle CSS-Regeln erhalten', { count: meta.customRuleCount }) + '<br>' +
      (effectLabels.length ? t('import.summaryEffects', 'Erkannte Effekte: {effects}', { effects: effectLabels.join(', ') }) : t('import.summaryNoEffects', 'Keine speziellen Effekte erkannt'));
  }

  function importCss(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pushUndoSnapshot('css-import');
      var text = String(reader.result || '');
      var meta = classifyCssImport(text, file.name);
      lastImportMeta = meta;

      // V39 Hybrid Import: Recognised --lb-* tokens become editable JSON values,
      // while the original CSS is preserved completely for non-token effects such
      // as Liquid Glass blur/backdrop-filter/wallpaper rules and selector-specific
      // component styling.
      customCss.value = '/* USER CUSTOM CSS START */\n' + text + '\n/* USER CUSTOM CSS END */';
      var count = meta.tokenCount;
      if (count) {
        studioModel = {};
        aiImportedTokens = Object.assign({}, aiImportedTokens || {}, meta.tokens);
        syncCurrentControlsFromAiTokens(aiImportedTokens);
        refreshPreviewAndPalette();
        setStatus(t('messages.hybridCssImported', 'Hybrid-CSS importiert: {file}. {tokens} Core-Tokens erkannt, {rules} individuelle CSS-Regeln erhalten.', { file: file.name, tokens: count, rules: meta.customRuleCount }), false);
      } else {
        setStatus(t('messages.cssImportedNoTokens', 'CSS importiert: {file}. Keine bekannten --lb-* Tokens gefunden; CSS bleibt als Custom CSS erhalten.', { file: file.name }), false);
      }
      renderImportSummary(meta);
    };
    reader.onerror = function () { setStatus(t('messages.cssReadError', 'CSS konnte nicht gelesen werden.'), true); };
    reader.readAsText(file, 'utf-8');
  }


  function populateUserThemeSelect() {
    if (!userThemeSelect) return;
    while (userThemeSelect.options.length > 1) userThemeSelect.remove(1);
    userThemes.forEach(function (theme, index) {
      if (!theme) return;
      if (theme.readonly_css_only || String(theme.version || '').toLowerCase() === 'css-only') return;
      var opt = document.createElement('option');
      opt.value = String(index);
      var version = theme.version && String(theme.version).toLowerCase() !== 'css-only' ? ' (' + theme.version + ')' : '';
      opt.textContent = (theme.name || theme.id || ('Theme ' + (index + 1))) + version;
      userThemeSelect.appendChild(opt);
    });
    updateDeleteThemeButton();
  }

  function themeTokensFromJson(theme) {
    if (!theme || typeof theme !== 'object') return {};
    if (theme.design || theme.theme) return compileSemanticDraftToTokens(theme);
    var tokens = {};
    Object.keys(theme.tokens || {}).forEach(function (name) {
      if (/^--lb-[a-z0-9-]+$/.test(name) && !isBlockedToken(name)) tokens[name] = theme.tokens[name];
    });
    return tokens;
  }

  function loadUserThemeByIndex(index) {
    if (index === '' || index == null) return;
    var theme = userThemes[Number(index)];
    if (!theme) return;
    pushUndoSnapshot('load-theme');

    // V126: Loading a different theme is a complete Working-State replacement.
    // Clear local edits, import all theme tokens, clear old inline preview vars,
    // then refresh inspector, preview and palette together. A second animation-
    // frame refresh catches browser-computed token values after the DOM update.
    studioModel = {};
    aiImportedTokens = enforceForcedOpaqueTokens(themeTokensFromJson(theme));
    var loadedPreviewTokens = applyDesignRules(Object.assign({}, coreTokens || {}, aiImportedTokens || {}));
    aiImportedCss = normalizeCustomCssValue(theme.custom_css || theme.css || '');
    lastImportMeta = importMetaHasVisibleContent(theme.import_meta) ? theme.import_meta : null;
    setWallpaperFromTheme(theme);
    if (customCss) customCss.value = aiImportedCss || '/* USER CUSTOM CSS START */\n/* Eigene Ergänzungen bleiben beim Speichern erhalten. */\n/* USER CUSTOM CSS END */';
    if (themeId) themeId.value = theme.id || 'theme-user-loaded';
    if (themeName) themeName.value = normalizeThemeDisplayName(theme.name || theme.id || 'User Theme');
    if (themeVersion) themeVersion.value = theme.version || '0.1.0';

    hasActiveEditorSelection = false;
    updateWallpaperControlVisibility();
    if (previewRoot) {
      appliedPreviewVars.forEach(function (name) { previewRoot.style.removeProperty(name); });
      appliedPreviewVars = [];
      previewRoot.querySelectorAll('.cfw-edit-highlight').forEach(function (node) { node.classList.remove('cfw-edit-highlight'); });
    }

    syncCurrentControlsFromAiTokens(aiImportedTokens);
    applyTokensToPreviewRoot(loadedPreviewTokens);
    broadcastEmbeddedFrameTokens(loadedPreviewTokens);
    updateAll(false);
    if (lastImportMeta) {
      renderImportSummary(lastImportMeta);
    } else {
      hideImportSummary();
    }

    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        applyTokensToPreviewRoot(loadedPreviewTokens);
        broadcastEmbeddedFrameTokens(loadedPreviewTokens);
        updateAll(false);
      });
    } else {
      setTimeout(function () {
        applyTokensToPreviewRoot(loadedPreviewTokens);
        broadcastEmbeddedFrameTokens(loadedPreviewTokens);
        updateAll(false);
      }, 0);
    }

    setStatus(t('messages.userThemeLoaded', 'User Theme geladen: {theme}. Preview und Tokens wurden aktualisiert.', { theme: (theme.name || theme.id) }), false);
  }

  function rememberSavedTheme(payload) {
    if (!payload || !payload.id) return;
    var existing = userThemes.findIndex(function (theme) { return theme.id === payload.id; });
    var theme = {
      id: payload.id,
      name: payload.name || payload.id,
      version: payload.version || '0.1.0',
      tokens: payload.tokens || {},
      custom_css: normalizeCustomCssValue(payload.custom_css || ''),
      studio_model: payload.studio_model || {},
      wallpaper: payload.wallpaper || null,
      studio_version: payload.studio_version || 'V31_TokenLabelsSaveCssFix'
    };
    if (existing >= 0) userThemes[existing] = theme;
    else userThemes.push(theme);
    populateUserThemeSelect();
    if (userThemeSelect) {
      var idx = userThemes.findIndex(function (item) { return item.id === payload.id; });
      if (idx >= 0) userThemeSelect.value = String(idx);
    }
  }


  function selectedUserThemeInfo() {
    if (!userThemeSelect || userThemeSelect.value === '') return null;
    var index = parseInt(userThemeSelect.value, 10);
    if (isNaN(index) || !userThemes[index]) return null;
    return { index: index, theme: userThemes[index] };
  }

  function updateDeleteThemeButton() {
    if (!deleteThemeButton) return;
    var selected = selectedUserThemeInfo();
    deleteThemeButton.disabled = !selected || !!(selected.theme && selected.theme.readonly_css_only);
  }

  function openDeleteModal() {
    var selected = selectedUserThemeInfo();
    if (!selected || !selected.theme || !selected.theme.id) {
      setStatus(t('messages.deleteNoThemeSelected', 'Kein User Theme zum Löschen ausgewählt.'), true);
      return;
    }
    if (selected.theme.readonly_css_only) {
      setStatus(t('messages.deleteReadonlyTheme', 'Dieses CSS-only Paket-Theme kann nicht direkt gelöscht werden.'), true);
      return;
    }
    pendingDeleteTheme = selected;
    if (deleteModal) deleteModal.hidden = false;
  }

  function closeDeleteModal() {
    pendingDeleteTheme = null;
    if (deleteModal) deleteModal.hidden = true;
  }

  function deleteSelectedTheme() {
    var selected = pendingDeleteTheme || selectedUserThemeInfo();
    if (!selected || !selected.theme || !selected.theme.id) {
      closeDeleteModal();
      setStatus(t('messages.deleteNoThemeSelected', 'Kein User Theme zum Löschen ausgewählt.'), true);
      return;
    }
    var name = selected.theme.name || selected.theme.id;
    closeDeleteModal();
    setStatus(t('messages.deletingTheme', 'Lösche User Theme ...'), false);
    fetch('theme-delete.cgi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: selected.theme.id })
    })
      .then(function (response) { return response.json(); })
      .then(function (json) {
        if (!json.ok) throw new Error(json.error || 'Löschen fehlgeschlagen');
        userThemes.splice(selected.index, 1);
        populateUserThemeSelect();
        if (userThemeSelect) userThemeSelect.value = '';
        updateDeleteThemeButton();
        setStatus(t('messages.themeDeleted', 'Gelöscht: {theme}. Entfernt: JSON {json}, CSS {css}, Manifest {manifest}.', {
          theme: name,
          json: json.deleted_json ? 'ja' : 'nein',
          css: json.deleted_css ? 'ja' : 'nein',
          manifest: json.deleted_manifest ? 'ja' : 'nein'
        }), false);
      })
      .catch(function (error) { setStatus(error.message || String(error), true); });
  }



  function setAiStatus(message, isError, kind) {
    var box = document.getElementById('aiStatus');
    if (!box) return;
    box.textContent = message || '';
    applyStatusKind(box, classifyStatusKind(message, isError, kind));
  }

  function currentStudioThemeId() {
    var select = document.getElementById('userThemeSelect');
    if (!select || !select.value) return '';
    var index = parseInt(select.value, 10);
    var theme = !isNaN(index) && userThemes[index] ? userThemes[index] : null;
    return theme && theme.id ? theme.id : '';
  }

  function refreshEmbeddedFrame(tabName) {
    var frame = tabName === 'preview' ? document.getElementById('cfwPreviewFrame') : (tabName === 'documentation' ? document.getElementById('cfwHelpFrame') : null);
    if (!frame) return;
    var nextSrc = tabName === 'preview' ? '/admin/plugins/cssframework/preview.cgi' : '/admin/plugins/cssframework/help.cgi';
    if (frame.getAttribute('src') !== nextSrc) frame.setAttribute('src', nextSrc);
    if (tabName === 'preview') {
      setTimeout(function () { broadcastEmbeddedFrameTokens(effectivePreviewTokens()); }, 80);
    }
  }

  function switchTab(name) {
    document.querySelectorAll('.cfw-tab').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-cfw-tab') === name);
    });
    document.querySelectorAll('.cfw-tab-panel').forEach(function (panel) {
      var panelName = panel.id === 'cfwTabWorkbench' ? 'workbench' : (panel.id === 'cfwTabAi' ? 'ai' : (panel.id === 'cfwTabPreview' ? 'preview' : (panel.id === 'cfwTabDocumentation' ? 'documentation' : '')));
      var active = panelName === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    refreshEmbeddedFrame(name);
  }

  function buildAiRequest() {
    var tokenNames = Object.keys(coreTokens || {}).filter(function (name) { return /^--lb-/.test(name); }).slice(0, 450);
    var componentSummary = Object.keys(areas).map(function (area) {
      return {
        area: area,
        variants: Object.keys(areas[area] || {}).map(function (variant) {
          return {
            name: variant,
            properties: Object.keys((areas[area] || {})[variant] || {})
          };
        })
      };
    });
    var userPromptEl = document.getElementById('aiPrompt');
    return {
      system: [
        'Du bist Designer, nicht CSS-Compiler.',
        'Erzeuge ausschließlich ein semantisches LoxBerry Theme-Draft-JSON. Kein Markdown, kein Fließtext.',
        'Core-Dateien sind read-only und dürfen niemals verändert werden.',
        'Der Benutzer beschreibt sein gewünschtes Theme frei in natürlicher Sprache.',
        'Arbeite mit Komponenten und Design-Begriffen, nicht mit CSS-Implementierungsdetails.',
        'Gib möglichst harmonische, gut lesbare Farben als Hex- oder rgba-Werte zurück.',
        'Wähle Textfarben kontrastabhängig: dunkler Background/Surface braucht helle Textfarbe, heller Background/Surface braucht dunkle Textfarbe.',
        'Achte besonders bei background, surface, card, input, select, table und button auf ausreichenden Kontrast der jeweiligen text/on_* Werte.',
        'Kein JavaScript, kein HTML, keine externen URLs, keine Imports.',
        'Logmanager-/Status-Farben sind kein Bestandteil von User-Themes und bleiben LoxBerry-Standard.',
        'Tooltip-Farben werden vom Design Studio fest abgeleitet: Hintergrund = primary_hover, Text = sidebar_text.',
        'Antwortformat exakt als JSON:',
        '{"theme":{"id":"theme-user-...","name":"...","description":"..."},"design":{"colors":{"primary":"#...","primary_hover":"#...","background":"#...","surface":"#...","surface_alt":"#...","text":"#...","muted_text":"#...","border":"#...","success":"#...","warning":"#...","danger":"#..."},"components":{"button":{"background":"#...","text":"#...","hover":"#...","radius":"...","shadow":"soft|none|strong"},"input":{"background":"#...","text":"#...","border":"#...","focus":"#...","radius":"..."},"select":{"background":"#...","text":"#...","border":"#...","hover":"#...","radius":"..."},"dropdown":{"background":"#...","text":"#...","hover":"#...","border":"#...","shadow":"soft|none|strong"},"card":{"background":"#...","text":"#...","border":"#...","radius":"...","shadow":"soft|none|strong"},"table":{"background":"#...","header":"#...","text":"#...","hover":"#...","border":"#...","density":"comfortable|compact"},"button_group":{"active":"#...","text":"#...","hover":"#..."},"header_button":{"background":"#...","text":"#...","hover":"#..."}}},"meta":{"style_type":"...","primary_color":"#...","warnings":[]}}'
      ].join('\n'),
      user_request: userPromptEl ? userPromptEl.value : '',
      current_selection: {
        area: currentArea(),
        variant: currentElement(),
        property: currentGroup(),
        tokens: currentMapping(),
        related_tokens: relatedTokensForVariant(currentArea(), currentElement())
      },
      explicit_user_constraints: [
        'Respect explicit color requests from the user. Do not replace requested blue/dark gray/etc. with a different accent color.',
        'For Direct Editor tasks, change only selected or related element tokens.',
        'If the user mentions an off/disabled/hover state, use the matching related token of the selected element, not only the currently active property.'
      ],
      current_theme_tokens: collectTokens(),
      available_core_tokens: tokenNames,
      components: componentSummary
    };
  }

  function clearAiDraftResultUi() {
    var result = document.getElementById('aiResult');
    var preview = document.getElementById('aiPreview');
    if (result) result.value = '';
    if (preview) preview.textContent = t('ai.noDraft', 'Noch kein Entwurf.');
    invalidateAiValidation();
  }

  function renderAiRequest() {
    clearAiDraftResultUi();
    var target = document.getElementById('aiRequest');
    if (target) target.value = JSON.stringify(buildAiRequest(), null, 2);
    setAiStatus(t('messages.requestBuilt', 'Request-Paket lokal erzeugt. Noch nichts extern übertragen.'), false);
  }

  function loadPuterScript() {
    return new Promise(function (resolve, reject) {
      if (window.puter && window.puter.ai && window.puter.ai.chat) return resolve();
      var existing = document.querySelector('script[data-cfw-puter]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Puter.js konnte nicht geladen werden.')); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.setAttribute('data-cfw-puter', '1');
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Puter.js konnte nicht geladen werden.')); };
      document.head.appendChild(script);
    });
  }

  function extractTextFromAiResponse(response) {
    if (typeof response === 'string') return response;
    if (!response) return '';
    if (response.message && Array.isArray(response.message.content)) {
      return response.message.content.map(function (part) {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        try { return JSON.stringify(part); } catch (e) { return ''; }
      }).join('');
    }
    if (response.message && typeof response.message.content === 'string') return response.message.content;
    if (response.text) return typeof response.text === 'string' ? response.text : JSON.stringify(response.text);
    if (response.content) return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    try { return JSON.stringify(response); } catch (e) { return ''; }
  }

  function sanitizeJsonTextForParse(text) {
    text = String(text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
    text = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    return text;
  }

  function extractJson(text) {
    text = sanitizeJsonTextForParse(text);
    try { return JSON.parse(text); } catch (ignore) {}
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch (ignore2) {}
    }
    throw new Error('Antwort enthält kein gültiges JSON.');
  }


  function normalizeRadius(value, fallback) {
    value = String(value || '').trim().toLowerCase();
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return value;
    if (value === 'small' || value === 'klein') return '8px';
    if (value === 'large' || value === 'groß' || value === 'gross') return '18px';
    if (value === 'xlarge' || value === 'extra-large' || value === 'sehr groß' || value === 'sehr gross') return '24px';
    return fallback || '14px';
  }

  function normalizeShadow(value) {
    value = String(value || '').trim().toLowerCase();
    if (value === 'none' || value === 'kein' || value === 'keiner') return 'none';
    if (value === 'strong' || value === 'stark') return '0 16px 42px rgba(0,0,0,0.28)';
    return '0 10px 28px rgba(0,0,0,0.16)';
  }

  function colorValue(value, fallback) {
    value = String(value || '').trim();
    if (/^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(|hsla?\()/i.test(value)) return value;
    return fallback || '';
  }

  function colorToPickerHex(value, fallback) {
    value = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (/^#[0-9a-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(function (c) { return c + c; }).join('');
    var m = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return rgbToHex({ r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) });
    return fallback || '#007aff';
  }

  function tokenValueForMapping(tokens, mapping) {
    mapping = mapping || [];
    for (var i = 0; i < mapping.length; i++) {
      if (tokens[mapping[i]] != null && tokens[mapping[i]] !== '') return tokens[mapping[i]];
    }
    return '';
  }

  function syncCurrentControlsFromAiTokens(tokens) {
    var value = tokenValueForMapping(tokens, currentMapping());
    if (!value) return;
    var entry = defaultEntry(false);
    entry.color = colorToPickerHex(value, entry.color);
    var alphaMatch = String(value).match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\s*\)/i);
    if (alphaMatch) entry.alpha = Math.round(parseFloat(alphaMatch[1]) * 100);
    entry.dirty = false;
    studioModel[currentKey()] = entry;
    loadEntryToControls();
  }

  function mixColor(hex, percent) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex || ''))) return hex;
    var rgb = hexToRgb(hex);
    var target = percent >= 0 ? 255 : 0;
    var p = Math.abs(percent) / 100;
    return rgbToHex({
      r: rgb.r + (target - rgb.r) * p,
      g: rgb.g + (target - rgb.g) * p,
      b: rgb.b + (target - rgb.b) * p
    });
  }

  function componentValue(component, names, fallback) {
    if (!component || typeof component !== 'object') return fallback || '';
    for (var i = 0; i < names.length; i++) {
      if (component[names[i]] != null && component[names[i]] !== '') return component[names[i]];
    }
    return fallback || '';
  }


  function parseHexColor(value) {
    value = String(value || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      value = '#' + value.slice(1).split('').map(function (c) { return c + c; }).join('');
    }
    if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
    return {
      r: parseInt(value.slice(1, 3), 16),
      g: parseInt(value.slice(3, 5), 16),
      b: parseInt(value.slice(5, 7), 16)
    };
  }

  function relativeLuminance(value) {
    var rgb = parseHexColor(value);
    if (!rgb) return null;
    function channel(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function readableTextFor(background, light, dark) {
    var lum = relativeLuminance(background);
    if (lum == null) return dark || '#1f2d1f';
    return lum < 0.46 ? (light || '#f8fafc') : (dark || '#1f2d1f');
  }


  function normalizeAiTokenName(name) {
    name = String(name || '').trim().replace(/[–—]/g, '-');
    // Repair common LLM/list artefacts: "- -lb-table-bg", "- --lb-bg", "• --lb-bg".
    name = name.replace(/^[\s*•]+/, '');
    name = name.replace(/^-\s+-/, '--');
    name = name.replace(/^-\s+--/, '--');
    name = name.replace(/^[-*\s]+/, '');
    name = name.replace(/\s+/g, '');
    if (/^lb-[a-z0-9-]+$/i.test(name)) name = '--' + name;
    if (/^-lb-[a-z0-9-]+$/i.test(name)) name = '-' + name;
    return name;
  }

  function addDraftToken(out, name, value) {
    name = normalizeAiTokenName(name);
    if (/^--lb-[a-z0-9-]+$/.test(name) && coreTokens[name] !== undefined && !isBlockedToken(name)) out[name] = value;
  }

  function detectPaletteFamilyFromText(text) {
    text = String(text || '').toLowerCase();
    var map = window.CFW_COLOR_STYLE_MAP || {};
    var colors = map.colors || [];
    function esc(term) { return String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'); }
    for (var i = 0; i < colors.length; i += 1) {
      var entry = colors[i] || {};
      var terms = entry.de || [];
      for (var j = 0; j < terms.length; j += 1) {
        var term = String(terms[j] || '').toLowerCase().trim();
        if (term && new RegExp(term.indexOf(' ') >= 0 ? esc(term) : '\\b' + esc(term) + '\\b', 'i').test(text)) {
          return entry.family || entry.en || '';
        }
      }
    }
    if (/hell\s*blau|hellblau|blau|blue|azure|cyan|sky\s*blue|light\s*blue/.test(text)) return 'blue';
    if (/dunkel\s*blau|dunkelblau|navy|marineblau/.test(text)) return 'navy';
    if (/rosefarben|rosé|rosa|pink|rose\b/.test(text)) return 'rose';
    if (/dunkel\s*grau|dunkelgrau|anthrazit|dark\s*gr[ae]y/.test(text)) return 'dark-gray';
    if (/grau|gr[ae]y/.test(text)) return 'gray';
    if (/lila|violett|flieder|lavendel|purple|violet/.test(text)) return 'purple';
    if (/türkis|tuerkis|cyan|aqua/.test(text)) return 'cyan';
    if (/petrol|teal/.test(text)) return 'teal';
    if (/orange/.test(text)) return 'orange';
    if (/gelb|gold|yellow/.test(text)) return 'yellow';
    if (/rot|red/.test(text)) return 'red';
    if (/grün|gruen|green/.test(text)) return 'green';
    if (/schwarz|black/.test(text)) return 'black';
    if (/weiß|weiss|white/.test(text)) return 'white';
    return '';
  }

  function getCurrentAiPaletteFamily() {
    var reqBox = document.getElementById('aiRequest');
    if (reqBox && reqBox.value) {
      try {
        var req = JSON.parse(reqBox.value);
        if (req.color_style_direction && req.color_style_direction.primary_family) return req.color_style_direction.primary_family;
        if (req.palette_directive && req.palette_directive.family) return req.palette_directive.family;
        if (req.color_direction && req.color_direction.length) return String(req.color_direction[0] || '');
        var fromReq = detectPaletteFamilyFromText(req.user_request || '');
        if (fromReq) return fromReq;
      } catch (ignore) {}
    }
    var prompt = document.getElementById('aiPrompt');
    return detectPaletteFamilyFromText(prompt ? prompt.value : '');
  }

  function aiPaletteDefaults(family) {
    var presets = {
      blue: {
        primary: '#2563eb', primaryHover: '#1d4ed8', primaryDark: '#1e40af',
        bg: '#f0f7ff', surface: '#ffffff', surfaceAlt: '#eaf4ff', text: '#102033', muted: '#516173', border: '#bfdbfe',
        sidebar: '#102a43', sidebarText: '#eaf4ff', focusShadow: '0 0 0 3px rgba(37, 99, 235, 0.25)'
      },
      navy: {
        primary: '#1d4ed8', primaryHover: '#1e40af', primaryDark: '#172554',
        bg: '#eff6ff', surface: '#ffffff', surfaceAlt: '#dbeafe', text: '#0f172a', muted: '#475569', border: '#bfdbfe',
        sidebar: '#0f172a', sidebarText: '#eff6ff', focusShadow: '0 0 0 3px rgba(29, 78, 216, 0.25)'
      },
      rose: {
        primary: '#c75b7a', primaryHover: '#a94363', primaryDark: '#8f3653',
        bg: '#fff7fa', surface: '#ffffff', surfaceAlt: '#fdf2f6', text: '#2f1a22', muted: '#75515e', border: '#f3c7d4',
        sidebar: '#3b202a', sidebarText: '#fff7fa', focusShadow: '0 0 0 3px rgba(199, 91, 122, 0.25)'
      },
      purple: {
        primary: '#7c3aed', primaryHover: '#6d28d9', primaryDark: '#5b21b6',
        bg: '#f7f2ff', surface: '#ffffff', surfaceAlt: '#f0e7ff', text: '#241733', muted: '#6b5a7a', border: '#d8c4f7',
        sidebar: '#2e2140', sidebarText: '#f7f2ff', focusShadow: '0 0 0 3px rgba(124, 58, 237, 0.25)'
      },
      red: {
        primary: '#dc2626', primaryHover: '#b91c1c', primaryDark: '#991b1b',
        bg: '#fff5f5', surface: '#ffffff', surfaceAlt: '#fee2e2', text: '#2a1414', muted: '#745151', border: '#fecaca',
        sidebar: '#3a1d1d', sidebarText: '#fff5f5', focusShadow: '0 0 0 3px rgba(220, 38, 38, 0.25)'
      },
      orange: {
        primary: '#ea580c', primaryHover: '#c2410c', primaryDark: '#9a3412',
        bg: '#fff7ed', surface: '#ffffff', surfaceAlt: '#ffedd5', text: '#2f1d12', muted: '#7c5a3f', border: '#fed7aa',
        sidebar: '#3b2518', sidebarText: '#fff7ed', focusShadow: '0 0 0 3px rgba(234, 88, 12, 0.25)'
      },
      brown: {
        primary: '#8b5e34', primaryHover: '#74502f', primaryDark: '#5d4028',
        bg: '#f7efe4', surface: '#fffaf3', surfaceAlt: '#ead8c0', text: '#2c2118', muted: '#6f5b48', border: '#d9c3a8',
        sidebar: '#3a2a1f', sidebarText: '#fff7ed', focusShadow: '0 0 0 3px rgba(139, 94, 52, 0.25)'
      },
      beige: {
        primary: '#a57948', primaryHover: '#8b653d', primaryDark: '#6f4f31',
        bg: '#f9f1e4', surface: '#fffaf2', surfaceAlt: '#efe0c7', text: '#2d241a', muted: '#705f4d', border: '#ddc7a7',
        sidebar: '#3c3023', sidebarText: '#fff8ed', focusShadow: '0 0 0 3px rgba(165, 121, 72, 0.25)'
      },
      yellow: {
        primary: '#ca8a04', primaryHover: '#a16207', primaryDark: '#854d0e',
        bg: '#fffbeb', surface: '#ffffff', surfaceAlt: '#fef3c7', text: '#2c2414', muted: '#746843', border: '#fde68a',
        sidebar: '#342a12', sidebarText: '#fffbeb', focusShadow: '0 0 0 3px rgba(202, 138, 4, 0.25)'
      },
      green: {
        primary: '#16a34a', primaryHover: '#15803d', primaryDark: '#166534',
        bg: '#f0fdf4', surface: '#ffffff', surfaceAlt: '#dcfce7', text: '#13291c', muted: '#516b58', border: '#bbf7d0',
        sidebar: '#17351f', sidebarText: '#f0fdf4', focusShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)'
      },
      lime: {
        primary: '#65a30d', primaryHover: '#4d7c0f', primaryDark: '#365314',
        bg: '#f7fee7', surface: '#ffffff', surfaceAlt: '#ecfccb', text: '#1f2a13', muted: '#596747', border: '#d9f99d',
        sidebar: '#243313', sidebarText: '#f7fee7', focusShadow: '0 0 0 3px rgba(101, 163, 13, 0.25)'
      },
      cyan: {
        primary: '#0891b2', primaryHover: '#0e7490', primaryDark: '#155e75',
        bg: '#ecfeff', surface: '#ffffff', surfaceAlt: '#cffafe', text: '#103038', muted: '#4b6d75', border: '#a5f3fc',
        sidebar: '#12343b', sidebarText: '#ecfeff', focusShadow: '0 0 0 3px rgba(8, 145, 178, 0.25)'
      },
      teal: {
        primary: '#0f766e', primaryHover: '#115e59', primaryDark: '#134e4a',
        bg: '#f0fdfa', surface: '#ffffff', surfaceAlt: '#ccfbf1', text: '#102c2a', muted: '#52706b', border: '#99f6e4',
        sidebar: '#143532', sidebarText: '#f0fdfa', focusShadow: '0 0 0 3px rgba(15, 118, 110, 0.25)'
      },
      magenta: {
        primary: '#c026d3', primaryHover: '#a21caf', primaryDark: '#86198f',
        bg: '#fdf4ff', surface: '#ffffff', surfaceAlt: '#fae8ff', text: '#2d1633', muted: '#76537d', border: '#f5d0fe',
        sidebar: '#351b3a', sidebarText: '#fdf4ff', focusShadow: '0 0 0 3px rgba(192, 38, 211, 0.25)'
      },
      maroon: {
        primary: '#800000', primaryHover: '#6b0000', primaryDark: '#4f0000',
        bg: '#fff5f5', surface: '#ffffff', surfaceAlt: '#fde2e2', text: '#2b1515', muted: '#755353', border: '#f5bcbc',
        sidebar: '#321818', sidebarText: '#fff5f5', focusShadow: '0 0 0 3px rgba(128, 0, 0, 0.25)'
      },
      olive: {
        primary: '#808000', primaryHover: '#6b6b00', primaryDark: '#4f4f00',
        bg: '#fbfbe9', surface: '#ffffff', surfaceAlt: '#f1f1c8', text: '#262714', muted: '#6b6b4b', border: '#dfdfa3',
        sidebar: '#303018', sidebarText: '#fbfbe9', focusShadow: '0 0 0 3px rgba(128, 128, 0, 0.25)'
      },
      gray: {
        primary: '#4b5563', primaryHover: '#374151', primaryDark: '#1f2937',
        bg: '#f7f7f7', surface: '#ffffff', surfaceAlt: '#eeeeee', text: '#171717', muted: '#525252', border: '#d4d4d4',
        sidebar: '#2f343b', sidebarText: '#f8fafc', focusShadow: '0 0 0 3px rgba(75, 85, 99, 0.25)'
      },
      'dark-gray': {
        primary: '#374151', primaryHover: '#1f2937', primaryDark: '#111827',
        bg: '#f3f4f6', surface: '#ffffff', surfaceAlt: '#e5e7eb', text: '#111827', muted: '#4b5563', border: '#d1d5db',
        sidebar: '#111827', sidebarText: '#f8fafc', focusShadow: '0 0 0 3px rgba(55, 65, 81, 0.25)'
      },
      silver: {
        primary: '#64748b', primaryHover: '#475569', primaryDark: '#334155',
        bg: '#f8fafc', surface: '#ffffff', surfaceAlt: '#e2e8f0', text: '#0f172a', muted: '#64748b', border: '#cbd5e1',
        sidebar: '#334155', sidebarText: '#f8fafc', focusShadow: '0 0 0 3px rgba(100, 116, 139, 0.25)'
      },
      black: {
        primary: '#111827', primaryHover: '#000000', primaryDark: '#000000',
        bg: '#f9fafb', surface: '#ffffff', surfaceAlt: '#e5e7eb', text: '#111827', muted: '#4b5563', border: '#d1d5db',
        sidebar: '#000000', sidebarText: '#ffffff', focusShadow: '0 0 0 3px rgba(17, 24, 39, 0.25)'
      },
      white: {
        primary: '#475569', primaryHover: '#334155', primaryDark: '#1e293b',
        bg: '#ffffff', surface: '#ffffff', surfaceAlt: '#f8fafc', text: '#0f172a', muted: '#64748b', border: '#e2e8f0',
        sidebar: '#f8fafc', sidebarText: '#0f172a', focusShadow: '0 0 0 3px rgba(71, 85, 105, 0.25)'
      }
    };
    return presets[family] || null;
  }

  function isGreenishHex(value) {
    var rgb = parseHexColor(value);
    if (!rgb) return false;
    return rgb.g > rgb.r + 25 && rgb.g > rgb.b + 10;
  }

  function applyPaletteGuard(tokens, family) {
    var p = aiPaletteDefaults(family);
    if (!p) return tokens;
    function force(names, value) {
      names.forEach(function (name) {
        if (coreTokens[name] !== undefined && !isBlockedToken(name)) tokens[name] = value;
      });
    }
    // Hard guard for Theme Create: requested blue/rose/gray must not leave a green primary palette behind.
    force(['--lb-primary', '--lb-btn-primary-bg', '--lb-active-bg', '--lb-focus-ring', '--lb-header-btn-bg', '--lb-sidebar-active-bg', '--lb-sidebar-link-hover-bg', '--lb-btn-group-active-bg', '--lb-switch-on-bg'], p.primary);
    force(['--lb-primary-hover', '--lb-btn-primary-hover-bg', '--lb-btn-group-active-hover-bg', '--lb-header-btn-hover-bg', '--lb-btn-hover-bg', '--lb-sidebar-link-hover-bg', '--lb-tab-popup-item-hover-bg', '--lb-multiselect-option-hover-bg'], p.primaryHover);
    force(['--lb-primary-dark'], p.primaryDark);
    force(['--lb-bg'], p.bg);
    force(['--lb-card-bg', '--lb-table-bg', '--lb-table-row-bg', '--lb-input-bg', '--lb-select-bg', '--lb-dropdown-menu-bg', '--lb-multiselect-bg', '--lb-multiselect-summary-bg'], p.surface);
    force(['--lb-table-row-alt-bg', '--lb-table-footer-bg', '--lb-table-header-bg', '--lb-btn-bg'], p.surfaceAlt);
    force(['--lb-text', '--lb-input-text', '--lb-select-text', '--lb-table-cell-text', '--lb-btn-text', '--lb-dropdown-menu-text', '--lb-multiselect-text', '--lb-table-header-text'], p.text);
    force(['--lb-text-muted', '--lb-text-secondary', '--lb-input-placeholder-text', '--lb-table-footer-text'], p.muted);
    force(['--lb-border-color', '--lb-input-border', '--lb-select-border', '--lb-btn-border', '--lb-table-border-color', '--lb-table-cell-border-color', '--lb-multiselect-border', '--lb-multiselect-menu-border'], p.border);
    force(['--lb-sidebar-bg'], p.sidebar);
    force(['--lb-sidebar-text', '--lb-sidebar-active-text', '--lb-sidebar-link-hover-text', '--lb-active-text', '--lb-btn-primary-text', '--lb-btn-primary-hover-text', '--lb-header-btn-text', '--lb-header-btn-hover-text'], p.sidebarText);
    force(['--lb-input-focus-border'], p.primary);
    force(['--lb-input-focus-shadow'], p.focusShadow);
    return tokens;
  }

  function compileSemanticDraftToTokens(draft) {
    var out = {};
    if (!draft || typeof draft !== 'object') return out;
    Object.keys(draft.tokens || {}).forEach(function (name) { addDraftToken(out, name, draft.tokens[name]); });
    var design = draft.design || {};
    var colors = design.colors || {};
    var palette = aiPaletteDefaults(getCurrentAiPaletteFamily()) || {};
    var primary = colorValue(colors.primary, palette.primary || '#2563eb');
    var primaryHover = colorValue(colors.primary_hover, palette.primaryHover || mixColor(primary, 10));
    var surface = colorValue(colors.surface, palette.surface || '#ffffff');
    var surfaceAlt = colorValue(colors.surface_alt, palette.surfaceAlt || mixColor(surface, -4));
    var bg = colorValue(colors.background, palette.bg || '#f7f7f7');
    var text = colorValue(colors.text, palette.text || readableTextFor(bg));
    var muted = colorValue(colors.muted_text, palette.muted || readableTextFor(bg, '#cbd5e1', '#525252'));
    var border = colorValue(colors.border, palette.border || '#d4d4d4');

    function put(names, value) {
      value = colorValue(value, value);
      if (!value) return;
      names.forEach(function (name) {
        if (coreTokens[name] !== undefined && !isBlockedToken(name)) out[name] = value;
      });
    }
    function putRaw(names, value) {
      if (!value) return;
      names.forEach(function (name) {
        if (coreTokens[name] !== undefined && !isBlockedToken(name)) out[name] = value;
      });
    }

    put(['--lb-primary', '--lb-btn-primary-bg', '--lb-active-bg', '--lb-focus-ring'], primary);
    put(['--lb-primary-hover', '--lb-btn-primary-hover-bg', '--lb-btn-group-active-hover-bg'], primaryHover);
    put(['--lb-active-text', '--lb-btn-primary-text', '--lb-btn-primary-hover-text'], colorValue(colors.on_primary, readableTextFor(primary)));
    put(['--lb-bg'], bg);
    put(['--lb-card-bg', '--lb-table-bg', '--lb-table-row-bg', '--lb-input-bg', '--lb-select-bg', '--lb-btn-bg', '--lb-dropdown-menu-bg', '--lb-multiselect-bg', '--lb-multiselect-summary-bg'], surface);
    put(['--lb-table-row-alt-bg', '--lb-table-footer-bg'], surfaceAlt);
    put(['--lb-text', '--lb-input-text', '--lb-select-text', '--lb-table-cell-text', '--lb-btn-text', '--lb-dropdown-menu-text', '--lb-multiselect-text'], text);
    put(['--lb-text-muted', '--lb-text-secondary', '--lb-input-placeholder-text', '--lb-table-footer-text'], muted);
    put(['--lb-border', '--lb-border-color', '--lb-card-border', '--lb-input-border', '--lb-select-border', '--lb-btn-border', '--lb-table-border-color', '--lb-table-cell-border-color', '--lb-multiselect-border', '--lb-multiselect-menu-border'], border);
    put(['--lb-header-bg'], colorValue(colors.header, surface));
    put(['--lb-header-text', '--lb-header-btn-text'], text);
    put(['--lb-header-border'], border);
    put(['--lb-sidebar-bg'], colorValue(colors.sidebar, mixColor(text, 10)));
    put(['--lb-sidebar-text'], colorValue(colors.sidebar_text, '#ffffff'));
    put(['--lb-sidebar-active-bg', '--lb-sidebar-link-hover-bg'], primary);
    put(['--lb-sidebar-active-text', '--lb-sidebar-link-hover-text'], colorValue(colors.on_primary, readableTextFor(primary)));
    put(['--lb-success'], colorValue(colors.success, '#2e8b57'));
    put(['--lb-warning'], colorValue(colors.warning, '#d98b00'));
    put(['--lb-danger'], colorValue(colors.danger, '#c0392b'));

    var componentsDesign = design.components || {};
    var button = componentsDesign.button || {};
    put(['--lb-btn-bg'], componentValue(button, ['background', 'bg'], surface));
    put(['--lb-btn-text'], componentValue(button, ['text', 'text_color'], text));
    put(['--lb-btn-hover-bg'], componentValue(button, ['hover', 'hover_background'], primaryHover));
    put(['--lb-btn-hover-text'], componentValue(button, ['hover_text'], componentValue(button, ['text'], text)));
    put(['--lb-btn-border', '--lb-btn-hover-border'], componentValue(button, ['border'], border));
    putRaw(['--lb-btn-radius'], normalizeRadius(componentValue(button, ['radius'], ''), '12px'));
    putRaw(['--lb-btn-shadow'], normalizeShadow(componentValue(button, ['shadow'], 'soft')));

    // V18: Header buttons/button groups are first-class targets; component registry and contrast-aware AI prompt added.
    // If the AI does not provide dedicated values, inherit from the button/primary
    // design so header icons do not fall back to LoxBerry green.
    var headerButton = componentsDesign.header_button || componentsDesign.header_buttons || componentsDesign.headerButton || {};
    put(['--lb-header-btn-bg'], componentValue(headerButton, ['background', 'bg'], componentValue(button, ['background'], primary)));
    put(['--lb-header-btn-text'], componentValue(headerButton, ['text', 'text_color'], componentValue(button, ['text'], colorValue(colors.on_primary, readableTextFor(primary)))));
    put(['--lb-header-btn-hover-bg'], componentValue(headerButton, ['hover', 'hover_background'], componentValue(button, ['hover'], primaryHover)));
    put(['--lb-header-btn-hover-text'], componentValue(headerButton, ['hover_text'], componentValue(headerButton, ['text'], colorValue(colors.on_primary, readableTextFor(primary)))));

    var buttonGroup = componentsDesign.button_group || componentsDesign.buttonGroup || {};
    put(['--lb-btn-group-border', '--lb-btn-group-inactive-border'], componentValue(buttonGroup, ['border'], componentValue(button, ['border'], border)));
    put(['--lb-btn-group-active-border'], componentValue(buttonGroup, ['active_border', 'border'], componentValue(button, ['border'], primary)));
    put(['--lb-btn-group-hover-bg'], componentValue(buttonGroup, ['hover', 'hover_background'], componentValue(button, ['hover'], primaryHover)));
    put(['--lb-btn-group-hover-text'], componentValue(buttonGroup, ['hover_text'], componentValue(buttonGroup, ['text'], componentValue(button, ['text'], text))));
    put(['--lb-btn-group-active-bg'], componentValue(buttonGroup, ['active', 'background', 'bg'], primary));
    put(['--lb-btn-group-active-text'], componentValue(buttonGroup, ['text', 'active_text'], colorValue(colors.on_primary, readableTextFor(primary))));
    put(['--lb-btn-group-active-hover-bg'], componentValue(buttonGroup, ['active_hover', 'hover'], primaryHover));
    put(['--lb-btn-group-active-hover-text'], componentValue(buttonGroup, ['active_hover_text', 'hover_text'], colorValue(colors.on_primary, readableTextFor(primary))));

    var card = componentsDesign.card || {};
    put(['--lb-card-bg'], componentValue(card, ['background', 'bg'], surface));
    put(['--lb-card-text'], componentValue(card, ['text', 'text_color'], text));
    put(['--lb-card-border'], componentValue(card, ['border'], border));
    put(['--lb-card-hover-bg'], componentValue(card, ['hover'], mixColor(surface, -3)));
    putRaw(['--lb-radius', '--lb-radius-sm'], normalizeRadius(componentValue(card, ['radius'], ''), '14px'));
    putRaw(['--lb-card-shadow'], normalizeShadow(componentValue(card, ['shadow'], 'soft')));

    var input = componentsDesign.input || {};
    put(['--lb-input-bg'], componentValue(input, ['background', 'bg'], surface));
    put(['--lb-input-text'], componentValue(input, ['text', 'text_color'], text));
    put(['--lb-input-border', '--lb-input-hover-border'], componentValue(input, ['border'], border));
    put(['--lb-input-hover-bg'], componentValue(input, ['hover'], mixColor(surface, -2)));
    put(['--lb-focus-ring', '--lb-focus-ring-strong'], componentValue(input, ['focus', 'focus_border'], primary));
    putRaw(['--lb-radius-sm'], normalizeRadius(componentValue(input, ['radius'], ''), '10px'));

    var select = componentsDesign.select || componentsDesign.selects || {};
    put(['--lb-select-bg'], componentValue(select, ['background', 'bg'], componentValue(input, ['background'], surface)));
    put(['--lb-select-text'], componentValue(select, ['text', 'text_color'], componentValue(input, ['text'], text)));
    put(['--lb-select-border', '--lb-select-hover-border'], componentValue(select, ['border'], componentValue(input, ['border'], border)));
    put(['--lb-select-hover-bg', '--lb-select-option-hover-bg'], componentValue(select, ['hover', 'hover_background'], mixColor(componentValue(select, ['background'], surface), -5)));
    put(['--lb-select-hover-text', '--lb-select-option-hover-text'], componentValue(select, ['hover_text'], componentValue(select, ['text'], text)));
    putRaw(['--lb-radius-sm'], normalizeRadius(componentValue(select, ['radius'], ''), '10px'));

    var dropdown = componentsDesign.dropdown || componentsDesign.dropdowns || {};
    put(['--lb-dropdown-menu-bg'], componentValue(dropdown, ['background', 'bg'], componentValue(select, ['background'], surface)));
    put(['--lb-dropdown-menu-text'], componentValue(dropdown, ['text', 'text_color'], componentValue(select, ['text'], text)));
    put(['--lb-tab-popup-item-hover-bg', '--lb-multiselect-option-hover-bg'], componentValue(dropdown, ['hover', 'hover_background'], componentValue(select, ['hover'], primaryHover)));
    put(['--lb-multiselect-menu-border'], componentValue(dropdown, ['border'], componentValue(select, ['border'], border)));
    putRaw(['--lb-multiselect-shadow'], normalizeShadow(componentValue(dropdown, ['shadow'], 'soft')));

    var table = componentsDesign.table || {};
    put(['--lb-table-bg', '--lb-table-row-bg'], componentValue(table, ['background', 'bg'], surface));
    put(['--lb-table-header-bg'], componentValue(table, ['header', 'header_background'], surfaceAlt));
    put(['--lb-table-header-text'], componentValue(table, ['header_text'], text));
    put(['--lb-table-cell-text'], componentValue(table, ['text', 'text_color'], text));
    put(['--lb-table-row-hover-bg'], componentValue(table, ['hover', 'hover_background'], mixColor(primary, 70)));
    put(['--lb-table-border-color', '--lb-table-cell-border-color'], componentValue(table, ['border'], border));
    putRaw(['--lb-table-radius'], normalizeRadius(componentValue(table, ['radius'], ''), '12px'));

    var toggle = componentsDesign.toggle || componentsDesign.switch || {};
    put(['--lb-toggle-bg', '--lb-switch-off-bg'], componentValue(toggle, ['off', 'off_bg', 'background', 'bg'], surfaceAlt));
    put(['--lb-toggle-hover-bg'], componentValue(toggle, ['hover'], mixColor(componentValue(toggle, ['off', 'off_bg', 'background', 'bg'], surfaceAlt), -5)));
    put(['--lb-switch-on-bg', '--lb-toggle-active-bg'], componentValue(toggle, ['active', 'on', 'on_bg'], primary));
    put(['--lb-switch-border'], componentValue(toggle, ['border'], border));
    put(['--lb-switch-thumb-bg', '--lb-toggle-thumb-bg', '--lb-toggle-knob-bg'], componentValue(toggle, ['thumb', 'thumb_bg'], '#ffffff'));

    return applyPaletteGuard(out, getCurrentAiPaletteFamily());
  }

  function validateAiDraftObject(draft) {
    var errors = [];
    if (!draft || typeof draft !== 'object') errors.push(t('messages.jsonNoObject', 'Kein JSON-Objekt.'));
    var tokens = compileSemanticDraftToTokens(draft);
    Object.keys(tokens).forEach(function (name) {
      if (!/^--lb-[a-z0-9-]+$/.test(name)) errors.push(t('messages.invalidToken', 'Ungültiger Token: {token}', { token: name }));
    });
    if (draft && draft.css && /<script|javascript:|@import|url\s*\(/i.test(String(draft.css))) {
      errors.push(t('messages.forbiddenCss', 'CSS enthält verbotene externe/aktive Inhalte.'));
    }
    return errors;
  }

  function renderAiPreview(draft) {
    var box = document.getElementById('aiPreview');
    if (!box) return;
    var tokens = compileSemanticDraftToTokens(draft);
    var excludedAiPaletteTokens = {
      '--lb-success': true,
      '--lb-warning': true,
      '--lb-danger': true
    };
    var names = Object.keys(tokens).filter(function (name) { return !excludedAiPaletteTokens[name]; });
    if (!names.length) {
      box.textContent = t('ai.validNoValues', 'JSON gültig, aber keine anwendbaren Designwerte enthalten.');
      return;
    }
    box.innerHTML = '' +
      '<div class="ai-swatch-grid"></div>';

    var grid = box.querySelector('.ai-swatch-grid');
    names.slice(0, 48).forEach(function (name) {
      var value = String(tokens[name]);
      var swatch = document.createElement('div');
      swatch.className = 'ai-swatch';
      var color = /^(#|rgb|hsl)/i.test(value) ? value : '#f3f4f6';
      swatch.innerHTML = '<div class="ai-swatch-color"></div><code></code><code></code>';
      swatch.querySelector('.ai-swatch-color').style.background = color;
      swatch.querySelectorAll('code')[0].textContent = name;
      swatch.querySelectorAll('code')[1].textContent = value;
      grid.appendChild(swatch);
    });
  }


  function setAiAdvancedView(enabled) {
    var requestPanel = document.getElementById('aiRequestPanel');
    var resultPanel = document.getElementById('aiResultPanel');
    [requestPanel, resultPanel].forEach(function (panel) {
      if (!panel) return;
      panel.hidden = !enabled;
    });
  }

  function hasAiResultText() {
    var result = document.getElementById('aiResult');
    return !!(result && String(result.value || '').trim());
  }

  function setAiImportEnabled(enabled) {
    var importBtn = document.getElementById('aiImport');
    var validateBtn = document.getElementById('aiValidate');
    var panel = document.getElementById('aiValidatedActionsPanel');
    if (importBtn) {
      importBtn.disabled = !enabled;
      importBtn.classList.toggle('is-disabled', !enabled);
    }
    // V74: The validation action panel must not be coupled to the import state.
    // A freshly received AI draft needs the Validate button while Import stays disabled.
    if (panel) panel.hidden = !(enabled || hasAiResultText());
    if (validateBtn) {
      validateBtn.disabled = false;
      validateBtn.classList.remove('is-disabled');
    }
  }

  function invalidateAiValidation() {
    aiValidatedDraft = null;
    aiResultSignature = '';
    setAiImportEnabled(false);
  }

  function validateAiResult() {
    var result = document.getElementById('aiResult');
    try {
      var raw = result ? result.value : '';
      var draft = extractJson(raw);
      var errors = validateAiDraftObject(draft);
      renderAiPreview(draft);
      if (errors.length) throw new Error(errors.join('\n'));
      aiValidatedDraft = draft;
      aiResultSignature = raw;
      setAiImportEnabled(true);
      setAiStatus(t('messages.aiValid', 'KI-Entwurf ist formal gültig und kann geladen werden.'), false, 'success');
      return draft;
    } catch (error) {
      aiValidatedDraft = null;
      aiResultSignature = '';
      setAiImportEnabled(false);
      setAiStatus(error.message, true);
      return null;
    }
  }

  function importAiResult() {
    var result = document.getElementById('aiResult');
    if (!aiValidatedDraft || !result || result.value !== aiResultSignature) {
      setAiImportEnabled(false);
      setAiStatus(t('messages.aiValidateFirst', 'Bitte den KI-Entwurf zuerst erfolgreich validieren.'), true);
      return;
    }
    var draft = aiValidatedDraft;
    pushUndoSnapshot('ai-import');
    // AI import is a new baseline. Clear earlier manual slider state so
    // stale local selections (for example an old blue input background) do
    // not overwrite the AI draft on the first transfer.
    studioModel = {};
    aiImportedTokens = compileSemanticDraftToTokens(draft);
    syncCurrentControlsFromAiTokens(aiImportedTokens);
    aiImportedCss = normalizeCustomCssValue(draft.custom_css || draft.css || '');
    if (aiImportedCss) {
      customCss.value = '/* USER CUSTOM CSS START */\n' + aiImportedCss + '\n/* USER CUSTOM CSS END */';
    }
    if (draft.theme) {
      if (draft.theme.id && themeId) themeId.value = draft.theme.id;
      if (draft.theme.name && themeName) themeName.value = normalizeThemeDisplayName(draft.theme.name);
      if (themeName && themeId) themeId.value = slugifyThemeName(themeName.value);
    }
    refreshPreviewAndPalette();
    switchTab('workbench');
    setStatus(t('messages.aiLoaded', 'KI-Entwurf in die Preview geladen. Bitte prüfen und final speichern.'), false);
  }

  function runAiDesigner() {
    clearAiDraftResultUi();
    var consent = document.getElementById('aiConsent');
    var model = document.getElementById('aiModel');
    var result = document.getElementById('aiResult');
    if (!consent || !consent.checked) {
      setAiStatus(t('messages.aiConsentRequired', 'Bitte zuerst der externen Verarbeitung über Puter.js zustimmen.'), true);
      return;
    }
    var request = buildAiRequest();
    var prompt = request.system + '\n\nREQUEST JSON:\n' + JSON.stringify(request, null, 2);
    var reqBox = document.getElementById('aiRequest');
    if (reqBox) reqBox.value = JSON.stringify(request, null, 2);
    setAiStatus(t('messages.aiLoading', 'Lade Puter.js und frage KI an ...'), false);
    loadPuterScript()
      .then(function () {
        // Some Puter/OpenAI-backed models reject custom temperature values.
        // Do not send temperature; use the provider/model default.
        return window.puter.ai.chat(prompt, { model: model ? String(model.value) : 'gpt-5-nano' });
      })
      .then(function (response) {
        var text = extractTextFromAiResponse(response);
        if (result) result.value = text;
        setAiImportEnabled(false);
        setAiStatus(t('messages.aiReceived', 'KI-Antwort erhalten. Bitte validieren und erst danach ins Design Studio laden.'), false);
      })
      .catch(function (error) { setAiStatus(error.message || String(error), true); });
  }



  function formatTokenList(tokens) {
    if (!tokens || !tokens.length) return '<em>' + t('inspector.noMapping', 'Keine Tokens im Mapping') + '</em>';
    return tokens.map(function (token) { return '<code>' + token + '</code>'; }).join(' ');
  }

  function openComponentInspector(definition, target) {
    if (!componentInspector || !definition) return;
    selectedComponentTarget = {
      area: definition.area,
      variant: definition.variant,
      property: definition.property,
      tokens: definition.tokens || []
    };
    if (componentInspectorTitle) {
      componentInspectorTitle.textContent = definition.area + ' → ' + definition.variant + ' → ' + definition.property;
    }
    if (componentInspectorMeta) {
      componentInspectorMeta.innerHTML = '' +
        '<div><strong>Mapping:</strong></div>' +
        '<div class="cfw-token-list">' + formatTokenList(definition.tokens || []) + '</div>' +
        '<div class="cfw-small-note">Normaler Klick wählt das Element. Doppelklick oder CTRL-/Strg-Klick öffnet diesen Direkteditor.</div>';
    }
    componentInspector.hidden = false;
    componentInspector.classList.add('is-open');
    if (target) {
      previewRoot.querySelectorAll('.cfw-edit-highlight').forEach(function (node) { node.classList.remove('cfw-edit-highlight'); });
      target.classList.add('cfw-edit-highlight');
      setTimeout(function () { target.classList.remove('cfw-edit-highlight'); }, 1800);
    }
  }

  function closeComponentInspector() {
    if (!componentInspector) return;
    componentInspector.hidden = true;
    componentInspector.classList.remove('is-open');
  }

  function focusSelectedComponent() {
    if (!selectedComponentTarget) return;
    selectEditorTarget(selectedComponentTarget.area, selectedComponentTarget.variant, selectedComponentTarget.property);
    setStatus(t('messages.directEditorFocused', 'Direkteditor-Auswahl fokussiert: {path}', { path: currentArea() + ' → ' + currentElement() + ' → ' + currentGroup() }), false);
  }

  function prepareElementAiPrompt() {
    if (!selectedComponentTarget) return;
    var prompt = document.getElementById('aiPrompt');
    var tokens = selectedComponentTarget.tokens || [];
    var values = collectTokens();
    var tokenState = {};
    var relatedTokens = relatedTokensForVariant(selectedComponentTarget.area, selectedComponentTarget.variant);
    relatedTokens.forEach(function (token) { if (values[token]) tokenState[token] = values[token]; });
    if (prompt) {
      prompt.value = [
        'Ändere gezielt dieses LoxBerry-Design-Element. Explizite Farbwünsche und genannte Zustände haben Vorrang vor der bestehenden Palette:',
        '',
        'Element: ' + selectedComponentTarget.area + ' → ' + selectedComponentTarget.variant,
        'Eigenschaft: ' + selectedComponentTarget.property,
        'Aktuelle zugeordnete Tokens: ' + tokens.join(', '),
        'Weitere Tokens desselben Elements: ' + relatedTokens.join(', '),
        'Aktuelle Werte der Element-Tokens: ' + JSON.stringify(tokenState),
        '',
        'Wichtig:',
        '- Erzeuge weiterhin nur semantisches Design-JSON.',
        '- Achte auf Kontrast: dunkler Hintergrund benötigt helle Textfarbe, heller Hintergrund dunkle Textfarbe.',
        '- Logmanager/Status-Farben nicht verändern; sie bleiben LoxBerry-Standard.',
          '- Tooltip-Farben nicht frei gestalten; sie werden vom Studio abgeleitet: Hintergrund primary_hover, Text sidebar_text.',
        '- Explizite Farbwünsche aus diesem Prompt haben höchste Priorität und dürfen nicht durch eine andere Akzentfarbe ersetzt werden.',
        '- Wenn ein anderer Zustand desselben Elements genannt wird, z. B. Toggle off, Hover oder Disabled, nutze den passenden verwandten Token dieses Elements.',
        '- Das bestehende Theme ist nur nachrangige Orientierung. Es darf einen konkreten Farbwunsch nicht überschreiben.'
      ].join('\n');
    }
    switchTab('ai');
    renderAiRequest();
    setAiStatus(t('messages.aiFocusPrepared', 'KI-Fokus für {path} vorbereitet. Bei Bedarf Prompt anpassen und KI Entwurf erzeugen.', { path: selectedComponentTarget.area + ' → ' + selectedComponentTarget.variant }), false);
  }


  function ensurePreviewHoverCard() {
    if (previewHoverCard) return previewHoverCard;
    previewHoverCard = document.createElement('div');
    previewHoverCard.className = 'cfw-preview-hover-card';
    previewHoverCard.setAttribute('aria-hidden', 'true');
    document.body.appendChild(previewHoverCard);
    return previewHoverCard;
  }

  function describePreviewTarget(target) {
    if (!target) return null;
    var area = target.getAttribute('data-cfw-area') || '';
    var element = target.getAttribute('data-cfw-element') || '';
    var group = target.getAttribute('data-cfw-group') || 'Grundfarbe';
    var registered = registryLookup(area, element, group) || { area: area, variant: element, property: group, tokens: [] };
    return registered;
  }

  function showPreviewHover(target) {
    var definition = describePreviewTarget(target);
    if (!definition) return;
    previewHoverTarget = target;
    var card = ensurePreviewHoverCard();
    var tokenCount = (definition.tokens || []).length;
    card.innerHTML = '' +
      '<strong>' + definition.area + ' → ' + definition.variant + '</strong>' +
      '<span>' + definition.property + ' · ' + tokenCount + ' Token' + (tokenCount === 1 ? '' : 's') + '</span>' +
      '<em>Klick: auswählen · Doppelklick/Strg: Direkteditor</em>';
    var rect = target.getBoundingClientRect();
    var top = Math.max(8, rect.top + window.scrollY - card.offsetHeight - 12);
    var left = Math.min(window.scrollX + document.documentElement.clientWidth - 280, Math.max(8, rect.left + window.scrollX));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.classList.add('is-visible');
    target.classList.add('cfw-hover-highlight');
  }

  function hidePreviewHover() {
    if (previewHoverCard) previewHoverCard.classList.remove('is-visible');
    if (previewHoverTarget) previewHoverTarget.classList.remove('cfw-hover-highlight');
    previewHoverTarget = null;
  }

  function openInspectorForTarget(target) {
    var definition = describePreviewTarget(target);
    if (!definition) return false;
    selectEditorTarget(definition.area, definition.variant, definition.property);
    openComponentInspector(definition, target);
    setStatus(t('messages.directEditorOpened', 'Direkteditor geöffnet: {path}', { path: currentArea() + ' → ' + currentElement() + ' → ' + currentGroup() }), false);
    return true;
  }

  function openInspectorForCurrentSelection() {
    var area = currentArea();
    var variant = currentElement();
    var property = currentGroup();
    var definition = registryLookup(area, variant, property) || {
      area: area,
      variant: variant,
      property: property,
      tokens: currentMapping()
    };
    if (!definition || !definition.area || !definition.variant) return false;
    openComponentInspector(definition, null);
    if (componentInspector) {
      componentInspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      componentInspector.classList.add('cfw-direct-focus');
      setTimeout(function () { componentInspector.classList.remove('cfw-direct-focus'); }, 1600);
    }
    setStatus(t('messages.directEditorOpened', 'Direkteditor geöffnet: {path}', { path: definition.area + ' → ' + definition.variant + ' → ' + definition.property }), false);
    return true;
  }

  function markPreviewEditables() {
    if (!previewRoot) return;
    previewRoot.querySelectorAll('[data-cfw-area]').forEach(function (node) {
      node.classList.add('cfw-preview-editable');
      if (node.getAttribute('title')) { node.setAttribute('data-cfw-title', node.getAttribute('title')); node.removeAttribute('title'); }
      node.setAttribute('aria-label', 'Klicken zum Bearbeiten, Doppelklick oder CTRL-/Strg-Klick für Direkteditor');
    });
  }

  function selectEditorTarget(area, element, group) {
    if (!areas[area]) return false;
    hasActiveEditorSelection = true;
    areaSelect.value = area;
    renderElements();
    if (!((areas[area] || {})[element])) element = Object.keys(areas[area] || {})[0];
    elementSelect.value = element;
    renderColorGroups();
    if (!((((areas[area] || {})[element] || {})[group]))) group = Object.keys(((areas[area] || {})[element] || {}))[0];
    colorGroupSelect.value = group;
    loadEntryToControls();
    updateAll();
    previewCaption.textContent = area + ' → ' + element + ' → ' + group + ' (aus Preview gewählt)';
    return true;
  }

  function setupPreviewClickToEdit() {
    if (!previewRoot) return;
    markPreviewEditables();
    previewRoot.addEventListener('mouseover', function (event) {
      var target = event.target.closest('[data-cfw-area]');
      if (!target || !previewRoot.contains(target)) return;
      if (target === previewHoverTarget) return;
      hidePreviewHover();
      showPreviewHover(target);
    });
    previewRoot.addEventListener('mouseout', function (event) {
      var target = event.target.closest('[data-cfw-area]');
      if (!target || !previewRoot.contains(target)) return;
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      hidePreviewHover();
    });
    previewRoot.addEventListener('dblclick', function (event) {
      var target = event.target.closest('[data-cfw-area]');
      if (!target || !previewRoot.contains(target)) return;
      event.preventDefault();
      openInspectorForTarget(target);
    });
    previewRoot.addEventListener('click', function (event) {
      var target = event.target.closest('[data-cfw-area]');
      if (!target || !previewRoot.contains(target)) return;
      event.preventDefault();
      var requestedArea = target.getAttribute('data-cfw-area');
      var requestedElement = target.getAttribute('data-cfw-element');
      var requestedGroup = target.getAttribute('data-cfw-group') || 'Grundfarbe';
      var registered = registryLookup(requestedArea, requestedElement, requestedGroup) || {
        area: requestedArea,
        variant: requestedElement,
        property: requestedGroup,
        tokens: []
      };
      var ok = selectEditorTarget(registered.area, registered.variant, registered.property);
      if (!ok) return;
      previewRoot.querySelectorAll('.cfw-edit-highlight').forEach(function (node) { node.classList.remove('cfw-edit-highlight'); });
      target.classList.add('cfw-edit-highlight');
      setTimeout(function () { target.classList.remove('cfw-edit-highlight'); }, 1600);
      if (event.ctrlKey || event.metaKey) {
        openInspectorForTarget(target);
      } else {
        setStatus(t('messages.previewSelected', 'Preview-Auswahl übernommen: {path}. Doppelklick oder CTRL-/Strg-Klick öffnet den Direkteditor.', { path: currentArea() + ' → ' + currentElement() + ' → ' + currentGroup() }), false);
      }
    });
  }


  if (previewRoot) {
    previewRoot.querySelectorAll('.cfw-range').forEach(function (range) {
      range.addEventListener('input', updatePreviewRangeFills);
      range.addEventListener('change', updatePreviewRangeFills);
    });
    updatePreviewRangeFills();
  }


  window.CFW_DESIGN_STUDIO = {
    t: t,
    setAiStatus: setAiStatus,
    switchTab: switchTab,
    getAiContext: function () {
      var tokenNames = Object.keys(coreTokens || {}).filter(function (name) { return /^--lb-/.test(name); }).slice(0, 450);
      var componentSummary = Object.keys(areas).map(function (area) {
        return {
          area: area,
          variants: Object.keys(areas[area] || {}).map(function (variant) {
            return {
              name: variant,
              properties: Object.keys((areas[area] || {})[variant] || {})
            };
          })
        };
      });
      var userPromptEl = document.getElementById('aiPrompt');
      return {
        user_request: userPromptEl ? userPromptEl.value : '',
        current_selection: {
          area: currentArea(),
          variant: currentElement(),
          property: currentGroup(),
          tokens: currentMapping(),
          related_tokens: relatedTokensForVariant(currentArea(), currentElement())
        },
        explicit_user_constraints: [
          'Respect explicit color requests from the user. Do not replace requested blue/dark gray/etc. with a different accent color.',
          'For Direct Editor tasks, change only selected or related element tokens.',
          'If the user mentions an off/disabled/hover state, use the matching related token of the selected element, not only the currently active property.'
        ],
        current_theme_tokens: collectTokens(),
        available_core_tokens: tokenNames,
        components: componentSummary
      };
    },
    validateAiResult: validateAiResult,
    importAiResult: importAiResult,
    invalidateAiValidation: invalidateAiValidation,
    setAiImportEnabled: setAiImportEnabled,
    prepareElementAiPrompt: prepareElementAiPrompt
  };

  applyI18n(document);

  renderColorPresetPalette();

  ['cfwPreviewFrame'].forEach(function (id) {
    var frame = document.getElementById(id);
    if (!frame) return;
    frame.addEventListener('load', function () {
      broadcastEmbeddedFrameTokens(effectivePreviewTokens());
    });
  });


  if (statusModalBack) statusModalBack.addEventListener('click', closeStatusModal);

  if (undoThemeButton) {
    undoThemeButton.addEventListener('click', function () { undoLastChange(); });
    updateUndoButton();
  }
  [colorPicker, alphaRange, brightnessRange, radiusRange, shadowRange, customCss, wallpaperEnabled, wallpaperImage, wallpaperMode, wallpaperBrightness, wallpaperOpacity].forEach(bindUndoControl);

  document.getElementById('saveTheme').addEventListener('click', openSaveModal);
  if (deleteThemeButton) deleteThemeButton.addEventListener('click', openDeleteModal);
  if (cancelDeleteButton) cancelDeleteButton.addEventListener('click', closeDeleteModal);
  if (confirmDeleteButton) confirmDeleteButton.addEventListener('click', deleteSelectedTheme);
  document.getElementById('cancelSave').addEventListener('click', closeSaveModal);
  document.getElementById('confirmSave').addEventListener('click', saveTheme);
  if (themeName) themeName.addEventListener('blur', updateThemeIdentityFromName);
  areaSelect.addEventListener('change', renderElements);
  elementSelect.addEventListener('change', renderColorGroups);
  colorGroupSelect.addEventListener('change', function () { loadEntryToControls(); updateWallpaperControlVisibility(); updateAll(); });
  if (colorPicker) {
    colorPicker.addEventListener('input', function () {
      if (!requireColorEditTarget()) {
        updateColorPresetSelection();
        return;
      }
      updateAll(true, 'color');
    });
    colorPicker.addEventListener('change', function () {
      if (!requireColorEditTarget()) {
        updateColorPresetSelection();
        return;
      }
      updateColorPresetSelection();
      updateAll(true, 'color');
    });
  }

  if (radiusRange) {
    radiusRange.addEventListener('input', function () {
      if (!requireColorEditTarget()) return;
      updateAll(true, 'radius');
    });
  }

  if (borderWidthRange) {
    borderWidthRange.addEventListener('input', function () {
      if (!requireColorEditTarget()) return;
      updateAll(true, 'borderWidth');
    });
  }
  if (cssImportButton && cssImport) { cssImportButton.addEventListener('click', function () { cssImport.click(); }); }
  updateCssImportFileName(null);
  if (cssImport) cssImport.addEventListener('change', function () { var file = cssImport.files && cssImport.files[0]; updateCssImportFileName(file); importCss(file); });
  [wallpaperEnabled, wallpaperImage, wallpaperMode, wallpaperBrightness, wallpaperOpacity].forEach(function (node) {
    if (!node) return;
    node.addEventListener('input', function () { syncWallpaperStateFromControls(); updateWallpaperLabels(); updateWallpaperControlVisibility(); updatePreview(); });
    node.addEventListener('change', function () { syncWallpaperStateFromControls(); updateWallpaperLabels(); updateWallpaperControlVisibility(); updatePreview(); });
    node.addEventListener('click', function () { window.setTimeout(function () { syncWallpaperStateFromControls(); updateWallpaperLabels(); updateWallpaperControlVisibility(); updatePreview(); }, 0); });
  });
  if (wallpaperFileButton && wallpaperFile) {
    wallpaperFileButton.addEventListener('click', function () { wallpaperFile.click(); });
  }
  updateWallpaperFileName(null);
  if (wallpaperFile) {
    wallpaperFile.addEventListener('change', function () {
      pushUndoSnapshot('wallpaper-file');
      var file = wallpaperFile.files && wallpaperFile.files[0];
      updateWallpaperFileName(file);
      if (!file) {
        syncWallpaperStateFromControls();
        updatePreview();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        if (wallpaperImage) wallpaperImage.value = String(reader.result || '');
        if (wallpaperEnabled) wallpaperEnabled.checked = true;
        syncWallpaperStateFromControls();
        updateWallpaperLabels();
        updateWallpaperControlVisibility();
        updatePreview();
      };
      reader.readAsDataURL(file);
    });
  }
  saveModal.addEventListener('click', function (event) { if (event.target === saveModal) closeSaveModal(); });
  document.querySelectorAll('.cfw-tab').forEach(function (button) {
    button.addEventListener('click', function () { switchTab(button.getAttribute('data-cfw-tab')); });
  });
  var aiBuildContext = document.getElementById('aiBuildContext');
  var aiRun = document.getElementById('aiRun');
  var aiValidate = document.getElementById('aiValidate');
  var aiImport = document.getElementById('aiImport');
  var aiAdvancedView = document.getElementById('aiAdvancedView');
  setAiAdvancedView(false);
  if (aiAdvancedView) {
    aiAdvancedView.checked = false;
    aiAdvancedView.addEventListener('change', function () { setAiAdvancedView(!!aiAdvancedView.checked); });
  }
  if (aiBuildContext) aiBuildContext.addEventListener('click', function () { (window.CFW_AI_ASSISTANT && window.CFW_AI_ASSISTANT.renderRequest ? window.CFW_AI_ASSISTANT.renderRequest : renderAiRequest)(); });
  if (aiRun) aiRun.addEventListener('click', function () { (window.CFW_AI_ASSISTANT && window.CFW_AI_ASSISTANT.runDesigner ? window.CFW_AI_ASSISTANT.runDesigner : runAiDesigner)(); });
  if (aiValidate) aiValidate.addEventListener('click', function () { (window.CFW_AI_ASSISTANT && window.CFW_AI_ASSISTANT.validateResult ? window.CFW_AI_ASSISTANT.validateResult : validateAiResult)(); });
  if (aiImport) { aiImport.addEventListener('click', function () { (window.CFW_AI_ASSISTANT && window.CFW_AI_ASSISTANT.importResult ? window.CFW_AI_ASSISTANT.importResult : importAiResult)(); }); setAiImportEnabled(false); }
  var aiResultBox = document.getElementById('aiResult');
  if (aiResultBox) aiResultBox.addEventListener('input', invalidateAiValidation);
  if (userThemeSelect) userThemeSelect.addEventListener('change', function () {
    updateDeleteThemeButton();
    loadUserThemeByIndex(userThemeSelect.value);
  });
  if (selectedComponentCard) {
    selectedComponentCard.setAttribute('title', t('inspector.selectedCardTitle', 'Doppelklick öffnet den Direkteditor für das aktuell ausgewählte Element'));
    selectedComponentCard.setAttribute('tabindex', '0');
    selectedComponentCard.addEventListener('dblclick', function (event) {
      event.preventDefault();
      openInspectorForCurrentSelection();
    });
    selectedComponentCard.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInspectorForCurrentSelection();
      }
    });
  }

  if (themeState && typeof themeState.attachFrames === 'function') {
    themeState.attachFrames(['cfwPreviewFrame']);
  }

  setupPreviewClickToEdit();
  var inspectorClose = document.getElementById('componentInspectorClose');
  var inspectorEdit = document.getElementById('componentInspectorEdit');
  var inspectorAi = document.getElementById('componentInspectorAi');
  if (inspectorClose) inspectorClose.addEventListener('click', closeComponentInspector);
  if (inspectorEdit) inspectorEdit.addEventListener('click', focusSelectedComponent);
  if (inspectorAi) inspectorAi.addEventListener('click', function () { (window.CFW_AI_ASSISTANT && window.CFW_AI_ASSISTANT.prepareElementPrompt ? window.CFW_AI_ASSISTANT.prepareElementPrompt : prepareElementAiPrompt)(); });
  populateUserThemeSelect();
  renderAiColorPresetPalette();
  buildComponentRegistry();
  renderAreas();
  renderElements();
  setStatus(t('messages.coreRead', 'Core gelesen: {tokens} Tokens, {themes} Themes.', { tokens: Object.keys(coreTokens).length, themes: ((coreData.themes || []).length) }), false);
}());
