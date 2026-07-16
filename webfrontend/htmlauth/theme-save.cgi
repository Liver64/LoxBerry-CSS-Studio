#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "/opt/loxberry/libs/perllib";
use FindBin qw($Bin);
use lib "$Bin/lib";

use CGI qw(:standard);
use JSON::PP qw(decode_json encode_json);
use File::Path qw(make_path);
use File::Copy qw(move copy);
use POSIX qw(strftime);
use MIME::Base64 qw(decode_base64);
use LoxBerry::System;
use LoxBerry::Web;
use LoxBerry::JSON;

our ($lbpconfigdir, $lbpdatadir);

my $plugin = 'cssframework';
my $cfgdir = $lbpconfigdir || $ENV{LBPCONFIG} || "/opt/loxberry/config/plugins/$plugin";
my $datadir = $lbpdatadir || $ENV{LBPDATA} || "/opt/loxberry/data/plugins/$plugin";

# V79 storage split:
# - JSON/editable Studio state stays in config/plugins/cssframework/themes.
# - CSS/assets live only in data/plugins/cssframework/themes.
# - Browser delivery is handled by theme-file.cgi; no webfrontend theme mirror is used.
my $theme_json_dir = "$cfgdir/themes";
my $theme_dir      = "$datadir/themes";
my $manifest_dir   = "$cfgdir/manifests";

sub _pretty_json {
    my ($payload) = @_;
    return JSON::PP->new->canonical(1)->pretty(1)->encode($payload);
}

sub _respond {
    my ($status, $payload) = @_;
    print header(
        -type    => 'application/json',
        -charset => 'utf-8',
        -status  => $status,
    );
    print encode_json($payload);
    exit;
}

sub _error_payload {
    my ($key, $fallback, $values) = @_;
    $values = {} if ref($values) ne 'HASH';
    return {
        ok           => JSON::PP::false,
        error_key    => $key,
        error        => $fallback,
        error_values => $values,
    };
}

for my $dir ($theme_json_dir, $theme_dir, $manifest_dir) {
    if (!-d $dir) {
        eval { make_path($dir, { mode => 0775 }); 1 }
            or _respond('500 Internal Server Error', _error_payload('cannotCreateDirectory', 'cannotCreateDirectory', { path => $dir }));
    }
}

my $raw = do { local $/; <STDIN> };
my $data = eval { decode_json($raw || '{}') };
_respond('400 Bad Request', _error_payload('invalidJsonPayload', 'invalidJsonPayload', {})) if $@ || ref($data) ne 'HASH';

sub _normalize_name {
    my ($name) = @_;
    $name = defined $name ? "$name" : '';
    $name =~ s/^\s+|\s+$//g;
    $name =~ s/^loxberry[\s_-]*//i;
    $name =~ s/^\s+|\s+$//g;
    return $name ne '' ? $name : 'User Theme';
}

sub _theme_id_from_name {
    my ($name) = @_;
    my $slug = lc(_normalize_name($name));
    $slug =~ s/ä/ae/g;
    $slug =~ s/ö/oe/g;
    $slug =~ s/ü/ue/g;
    $slug =~ s/ß/ss/g;
    $slug =~ s/[^a-z0-9]+/-/g;
    $slug =~ s/^-+|-+$//g;
    $slug = 'theme' if $slug eq '';
    return 'theme-user-' . $slug;
}

sub _inc_patch {
    my ($version) = @_;
    $version = '0.1.0' if !defined $version || $version !~ /^(\d+)\.(\d+)\.(\d+)/;
    my ($maj, $min, $patch) = ($1, $2, $3);
    return join('.', $maj, $min, $patch + 1);
}

my $name = _normalize_name($data->{name});
my $id = _theme_id_from_name($name);

sub _protected_studio_theme_mode {
    my ($theme_id) = @_;
    $theme_id = defined $theme_id ? lc("$theme_id") : '';
    return 'wallpaper-only' if $theme_id eq 'theme-user-liquid-glass';
    return 'readonly'       if $theme_id eq 'theme-user-classic-mac';
    return '';
}

sub _protected_studio_theme_name {
    my ($theme_id) = @_;
    return 'Liquid Glass' if lc($theme_id || '') eq 'theme-user-liquid-glass';
    return 'Classic Mac'  if lc($theme_id || '') eq 'theme-user-classic-mac';
    return $theme_id || 'Package Theme';
}

my $protected_studio_theme_mode = _protected_studio_theme_mode($id);
my $is_protected_studio_theme = $protected_studio_theme_mode ne '' ? 1 : 0;
my $protected_wallpaper_only_request = (
    $protected_studio_theme_mode eq 'wallpaper-only' && $data->{protected_wallpaper_only}
) ? 1 : 0;

if ($protected_studio_theme_mode eq 'readonly') {
    _respond('403 Forbidden', _error_payload('protectedPackageTheme', 'protectedPackageTheme', {
        theme => _protected_studio_theme_name($id), id => $id
    }));
}

if ($protected_studio_theme_mode eq 'wallpaper-only' && !$protected_wallpaper_only_request) {
    _respond('403 Forbidden', _error_payload('protectedPackageTheme', 'protectedPackageTheme', {
        theme => _protected_studio_theme_name($id), id => $id
    }));
}

my $version = $data->{version} || '0.1.0';
$version =~ s/^\s+|\s+$//g;
$version = '0.1.0' if $version !~ /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9_.-]+)?$/;

my $json_path = "$theme_json_dir/$id.json";
my $legacy_data_json_path = "$theme_dir/$id.json";

# V76 temporarily stored JSON next to CSS in data/themes.
# Move such JSON files back to config/themes on the next save.
if (!-f $json_path && -f $legacy_data_json_path) {
    if (copy($legacy_data_json_path, $json_path)) {
        chmod 0664, $json_path;
        unlink($legacy_data_json_path);
    }
}
elsif (-f $json_path && -f $legacy_data_json_path) {
    unlink($legacy_data_json_path);
}

my $previous_backup = '';
if (-f $json_path) {
    my $old;
    if (open(my $rfh, '<:raw', $json_path)) {
        local $/;
        my $old_raw = <$rfh>;
        close($rfh);
        $old = eval { decode_json($old_raw) };
    }
    $version = _inc_patch(ref($old) eq 'HASH' ? $old->{version} : $version);
    my $stamp = strftime('%Y%m%d-%H%M%S', localtime);
    my $bak = "$theme_json_dir/$id.$stamp.v$version.json.bak";
    if (!move($json_path, $bak)) {
        _respond('500 Internal Server Error', _error_payload('cannotBackupPreviousJson', 'cannotBackupPreviousJson', { path => $json_path }));
    }
    chmod 0664, $bak;
    $previous_backup = $bak;
}

my $tokens = ref($data->{tokens}) eq 'HASH' ? $data->{tokens} : {};

sub _sanitize_custom_css_value {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    return '' if $value eq '[object Object]';

    # V275: remove the default Studio placeholder comment, including already
    # mojibake-corrupted variants such as "Eigene ErgÃ...nzungen bleiben beim
    # Speichern erhalten.". This placeholder is not user CSS and previously
    # grew exponentially in both JSON custom_css and generated CSS.
    $value =~ s{/\*\s*USER CUSTOM CSS START\s*\*/}{}ig;
    $value =~ s{/\*\s*USER CUSTOM CSS END\s*\*/}{}ig;
    $value =~ s{/\*\s*Eigene\s+Erg[\s\S]*?Speichern\s+erhalten\.\s*\*/}{}ig;

    # Safety net for already exploded files where the placeholder is megabytes
    # long and the exact comment pattern may be broken. Real CSS survives this.
    if (length($value) > 100000 && $value =~ /Eigene\s+Erg/i && $value =~ /Speichern\s+erhalten\./i) {
        my $without_comments = $value;
        $without_comments =~ s{/\*[\s\S]*?\*/}{}g;
        $without_comments =~ s/^\s+|\s+$//g;
        $value = '' if $without_comments eq '';
    }

    $value =~ s/^\s+|\s+$//g;
    return $value;
}

sub _normalize_custom_css_value {
    my ($value) = @_;
    return '' if !defined $value;
    if (ref($value) eq '') {
        return _sanitize_custom_css_value($value);
    }
    if (ref($value) eq 'ARRAY') {
        return _sanitize_custom_css_value(join("\n", grep { defined $_ && $_ ne '' } map { _normalize_custom_css_value($_) } @{$value}));
    }
    if (ref($value) eq 'HASH') {
        return _normalize_custom_css_value($value->{css}) if exists $value->{css};
        return _normalize_custom_css_value($value->{custom_css}) if exists $value->{custom_css};
        return _normalize_custom_css_value($value->{text}) if exists $value->{text};
        return '';
    }
    return '';
}

