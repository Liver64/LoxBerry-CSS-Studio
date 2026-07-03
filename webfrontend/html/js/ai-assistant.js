/* LoxBerry CSS Framework Design Studio - V66 AI Assistant Integration
 * Purpose: Puter.js loading/calls and task-specific prompt context.
 * Security stays in ai-guard.js. This file deliberately sends only the
 * information needed for the selected AI task.
 */
(function () {
  'use strict';

  function api() { return window.CFW_DESIGN_STUDIO || {}; }
  function guard() { return window.CFW_AI_GUARD; }
  function tg(key, data) { return guard() && guard().t ? guard().t(key, data) : key; }
  function setStatus(message, isError, kind) { if (api().setAiStatus) api().setAiStatus(message, isError, kind); }

  function unique(list) {
    var seen = {};
    return (list || []).filter(function (item) {
      item = String(item || '').trim();
      if (!item || seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }


  // Built-in fallback for color/style normalization. The configurable file
  // config/plugins/cssframework/translations/de_en_color_style_map.json is still
  // preferred, but the AI request must stay robust if that config file was not
  // copied yet or is empty/cached on an installation.
  var CFW_DEFAULT_COLOR_STYLE_MAP = {
    "colors": [
      {
        "de": [
          "schwarz",
          "black"
        ],
        "en": "black",
        "family": "black"
      },
      {
        "de": [
          "weiß",
          "weiss",
          "white"
        ],
        "en": "white",
        "family": "white"
      },
      {
        "de": [
          "rot",
          "red"
        ],
        "en": "red",
        "family": "red"
      },
      {
        "de": [
          "hellrot",
          "light red",
          "red"
        ],
        "en": "light red",
        "family": "red"
      },
      {
        "de": [
          "dunkelrot",
          "dark red",
          "red"
        ],
        "en": "dark red",
        "family": "red"
      },
      {
        "de": [
          "bordeaux",
          "weinrot",
          "burgundy",
          "maroon"
        ],
        "en": "burgundy",
        "family": "maroon"
      },
      {
        "de": [
          "grün",
          "gruen",
          "green"
        ],
        "en": "green",
        "family": "green"
      },
      {
        "de": [
          "hellgrün",
          "hellgruen",
          "light green",
          "green"
        ],
        "en": "light green",
        "family": "green"
      },
      {
        "de": [
          "dunkelgrün",
          "dunkelgruen",
          "dark green",
          "green"
        ],
        "en": "dark green",
        "family": "green"
      },
      {
        "de": [
          "limette",
          "lime"
        ],
        "en": "lime",
        "family": "lime"
      },
      {
        "de": [
          "oliv",
          "olivgrün",
          "olivgruen",
          "olive"
        ],
        "en": "olive",
        "family": "olive"
      },
      {
        "de": [
          "blau",
          "blue"
        ],
        "en": "blue",
        "family": "blue"
      },
      {
        "de": [
          "hellblau",
          "hell blau",
          "light blue",
          "blue"
        ],
        "en": "light blue",
        "family": "blue"
      },
      {
        "de": [
          "dunkelblau",
          "dunkel blau",
          "dark blue",
          "navy"
        ],
        "en": "dark blue",
        "family": "navy"
      },
      {
        "de": [
          "marineblau",
          "navy"
        ],
        "en": "navy",
        "family": "navy"
      },
      {
        "de": [
          "türkis",
          "tuerkis",
          "turquoise",
          "cyan"
        ],
        "en": "turquoise",
        "family": "cyan"
      },
      {
        "de": [
          "cyan"
        ],
        "en": "cyan",
        "family": "cyan"
      },
      {
        "de": [
          "aqua",
          "cyan"
        ],
        "en": "aqua",
        "family": "cyan"
      },
      {
        "de": [
          "petrol",
          "blaugrün",
          "blaugruen",
          "teal"
        ],
        "en": "teal",
        "family": "teal"
      },
      {
        "de": [
          "lila",
          "purple"
        ],
        "en": "purple",
        "family": "purple"
      },
      {
        "de": [
          "violett",
          "violet",
          "purple"
        ],
        "en": "violet",
        "family": "purple"
      },
      {
        "de": [
          "lavendel",
          "lavender",
          "purple"
        ],
        "en": "lavender",
        "family": "purple"
      },
      {
        "de": [
          "flieder",
          "lilac",
          "purple"
        ],
        "en": "lilac",
        "family": "purple"
      },
      {
        "de": [
          "rosa",
          "pink",
          "rose"
        ],
        "en": "pink",
        "family": "rose"
      },
      {
        "de": [
          "pink",
          "rose"
        ],
        "en": "pink",
        "family": "rose"
      },
      {
        "de": [
          "rosé",
          "rose",
          "rosefarben",
          "rosafarben"
        ],
        "en": "rose",
        "family": "rose"
      },
      {
        "de": [
          "magenta"
        ],
        "en": "magenta",
        "family": "magenta"
      },
      {
        "de": [
          "fuchsia",
          "fuchsie",
          "magenta"
        ],
        "en": "fuchsia",
        "family": "magenta"
      },
      {
        "de": [
          "gelb",
          "yellow"
        ],
        "en": "yellow",
        "family": "yellow"
      },
      {
        "de": [
          "gold",
          "yellow"
        ],
        "en": "gold",
        "family": "yellow"
      },
      {
        "de": [
          "orange"
        ],
        "en": "orange",
        "family": "orange"
      },
      {
        "de": [
          "braun",
          "brown"
        ],
        "en": "brown",
        "family": "brown"
      },
      {
        "de": [
          "beige"
        ],
        "en": "beige",
        "family": "beige"
      },
      {
        "de": [
          "sand",
          "sandfarben",
          "beige"
        ],
        "en": "sand",
        "family": "beige"
      },
      {
        "de": [
          "creme",
          "cremefarben",
          "cream",
          "beige"
        ],
        "en": "cream",
        "family": "beige"
      },
      {
        "de": [
          "grau",
          "gray"
        ],
        "en": "gray",
        "family": "gray"
      },
      {
        "de": [
          "hellgrau",
          "hell grau",
          "light gray",
          "gray"
        ],
        "en": "light gray",
        "family": "gray"
      },
      {
        "de": [
          "dunkelgrau",
          "dunkel grau",
          "dark gray",
          "dark-gray"
        ],
        "en": "dark gray",
        "family": "dark-gray"
      },
      {
        "de": [
          "anthrazit",
          "anthracite",
          "dark-gray"
        ],
        "en": "anthracite",
        "family": "dark-gray"
      },
      {
        "de": [
          "silber",
          "silver"
        ],
        "en": "silver",
        "family": "silver"
      },
      {
        "de": [
          "transparent"
        ],
        "en": "transparent",
        "family": "transparent"
      },
      {
        "de": [
          "glas",
          "glasig",
          "glass"
        ],
        "en": "glass",
        "family": "glass"
      }
    ],
    "styles": [
      {
        "de": [
          "ruhig",
          "calm"
        ],
        "en": "calm"
      },
      {
        "de": [
          "modern"
        ],
        "en": "modern"
      },
      {
        "de": [
          "minimalistisch",
          "minimal"
        ],
        "en": "minimal"
      },
      {
        "de": [
          "elegant"
        ],
        "en": "elegant"
      },
      {
        "de": [
          "warm"
        ],
        "en": "warm"
      },
      {
        "de": [
          "kühl",
          "kuehl",
          "cool"
        ],
        "en": "cool"
      },
      {
        "de": [
          "kräftig",
          "kraeftig",
          "vivid"
        ],
        "en": "vivid"
      },
      {
        "de": [
          "pastell",
          "pastellfarben",
          "pastel"
        ],
        "en": "pastel"
      },
      {
        "de": [
          "dunkel",
          "dark"
        ],
        "en": "dark"
      },
      {
        "de": [
          "hell",
          "light"
        ],
        "en": "light"
      },
      {
        "de": [
          "dezent",
          "subtle"
        ],
        "en": "subtle"
      },
      {
        "de": [
          "kontrastreich",
          "klare kontraste",
          "high contrast"
        ],
        "en": "high contrast"
      },
      {
        "de": [
          "gut lesbar",
          "lesbarkeit",
          "readable"
        ],
        "en": "readable"
      },
      {
        "de": [
          "abgerundet",
          "runde karten",
          "abgerundete karten",
          "rounded"
        ],
        "en": "rounded"
      }
    ]
  };

  function pickTokenValues(tokens, values) {
    var result = {};
    unique(tokens).forEach(function (token) {
      if (values && Object.prototype.hasOwnProperty.call(values, token)) result[token] = values[token];
    });
    return result;
  }


  function getColorStyleMap() {
    var configured = window.CFW_COLOR_STYLE_MAP || {};
    var fallback = CFW_DEFAULT_COLOR_STYLE_MAP || { colors: [], styles: [] };
    var cfgColors = Array.isArray(configured.colors) ? configured.colors : [];
    var cfgStyles = Array.isArray(configured.styles) ? configured.styles : [];
    if (!cfgColors.length && !cfgStyles.length) return fallback;
    return {
      colors: cfgColors.concat(fallback.colors || []),
      styles: cfgStyles.concat(fallback.styles || [])
    };
  }

  function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function containsTerm(text, term) {
    term = String(term || '').toLowerCase().trim();
    if (!term) return false;
    var pattern = term.indexOf(' ') >= 0 ? escapeRegex(term).replace(/\s+/g, '\\s*') : '\\b' + escapeRegex(term) + '\\b';
    return new RegExp(pattern, 'i').test(text);
  }

  function normalizeColorStyleIntent(prompt) {
    var text = String(prompt || '').toLowerCase();
    var map = getColorStyleMap();
    var colors = [];
    var styles = [];
    (map.colors || []).forEach(function (entry) {
      (entry.de || []).forEach(function (term) {
        if (containsTerm(text, term)) {
          colors.push({ family: entry.family || entry.en, en: entry.en || entry.family, source: term });
        }
      });
    });
    (map.styles || []).forEach(function (entry) {
      (entry.de || []).forEach(function (term) {
        if (containsTerm(text, term)) {
          styles.push({ en: entry.en || term, source: term });
        }
      });
    });

    // English fallback terms are kept here because this is technical normalization,
    // not UI translation. German terms should come from config/plugins/.../translations.
    var fallback = [
      ['black', /\bblack\b/i],
      ['white', /\bwhite\b/i],
      ['red', /\bred\b/i],
      ['lime', /\blime\b/i],
      ['blue', /\b(light blue|sky blue|soft blue|blue|azure)\b/i],
      ['yellow', /\byellow\b/i],
      ['cyan', /\b(cyan|aqua|turquoise)\b/i],
      ['magenta', /\b(magenta|fuchsia)\b/i],
      ['gray', /\b(silver|light gr[ae]y|gr[ae]y)\b/i],
      ['dark-gray', /\bdark gr[ae]y\b/i],
      ['maroon', /\b(maroon|burgundy)\b/i],
      ['olive', /\bolive\b/i],
      ['green', /\bgreen\b/i],
      ['purple', /\b(purple|violet|lavender|lilac)\b/i],
      ['teal', /\bteal\b/i],
      ['navy', /\bnavy\b/i],
      ['rose', /\b(rose|pink)\b/i]
    ];
    fallback.forEach(function (entry) {
      if (entry[1].test(text)) colors.push({ family: entry[0], en: entry[0], source: entry[0] });
    });

    var seenFamilies = {};
    var uniqueColors = colors.filter(function (item) {
      var key = item.family || item.en;
      if (!key || seenFamilies[key]) return false;
      seenFamilies[key] = true;
      return true;
    });
    var seenStyles = {};
    var uniqueStyles = styles.filter(function (item) {
      var key = item.en;
      if (!key || seenStyles[key]) return false;
      seenStyles[key] = true;
      return true;
    });
    return {
      colors: uniqueColors,
      styles: uniqueStyles,
      primary_family: uniqueColors.length ? uniqueColors[0].family : '',
      normalized_english: unique([].concat(uniqueColors.map(function (c) { return c.en; }), uniqueStyles.map(function (st) { return st.en; }))).join(', ')
    };
  }

  function extractColorHints(prompt) {
    return normalizeColorStyleIntent(prompt).colors.map(function (item) { return item.family; });
  }


  function paletteDirective(intent) {
    if (!intent || !intent.primary_family) return null;
    return {
      family: intent.primary_family,
      normalized_english: intent.normalized_english || intent.primary_family,
      required: true,
      required_tokens: [
        '--lb-primary',
        '--lb-primary-hover',
        '--lb-primary-dark',
        '--lb-btn-primary-bg',
        '--lb-active-bg',
        '--lb-focus-ring',
        '--lb-btn-group-active-bg'
      ],
      rule: 'The requested palette family is mandatory. The primary/action tokens must visibly belong to this family. Do not copy or preserve the currently loaded theme colors unless explicitly requested.'
    };
  }

  function shouldWarnEmptyIntent(request) {
    if (!request || request.task !== 'THEME_CREATE') return false;
    var intent = request.color_style_direction || {};
    return !(intent.colors && intent.colors.length) && !(intent.styles && intent.styles.length);
  }

  function warnEmptyIntentIfNeeded(request) {
    if (shouldWarnEmptyIntent(request)) {
      setStatus(tg('aiGuard.status.intentNotRecognized'), false, 'warning');
      return true;
    }
    return false;
  }



  function parseJsonFromText(text) {
    text = String(text || '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function normalizeAiIntentObject(obj, originalPrompt) {
    obj = obj && typeof obj === 'object' ? obj : {};
    var colors = Array.isArray(obj.colors) ? obj.colors : [];
    var styles = Array.isArray(obj.styles) ? obj.styles : [];
    var normalized = typeof obj.normalized_request === 'string' ? obj.normalized_request : '';
    var primary = typeof obj.primary_family === 'string' ? obj.primary_family : '';
    if (!primary && colors.length) {
      if (typeof colors[0] === 'string') primary = colors[0];
      else if (colors[0] && typeof colors[0].family === 'string') primary = colors[0].family;
    }
    colors = colors.map(function (item) {
      if (typeof item === 'string') return { family: item, en: item, source: 'ai-normalizer' };
      return {
        family: item.family || item.en || item.name || '',
        en: item.en || item.family || item.name || '',
        source: item.source || 'ai-normalizer'
      };
    }).filter(function (item) { return item.family || item.en; });
    styles = styles.map(function (item) {
      if (typeof item === 'string') return { en: item, source: 'ai-normalizer' };
      return { en: item.en || item.name || '', source: item.source || 'ai-normalizer' };
    }).filter(function (item) { return item.en; });
    colors = unique(colors.map(function (c) { return JSON.stringify(c); })).map(function (v) { return JSON.parse(v); });
    styles = unique(styles.map(function (st) { return JSON.stringify(st); })).map(function (v) { return JSON.parse(v); });
    return {
      colors: colors,
      styles: styles,
      primary_family: primary || (colors[0] && colors[0].family) || '',
      normalized_english: normalized || unique([].concat(colors.map(function (c) { return c.en || c.family; }), styles.map(function (st) { return st.en; }))).join(', '),
      source: 'ai-normalizer'
    };
  }

  function buildNormalizerPrompt(userPrompt, staticIntent) {
    return [
      'You are a strict request normalizer for the LoxBerry CSS Framework Design Studio.',
      'Do not create a theme. Do not output CSS. Do not output explanations.',
      'Read the user request in any language and return JSON only with this exact shape:',
      '{"intent":"THEME_CREATE","colors":[{"family":"purple","en":"purple","source":"lila"}],"styles":[{"en":"calm","source":"ruhig"}],"primary_family":"purple","normalized_request":"Create a calm modern purple LoxBerry theme."}',
      'Use concise English color/style terms. If no color is present, colors must be []. If no style is present, styles must be [].',
      'Existing static detection, if any: ' + JSON.stringify(staticIntent || {}),
      'User request: ' + JSON.stringify(userPrompt)
    ].join('\n');
  }

  function shouldUseAiNormalizer(task, intent) {
    if (task !== 'THEME_CREATE') return false;
    return !(intent && intent.colors && intent.colors.length) || !(intent && intent.styles && intent.styles.length);
  }

  function intentCacheKey(userPrompt, task, staticIntent) {
    return 'cfw_ai_intent_v73:' + String(task || '') + ':' + String(userPrompt || '').trim().toLowerCase() + ':' + JSON.stringify(staticIntent || {});
  }

  function readIntentCache(key) {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(key) : '';
      if (!raw) return null;
      var item = JSON.parse(raw);
      if (!item || !item.value || !item.ts) return null;
      // Keep normalizer results only briefly; prompt edits should still be reflected quickly.
      if ((Date.now() - item.ts) > 24 * 60 * 60 * 1000) return null;
      return item.value;
    } catch (e) { return null; }
  }

  function writeIntentCache(key, value) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value: value }));
    } catch (e) {}
  }

  function aiNormalizeRequest(userPrompt, task) {
    var staticIntent = normalizeColorStyleIntent(userPrompt);
    // Cost saver: if the local map already found color and style, do not call AI normalizer.
    if (!shouldUseAiNormalizer(task, staticIntent)) return Promise.resolve(staticIntent);

    var cacheKey = intentCacheKey(userPrompt, task, staticIntent);
    var cached = readIntentCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var consent = document.getElementById('aiConsent');
    if (!consent || !consent.checked) return Promise.resolve(staticIntent);
    var model = document.getElementById('aiModel');
    return loadPuterScript()
      .then(function () {
        return window.puter.ai.chat(buildNormalizerPrompt(userPrompt, staticIntent), { model: model ? String(model.value) : 'gpt-5-nano' });
      })
      .then(function (response) {
        var obj = parseJsonFromText(extractTextFromAiResponse(response));
        var aiIntent = normalizeAiIntentObject(obj, userPrompt);
        if ((aiIntent.colors && aiIntent.colors.length) || (aiIntent.styles && aiIntent.styles.length)) {
          writeIntentCache(cacheKey, aiIntent);
          return aiIntent;
        }
        return staticIntent;
      })
      .catch(function () {
        return staticIntent;
      });
  }

  function compactSelection(selection) {
    selection = selection || {};
    return {
      area: selection.area || '',
      variant: selection.variant || '',
      property: selection.property || '',
      tokens: unique(selection.tokens || []),
      related_tokens: unique(selection.related_tokens || [])
    };
  }

  function compactAvailableTokens(context, selection, task) {
    var all = unique(context.available_core_tokens || []);
    if (task === 'THEME_CREATE') {
      // Theme creation should not be biased by the currently active theme.
      // A small semantic token hint is enough; semantic design JSON is preferred.
      return all.filter(function (token) {
        return /^(--lb-(primary|primary-hover|primary-dark|bg|text|text-secondary|text-muted|border-color|card-bg|card-border|btn-bg|btn-text|btn-border|btn-primary-bg|btn-primary-text|input-bg|input-text|input-border|select-bg|select-text|table-bg|table-header-bg|sidebar-bg|sidebar-text|success|warning|danger|radius|radius-sm|card-shadow))$/.test(token);
      }).slice(0, 30);
    }
    if (task === 'DIRECT_EDITOR' || task === 'TOKEN_EDIT' || task === 'COLOR_SUGGESTION' || task === 'COMPONENT_CREATE') {
      return unique([].concat(selection.tokens || [], selection.related_tokens || []));
    }
    return all.slice(0, 60);
  }

  function buildTaskContext(context, checked, normalizedIntentOverride) {
    var task = checked.task;
    var selection = compactSelection(context.current_selection || {});
    var currentValues = context.current_theme_tokens || {};
    var selectedAndRelated = unique([].concat(selection.tokens || [], selection.related_tokens || []));
    var colorIntent = normalizedIntentOverride || normalizeColorStyleIntent(checked.prompt);
    var colorHints = colorIntent.colors.map(function (item) { return item.family; });
    var request = {
      task: task,
      prompt_profile: task,
      user_request: checked.prompt,
      color_direction: colorHints,
      color_style_direction: colorIntent,
      palette_directive: paletteDirective(colorIntent),
      output_contract: {
        format: 'json-only',
        allowed_roots: ['theme', 'design', 'meta', 'tokens', 'effects', 'components', 'custom_css', 'css', 'import_meta'],
        preferred: 'semantic-design-json',
        compact: true
      },
      ai_guard: {
        version: guard().rules.version,
        task: task,
        allowed_scope: 'css-json-theme-only',
        allow_internet: false,
        allow_code_generation: false
      }
    };

    if (task === 'THEME_CREATE') {
      request.intent = 'create-new-theme';
      request.priority_rules = [
        'User color/style is mandatory and outranks any loaded theme.',
        'Primary/action tokens must visibly use the requested palette family from palette_directive.family. For example, brown means brown/beige/earth accent colors, not blue or green.',
        'Do not copy or preserve the currently loaded theme colors unless the user explicitly asks for that.',
        'Return compact JSON. Prefer meta + tokens + optional wallpaper/custom_css/import_meta. Do not include full CSS or component catalog unless needed.',
        'Use readable contrast after applying the requested palette.'
      ];
      request.output_size_policy = { compact: true, prefer_roots: ['meta', 'tokens', 'wallpaper', 'custom_css', 'import_meta'], avoid_roots: ['css', 'components', 'design'] };
      request.available_tokens_hint = compactAvailableTokens(context, selection, task);
      return request;
    }

    if (task === 'DIRECT_EDITOR' || task === 'TOKEN_EDIT' || task === 'COLOR_SUGGESTION' || task === 'COMPONENT_CREATE') {
      request.intent = 'targeted-element-change';
      request.selection = selection;
      request.token_values = pickTokenValues(selectedAndRelated, currentValues);
      request.priority_rules = [
        'Change only selected/related tokens. Return compact JSON with tokens only.',
        'Respect explicit color/state request; do not redesign the whole theme.'
      ];
      request.output_size_policy = { compact: true, prefer_roots: ['tokens'], avoid_roots: ['css', 'components', 'design'] };
      // Related tokens are already part of selection; do not repeat a large global token list.
      request.available_tokens_hint = compactAvailableTokens(context, selection, task);
      return request;
    }

    if (task === 'CSS_OPTIMIZE' || task === 'JSON_EXPLAIN' || task === 'CSS_EXPLAIN' || task === 'THEME_IMPORT') {
      request.intent = 'limited-analysis-or-import';
      request.selection = selection;
      request.token_values = pickTokenValues(selectedAndRelated, currentValues);
      request.available_tokens_hint = compactAvailableTokens(context, selection, task);
      return request;
    }

    return request;
  }

  function prepareCheckedRequest() {
    var context = api().getAiContext ? api().getAiContext() : {};
    var userPrompt = context.user_request || '';
    var checked = guard().validateRequest(userPrompt, context);
    if (!checked.ok) throw new Error(checked.errors.join('\n'));

    // The current selection helper is useful for targeted element edits, but it
    // must not bias full theme creation. V56 appends it only after task
    // classification and only for targeted tasks.
    if (checked.task === 'DIRECT_EDITOR' || checked.task === 'TOKEN_EDIT' || checked.task === 'COLOR_SUGGESTION' || checked.task === 'COMPONENT_CREATE') {
      var promptContext = tg('aiGuard.promptContext.useCurrentSelection');
      checked.prompt = [checked.prompt, promptContext].filter(Boolean).join('\n');
    }
    return { context: context, checked: checked };
  }

  function buildRequest() {
    var prepared = prepareCheckedRequest();
    return buildTaskContext(prepared.context, prepared.checked);
  }

  function buildRequestAsync() {
    var prepared;
    try { prepared = prepareCheckedRequest(); }
    catch (error) { return Promise.reject(error); }
    return aiNormalizeRequest(prepared.checked.prompt, prepared.checked.task)
      .then(function (normalizedIntent) {
        return buildTaskContext(prepared.context, prepared.checked, normalizedIntent);
      });
  }


  function clearAiDraftOutput() {
    var result = document.getElementById('aiResult');
    var preview = document.getElementById('aiPreview');
    if (result) result.value = '';
    if (preview) preview.textContent = tg('aiGuard.status.noDraft') || '';
    if (api().invalidateAiValidation) api().invalidateAiValidation();
    if (api().setAiImportEnabled) api().setAiImportEnabled(false);
  }

  function renderRequest() {
    clearAiDraftOutput();
    return buildRequestAsync()
      .then(function (request) {
        var target = document.getElementById('aiRequest');
        if (target) target.value = JSON.stringify(request, null, 2);
        if (!warnEmptyIntentIfNeeded(request)) setStatus(tg('aiGuard.status.requestBuilt'), false, 'info');
        return request;
      })
      .catch(function (error) {
        setStatus(error.message || String(error), true);
        return null;
      });
  }

  function loadPuterScript() {
    return new Promise(function (resolve, reject) {
      if (window.puter && window.puter.ai && window.puter.ai.chat) return resolve();
      var existing = document.querySelector('script[data-cfw-puter]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', function () { reject(new Error(tg('aiGuard.errors.puterLoadFailed'))); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.setAttribute('data-cfw-puter', '1');
      script.onload = resolve;
      script.onerror = function () { reject(new Error(tg('aiGuard.errors.puterLoadFailed'))); };
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

  function runDesigner() {
    clearAiDraftOutput();
    var consent = document.getElementById('aiConsent');
    var model = document.getElementById('aiModel');
    var result = document.getElementById('aiResult');
    var reqBox = document.getElementById('aiRequest');
    if (!consent || !consent.checked) {
      setStatus(tg('aiGuard.status.consentRequired'), true);
      return;
    }
    setStatus(tg('aiGuard.status.aiLoading'), false, 'info');
    try {
      var preliminary = buildRequest();
      if (reqBox) reqBox.value = JSON.stringify(preliminary, null, 2);
    } catch (ignore) {}
    buildRequestAsync()
      .then(function (request) {
        if (reqBox) reqBox.value = JSON.stringify(request, null, 2);
        if (warnEmptyIntentIfNeeded(request)) return null;
        var prompt = guard().buildRestrictedPrompt(request);
        return loadPuterScript()
          .then(function () {
            return window.puter.ai.chat(prompt, { model: model ? String(model.value) : 'gpt-5-nano' });
          });
      })
      .then(function (response) {
        if (!response) return;
        var text = extractTextFromAiResponse(response);
        var checked = guard().validateResponse(text);
        if (!checked.ok) throw new Error(checked.errors.join('\n'));
        if (result) result.value = text;
        if (api().setAiImportEnabled) api().setAiImportEnabled(false);
        setStatus(tg('aiGuard.status.aiReceived'), false, 'success');
      })
      .catch(function (error) { setStatus(error.message || String(error), true); });
  }

  function validateResult() {
    var result = document.getElementById('aiResult');
    var raw = result ? result.value : '';
    var checked = guard().validateResponse(raw);
    if (!checked.ok) {
      if (api().setAiImportEnabled) api().setAiImportEnabled(false);
      setStatus(checked.errors.join('\n'), true);
      return null;
    }
    return api().validateAiResult ? api().validateAiResult() : checked.json;
  }

  function importResult() {
    return api().importAiResult ? api().importAiResult() : null;
  }

  function prepareElementPrompt() {
    return api().prepareElementAiPrompt ? api().prepareElementAiPrompt() : null;
  }

  window.CFW_AI_ASSISTANT = {
    buildRequest: buildRequest,
    renderRequest: renderRequest,
    runDesigner: runDesigner,
    validateResult: validateResult,
    importResult: importResult,
    prepareElementPrompt: prepareElementPrompt,
    loadPuterScript: loadPuterScript
  };
}());
