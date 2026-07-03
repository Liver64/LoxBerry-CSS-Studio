# CSS Framework Design Studio translations

`de_en_color_style_map.json` contains technical normalization rules for AI prompts.
It maps German color and style terms to English canonical families before the
request is sent to the AI provider. This is not UI text and therefore does not
belong into `templates/plugins/cssframework/lang/`.

The map is intentionally stored below `config/plugins/cssframework/translations/`
so it can be reviewed and maintained centrally.