sub _make_css_color_opaque {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;
    return $value if $value eq '';

    if ($value =~ /^#([0-9a-fA-F]{8})$/) {
        return '#' . lc(substr($1, 0, 6));
    }
    if ($value =~ /^#([0-9a-fA-F]{4})$/) {
        my @c = split(//, $1);
        return '#' . lc($c[0] . $c[0] . $c[1] . $c[1] . $c[2] . $c[2]);
    }
    if ($value =~ /^rgba?\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i) {
        my ($r, $g, $b) = (int($1 + 0.5), int($2 + 0.5), int($3 + 0.5));
        $r = 0 if $r < 0; $r = 255 if $r > 255;
        $g = 0 if $g < 0; $g = 255 if $g > 255;
        $b = 0 if $b < 0; $b = 255 if $b > 255;
        return "rgb($r, $g, $b)";
    }
    if ($value =~ /^hsla?\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)/i) {
        my ($h, $s, $l) = ($1, $2, $3);
        $h =~ s/^\s+|\s+$//g;
        $s =~ s/^\s+|\s+$//g;
        $l =~ s/^\s+|\s+$//g;
        return "hsl($h, $s, $l)";
    }

    return $value;
}

sub _force_opaque_theme_tokens {
    my ($token, $value) = @_;
    return _make_css_color_opaque($value) if defined $token && $token eq '--lb-sidebar-bg';
    return $value;
}

