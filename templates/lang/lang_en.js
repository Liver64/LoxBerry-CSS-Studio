window.LBDesignStudioLangs = window.LBDesignStudioLangs || {};
window.LBDesignStudioLangs.en = {
  "main": {
    "buttons": {
      "save": "Save",
      "saveGenerateCss": "Save & generate CSS",
      "delete": "Delete",
      "cancel": "Cancel",
      "validate": "Validate",
      "test": "Test",
      "close": "Close",
      "apply": "Apply",
      "undo": "↶ Undo",
      "ok": "OK",
      "back": "Back"
    },
    "common": {
      "yes": "Yes",
      "no": "No",
      "auto": "Auto",
      "none": "None",
      "enabled": "Enabled",
      "disabled": "Disabled"
    },
    "status": {
      "title": "Status"
    }
  },
  "studio": {
    "title": "LoxBerry Design Studio",
    "subtitle": "Theme design using understandable elements. Core tokens are assigned automatically internally. Elements can be clicked directly in the preview. Ctrl-click, preview double-click, or double-click on a property/token tile opens the direct editor."
  },
  "toolbar": {
    "userTheme": "User Theme",
    "currentPreviewNewTheme": "Current preview / new theme"
  },
  "tabs": {
    "ariaLabel": "Design Studio sections",
    "designStudio": "Design Studio",
    "aiDesigner": "AI Designer",
    "preview": "Live Preview",
    "documentation": "Documentation"
  },
  "inspector": {
    "selectedElement": "Selected element",
    "selectedCardTitle": "Double-click opens the direct editor for the current element; property tiles open the matching property directly",
    "selectedEyebrow": "Preview selection · double-click element: direct editor",
    "emptyMeta": "0 properties · 0 tokens",
    "noMapping": "No tokens in mapping",
    "moreTokens": "more",
    "noToken": "no token",
    "propertyTitlePrefix": "Click: select property · double-click: open direct editor for this property"
  },
  "properties": {
    "ariaLabel": "Properties of the selected element",
    "area": "Area",
    "elementVariant": "Element / variant",
    "property": "Property"
  },
  "tokens": {
    "showAffected": "Show all affected tokens",
    "tokens": "Tokens",
    "internalTokens": "internal tokens"
  },
  "components": {
    "inputText": "Input Text"
  },
  "palette": {
    "title": "4. Preview colors"
  },
  "directEditor": {
    "title": "Direct editor",
    "closeAria": "Close direct editor",
    "hint": "Double-click a property/token tile or Ctrl-click in the final preview to open this element directly.",
    "noElement": "No element selected",
    "focusSettings": "Focus settings",
    "improveWithAi": "Improve this element with AI"
  },
  "settings": {
    "title": "Settings",
    "color": "Color",
    "opacity": "Opacity",
    "brightness": "Brightness",
    "radius": "Radius",
    "borderWidth": "Border width",
    "shadowDepth": "Shadow / depth"
  },
  "import": {
    "title": "5. CSS import",
    "hint": "Imported CSS is used as custom CSS. Known --lb-* tokens are also applied to the final preview and saved as JSON source when the theme is saved. Special rules that cannot be tokenized, such as blur, backdrop filters or wallpaper rules, remain preserved in the custom CSS block.",
    "showCustomCss": "Show custom CSS",
    "summaryTitle": "Hybrid import",
    "summaryTokens": "{count} core tokens detected",
    "summaryCustom": "{count} individual CSS rules preserved",
    "summaryEffects": "Detected effects: {effects}",
    "summaryNoEffects": "No special effects detected",
    "effects": {
      "backdropFilter": "Backdrop filter",
      "blur": "Blur",
      "transparency": "Transparency",
      "wallpaper": "Wallpaper",
      "shadows": "Shadows"
    }
  },
  "preview": {
    "title": "Workspace / Preview",
    "workHint": "Click individual elements to edit them in the Studio. Double-click opens the direct editor.",
    "caption": "No element selected.",
    "internalTokens": "internal tokens",
    "nav": {
      "dashboard": "Dashboard",
      "settings": "Settings",
      "logfiles": "Logfiles"
    },
    "edit": {
      "headerButtons": "Edit header buttons",
      "inputText": "Edit input text",
      "select": "Edit select",
      "button": "Edit button",
      "activeButton": "Edit active button",
      "buttonGroup": "Edit button group",
      "input": "Edit input",
      "dropdown": "Edit dropdown",
      "textarea": "Edit textarea",
      "slider": "Edit slider",
      "checkbox": "Edit checkbox",
      "radio": "Edit radio",
      "toggle": "Edit toggle",
      "validation": "Edit validation",
      "modal": "Edit modal",
      "table": "Edit table",
      "background": "Edit background",
      "sidebar": "Edit sidebar background"
    },
    "card": {
      "title": "Plugin Card / Note",
      "text": "Short neutral preview of a typical LoxBerry page."
    },
    "form": {
      "select": "Select",
      "option": "Option",
      "button": "Button",
      "active": "Active",
      "inputText": "Input Text"
    },
    "forms": {
      "title": "Forms",
      "input": "Input",
      "dropdown": "Dropdown",
      "textarea": "Textarea",
      "slider": "Slider",
      "checkbox": "Checkbox",
      "radio": "Radio",
      "toggle": "Toggle",
      "textValue": "Text"
    },
    "feedback": {
      "success": "Everything is OK!",
      "warning": "Validation notice",
      "openModal": "Open modal"
    },
    "table": {
      "name": "Name",
      "type": "Type",
      "status": "Status",
      "action": "Action",
      "livingRoom": "Living room",
      "standard": "Standard",
      "online": "Online",
      "selection": "Selection",
      "kitchen": "Kitchen",
      "compact": "Compact",
      "standby": "Standby",
      "bath": "Bathroom",
      "hover": "Hover",
      "offline": "Offline",
      "value": "Value"
    }
  },
  "wallpaper": {
    "title": "Wallpaper editor",
    "enabled": "Enable wallpaper",
    "image": "Wallpaper path / data URL",
    "file": "Wallpaper file",
    "chooseFile": "Choose file",
    "noFile": "No file selected",
    "imagePlaceholder": "theme-file.cgi?file=assets%2Fimages%2Ftheme%2Fwallpaper.jpg",
    "mode": "Mode",
    "modeCover": "Cover",
    "modeContain": "Contain",
    "modeRepeat": "Repeat",
    "modeCenter": "Centered",
    "brightness": "Wallpaper brightness",
    "opacity": "Wallpaper opacity"
  },
  "ai": {
    "title": "AI Designer",
    "hint": "In V40, AI is restricted to CSS, JSON and theme tasks. Do not enter personal data, passwords, API keys, configuration files or confidential content. AI creates only a semantic theme draft. Inputs, selects, dropdowns, tables, buttons, button groups, header buttons and cards are then mapped locally to core tokens. Header buttons are treated as their own component. Individual preview elements can be prepared as AI focus via Ctrl-click.",
    "consent": "I agree that only CSS/JSON/theme context, a reduced core/component summary and my prompt are processed externally via Puter.js.",
    "advancedView": "advanced view",
    "model": "AI model",
    "promptLabel": "Theme request",
    "colorDirection": "Color direction",
    "colorDirectionHint": "Clicking adds a readable color preference to the prompt, not a hex code.",
    "colorDirectionPrompt": "Use this color direction: {color}.",
    "defaultPrompt": "Create a modern, calm LoxBerry theme with clear contrasts, rounded cards, subtle buttons and good readability.",
    "showRequest": "Show request",
    "generate": "Generate AI draft",
    "requestContext": "Request / context",
    "result": "AI result",
    "resultHint": "Semantic JSON with <code>design.colors</code> and <code>design.components</code> is expected. Before loading, the AI Guard checks the response for allowed JSON/CSS content.",
    "loadIntoStudio": "Load into Design Studio",
    "previewTitle": "AI preview / theme draft",
    "noDraft": "No AI draft loaded yet.",
    "validNoValues": "JSON is valid, but contains no applicable design values.",
    "adoptedValues": "Adopted design values"
  },
  "statusModal": {
    "successTitle": "OK",
    "infoTitle": "Notice",
    "warningTitle": "Notice",
    "errorTitle": "Error",
    "autoCloseHint": "This message closes automatically after 5 seconds.",
    "manualCloseHint": "Please confirm."
  },

  "deleteModal": {
    "title": "Delete user theme",
    "help": "Really delete this user theme? The JSON and matching CSS file will be deleted if they were generated by CSS-Studio."
  },

  "saveModal": {
    "title": "Save theme",
    "help": "The filename is generated automatically from the display name. A leading “LoxBerry” is removed.",
    "displayName": "Display name / filename",
    "version": "Version",
    "base": "Base",
    "baseCore": "Core / system",
    "baseLiquidGlass": "Liquid Glass",
    "baseRounded": "Rounded",
    "baseClassicMac": "Classic Mac",
    "defaultThemeName": "Demo Theme"
  },
  "messages": {
    "noSaveableContent": "Not saved: there are no theme tokens or usable custom CSS rules. Load an AI draft, import CSS, or change a value first.",

    "deleteNoThemeSelected": "No user theme selected for deletion.",
    "deleteConfirm": "Really delete this user theme? The JSON and matching CSS file are deleted if they were generated by CSS-Studio.",
    "deletingTheme": "Deleting user theme ...",
    "themeDeleted": "Deleted: {theme}. Removed: JSON {json}, CSS {css}, manifest {manifest}.",
    "savingTheme": "Saving theme and generating CSS ...",
    "hybridCssImported": "Hybrid CSS imported: {file}. {tokens} core tokens detected, {rules} custom CSS rules preserved.",
    "legacyCssImported": "Legacy CSS imported: {file}. {count} known core tokens were applied to the final preview. It will be saved as a JSON source.",
    "cssImportedNoTokens": "CSS imported: {file}. No known --lb-* tokens found; CSS remains as custom CSS.",
    "cssReadError": "CSS could not be read.",
    "userThemeLoaded": "User theme loaded: {theme}. Only the final preview was updated.",
    "requestBuilt": "Request package created locally and checked by AI Guard. Nothing has been transmitted externally yet.",
    "jsonNoObject": "No JSON object.",
    "invalidToken": "Invalid token: {token}",
    "forbiddenCss": "CSS contains forbidden external/active content.",
    "aiValid": "AI draft is formally valid and can be loaded.",
    "aiValidateFirst": "Please validate the AI draft successfully first.",
    "aiLoaded": "AI draft loaded into the preview. Please review and save finally.",
    "aiConsentRequired": "Please first agree to external processing via Puter.js.",
    "aiLoading": "Loading Puter.js and requesting AI with restricted CSS/JSON/theme context ...",
    "aiReceived": "AI response received and pre-checked by AI Guard. Please validate before loading it into Design Studio.",
    "directEditorFocused": "Direct editor selection focused: {path}",
    "aiFocusPrepared": "AI focus prepared for {path}. Adjust the prompt if needed and generate the AI draft.",
    "directEditorOpened": "Direct editor opened: {path}",
    "previewSelected": "Preview selection applied: {path}. Double-click or Ctrl-click opens the direct editor.",
    "coreRead": "Core read: {tokens} tokens, {themes} themes.",
    "selectElementFirst": "Please select an element in Workspace / Preview or in the properties area first.",
    "noRadiusForElement": "This element has no radius tokens.",
    "noBorderWidthForElement": "This element has no border-width tokens."
  }
};
