window.LBDesignStudioLangs = window.LBDesignStudioLangs || {};
window.LBDesignStudioLangs.de = window.LBDesignStudioLangs.de || {};
window.LBDesignStudioLangs.de.aiGuard = {
  "errors": {
    "requestNotAllowed": "KI-Guard: Diese Anfrage ist keine erlaubte CSS/JSON/Theme-Aufgabe.",
    "blockedTerms": "KI-Guard: Anfrage enthält blockierte Begriffe: {terms}",
    "emptyRequest": "KI-Guard: Leere Anfrage.",
    "requestTooLong": "KI-Guard: Anfrage ist zu lang.",
    "invalidJson": "KI-Guard: Antwort enthält kein gültiges JSON.",
    "notJsonObject": "KI-Guard: Antwort ist kein JSON-Objekt.",
    "forbiddenRootKey": "KI-Guard: Unerlaubter JSON-Wurzelkey: {key}",
    "activeCss": "KI-Guard: CSS enthält aktive/externe oder nicht erlaubte Inhalte.",
    "cssExpression": "KI-Guard: CSS expression() ist nicht erlaubt.",
    "emptyResponse": "KI-Guard: Leere KI-Antwort.",
    "responseTooLong": "KI-Guard: KI-Antwort ist zu lang.",
    "blockedResponse": "KI-Guard: Antwort enthält blockierte Code-/Script-Inhalte.",
    "puterLoadFailed": "Puter.js konnte nicht geladen werden.",
    "returnedRequestContext": "KI-Guard: Die KI hat den Request-/Kontextblock zurückgegeben. Bitte erneut erzeugen; erwartet wird nur Theme-JSON mit theme/design/tokens/components."
  },
  "status": {
    "noDraft": "Noch kein KI-Entwurf geladen.",
    "requestBuilt": "Request-Paket lokal erzeugt und durch den KI-Guard geprüft. Es wurde noch nichts extern übertragen.",
    "consentRequired": "Bitte zuerst der externen Verarbeitung über Puter.js zustimmen.",
    "aiLoading": "Lade Puter.js und frage KI mit eingeschränktem CSS/JSON/Theme-Kontext an ...",
    "normalizingRequest": "",
    "aiReceived": "KI-Antwort erhalten und durch den KI-Guard vorgeprüft. Bitte vor dem Laden ins Design Studio validieren.",
    "intentNotRecognized": "Warnung: Es konnte keine eindeutige Farb- oder Stilrichtung erkannt werden. Bitte den Wunsch konkreter formulieren, z. B. blau, lila, dunkelgrau, modern oder ruhig."
  },
  "promptContext": {
    "useCurrentSelection": "Nutze die aktuelle Auswahl im Design Studio als Ausgangspunkt."
  },
  "systemPrompt": {
    "assistantRole": "Du bist der KI-Assistent des LoxBerry CSS Framework Design Studio.",
    "scopeOnly": "Du darfst ausschließlich bei CSS-, JSON-, Theme-, Design-Token- und Komponenten-Design-Aufgaben helfen.",
    "noCodeSecrets": "Du darfst keine PHP-, Perl-, Python-, Bash-, Shell-, Netzwerk-, Datei-, Login-, Cookie-, Session- oder API-Key-Inhalte erzeugen oder verarbeiten.",
    "noExternal": "Du darfst keine externen URLs, keine @import-HTTP-Regeln, kein JavaScript, kein HTML-Script und keine Installationsbefehle ausgeben.",
    "format": "Antwortformat: ausschließlich JSON ohne Markdown und ohne Erklärung.",
    "roots": "Erlaubte JSON-Wurzeln: theme, design, meta, tokens, effects, components, custom_css, css, import_meta.",
    "cssScope": "CSS darf nur visuelle Theme-Regeln enthalten. Liquid-Glass-Effekte wie backdrop-filter, blur, rgba, linear-gradient, border-radius und box-shadow sind erlaubt.",
    "protectedCore": "Core-Dateien sind read-only. Logmanager-/Status-Zeilen und Tooltip-Regeln bleiben geschützt.",
    "localValidation": "Der Entwurf wird danach lokal validiert und erst nach Benutzerbestätigung übernommen.",
    "doNotEchoRequest": "Gib niemals Request-/Kontextschlüssel wie user_request, task, prompt_profile, current_selection, selection, token_values, current_theme_tokens, available_core_tokens, components, output_contract oder ai_guard als JSON-Wurzel zurück. Wiederhole den REQUEST JSON nicht.",
    "priorityOrder": "Priorität: 1. expliziter Benutzerwunsch/Farbwunsch, 2. Kontrast und Lesbarkeit, 3. semantische Token-Zuordnung, 4. Theme-Konsistenz. Ein vorhandenes Theme darf einen expliziten Farbwunsch nicht überschreiben.",
    "respectUserColor": "Explizite Farbwünsche des Benutzers haben höchste Priorität. Wenn der Benutzer eine konkrete Farbe oder Stilrichtung verlangt, musst du passende Werte dafür erzeugen und darfst nicht auf eine andere Akzentfarbe zurückfallen.",
    "themeCreateNoPaletteCopy": "Bei THEME_CREATE wird absichtlich keine aktuelle Theme-Palette übergeben. Entwirf ein neues Theme aus dem Benutzerwunsch; nutze vorhandene Auswahl nur als Orientierung, nicht als Farbvorlage.",
    "targetedElementOnly": "Bei Direkteditor-Aufgaben verändere nur das gewählte Element oder eng zugehörige Tokens desselben Elements. Das restliche Theme bleibt so weit wie möglich unverändert.",
    "onlyListedTokens": "Bei gezielten Elementänderungen darfst du nur Tokens aus selection.tokens oder selection.related_tokens verändern. Wenn der Benutzer einen Zustand wie off, hover, disabled, focus oder active nennt, wähle den dazu passenden verwandten Token."
  }
};