sub _normalize_hex_color {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;
    if ($value =~ /^#([0-9a-fA-F]{3})$/) {
        my @c = split(//, lc($1));
        return '#' . $c[0] . $c[0] . $c[1] . $c[1] . $c[2] . $c[2];
    }
    if ($value =~ /^#([0-9a-fA-F]{6})$/) {
        return '#' . lc($1);
    }
    if ($value =~ /^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i) {
        my ($r, $g, $b) = (int($1), int($2), int($3));
        $r = 0 if $r < 0; $r = 255 if $r > 255;
        $g = 0 if $g < 0; $g = 255 if $g > 255;
        $b = 0 if $b < 0; $b = 255 if $b > 255;
        return sprintf('#%02x%02x%02x', $r, $g, $b);
    }
    return '';
}

sub _is_classic_loxberry_green {
    my ($value) = @_;
    my $hex = _normalize_hex_color($value);
    return $hex eq '#6dac20' || $hex eq '#5a9418' || $hex eq '#4a7a12';
}

sub _is_plain_white_color {
    my ($value) = @_;
    my $hex = _normalize_hex_color($value);
    return $hex eq '#ffffff';
}

sub _sync_tinted_surface_tokens {
    my ($tokens) = @_;
    return if ref($tokens) ne 'HASH';

    my $bg = _first_clean_token_value($tokens, '--lb-bg');
    return if $bg eq '' || _is_plain_white_color($bg);

    # V272/V261 restored: backend safety net matching the Design Studio generator.
    # If an already generated tinted user theme is loaded and saved unchanged,
    # old pure-white surface tokens are mapped back to the theme background.
    # Explicit non-white surface choices stay unchanged.
    for my $token (qw(
        --lb-card-bg
        --lb-table-bg
        --lb-table-row-bg
        --lb-input-bg
        --lb-input-disabled-bg
        --lb-select-bg
        --lb-dropdown-menu-bg
        --lb-multiselect-bg
        --lb-multiselect-summary-bg
    )) {
        next if !exists $tokens->{$token};
        next if !_is_plain_white_color($tokens->{$token});
        $tokens->{$token} = $bg;
    }
}

sub _first_clean_token_value {
    my ($tokens, @names) = @_;
    for my $name (@names) {
        next if !defined $tokens->{$name};
        my $value = "$tokens->{$name}";
        $value =~ s/^\s+|\s+$//g;
        return $value if $value ne '';
    }
    return '';
}

sub _sync_primary_slider_value_tokens {
    my ($tokens) = @_;
    return if ref($tokens) ne 'HASH';
    my $candidate = _first_clean_token_value($tokens,
        '--lb-btn-primary-bg',
        '--lb-active-bg',
        '--lb-btn-group-active-bg',
        '--lb-slider-fill-bg',
        '--lb-slider-active-bg',
        '--lb-range-active-bg'
    );
    my $primary = _first_clean_token_value($tokens, '--lb-primary');
    if ($candidate ne '' && ($primary eq '' || (_is_classic_loxberry_green($primary) && !_is_classic_loxberry_green($candidate)))) {
        $tokens->{'--lb-primary'} = $candidate;
        $primary = $candidate;
    }
    if ($primary ne '') {
        $tokens->{'--lb-slider-value-text'} = 'var(--lb-primary)';
    }
}

my $custom_css = _normalize_custom_css_value($data->{custom_css});

my $import_meta = {};
if (ref($data->{import_meta}) eq 'HASH') {
    my $src = $data->{import_meta};
    $import_meta = {
        mode                => defined $src->{mode} ? "$src->{mode}" : 'hybrid-tokens-plus-custom-css',
        file                => defined $src->{file} ? "$src->{file}" : '',
        tokenCount          => int($src->{tokenCount} || 0),
        customRuleCount     => int($src->{customRuleCount} || 0),
        customCssPreserved  => $src->{customCssPreserved} ? JSON::PP::true : JSON::PP::false,
        effects             => (ref($src->{effects}) eq 'HASH' ? $src->{effects} : {}),
    };
}

sub _clamp_int {
    my ($value, $min, $max, $default) = @_;
    $value = defined $value && $value =~ /^-?\d+$/ ? int($value) : $default;
    $value = $min if $value < $min;
    $value = $max if $value > $max;
    return $value;
}

sub _css_string_escape {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/\\/\\\\/g;
    $value =~ s/"/\\"/g;
    return $value;
}

# Wallpaper metadata contract for LoxBerry Core.
# Core may inspect only the CSS header, so these values must remain on one line
# and must use the canonical stored source path, not the theme-file.cgi URL.
sub _css_header_value {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/[\r\n]+/ /g;
    $value =~ s{\*/}{* /}g;
    $value =~ s/^\s+|\s+$//g;
    return $value;
}

sub _sync_wallpaper_header_metadata {
    my ($css_content, $wallpaper_ref) = @_;
    $css_content = defined $css_content ? "$css_content" : '';

    # Remove older metadata first, so repeated saves never duplicate markers.
    $css_content =~ s{^[ \t]*\*?[ \t]*Wallpaper-(?:URL|Brightness|Opacity):[^\r\n]*(?:\r?\n|\z)}{}gim;

    return $css_content
        if ref($wallpaper_ref) ne 'HASH'
        || !$wallpaper_ref->{enabled}
        || !$wallpaper_ref->{image};

    my $image = _css_header_value($wallpaper_ref->{image});
    my $brightness = _clamp_int($wallpaper_ref->{brightness}, 0, 150, 100);
    my $opacity = _clamp_int($wallpaper_ref->{opacity}, 0, 100, 100);
    my $metadata = " * Wallpaper-URL: $image\n";
    $metadata .= " * Wallpaper-Brightness: $brightness\n";
    $metadata .= " * Wallpaper-Opacity: $opacity\n";

    # Prefer the first existing CSS header. If none exists, create one.
    if ($css_content =~ m{\A/\*}) {
        $css_content =~ s{\*/}{$metadata . "*/"}e;
        return $css_content;
    }

    return "/*\n$metadata*/\n\n" . $css_content;
}

sub _theme_file_url_for_css {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;

    # Legacy mirror URLs are rewritten to the V79 data-serving CGI.
    if ($value =~ m{^/plugins/cssframework/themes/(.+)$}) {
        $value = $1;
    }
    if ($value =~ m{^(theme-user-[A-Za-z0-9_-]+\.css|assets/[A-Za-z0-9_./-]+)$}) {
        my $file = $value;
        $file =~ s/([^A-Za-z0-9_.~\/-])/sprintf("%%%02X", ord($1))/ge;
        $file =~ s{/}{%2F}g;
        return "theme-file.cgi?file=$file";
    }
    return $value;
}

sub _normalize_wallpaper_image_ref {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;
    $value =~ s{^/plugins/cssframework/themes/}{};
    return $value;
}

sub _write_wallpaper_asset {
    my ($image, $theme_id) = @_;
    $image = _normalize_wallpaper_image_ref($image);
    return '' if $image eq '';

    # Already a stored plugin asset reference.
    # V263: The protected Liquid Glass theme now uses the canonical
    # assets/images/theme-user-liquid-glass/ directory only. Older packages used
    # assets/images/liquid-glass/; normalize that legacy reference before saving
    # so the theme cannot render two wallpapers on top of each other.
    if ($theme_id eq 'theme-user-liquid-glass' && $image =~ m{^assets/images/liquid-glass/(wallpaper\.(?:png|jpe?g|webp|gif))\z}i) {
        return "assets/images/$theme_id/$1";
    }
    return $image if $image =~ m{^assets/images/\Q$theme_id\E/wallpaper\.(?:png|jpe?g|webp|gif)\z}i;

    # V146: Uploaded wallpapers arrive from the browser as data URLs. Store them
    # as real files below data/plugins/cssframework/themes/assets/images/<theme-id>/
    # and keep only the relative asset path in JSON/CSS.
    if ($image =~ m{^data:image/(png|jpe?g|webp|gif);base64,(.+)\z}is) {
        my ($type, $b64) = (lc($1), $2);
        $type = 'jpg' if $type eq 'jpeg';
        $type = 'jpg' if $type eq 'jpe';
        my $rel = "assets/images/$theme_id/wallpaper.$type";
        my $dir = "$theme_dir/assets/images/$theme_id";
        my $path = "$theme_dir/$rel";
        my $tmp = "$path.tmp.$$";

        $b64 =~ s/\s+//g;
        my $raw = eval { decode_base64($b64) };
        if ($@ || !defined $raw || length($raw) < 16) {
            _respond('400 Bad Request', _error_payload('invalidWallpaperImageData', 'invalidWallpaperImageData', {}));
        }

        # Guard against accidentally storing huge JSON uploads.
        if (length($raw) > 8 * 1024 * 1024) {
            _respond('400 Bad Request', _error_payload('wallpaperTooLarge', 'wallpaperTooLarge', {}));
        }

        eval { make_path($dir, { mode => 0775 }) if !-d $dir; 1 }
            or _respond('500 Internal Server Error', _error_payload('cannotCreateWallpaperAssetDirectory', 'cannotCreateWallpaperAssetDirectory', { path => $dir }));

        # Remove old wallpaper files with a different extension to avoid stale assets.
        for my $old_ext (qw(png jpg jpeg webp gif)) {
            my $old = "$theme_dir/assets/images/$theme_id/wallpaper.$old_ext";
            unlink $old if $old ne $path && -f $old;
        }

        # V263: Liquid Glass had a historical asset folder named just
        # "liquid-glass". Remove its wallpaper files when the canonical
        # theme-user-liquid-glass wallpaper is written to prevent a double
        # background from the built-in body::before layer plus the Studio layer.
        if ($theme_id eq 'theme-user-liquid-glass') {
            for my $old_ext (qw(png jpg jpeg webp gif)) {
                my $legacy = "$theme_dir/assets/images/liquid-glass/wallpaper.$old_ext";
                unlink $legacy if -f $legacy;
            }
        }

        open(my $fh, '>', $tmp)
            or _respond('500 Internal Server Error', _error_payload('cannotWriteWallpaperAsset', 'cannotWriteWallpaperAsset', { path => $path }));
        binmode $fh;
        print {$fh} $raw;
        close($fh);
        chmod 0664, $tmp;
        move($tmp, $path)
            or _respond('500 Internal Server Error', _error_payload('cannotFinalizeWallpaperAsset', 'cannotFinalizeWallpaperAsset', { path => $path }));
        chmod 0664, $path;

        return $rel;
    }

    # Keep any other existing image reference untouched, but normalize legacy prefix.
    return $image;
}

my $wallpaper_src = ref($data->{wallpaper}) eq 'HASH' ? $data->{wallpaper} : {};
my $wallpaper_image = defined $wallpaper_src->{image} ? "$wallpaper_src->{image}" : '';
$wallpaper_image = _write_wallpaper_asset($wallpaper_image, $id) if $wallpaper_image ne '';

my $wallpaper = {
    enabled    => ($wallpaper_src->{enabled} && $wallpaper_image ne '') ? JSON::PP::true : JSON::PP::false,
    image      => $wallpaper_image,
    brightness => _clamp_int($wallpaper_src->{brightness}, 0, 150, 100),
    opacity    => _clamp_int($wallpaper_src->{opacity}, 0, 100, 100),
};

sub _wallpaper_css_block {
    my ($theme_id, $wallpaper_ref) = @_;
    return '' if ref($wallpaper_ref) ne 'HASH' || !$wallpaper_ref->{enabled} || !$wallpaper_ref->{image};

    my $img = _css_string_escape(_theme_file_url_for_css($wallpaper_ref->{image}));
    my $opacity = sprintf('%.2f', $wallpaper_ref->{opacity} / 100);
    my $brightness = sprintf('%.2f', $wallpaper_ref->{brightness} / 100);

    my $block = "\n/* DESIGN STUDIO WALLPAPER START */\n";
    $block .= "body.$theme_id .lb-main, .$theme_id .lb-main {\n";
    $block .= "  position: relative !important;\n";
    $block .= "  overflow: hidden;\n";
    $block .= "  text-shadow: none;\n";
    $block .= "}\n";
    $block .= "body.$theme_id .lb-main::before, .$theme_id .lb-main::before {\n";
    $block .= "  content: \"\";\n";
    $block .= "  position: fixed;\n";
    $block .= "  inset: 0;\n";
    $block .= "  pointer-events: none;\n";
    $block .= "  background-image: url(\"$img\");\n";
    $block .= "  background-size: cover;\n";
    $block .= "  background-repeat: no-repeat;\n";
    $block .= "  background-position: center center;\n";
    $block .= "  opacity: $opacity;\n";
    $block .= "  filter: brightness($brightness);\n";
    $block .= "  z-index: 0;\n";
    $block .= "}\n";
    $block .= "body.$theme_id .lb-main > *, .$theme_id .lb-main > * { position: relative; z-index: 1; }\n";
    $block .= "/* DESIGN STUDIO WALLPAPER END */\n";
    return $block;
}


sub _apply_protected_liquid_glass_wallpaper_css {
    my ($css_content, $theme_id, $wallpaper_ref) = @_;
    return $css_content if $theme_id ne 'theme-user-liquid-glass';
    return $css_content if ref($wallpaper_ref) ne 'HASH' || !$wallpaper_ref->{enabled} || !$wallpaper_ref->{image};

    my $img = _css_string_escape(_theme_file_url_for_css($wallpaper_ref->{image}));
    my $opacity = sprintf('%.2f', _clamp_int($wallpaper_ref->{opacity}, 0, 100, 100) / 100);
    my $brightness = sprintf('%.2f', _clamp_int($wallpaper_ref->{brightness}, 0, 150, 100) / 100);

    # Liquid Glass already owns the page wallpaper through body::before. Remove
    # every generic Studio layer and every older Liquid-Glass override block
    # before writing one deterministic current block.
    $css_content =~ s{\n?\/\*\s*DESIGN STUDIO WALLPAPER START\s*\*\/[\s\S]*?\/\*\s*DESIGN STUDIO WALLPAPER END\s*\*\/\n?}{\n}ig;
    $css_content =~ s{\n?\/\*\s*DESIGN STUDIO LIQUID GLASS WALLPAPER START\s*\*\/[\s\S]*?\/\*\s*DESIGN STUDIO LIQUID GLASS WALLPAPER END\s*\*\/\n?}{\n}ig;
    $css_content =~ s{\n?\/\*\s*DESIGN STUDIO LIQUID GLASS WALLPAPER SETTINGS START\s*\*\/[\s\S]*?\/\*\s*DESIGN STUDIO LIQUID GLASS WALLPAPER SETTINGS END\s*\*\/\n?}{\n}ig;

    # Replace the historical built-in Liquid Glass wallpaper URL, independent of
    # whether it points to assets/images/liquid-glass/ or the canonical
    # assets/images/theme-user-liquid-glass/ directory.
    my $replacement = "url(\"$img\") !important;";
    my $replaced = 0;

    $replaced += ($css_content =~ s{url\(["']?(?:/admin/plugins/cssframework/theme-file\.cgi\?file=)?assets(?:/|%2F)images(?:/|%2F)(?:liquid-glass|theme-user-liquid-glass)(?:/|%2F)wallpaper\.(?:png|jpe?g|webp|gif)["']?\)\s*!important;?}{$replacement}ig);
    $replaced += ($css_content =~ s{url\(["']?[^"')]*assets(?:/|%2F)images(?:/|%2F)(?:liquid-glass|theme-user-liquid-glass)(?:/|%2F)wallpaper\.(?:png|jpe?g|webp|gif)["']?\)\s*!important;?}{$replacement}ig) if !$replaced;

    if (!$replaced) {
        # Safe fallback for unexpected older CSS: add only the background image
        # to the existing Liquid-Glass-native pseudo element.
        $css_content .= "\n/* DESIGN STUDIO LIQUID GLASS WALLPAPER START */\n";
        $css_content .= ":is(body.theme-user-liquid-glass, body.theme-liquid-glass)::before {\n";
        $css_content .= "  background-image: url(\"$img\") !important;\n";
        $css_content .= "}\n";
        $css_content .= "/* DESIGN STUDIO LIQUID GLASS WALLPAPER END */\n";
    }

    # V309: The protected-theme path previously replaced only the image URL.
    # Persist and apply the same brightness/opacity values that the Studio
    # preview shows. A marked override at the end wins over package defaults and
    # is replaced atomically on every save, so no duplicate rules accumulate.
    $css_content .= "\n/* DESIGN STUDIO LIQUID GLASS WALLPAPER SETTINGS START */\n";
    $css_content .= ":is(body.theme-user-liquid-glass, body.theme-liquid-glass)::before {\n";
    $css_content .= "  opacity: $opacity !important;\n";
    $css_content .= "  filter: brightness($brightness) !important;\n";
    $css_content .= "}\n";
    $css_content .= "/* DESIGN STUDIO LIQUID GLASS WALLPAPER SETTINGS END */\n";

    return $css_content;
}

sub _save_protected_wallpaper_only {
    my ($theme_id, $theme_name, $version_value, $wallpaper_ref) = @_;

    if (ref($wallpaper_ref) ne 'HASH' || !$wallpaper_ref->{enabled} || !$wallpaper_ref->{image}) {
        _respond('403 Forbidden', _error_payload('protectedPackageTheme', 'protectedPackageTheme', { theme => 'Liquid Glass', id => $theme_id }));
    }

    my $css_file = "$theme_id.css";
    my $css_path = "$theme_dir/$css_file";
    my $css_content = '';

    if (-f $css_path) {
        my $fh;
        if (open($fh, '<:encoding(UTF-8)', $css_path)) {
            local $/;
            $css_content = <$fh>;
            close($fh);
            $css_content = '' if !defined $css_content;
        }
    }

    if ($css_content eq '') {
        $css_content = "/*\n * CSS-Studio protected package theme\n * Theme: $theme_name ($theme_id)\n */\n\nbody.$theme_id,\n.$theme_id { }\n";
    }

    # V263: Liquid Glass uses its own body::before wallpaper layer. Do not append
    # the generic Design Studio .lb-main::before wallpaper block, because that
    # creates two wallpapers on top of each other.
    if ($theme_id eq 'theme-user-liquid-glass') {
        $css_content = _apply_protected_liquid_glass_wallpaper_css($css_content, $theme_id, $wallpaper_ref);
    }
    else {
        my $wallpaper_css = _wallpaper_css_block($theme_id, $wallpaper_ref);
        if ($css_content =~ m{/\*\s*DESIGN STUDIO WALLPAPER START\s*\*/[\s\S]*?/\*\s*DESIGN STUDIO WALLPAPER END\s*\*/}i) {
            $css_content =~ s{/\*\s*DESIGN STUDIO WALLPAPER START\s*\*/[\s\S]*?/\*\s*DESIGN STUDIO WALLPAPER END\s*\*/}{$wallpaper_css}i;
        }
        else {
            $css_content .= "\n" . $wallpaper_css;
        }
    }

    # V302: Keep the protected package theme compatible with the same CSS-only
    # wallpaper detection contract as normal Studio-generated themes.
    $css_content = _sync_wallpaper_header_metadata($css_content, $wallpaper_ref);

    my $fh;
    if (!open($fh, '>:encoding(UTF-8)', $css_path)) {
        _respond('500 Internal Server Error', _error_payload('cannotWriteFile', 'cannotWriteFile', { path => $css_path }));
    }
    print {$fh} $css_content;
    if (!close($fh)) {
        _respond('500 Internal Server Error', _error_payload('cannotWriteFile', 'cannotWriteFile', { path => $css_path }));
    }
    chmod 0664, $css_path;

    my $editable_wallpaper = {
        id                       => $theme_id,
        name                     => $theme_name,
        version                  => $version_value,
        tokens                   => {},
        custom_css               => '',
        studio_model             => {},
        import_meta              => undef,
        wallpaper                => $wallpaper_ref,
        protected_wallpaper_only => JSON::PP::true,
        studio_version           => 'V309_LiquidGlassWallpaperPersistence',
        updated_at               => strftime('%Y-%m-%dT%H:%M:%S%z', localtime),
    };

    my $jfh;
    if (open($jfh, '>:encoding(UTF-8)', $json_path)) {
        print {$jfh} _pretty_json($editable_wallpaper);
        close($jfh);
        chmod 0664, $json_path;
    }

    _respond('200 OK', {
        ok        => JSON::PP::true,
        id        => $theme_id,
        name      => $theme_name,
        version   => $version_value,
        css       => $css_file,
        wallpaper => $wallpaper_ref,
        protected_wallpaper_only => JSON::PP::true,
    });
}

if ($protected_studio_theme_mode eq 'wallpaper-only') {
    _save_protected_wallpaper_only($id, $name, $version, $wallpaper);
}
# Avoid nested USER CUSTOM markers when importing/saving repeatedly.
$custom_css =~ s{/\*\s*USER CUSTOM CSS START\s*\*/}{}ig;
$custom_css =~ s{/\*\s*USER CUSTOM CSS END\s*\*/}{}ig;
$custom_css =~ s/(--lb-sidebar-bg\s*:\s*)(rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\)|#[0-9a-fA-F]{3,8})/$1 . _make_css_color_opaque($2)/ge;
$custom_css =~ s/^\s+|\s+$//g;

my %clean_tokens;
sub _blocked_token {
    my ($token) = @_;
    return 1 if $token =~ /^--lb-table-status-/;

    # V181: LoxBerry status/log/semantic colors are not part of user themes.
    # They are neither written to the editable JSON nor to generated CSS.
    # The Design Studio preview keeps a hard-coded example only.
    return 1 if $token =~ /^--lb-(?:success|ok|warning|warn|danger|error|critical|info|notice|alert)(?:-|$)/;

    # Tooltip colors are protected from AI/user free editing, but the Design
    # Rules Engine deliberately writes these two derived values.
    return 0 if $token eq '--lb-tooltip-bg' || $token eq '--lb-tooltip-text';
    return 1 if $token =~ /^--lb-tooltip-/;
    return 0;
}
for my $token (sort keys %{$tokens}) {
    my $value = $tokens->{$token};
    next if $token !~ /^--lb-[a-z0-9-]+$/;
    next if _blocked_token($token);
    next if !defined $value;
    $value = "$value";
    $value =~ s/^\s+|\s+$//g;
    next if $value eq '';
    next if $value =~ /[{};]/;
    $value = _force_opaque_theme_tokens($token, $value);
    $clean_tokens{$token} = $value;
}
_sync_primary_slider_value_tokens(\%clean_tokens) if keys(%clean_tokens);
_sync_tinted_surface_tokens(\%clean_tokens) if keys(%clean_tokens);

# V248: Backend safety net for Design Studio / AI-generated themes.
# Keep inner table separators off by default unless the Studio/AI explicitly
# sends another width. This is theme-generation logic, not a Core change.
if (!exists $clean_tokens{'--lb-table-cell-border-width'} || $clean_tokens{'--lb-table-cell-border-width'} eq '') {
    $clean_tokens{'--lb-table-cell-border-width'} = '0px';
}

# V248: Button-group hover is a simple color state. Its text follows the
# active text by default and must not introduce a separate hover border/shadow.
my $btn_group_active_text = _first_clean_token_value(\%clean_tokens,
    '--lb-btn-group-active-text',
    '--lb-active-text',
    '--lb-btn-primary-text'
);
if ($btn_group_active_text ne '') {
    $clean_tokens{'--lb-btn-group-hover-text'} = $btn_group_active_text;
} else {
    $clean_tokens{'--lb-btn-group-hover-text'} = 'var(--lb-btn-group-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))';
}

my $meaningful_custom_css = $custom_css;
$meaningful_custom_css =~ s{/\*[\s\S]*?\*/}{}g;
$meaningful_custom_css =~ s/^\s+|\s+$//g;
if (!keys(%clean_tokens) && $meaningful_custom_css eq '' && !$wallpaper->{enabled}) {
    _respond('400 Bad Request', _error_payload('emptyTheme', 'emptyTheme', {}));
}

my $css_file = "$id.css";
my $manifest = {
    id           => $id,
    name         => $name,
    type         => 'user-theme',
    version      => $version,
    loxberry_min => '4.0',
    plugin       => $plugin,
    css          => $css_file,
    assets       => {
        wallpaper => ($wallpaper->{image} || "assets/images/$id/wallpaper.jpg"),
        icons     => "assets/icons/$id/",
    },
    features     => {
        custom_css   => JSON::PP::true,
        wallpaper    => JSON::PP::true,
        token_editor => JSON::PP::true,
        workbench_ui => JSON::PP::true,
        css_import => JSON::PP::true,
        hybrid_import => JSON::PP::true,
    },
};

my $editable = {
    id         => $id,
    name       => $name,
    version    => $version,
    tokens     => \%clean_tokens,
    custom_css => $custom_css,
    studio_model => (ref($data->{studio_model}) eq 'HASH' ? $data->{studio_model} : {}),
    import_meta  => $import_meta,
    wallpaper    => $wallpaper,
    studio       => { generator => 'CSS-Studio' },
    studio_version => ($data->{studio_version} || 'V302_WallpaperHeaderCoreContract'),
};

my $css = "/*\n";
$css .= " * CSS-Studio\n";
$css .= " * Generated by LoxBerry CSS Framework Design Studio\n";
$css .= " * Plugin folder: cssframework\n";
$css .= " * Theme: $name ($id)\n";
$css .= " * Source-JSON: config/plugins/cssframework/themes/$id.json\n";
$css .= " * Runtime scope: body.$id / .$id\n";
if ($wallpaper->{enabled} && $wallpaper->{image}) {
    my $wallpaper_header_image = _css_header_value($wallpaper->{image});
    $css .= " * Wallpaper-URL: $wallpaper_header_image\n";
    $css .= " * Wallpaper-Brightness: $wallpaper->{brightness}\n";
    $css .= " * Wallpaper-Opacity: $wallpaper->{opacity}\n";
}
$css .= " */\n\n";
$css .= "body.$id,\n.$id {\n";
for my $token (sort keys %clean_tokens) {
    $css .= "  $token: $clean_tokens{$token};\n";
}

$css .= "}\n\n";
$css .= "/* USER CUSTOM CSS START */\n" . $custom_css . "\n/* USER CUSTOM CSS END */\n";


# Optional wallpaper generated by Design Studio V49. The background color token
# stays authoritative; the wallpaper is layered behind page content.
if ($wallpaper->{enabled}) {
    my $img = _css_string_escape(_theme_file_url_for_css($wallpaper->{image}));
    my $opacity = sprintf('%.2f', $wallpaper->{opacity} / 100);
    my $brightness = sprintf('%.2f', $wallpaper->{brightness} / 100);
    $css .= "\n/* DESIGN STUDIO WALLPAPER START */\n";
    $css .= "body.$id .lb-main, .$id .lb-main {\n";
    $css .= "  position: relative !important;\n";
    $css .= "  overflow: hidden;\n";
    $css .= "  text-shadow: none;\n";
    $css .= "}\n";
    $css .= "body.$id .lb-main::before, .$id .lb-main::before {\n";
    $css .= "  content: \"\";\n";
    $css .= "  position: fixed;\n";
    $css .= "  inset: 0;\n";
    $css .= "  pointer-events: none;\n";
    $css .= "  background-image: url(\"$img\");\n";
    $css .= "  background-size: cover;\n";
    $css .= "  background-repeat: no-repeat;\n";
    $css .= "  background-position: center center;\n";
    $css .= "  opacity: $opacity;\n";
    $css .= "  filter: brightness($brightness);\n";
    $css .= "  z-index: 0;\n";
    $css .= "}\n";
    $css .= "body.$id .lb-main > *, .$id .lb-main > * { position: relative; z-index: 1; }\n";
    $css .= "/* DESIGN STUDIO WALLPAPER END */\n";
}


# V250: Generated JQM compatibility helpers for user themes.
# Keep this scoped to the generated theme class so old v3/JQM plugin markup can
# consume the theme tokens without changing Core or plugin code. The more
# specific Design-Studio component rules below still win for lb-* components.
$css .= "\n/* DESIGN STUDIO JQM COMPAT START */\n";
$css .= "/* V250: Token based jQuery Mobile compatibility for generated user themes. */\n";
$css .= "body.$id .ui-page, body.$id .ui-content, body.$id .ui-body-a, body.$id .ui-body-b, body.$id .ui-body-c, body.$id .ui-body-d, body.$id .ui-body-e, body.$id .ui-overlay-a,\n";
$css .= ".$id .ui-page, .$id .ui-content, .$id .ui-body-a, .$id .ui-body-b, .$id .ui-body-c, .$id .ui-body-d, .$id .ui-body-e, .$id .ui-overlay-a {\n";
$css .= "  background: var(--lb-bg, transparent) !important;\n";
$css .= "  color: var(--lb-text, inherit) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-btn, body.$id .ui-btn:visited, body.$id .ui-btn:link, body.$id a.ui-btn, body.$id button.ui-btn,\n";
$css .= ".$id .ui-btn, .$id .ui-btn:visited, .$id .ui-btn:link, .$id a.ui-btn, .$id button.ui-btn {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-btn-bg, var(--lb-card-bg, #fff)) !important;\n";
$css .= "  color: var(--lb-btn-text, var(--lb-text, inherit)) !important;\n";
$css .= "  border-color: var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-btn-radius, var(--lb-radius, 4px)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-btn:hover, body.$id a.ui-btn:hover, body.$id button.ui-btn:hover,\n";
$css .= ".$id .ui-btn:hover, .$id a.ui-btn:hover, .$id button.ui-btn:hover {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-btn-hover-bg, var(--lb-btn-bg, var(--lb-card-bg, #fff))) !important;\n";
$css .= "  color: var(--lb-btn-hover-text, var(--lb-btn-text, var(--lb-text, inherit))) !important;\n";
$css .= "  border-color: var(--lb-btn-hover-border, var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-btn.ui-btn-active, body.$id .ui-btn.ui-state-persist, body.$id .ui-btn-active,\n";
$css .= ".$id .ui-btn.ui-btn-active, .$id .ui-btn.ui-state-persist, .$id .ui-btn-active {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "  color: var(--lb-active-text, var(--lb-btn-primary-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-active-border, var(--lb-btn-primary-border, var(--lb-primary, #007aff))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
# V310: Keep the generated JQM/native control geometry aligned with the
# Design Studio preview. Inputs, textareas and selects have separate radius
# tokens; the old combined rule incorrectly fell back to --lb-radius and made
# square controls rounded again in legacy plugins.
$css .= "/* V310: Granular input, textarea and select token compatibility. */\n";
$css .= "body.$id .ui-input-text, body.$id .ui-input-search, body.$id .ui-textinput,\n";
$css .= ".$id .ui-input-text, .$id .ui-input-search, .$id .ui-textinput {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-input-bg, var(--lb-card-bg, #fff)) !important;\n";
$css .= "  color: var(--lb-input-text, var(--lb-text, inherit)) !important;\n";
$css .= "  border-color: var(--lb-input-border, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id textarea.ui-input-text, body.$id textarea.ui-textinput, body.$id textarea.ui-input-search,\n";
$css .= ".$id textarea.ui-input-text, .$id textarea.ui-textinput, .$id textarea.ui-input-search {\n";
$css .= "  background-color: var(--lb-textarea-bg, var(--lb-input-bg, var(--lb-card-bg, #fff))) !important;\n";
$css .= "  color: var(--lb-textarea-text, var(--lb-input-text, var(--lb-text, inherit))) !important;\n";
$css .= "  border-color: var(--lb-textarea-border, var(--lb-input-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-radius: var(--lb-textarea-radius, var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-select .ui-btn, .$id .ui-select .ui-btn {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-select-bg, var(--lb-input-bg, var(--lb-card-bg, #fff))) !important;\n";
$css .= "  color: var(--lb-select-text, var(--lb-input-text, var(--lb-text, inherit))) !important;\n";
$css .= "  border-color: var(--lb-select-border, var(--lb-input-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-select-radius, var(--lb-radius-select, var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px)))))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id input:not([type]), body.$id input[type=\"text\"], body.$id input[type=\"password\"], body.$id input[type=\"email\"], body.$id input[type=\"number\"], body.$id input[type=\"search\"], body.$id input[type=\"tel\"], body.$id input[type=\"url\"], body.$id input[type=\"date\"], body.$id input[type=\"time\"], body.$id input[type=\"datetime-local\"], body.$id input[type=\"month\"], body.$id input[type=\"week\"],\n";
$css .= ".$id input:not([type]), .$id input[type=\"text\"], .$id input[type=\"password\"], .$id input[type=\"email\"], .$id input[type=\"number\"], .$id input[type=\"search\"], .$id input[type=\"tel\"], .$id input[type=\"url\"], .$id input[type=\"date\"], .$id input[type=\"time\"], .$id input[type=\"datetime-local\"], .$id input[type=\"month\"], .$id input[type=\"week\"] {\n";
$css .= "  border-radius: var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px)))) !important;\n";
$css .= "}\n";
$css .= "body.$id textarea, .$id textarea {\n";
$css .= "  border-radius: var(--lb-textarea-radius, var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px))))) !important;\n";
$css .= "}\n";
$css .= "body.$id select, .$id select {\n";
$css .= "  border-radius: var(--lb-select-radius, var(--lb-radius-select, var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, var(--lb-radius, 4px)))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-input-text input, body.$id .ui-input-search input, body.$id .ui-textinput input,\n";
$css .= ".$id .ui-input-text input, .$id .ui-input-search input, .$id .ui-textinput input {\n";
$css .= "  color: var(--lb-input-text, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id textarea, .$id textarea {\n";
$css .= "  color: var(--lb-textarea-text, var(--lb-input-text, var(--lb-text, inherit))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id select, .$id select {\n";
$css .= "  color: var(--lb-select-text, var(--lb-input-text, var(--lb-text, inherit))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-input-text:focus-within, body.$id .ui-input-search:focus-within,\n";
$css .= ".$id .ui-input-text:focus-within, .$id .ui-input-search:focus-within {\n";
$css .= "  border-color: var(--lb-focus-border, var(--lb-input-focus-border, var(--lb-primary, #007aff))) !important;\n";
$css .= "  box-shadow: 0 0 0 3px var(--lb-focus-ring, rgba(0,122,255,.18)) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-select .ui-btn:focus, .$id .ui-select .ui-btn:focus {\n";
$css .= "  border-color: var(--lb-select-focus-border, var(--lb-focus-border, var(--lb-input-focus-border, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  box-shadow: 0 0 0 3px var(--lb-focus-ring, rgba(0,122,255,.18)) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-checkbox .ui-btn, body.$id .ui-radio .ui-btn, .$id .ui-checkbox .ui-btn, .$id .ui-radio .ui-btn {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-input-bg, var(--lb-btn-bg, var(--lb-card-bg, #fff))) !important;\n";
$css .= "  color: var(--lb-input-text, var(--lb-btn-text, var(--lb-text, inherit))) !important;\n";
$css .= "  border-color: var(--lb-input-border, var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-checkbox .ui-btn.ui-checkbox-on, body.$id .ui-radio .ui-btn.ui-radio-on,\n";
$css .= ".$id .ui-checkbox .ui-btn.ui-checkbox-on, .$id .ui-radio .ui-btn.ui-radio-on {\n";
$css .= "  background-color: var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "  color: var(--lb-active-text, var(--lb-btn-primary-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-active-border, var(--lb-btn-primary-border, var(--lb-primary, #007aff))) !important;\n";
$css .= "}\n";
$css .= "/* V252: JQM checkbox/radio icon compatibility. Keep icons in the active theme color and remove old jQM icon shadows. */\n";
$css .= "body.$id .ui-checkbox .ui-btn::after, body.$id .ui-radio .ui-btn::after,\n";
$css .= ".$id .ui-checkbox .ui-btn::after, .$id .ui-radio .ui-btn::after {\n";
$css .= "  background-color: var(--lb-checkbox-bg, var(--lb-radio-bg, var(--lb-input-bg, #fff))) !important;\n";
$css .= "  border: 2px solid var(--lb-checkbox-border, var(--lb-radio-border, var(--lb-input-border, var(--lb-border-color, rgba(0,0,0,.25))))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-checkbox .ui-btn::after, .$id .ui-checkbox .ui-btn::after {\n";
$css .= "  border-radius: var(--lb-checkbox-radius, 3px) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-radio .ui-btn::after, .$id .ui-radio .ui-btn::after {\n";
$css .= "  border-radius: 999px !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-checkbox .ui-btn.ui-checkbox-on::after, body.$id .ui-radio .ui-btn.ui-radio-on::after,\n";
$css .= ".$id .ui-checkbox .ui-btn.ui-checkbox-on::after, .$id .ui-radio .ui-btn.ui-radio-on::after {\n";
$css .= "  background-color: var(--lb-checkbox-checked-bg, var(--lb-radio-checked-bg, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "  border-color: var(--lb-checkbox-checked-border, var(--lb-radio-checked-border, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-checkbox .ui-btn.ui-checkbox-on::after, .$id .ui-checkbox .ui-btn.ui-checkbox-on::after {\n";
$css .= "  background-image: var(--lb-checkbox-check-icon, url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%23000000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='M2 6.5L4.5 9.5L10 3'/%3E%3C/svg%3E\")) !important;\n";
$css .= "  background-repeat: no-repeat !important;\n";
$css .= "  background-position: center !important;\n";
$css .= "  background-size: 12px 12px !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-radio .ui-btn.ui-radio-on::after, .$id .ui-radio .ui-btn.ui-radio-on::after {\n";
$css .= "  background-image: none !important;\n";
$css .= "  box-shadow: inset 0 0 0 4px var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-controlgroup-controls .ui-btn, .$id .ui-controlgroup-controls .ui-btn {\n";
$css .= "  border-radius: 0 !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-controlgroup-controls .ui-btn:first-child, .$id .ui-controlgroup-controls .ui-btn:first-child {\n";
$css .= "  border-top-left-radius: var(--lb-btn-radius, var(--lb-radius, 4px)) !important;\n";
$css .= "  border-bottom-left-radius: var(--lb-btn-radius, var(--lb-radius, 4px)) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-controlgroup-controls .ui-btn:last-child, .$id .ui-controlgroup-controls .ui-btn:last-child {\n";
$css .= "  border-top-right-radius: var(--lb-btn-radius, var(--lb-radius, 4px)) !important;\n";
$css .= "  border-bottom-right-radius: var(--lb-btn-radius, var(--lb-radius, 4px)) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-track, .$id .ui-slider-track {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-slider-track-bg, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "  border-color: var(--lb-slider-border, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-bg, .$id .ui-slider-bg {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-handle, body.$id .ui-slider-track .ui-btn.ui-slider-handle,\n";
$css .= ".$id .ui-slider-handle, .$id .ui-slider-track .ui-btn.ui-slider-handle {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-slider-thumb-bg, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff))))) !important;\n";
$css .= "  border-color: var(--lb-slider-thumb-border-color, var(--lb-slider-thumb-border, #fff)) !important;\n";
$css .= "  box-shadow: var(--lb-slider-thumb-shadow, 0 1px 5px rgba(0,0,0,.25)) !important;\n";
$css .= "}\n";
$css .= "/* V251/V252: JQM switch/flipswitch compatibility. Keep old data-role=slider toggles token based. */\n";
$css .= "body.$id .ui-slider-switch.ui-slider-track, body.$id .ui-slider-switch,\n";
$css .= ".$id .ui-slider-switch.ui-slider-track, .$id .ui-slider-switch {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-switch-off-bg, var(--lb-toggle-bg, var(--lb-btn-bg, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-color: var(--lb-switch-border, var(--lb-toggle-border, var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18))))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-btn-radius, var(--lb-radius, 999px)))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label, .$id .ui-slider-switch .ui-slider-label {\n";
$css .= "  background-image: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  font-family: var(--lb-font) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-a, .$id .ui-slider-switch .ui-slider-label-a {\n";
$css .= "  background-color: var(--lb-switch-on-bg, var(--lb-toggle-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  color: var(--lb-switch-on-text, var(--lb-toggle-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-b, .$id .ui-slider-switch .ui-slider-label-b {\n";
$css .= "  background-color: var(--lb-switch-off-bg, var(--lb-toggle-bg, var(--lb-btn-bg, rgba(0,0,0,.18)))) !important;\n";
$css .= "  color: var(--lb-switch-off-text, var(--lb-toggle-text, var(--lb-btn-text, var(--lb-text, inherit)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-handle, body.$id .ui-slider-switch .ui-btn.ui-slider-handle,\n";
$css .= ".$id .ui-slider-switch .ui-slider-handle, .$id .ui-slider-switch .ui-btn.ui-slider-handle {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-switch-thumb-bg, var(--lb-toggle-thumb-bg, var(--lb-toggle-knob-bg, var(--lb-slider-thumb-bg, #fff)))) !important;\n";
$css .= "  border-color: var(--lb-switch-thumb-border, var(--lb-toggle-thumb-border, var(--lb-slider-thumb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-radius: var(--lb-toggle-thumb-radius, var(--lb-toggle-knob-radius, 999px)) !important;\n";
$css .= "  box-shadow: var(--lb-switch-thumb-shadow, var(--lb-toggle-thumb-shadow, 0 1px 4px rgba(0,0,0,.22))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-flipswitch, .$id .ui-flipswitch {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-switch-off-bg, var(--lb-toggle-bg, var(--lb-btn-bg, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-color: var(--lb-switch-border, var(--lb-toggle-border, var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18))))) !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-btn-radius, var(--lb-radius, 999px)))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-flipswitch.ui-flipswitch-active, .$id .ui-flipswitch.ui-flipswitch-active {\n";
$css .= "  background-color: var(--lb-switch-on-bg, var(--lb-toggle-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  color: var(--lb-switch-on-text, var(--lb-toggle-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-flipswitch .ui-flipswitch-on, .$id .ui-flipswitch .ui-flipswitch-on {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-switch-thumb-bg, var(--lb-toggle-thumb-bg, var(--lb-toggle-knob-bg, #fff))) !important;\n";
$css .= "  border-color: var(--lb-switch-thumb-border, var(--lb-toggle-thumb-border, rgba(0,0,0,.18))) !important;\n";
$css .= "  border-radius: var(--lb-toggle-thumb-radius, var(--lb-toggle-knob-radius, 999px)) !important;\n";
$css .= "  box-shadow: var(--lb-switch-thumb-shadow, var(--lb-toggle-thumb-shadow, 0 1px 4px rgba(0,0,0,.22))) !important;\n";
$css .= "}\n";
$css .= "/* DESIGN STUDIO JQM COMPAT END */\n";

# Design Studio generated compatibility helpers. These are scoped to the user
# theme and keep protected/compound components consistent without touching Core.
$css .= "\n/* DESIGN STUDIO RULES START */\n";
$css .= "/* V188: Table border width/color apply to the complete outer frame. Cell separators remain thin and do not cover the outer frame. */\n";
$css .= "body.$id table.lb-table, body.$id .lb-table,\n";
$css .= ".$id table.lb-table, .$id .lb-table {\n";
$css .= "  background-color: var(--lb-table-bg, var(--lb-table-row-bg, transparent));\n";
$css .= "  color: var(--lb-table-text, var(--lb-table-row-text, inherit));\n";
$css .= "  border-color: var(--lb-table-border-color, var(--lb-table-border, var(--lb-border-color, rgba(0,0,0,.16)))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: var(--lb-table-outer-border-width, var(--lb-table-border-width, 1px)) !important;\n";
$css .= "  border-radius: var(--lb-table-radius, var(--lb-radius-table, 0px)) !important;\n";
$css .= "  border-collapse: separate !important;\n";
$css .= "  border-spacing: 0 !important;\n";
$css .= "  overflow: hidden;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table thead, body.$id table.lb-table th, body.$id .lb-table thead, body.$id .lb-table th,\n";
$css .= ".$id table.lb-table thead, .$id table.lb-table th, .$id .lb-table thead, .$id .lb-table th {\n";
$css .= "  background-color: var(--lb-table-header-bg, var(--lb-table-bg, transparent));\n";
$css .= "  color: var(--lb-table-header-text, var(--lb-table-text, inherit));\n";
$css .= "  border-color: var(--lb-table-header-border-color, var(--lb-table-header-border, var(--lb-table-border-color, var(--lb-table-border, rgba(0,0,0,.16)))));\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 0 var(--lb-table-cell-border-width, 1px) var(--lb-table-cell-border-width, 1px) 0 !important;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table td, body.$id .lb-table td,\n";
$css .= ".$id table.lb-table td, .$id .lb-table td {\n";
$css .= "  background-color: var(--lb-table-row-bg, var(--lb-table-bg, transparent));\n";
$css .= "  color: var(--lb-table-row-text, var(--lb-table-text, inherit));\n";
$css .= "  border-color: var(--lb-table-row-border-color, var(--lb-table-row-border, var(--lb-table-border-color, var(--lb-table-border, rgba(0,0,0,.16)))));\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 0 var(--lb-table-cell-border-width, 1px) var(--lb-table-cell-border-width, 1px) 0 !important;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table tr > th:last-child, body.$id table.lb-table tr > td:last-child, body.$id .lb-table tr > th:last-child, body.$id .lb-table tr > td:last-child,\n";
$css .= ".$id table.lb-table tr > th:last-child, .$id table.lb-table tr > td:last-child, .$id .lb-table tr > th:last-child, .$id .lb-table tr > td:last-child {\n";
$css .= "  border-right-width: 0 !important;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table tbody tr:last-child > td, body.$id table.lb-table tfoot tr:last-child > td, body.$id .lb-table tbody tr:last-child > td, body.$id .lb-table tfoot tr:last-child > td,\n";
$css .= ".$id table.lb-table tbody tr:last-child > td, .$id table.lb-table tfoot tr:last-child > td, .$id .lb-table tbody tr:last-child > td, .$id .lb-table tfoot tr:last-child > td {\n";
$css .= "  border-bottom-width: 0 !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group, .$id .lb-btn-group {\n";
$css .= "  border: 1px solid var(--lb-input-border, var(--lb-btn-group-border, var(--lb-btn-group-inactive-border, var(--lb-border-color, var(--lb-border, #d7e7d9))))) !important;\n";
$css .= "  border-radius: var(--lb-btn-group-radius, var(--lb-btn-radius, var(--lb-radius-button, var(--lb-radius-sm, 10px)))) !important;\n";
$css .= "  overflow: hidden !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "  display: inline-flex !important;\n";
$css .= "  align-items: stretch !important;\n";
$css .= "  background-clip: padding-box !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.is-active),\n";
$css .= "body.$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.is-active),\n";
$css .= ".$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.is-active),\n";
$css .= ".$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.is-active) {\n";
$css .= "  background-color: var(--lb-btn-group-inactive-bg, var(--lb-btn-group-active-text, #fff)) !important;\n";
$css .= "  color: var(--lb-btn-group-inactive-text, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.is-active):hover,\n";
$css .= "body.$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.is-active):hover,\n";
$css .= ".$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.is-active):hover,\n";
$css .= ".$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.is-active):hover {\n";
$css .= "  background-color: var(--lb-btn-group-hover-bg, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  color: var(--lb-btn-group-hover-text, var(--lb-btn-group-active-text, var(--lb-active-text, #fff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  filter: none !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group button.ui-btn-active,\n";
$css .= "body.$id .lb-btn-group button.lb-active,\n";
$css .= "body.$id .lb-btn-group button.is-active,\n";
$css .= "body.$id .lb-btn-group .ui-btn.ui-btn-active,\n";
$css .= "body.$id .lb-btn-group .ui-btn.lb-active,\n";
$css .= "body.$id .lb-btn-group .ui-btn.is-active,\n";
$css .= ".$id .lb-btn-group button.ui-btn-active,\n";
$css .= ".$id .lb-btn-group button.lb-active,\n";
$css .= ".$id .lb-btn-group button.is-active,\n";
$css .= ".$id .lb-btn-group .ui-btn.ui-btn-active,\n";
$css .= ".$id .lb-btn-group .ui-btn.lb-active,\n";
$css .= ".$id .lb-btn-group .ui-btn.is-active {\n";
$css .= "  background-color: var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff)) !important;\n";
$css .= "  color: var(--lb-btn-group-active-text, var(--lb-active-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:checked + label, .$id .lb-btn-group input:checked + label {\n";
$css .= "  background-color: var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff)) !important;\n";
$css .= "  color: var(--lb-btn-group-active-text, var(--lb-active-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:not(:checked) + label, .$id .lb-btn-group input:not(:checked) + label {\n";
$css .= "  background-color: var(--lb-btn-group-inactive-bg, var(--lb-btn-group-active-text, #fff)) !important;\n";
$css .= "  color: var(--lb-btn-group-inactive-text, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group > a, body.$id .lb-btn-group > label, body.$id .lb-btn-group > button, body.$id .lb-btn-group > .ui-btn,\n";
$css .= ".$id .lb-btn-group > a, .$id .lb-btn-group > label, .$id .lb-btn-group > button, .$id .lb-btn-group > .ui-btn {\n";
$css .= "  border: 0 !important;\n";
$css .= "  border-right: 1px solid var(--lb-input-border, var(--lb-btn-group-border, var(--lb-btn-group-inactive-border, var(--lb-border-color, var(--lb-border, #d7e7d9))))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group > a:last-child, body.$id .lb-btn-group > label:last-child, body.$id .lb-btn-group > button:last-child, body.$id .lb-btn-group > .ui-btn:last-child,\n";
$css .= ".$id .lb-btn-group > a:last-child, .$id .lb-btn-group > label:last-child, .$id .lb-btn-group > button:last-child, .$id .lb-btn-group > .ui-btn:last-child {\n";
$css .= "  border-right: 0 !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group > a.ui-btn-active, body.$id .lb-btn-group > a.lb-active, body.$id .lb-btn-group > a.is-active,\n";
$css .= "body.$id .lb-btn-group > label.ui-btn-active, body.$id .lb-btn-group > label.lb-active, body.$id .lb-btn-group > label.is-active,\n";
$css .= "body.$id .lb-btn-group > button.ui-btn-active, body.$id .lb-btn-group > button.lb-active, body.$id .lb-btn-group > button.is-active,\n";
$css .= ".$id .lb-btn-group > a.ui-btn-active, .$id .lb-btn-group > a.lb-active, .$id .lb-btn-group > a.is-active,\n";
$css .= ".$id .lb-btn-group > label.ui-btn-active, .$id .lb-btn-group > label.lb-active, .$id .lb-btn-group > label.is-active,\n";
$css .= ".$id .lb-btn-group > button.ui-btn-active, .$id .lb-btn-group > button.lb-active, .$id .lb-btn-group > button.is-active {\n";
$css .= "  background-color: var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff)) !important;\n";
$css .= "  color: var(--lb-btn-group-active-text, var(--lb-active-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:not(:checked) + label:hover, .$id .lb-btn-group input:not(:checked) + label:hover {\n";
$css .= "  background-color: var(--lb-btn-group-hover-bg, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  color: var(--lb-btn-group-hover-text, var(--lb-btn-group-active-text, var(--lb-active-text, #fff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-btn-group-border, var(--lb-border-color, var(--lb-border, #d7e7d9)))) !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  filter: none !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle, .$id .lb-toggle {\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-toggle-slider-radius, 999px))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle .lb-toggle-slider, body.$id .lb-toggle input:not(:checked) + .lb-toggle-slider, .$id .lb-toggle .lb-toggle-slider, .$id .lb-toggle input:not(:checked) + .lb-toggle-slider {\n";
$css .= "  background-color: var(--lb-switch-off-bg, var(--lb-toggle-bg, rgba(0,0,0,.22))) !important;\n";
$css .= "  border-color: var(--lb-switch-border, var(--lb-toggle-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-toggle-slider-radius, 999px))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle input:checked + .lb-toggle-slider, .$id .lb-toggle input:checked + .lb-toggle-slider {\n";
$css .= "  background-color: var(--lb-switch-on-bg, var(--lb-toggle-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  border-color: var(--lb-switch-border, var(--lb-toggle-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-toggle-slider-radius, 999px))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle .lb-toggle-slider:before, body.$id .lb-toggle .lb-toggle-slider:after, .$id .lb-toggle .lb-toggle-slider:before, .$id .lb-toggle .lb-toggle-slider:after {\n";
$css .= "  background-color: var(--lb-switch-thumb-bg, var(--lb-toggle-thumb-bg, var(--lb-toggle-knob-bg, #fff))) !important;\n";
$css .= "  border-radius: var(--lb-toggle-thumb-radius, var(--lb-toggle-knob-radius, var(--lb-switch-radius, 999px))) !important;\n";
$css .= "}\n";
$css .= "body.$id input[type=checkbox], .$id input[type=checkbox] {\n";
$css .= "  accent-color: var(--lb-checkbox-checked-bg, var(--lb-primary, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "}\n";
$css .= "body.$id input[type=radio], .$id input[type=radio] {\n";
$css .= "  accent-color: var(--lb-radio-checked-bg, var(--lb-primary, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider, .$id .lb-slider {\n";
$css .= "  /* V225: prefer explicit slider tokens; older themes fall back to their own active/button/primary color. */\n";
$css .= "  accent-color: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff)))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-webkit-slider-runnable-track, .$id .lb-slider::-webkit-slider-runnable-track {\n";
$css .= "  height: var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) !important;\n";
$css .= "  min-height: 0 !important;\n";
$css .= "  border-radius: var(--lb-slider-track-radius, 999px) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "  background: linear-gradient(to right, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff)))))) 0%, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff)))))) var(--lb-slider-fill, 50%), var(--lb-slider-track-bg, var(--lb-slider-bg, rgba(0,0,0,.22))) var(--lb-slider-fill, 50%), var(--lb-slider-track-bg, var(--lb-slider-bg, rgba(0,0,0,.22))) 100%) !important;\n";
$css .= "  border-color: var(--lb-slider-border, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-moz-range-track, .$id .lb-slider::-moz-range-track {\n";
$css .= "  height: var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) !important;\n";
$css .= "  min-height: 0 !important;\n";
$css .= "  border-radius: var(--lb-slider-track-radius, 999px) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "  background-color: var(--lb-slider-track-bg, var(--lb-slider-bg, rgba(0,0,0,.22))) !important;\n";
$css .= "  border-color: var(--lb-slider-border, var(--lb-border-color, rgba(0,0,0,.18))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-moz-range-progress, .$id .lb-slider::-moz-range-progress {\n";
$css .= "  height: var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) !important;\n";
$css .= "  min-height: 0 !important;\n";
$css .= "  border-radius: var(--lb-slider-track-radius, 999px) !important;\n";
$css .= "  background-color: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff)))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-webkit-slider-thumb, .$id .lb-slider::-webkit-slider-thumb {\n";
$css .= "  margin-top: var(--lb-slider-thumb-offset, calc((var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) - var(--lb-slider-thumb-size, 20px)) / 2)) !important;\n";
$css .= "  width: var(--lb-slider-thumb-size, 20px) !important;\n";
$css .= "  height: var(--lb-slider-thumb-size, 20px) !important;\n";
$css .= "  background-color: var(--lb-slider-thumb-bg, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff))))))) !important;\n";
$css .= "  border-width: var(--lb-slider-thumb-border-width, 3px) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-color: var(--lb-slider-thumb-border-color, var(--lb-slider-thumb-border, #ffffff)) !important;\n";
$css .= "  box-shadow: var(--lb-slider-thumb-shadow, 0 1px 5px rgba(0,0,0,.25)) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-moz-range-thumb, .$id .lb-slider::-moz-range-thumb {\n";
$css .= "  width: var(--lb-slider-thumb-size, 20px) !important;\n";
$css .= "  height: var(--lb-slider-thumb-size, 20px) !important;\n";
$css .= "  background-color: var(--lb-slider-thumb-bg, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-active-bg, var(--lb-btn-primary-bg, var(--lb-primary, #007aff))))))) !important;\n";
$css .= "  border-width: var(--lb-slider-thumb-border-width, 3px) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-color: var(--lb-slider-thumb-border-color, var(--lb-slider-thumb-border, #ffffff)) !important;\n";
$css .= "  box-shadow: var(--lb-slider-thumb-shadow, 0 1px 5px rgba(0,0,0,.25)) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-webkit-slider-thumb:hover, .$id .lb-slider::-webkit-slider-thumb:hover, body.$id .lb-slider::-moz-range-thumb:hover, .$id .lb-slider::-moz-range-thumb:hover {\n";
$css .= "  box-shadow: var(--lb-slider-thumb-hover-shadow, 0 0 0 7px var(--lb-focus-ring-strong, rgba(37,99,235,.18)), var(--lb-slider-thumb-shadow, 0 1px 5px rgba(0,0,0,.25))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-tooltip, body.$id [role=tooltip], .$id .lb-tooltip, .$id [role=tooltip] {\n";
$css .= "  background-color: var(--lb-tooltip-bg, var(--lb-primary-hover, #2e8b57)) !important;\n";
$css .= "  color: var(--lb-tooltip-text, var(--lb-sidebar-text, #fff)) !important;\n";
$css .= "}\n";
# V308: Reliable dropdown indicators.
# Do not redraw native selects with background gradients. Core and legacy
# rules may replace background-image. Restore the platform menulist for raw
# single-choice selects. jQuery Mobile renders its own button, so give that
# visible wrapper one deterministic caret.
$css .= "/* V308: Reliable native and jQuery Mobile dropdown indicators. */\n";
$css .= "body.$id select:not([multiple]):not([size]), body.$id select:not([multiple])[size=\"0\"], body.$id select:not([multiple])[size=\"1\"],\n";
$css .= ".$id select:not([multiple]):not([size]), .$id select:not([multiple])[size=\"0\"], .$id select:not([multiple])[size=\"1\"] {\n";
$css .= "  -webkit-appearance: menulist !important;\n";
$css .= "  -moz-appearance: menulist !important;\n";
$css .= "  appearance: auto !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-select .ui-btn, .$id .ui-select .ui-btn {\n";
$css .= "  position: relative !important;\n";
$css .= "  padding-right: 36px !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-select .ui-btn::after, .$id .ui-select .ui-btn::after {\n";
$css .= "  content: \"\" !important;\n";
$css .= "  position: absolute !important;\n";
$css .= "  top: 50% !important;\n";
$css .= "  right: 14px !important;\n";
$css .= "  left: auto !important;\n";
$css .= "  width: 0 !important;\n";
$css .= "  height: 0 !important;\n";
$css .= "  margin: -2px 0 0 0 !important;\n";
$css .= "  border-left: 5px solid transparent !important;\n";
$css .= "  border-right: 5px solid transparent !important;\n";
$css .= "  border-top: 6px solid currentColor !important;\n";
$css .= "  border-bottom: 0 !important;\n";
$css .= "  border-radius: 0 !important;\n";
$css .= "  background: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  opacity: .82 !important;\n";
$css .= "  pointer-events: none !important;\n";
$css .= "}\n";
$css .= "/* DESIGN STUDIO RULES END */\n";

sub _read_file_head {
    my ($file, $limit) = @_;
    $limit ||= 8192;
    return '' if !defined $file || !-f $file || !-r $file;
    my $fh;
    return '' if !open($fh, '<:encoding(UTF-8)', $file);
    local $/;
    my $content = <$fh>;
    close($fh);
    $content = '' if !defined $content;
    return substr($content, 0, $limit);
}

sub _cleanup_orphan_studio_css {
    # V79: data/plugins/cssframework/themes is the CSS/assets storage.
    # Do not delete CSS-only package/example themes just because no editable JSON
    # exists yet. Explicit deletion is handled by theme-delete.cgi.
    return [];
}

my @writes = (
    [$json_path, _pretty_json($editable)],
    ["$manifest_dir/$id.manifest.json", _pretty_json($manifest)],
    ["$theme_dir/$css_file", $css],
);

for my $item (@writes) {
    my ($file, $content) = @{$item};
    my $fh;
    if (!open($fh, '>:encoding(UTF-8)', $file)) {
        _respond('500 Internal Server Error', _error_payload('cannotWriteFile', 'cannotWriteFile', { path => $file }));
    }
    print {$fh} $content;
    if (!close($fh)) {
        _respond('500 Internal Server Error', _error_payload('cannotCloseWriteFile', 'cannotCloseWriteFile', { path => $file }));
    }
    chmod 0664, $file;
}

my $orphan_css_deleted = _cleanup_orphan_studio_css();

if (!-f "$theme_dir/$css_file" || -s "$theme_dir/$css_file" <= 0) {
    _respond('500 Internal Server Error', _error_payload('cssNotCreatedOrEmpty', 'cssNotCreatedOrEmpty', { path => "$theme_dir/$css_file" }));
}


_respond('200 OK', {
    ok         => JSON::PP::true,
    id         => $id,
    name       => $name,
    version    => $version,
    theme_json => "config/plugins/cssframework/themes/$id.json",
    manifest   => "config/plugins/cssframework/manifests/$id.manifest.json",
    css        => "data/plugins/cssframework/themes/$css_file",
    public_css => "theme-file.cgi?file=$css_file",
    css_written => JSON::PP::true,
    previous_backup => $previous_backup,
    orphan_css_deleted => scalar(@{$orphan_css_deleted || []}),
});
