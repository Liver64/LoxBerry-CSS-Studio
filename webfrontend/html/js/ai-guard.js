/* LoxBerry CSS Framework Design Studio - V65 AI Guard Layer
 * Purpose: security/privacy rules for CSS/JSON/theme-only AI assistance.
 * This file must not call Puter.js directly. It validates requests and responses.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // V63 CENTRAL AI GUARD RULES
  // Keep all relevant keywords, tasks, root keys and CSS allow/block lists here.
  // The functions below must only consume these lists; do not scatter new
  // security terms deeper in the file.
  // ---------------------------------------------------------------------------

  var CFW_AI_ALLOWED_TASKS = [
    'THEME_CREATE',
    'THEME_IMPORT',
    'TOKEN_EDIT',
    'CSS_OPTIMIZE',
    'CSS_EXPLAIN',
    'JSON_EXPLAIN',
    'DIRECT_EDITOR',
    'COMPONENT_CREATE',
    'COLOR_SUGGESTION'
  ];

  var CFW_AI_ALLOWED_TOPICS = [
    'css', 'json', 'theme', 'design', 'token', 'tokens', 'color', 'colour', 'farbe',
    'gradient', 'shadow', 'blur', 'radius', 'spacing', 'typography', 'accessibility',
    'component', 'button', 'input', 'select', 'dropdown', 'table', 'card', 'modal',
    'liquid', 'glass', 'backdrop', 'transparency', 'contrast', 'kontrast'
  ];

  var CFW_AI_BLOCKED_KEYWORDS = [
    'php', 'perl', 'python', 'bash', 'shell', 'terminal', 'sudo', 'apt ', 'apt-get',
    'passwd', 'password', 'passwort', 'secret', 'apikey', 'api_key', 'token=',
    'cookie', 'session', 'sessionid', 'ssh', 'mysql', 'sqlite', 'config.php',
    'loxberry_system', '/etc/', '/opt/loxberry/config', 'filesystem', 'file system',
    'curl ', 'wget ', 'http request', 'fetch(', 'xmlhttprequest', '<script', 'iframe'
  ];

  var CFW_AI_BLOCKED_RESPONSE_PATTERNS = [
    /<\?php/i,
    /#!\s*\/bin\/(bash|sh|perl|python)/i,
    /\b(sudo|apt-get|passwd|ssh|mysql|sqlite3)\b/i,
    /<script\b/i,
    /javascript\s*:/i,
    /@import\s+(url\()?\s*['"]?https?:/i,
    /url\s*\(\s*['"]?javascript:/i
  ];

  var CFW_AI_ALLOWED_JSON_ROOT_KEYS = [
    'theme',
    'design',
    'meta',
    'tokens',
    'effects',
    'components',
    'custom_css',
    'css',
    'import_meta'
  ];

  var CFW_AI_ALLOWED_CSS_PROPERTIES = [
    'background', 'background-color', 'background-image', 'color', 'border', 'border-color',
    'border-radius', 'box-shadow', 'filter', 'backdrop-filter', '-webkit-backdrop-filter',
    'opacity', 'font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap',
    'transition', 'outline', 'outline-color', 'text-shadow', 'text-decoration'
  ];


  var CFW_AI_REQUEST_CONTEXT_ROOT_KEYS = [
    'user_request',
    'current_selection',
    'current_theme_tokens',
    'available_core_tokens',
    'components',
    'ai_guard',
    'system',
    'explicit_user_constraints',
    'task',
    'prompt_profile',
    'output_contract',
    'intent',
    'priority_rules',
    'current_selection_hint',
    'selection',
    'token_values',
    'available_tokens_hint',
    'color_direction',
    'palette_directive',
    'color_style_direction'
  ];

  var CFW_AI_CLASSIFIER_HINTS = {
    hasCss: /\b(css|style|selector|token|--lb-|farbe|color|shadow|blur|radius|gradient|component|button|input|table|theme|json|liquid|glass)\b/i,
    themeImport: /json|css.*json|import|umwandeln|convert/,
    directEditor: /direkteditor|direct editor|gezielt dieses|dieses element|selected element|aktuelle auswahl.*element|element.*verbesser|element.*ändern|component.*ändern|komponente.*ändern/,
    optimize: /optimier|verbesser|improve|refine|anpass/,
    themeCreate: /(?:erstell|create|generate|generiere|erstelle|entwirf).*(?:theme|design|look|stil|style|palette)|(?:theme|design|look|stil|style|palette).*(?:erstell|create|generate|generiere|erstelle|entwirf)|rosefarben|rosé|rosa|pink|blau|hellblau|dunkelblau|bläulich|lila|violett|flieder|lavendel|rot|orange|gelb|grün|gruen|grau|türkis|tuerkis|petrol|blue theme|blaues theme|blauer style/,
    tokenEdit: /token/,
    colorSuggestion: /farbe|color|palette|kontrast|contrast/,
    explain: /erklär|explain/
  };

  var RULES = {
    version: '73.0.0',
    maxPromptLength: 4000,
    maxResponseLength: 120000,
    allowInternet: false,
    allowCodeGeneration: false,
    allowedTasks: CFW_AI_ALLOWED_TASKS,
    allowedTopics: CFW_AI_ALLOWED_TOPICS,
    blockedKeywords: CFW_AI_BLOCKED_KEYWORDS,
    blockedResponsePatterns: CFW_AI_BLOCKED_RESPONSE_PATTERNS,
    allowedJsonRootKeys: CFW_AI_ALLOWED_JSON_ROOT_KEYS,
    allowedCssProperties: CFW_AI_ALLOWED_CSS_PROPERTIES,
    requestContextRootKeys: CFW_AI_REQUEST_CONTEXT_ROOT_KEYS,
    classifierHints: CFW_AI_CLASSIFIER_HINTS
  };


  function currentLanguage() {
    return String(window.CFW_LANGUAGE || window.LBLANG || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  }

  function i18nGet(path) {
    var dictionary = (window.LBDesignStudioLangs && (window.LBDesignStudioLangs[currentLanguage()] || window.LBDesignStudioLangs.en || window.LBDesignStudioLangs.de)) || {};
    var parts = String(path || '').split('.');
    var current = dictionary;
    for (var i = 0; i < parts.length; i += 1) {
      if (!current || !Object.prototype.hasOwnProperty.call(current, parts[i])) return '';
      current = current[parts[i]];
    }
    return typeof current === 'string' ? current : '';
  }

  function tg(path, values) {
    var text = i18nGet(path) || path || '';
    if (values) {
      Object.keys(values).forEach(function (key) {
        text = text.replace(new RegExp('\\{' + key + '\\}', 'g'), values[key]);
      });
    }
    return text;
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).normalize('NFKC');
  }

  function stripActiveContent(value) {
    return normalizeText(value)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/password\s*[:=]\s*\S+/gi, 'password=[removed]')
      .replace(/passwort\s*[:=]\s*\S+/gi, 'passwort=[removed]')
      .replace(/api[_-]?key\s*[:=]\s*\S+/gi, 'api_key=[removed]')
      .replace(/session(id)?\s*[:=]\s*\S+/gi, 'session=[removed]')
      .trim();
  }

  function classifyRequest(prompt, context) {
    var text = normalizeText(prompt).toLowerCase();
    var hints = RULES.classifierHints;
    var hasCss = hints.hasCss.test(text);

    /* V56 priority: a full theme/style creation request must not be downgraded
       to DIRECT_EDITOR only because the sentence mentions buttons, inputs or
       the current Design Studio selection. */
    if (hints.themeImport.test(text)) return 'THEME_IMPORT';
    if (hints.themeCreate.test(text)) return 'THEME_CREATE';
    if (hints.directEditor.test(text)) return 'DIRECT_EDITOR';
    if (hints.optimize.test(text)) return hasCss ? 'CSS_OPTIMIZE' : 'BLOCK';
    if (hints.tokenEdit.test(text)) return 'TOKEN_EDIT';
    if (hints.colorSuggestion.test(text)) return 'COLOR_SUGGESTION';
    if (hints.explain.test(text)) return /json/.test(text) ? 'JSON_EXPLAIN' : 'CSS_EXPLAIN';
    return hasCss ? 'CSS_OPTIMIZE' : 'BLOCK';
  }

  function containsBlockedKeyword(text) {
    var lower = normalizeText(text).toLowerCase();
    return RULES.blockedKeywords.filter(function (word) { return lower.indexOf(word) !== -1; });
  }

  function validateRequest(userPrompt, context) {
    var sanitized = sanitizePromptInput(userPrompt);
    var task = classifyRequest(sanitized, context || {});
    var blocked = containsBlockedKeyword(sanitized);
    var errors = [];
    if (RULES.allowedTasks.indexOf(task) === -1) errors.push(tg('aiGuard.errors.requestNotAllowed'));
    if (blocked.length) errors.push(tg('aiGuard.errors.blockedTerms', { terms: blocked.slice(0, 6).join(', ') }));
    if (!sanitized) errors.push(tg('aiGuard.errors.emptyRequest'));
    if (sanitized.length > RULES.maxPromptLength) errors.push(tg('aiGuard.errors.requestTooLong'));
    return { ok: errors.length === 0, task: task, prompt: sanitized, errors: errors };
  }

  function sanitizePromptInput(userPrompt) {
    return stripActiveContent(userPrompt).slice(0, RULES.maxPromptLength);
  }

  function buildRestrictedPrompt(request) {
    request = request || {};

    // V73 cost saver: the UI can still show a pretty request, but the actual
    // model prompt is deliberately compact and task-specific. This preserves
    // all functions while reducing repeated instruction and output tokens.
    var systemParts = [
      'You are the LoxBerry CSS Framework Design Studio AI assistant.',
      'Allowed scope: CSS variables, semantic theme JSON, safe theme CSS only.',
      'Do not generate shell/PHP/Perl/Python/JS app code, secrets, config files, URLs or external imports.',
      'Return JSON only. Do not echo or explain the request.',
      'Allowed root keys: ' + RULES.allowedJsonRootKeys.join(', ') + '.',
      'User color/style request has highest priority; never replace it with the loaded theme palette.',
      'Keep output compact. Prefer tokens. Omit full css/components/design unless explicitly needed.'
    ];
    if (request.task === 'THEME_CREATE') {
      systemParts.push('For full theme creation, create a complete usable token set, but keep JSON compact.');
    }
    if (request.task === 'DIRECT_EDITOR' || request.task === 'TOKEN_EDIT' || request.intent === 'targeted-element-change') {
      systemParts.push('For targeted edits, change only selected/related tokens and return {"tokens":{...}}.');
    }
    return systemParts.join('\n') + '\nREQUEST JSON:\n' + JSON.stringify(request);
  }

  function sanitizeJsonTextForParse(text) {
    text = normalizeText(text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
    // LLMs sometimes return CSS strings with invalid JSON escapes such as \s or \.;
    // keep valid JSON escapes untouched and double only invalid backslashes.
    text = text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    return text;
  }

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch (ignore) { return null; }
  }

  function extractJson(text) {
    text = sanitizeJsonTextForParse(text);
    var parsed = tryParseJson(text);
    if (parsed) return parsed;

    // V65: Extract the first balanced JSON object from mixed AI output.
    // This tolerates short explanations or markdown around the JSON while still
    // validating the extracted object afterwards. Braces inside JSON strings are
    // ignored by the scanner.
    var starts = [];
    for (var i = 0; i < text.length; i += 1) {
      if (text.charAt(i) === '{') starts.push(i);
    }
    for (var sidx = 0; sidx < starts.length; sidx += 1) {
      var start = starts[sidx];
      var depth = 0;
      var inString = false;
      var escaped = false;
      for (var pos = start; pos < text.length; pos += 1) {
        var ch = text.charAt(pos);
        if (inString) {
          if (escaped) { escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') { inString = false; }
          continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            parsed = tryParseJson(text.slice(start, pos + 1));
            if (parsed) return parsed;
            break;
          }
        }
      }
    }

    // Last fallback for common fenced JSON with trailing text.
    var first = text.indexOf('{');
    var last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      parsed = tryParseJson(text.slice(first, last + 1));
      if (parsed) return parsed;
    }
    throw new Error(tg('aiGuard.errors.invalidJson'));
  }


  function normalizeTokenName(name) {
    name = String(name || '').trim();
    // Repair common LLM/list artefacts such as "- -lb-table-bg", "—lb-bg" or "–lb-primary".
    name = name.replace(/[–—]/g, '-');
    name = name.replace(/^[-*\s]+/, '');
    name = name.replace(/^(-\s+)+/, '');
    name = name.replace(/^-\s*-/, '--');
    name = name.replace(/\s+/g, '');
    if (/^lb-[a-z0-9-]+$/i.test(name)) name = '--' + name;
    if (/^-lb-[a-z0-9-]+$/i.test(name)) name = '-' + name;
    return name;
  }

  function normalizeTokenMap(map) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return map;
    var cleaned = {};
    Object.keys(map).forEach(function (key) {
      var normalized = normalizeTokenName(key);
      cleaned[normalized] = map[key];
    });
    return cleaned;
  }

  function normalizeAiJson(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    if (obj.tokens && typeof obj.tokens === 'object' && !Array.isArray(obj.tokens)) {
      obj.tokens = normalizeTokenMap(obj.tokens);
    }
    return obj;
  }

  function stripReturnedRequestContext(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    var cleaned = {};
    var hadAllowed = false;
    Object.keys(obj).forEach(function (key) {
      if (RULES.allowedJsonRootKeys.indexOf(key) !== -1) {
        cleaned[key] = obj[key];
        hadAllowed = true;
      }
    });
    if (hadAllowed) return cleaned;
    return obj;
  }

  function validateJsonShape(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [tg('aiGuard.errors.notJsonObject')];
    var keys = Object.keys(obj);
    var onlyRequestContext = keys.length > 0 && keys.every(function (key) { return RULES.requestContextRootKeys.indexOf(key) !== -1; });
    if (onlyRequestContext) return [tg('aiGuard.errors.returnedRequestContext')];
    keys.forEach(function (key) {
      if (RULES.allowedJsonRootKeys.indexOf(key) === -1) errors.push(tg('aiGuard.errors.forbiddenRootKey', { key: key }));
    });
    return errors;
  }

  function validateCssText(css) {
    css = normalizeText(css || '');
    var errors = [];
    RULES.blockedResponsePatterns.forEach(function (pattern) {
      if (pattern.test(css)) errors.push(tg('aiGuard.errors.activeCss'));
    });
    if (/expression\s*\(/i.test(css)) errors.push(tg('aiGuard.errors.cssExpression'));
    return errors;
  }

  function validateResponse(rawText) {
    var text = normalizeText(rawText);
    var errors = [];
    if (!text) errors.push(tg('aiGuard.errors.emptyResponse'));
    if (text.length > RULES.maxResponseLength) errors.push(tg('aiGuard.errors.responseTooLong'));
    RULES.blockedResponsePatterns.forEach(function (pattern) {
      if (pattern.test(text)) errors.push(tg('aiGuard.errors.blockedResponse'));
    });
    var json = null;
    if (!errors.length) {
      try {
        json = normalizeAiJson(stripReturnedRequestContext(extractJson(text)));
        errors = errors.concat(validateJsonShape(json));
        if (json.css) errors = errors.concat(validateCssText(json.css));
        if (json.custom_css) errors = errors.concat(validateCssText(json.custom_css));
      } catch (e) {
        errors.push(e.message || String(e));
      }
    }
    return { ok: errors.length === 0, errors: errors, json: json, text: text };
  }

  window.CFW_AI_GUARD = {
    rules: RULES,
    language: currentLanguage,
    t: tg,
    classifyRequest: classifyRequest,
    sanitizePromptInput: sanitizePromptInput,
    validateRequest: validateRequest,
    buildRestrictedPrompt: buildRestrictedPrompt,
    validateResponse: validateResponse,
    validateCssText: validateCssText,
    extractJson: extractJson
  };
}());
