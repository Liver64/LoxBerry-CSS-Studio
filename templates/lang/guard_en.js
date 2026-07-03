window.LBDesignStudioLangs = window.LBDesignStudioLangs || {};
window.LBDesignStudioLangs.en = window.LBDesignStudioLangs.en || {};
window.LBDesignStudioLangs.en.aiGuard = {
  "errors": {
    "requestNotAllowed": "AI Guard: This request is not an allowed CSS/JSON/theme task.",
    "blockedTerms": "AI Guard: Request contains blocked terms: {terms}",
    "emptyRequest": "AI Guard: Empty request.",
    "requestTooLong": "AI Guard: Request is too long.",
    "invalidJson": "AI Guard: Response does not contain valid JSON.",
    "notJsonObject": "AI Guard: Response is not a JSON object.",
    "forbiddenRootKey": "AI Guard: Forbidden JSON root key: {key}",
    "activeCss": "AI Guard: CSS contains active, external or disallowed content.",
    "cssExpression": "AI Guard: CSS expression() is not allowed.",
    "emptyResponse": "AI Guard: Empty AI response.",
    "responseTooLong": "AI Guard: AI response is too long.",
    "blockedResponse": "AI Guard: Response contains blocked code/script content.",
    "puterLoadFailed": "Puter.js could not be loaded.",
    "returnedRequestContext": "AI Guard: The AI returned the request/context block. Generate again; only theme JSON with theme/design/tokens/components is expected."
  },
  "status": {
    "noDraft": "No AI draft loaded yet.",
    "requestBuilt": "Request package created locally and checked by AI Guard. Nothing has been transmitted externally yet.",
    "consentRequired": "Please approve external processing via Puter.js first.",
    "aiLoading": "Loading Puter.js and requesting AI with restricted CSS/JSON/theme context ...",
    "normalizingRequest": "",
    "aiReceived": "AI response received and pre-checked by AI Guard. Please validate before loading it into Design Studio.",
    "intentNotRecognized": "Warning: No clear color or style direction was detected. Please make the prompt more specific, for example blue, purple, dark gray, modern or calm."
  },
  "promptContext": {
    "useCurrentSelection": "Use the current selection in the Design Studio as the starting point."
  },
  "systemPrompt": {
    "assistantRole": "You are the AI assistant of the LoxBerry CSS Framework Design Studio.",
    "scopeOnly": "You may only help with CSS, JSON, theme, design token and component design tasks.",
    "noCodeSecrets": "You must not create or process PHP, Perl, Python, Bash, shell, network, file, login, cookie, session or API key content.",
    "noExternal": "You must not output external URLs, @import HTTP rules, JavaScript, HTML script tags or installation commands.",
    "format": "Response format: JSON only, without Markdown and without explanation.",
    "roots": "Allowed JSON roots: theme, design, meta, tokens, effects, components, custom_css, css, import_meta.",
    "cssScope": "CSS may contain visual theme rules only. Liquid Glass effects such as backdrop-filter, blur, rgba, linear-gradient, border-radius and box-shadow are allowed.",
    "protectedCore": "Core files are read-only. Log manager/status lines and tooltip rules remain protected.",
    "localValidation": "The draft is validated locally afterwards and only applied after user confirmation.",
    "doNotEchoRequest": "Never return request/context keys such as user_request, task, prompt_profile, current_selection, selection, token_values, current_theme_tokens, available_core_tokens, components, output_contract or ai_guard as JSON root keys. Do not echo the REQUEST JSON.",
    "priorityOrder": "Priority: 1. explicit user request/color request, 2. contrast and readability, 3. semantic token mapping, 4. theme consistency. An existing theme must not override an explicit color request.",
    "respectUserColor": "Explicit user color requests have highest priority. If the user asks for a specific color or style direction, you must generate matching values for it and must not fall back to another accent color.",
    "themeCreateNoPaletteCopy": "For THEME_CREATE no current theme palette is intentionally provided. Design a new theme from the user request; use the current selection only as orientation, not as a color template.",
    "targetedElementOnly": "For Direct Editor tasks, change only the selected element or closely related tokens of that same element. Keep the rest of the theme unchanged as much as possible.",
    "onlyListedTokens": "For targeted element changes, only change tokens from selection.tokens or selection.related_tokens. If the user mentions a state such as off, hover, disabled, focus or active, choose the matching related token."
  }
};
