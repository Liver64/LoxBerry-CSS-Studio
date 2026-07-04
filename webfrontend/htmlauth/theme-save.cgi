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

for my $dir ($theme_json_dir, $theme_dir, $manifest_dir) {
    if (!-d $dir) {
        eval { make_path($dir, { mode => 0775 }); 1 }
            or _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot create directory: $dir" });
    }
}

my $raw = do { local $/; <STDIN> };
my $data = eval { decode_json($raw || '{}') };
_respond('400 Bad Request', { ok => JSON::PP::false, error => 'Invalid JSON payload' }) if $@ || ref($data) ne 'HASH';

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
        _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot backup previous JSON: $json_path" });
    }
    chmod 0664, $bak;
    $previous_backup = $bak;
}

my $tokens = ref($data->{tokens}) eq 'HASH' ? $data->{tokens} : {};

sub _normalize_custom_css_value {
    my ($value) = @_;
    return '' if !defined $value;
    if (ref($value) eq '') {
        $value = "$value";
        return '' if $value eq '[object Object]';
        return $value;
    }
    if (ref($value) eq 'ARRAY') {
        return join("\n", grep { defined $_ && $_ ne '' } map { _normalize_custom_css_value($_) } @{$value});
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

sub _wallpaper_mode {
    my ($mode) = @_;
    $mode = defined $mode ? lc("$mode") : 'cover';
    return $mode if $mode =~ /^(cover|contain|repeat|center)$/;
    return 'cover';
}

sub _css_string_escape {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/\\/\\\\/g;
    $value =~ s/"/\\"/g;
    return $value;
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
            _respond('400 Bad Request', { ok => JSON::PP::false, error => 'Invalid wallpaper image data.' });
        }

        # Guard against accidentally storing huge JSON uploads.
        if (length($raw) > 8 * 1024 * 1024) {
            _respond('400 Bad Request', { ok => JSON::PP::false, error => 'Wallpaper image is too large. Maximum is 8 MB.' });
        }

        eval { make_path($dir, { mode => 0775 }) if !-d $dir; 1 }
            or _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot create wallpaper asset directory: $dir" });

        # Remove old wallpaper files with a different extension to avoid stale assets.
        for my $old_ext (qw(png jpg jpeg webp gif)) {
            my $old = "$theme_dir/assets/images/$theme_id/wallpaper.$old_ext";
            unlink $old if $old ne $path && -f $old;
        }

        open(my $fh, '>', $tmp)
            or _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot write wallpaper asset: $path" });
        binmode $fh;
        print {$fh} $raw;
        close($fh);
        chmod 0664, $tmp;
        move($tmp, $path)
            or _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot finalize wallpaper asset: $path" });
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
    mode       => _wallpaper_mode($wallpaper_src->{mode}),
    brightness => _clamp_int($wallpaper_src->{brightness}, 0, 150, 100),
    opacity    => _clamp_int($wallpaper_src->{opacity}, 0, 100, 100),
};
# Avoid nested USER CUSTOM markers when importing/saving repeatedly.
$custom_css =~ s{/\*\s*USER CUSTOM CSS START\s*\*/}{}ig;
$custom_css =~ s{/\*\s*USER CUSTOM CSS END\s*\*/}{}ig;
$custom_css =~ s/(--lb-sidebar-bg\s*:\s*)(rgba?\s*\([^)]+\)|hsla?\s*\([^)]+\)|#[0-9a-fA-F]{3,8})/$1 . _make_css_color_opaque($2)/ge;
$custom_css =~ s/^\s+|\s+$//g;

my %clean_tokens;
sub _blocked_token {
    my ($token) = @_;
    return 1 if $token =~ /^--lb-table-status-/;
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

my $meaningful_custom_css = $custom_css;
$meaningful_custom_css =~ s{/\*[\s\S]*?\*/}{}g;
$meaningful_custom_css =~ s/^\s+|\s+$//g;
if (!keys(%clean_tokens) && $meaningful_custom_css eq '' && !$wallpaper->{enabled}) {
    _respond('400 Bad Request', {
        ok => JSON::PP::false,
        error => 'No theme tokens or usable custom CSS received. CSS would be empty.'
    });
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
    studio_version => ($data->{studio_version} || 'V39_HybridImportTokensPlusCustomCss'),
};

my $css = "/*\n";
$css .= " * CSS-Studio\n";
$css .= " * Generated by LoxBerry CSS Framework Design Studio\n";
$css .= " * Plugin folder: cssframework\n";
$css .= " * Theme: $name ($id)\n";
$css .= " * Source-JSON: config/plugins/cssframework/themes/$id.json\n";
$css .= " * Runtime scope: body.$id / .$id\n";
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
    my $mode = $wallpaper->{mode};
    my $size = $mode eq 'contain' ? 'contain' : ($mode eq 'repeat' ? 'auto' : 'cover');
    my $repeat = $mode eq 'repeat' ? 'repeat' : 'no-repeat';
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
    $css .= "  background-size: $size;\n";
    $css .= "  background-repeat: $repeat;\n";
    $css .= "  background-position: center center;\n";
    $css .= "  opacity: $opacity;\n";
    $css .= "  filter: brightness($brightness);\n";
    $css .= "  z-index: 0;\n";
    $css .= "}\n";
    $css .= "body.$id .lb-main > *, .$id .lb-main > * { position: relative; z-index: 1; }\n";
    $css .= "/* DESIGN STUDIO WALLPAPER END */\n";
}

# Design Studio generated compatibility helpers. These are scoped to the user
# theme and keep protected/compound components consistent without touching Core.
$css .= "\n/* DESIGN STUDIO RULES START */\n";
$css .= "body.$id table.lb-table, body.$id .lb-table, body.$id table.formtable, body.$id .lb-content table:not(.ui-datepicker-calendar),\n";
$css .= ".$id table.lb-table, .$id .lb-table, .$id table.formtable, .$id .lb-content table:not(.ui-datepicker-calendar) {\n";
$css .= "  background-color: var(--lb-table-bg, var(--lb-table-row-bg, transparent)) !important;\n";
$css .= "  color: var(--lb-table-text, var(--lb-table-row-text, inherit)) !important;\n";
$css .= "  border-color: var(--lb-table-border-color, var(--lb-table-border, rgba(0,0,0,.16))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: var(--lb-table-outer-border-width, var(--lb-table-border-width, 1px)) !important;\n";
$css .= "  border-radius: var(--lb-table-radius, var(--lb-radius-table, 0px)) !important;\n";
$css .= "  overflow: hidden;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table thead, body.$id table.lb-table th, body.$id .lb-table thead, body.$id .lb-table th, body.$id table.formtable th, body.$id .lb-content table:not(.ui-datepicker-calendar) th,\n";
$css .= ".$id table.lb-table thead, .$id table.lb-table th, .$id .lb-table thead, .$id .lb-table th, .$id table.formtable th, .$id .lb-content table:not(.ui-datepicker-calendar) th {\n";
$css .= "  background-color: var(--lb-table-header-bg, var(--lb-table-bg, transparent)) !important;\n";
$css .= "  color: var(--lb-table-header-text, var(--lb-table-text, inherit)) !important;\n";
$css .= "  border-color: var(--lb-table-header-border-color, var(--lb-table-header-border, var(--lb-table-border-color, var(--lb-table-border, rgba(0,0,0,.16))))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: var(--lb-table-cell-border-width, var(--lb-table-border-width, 1px)) !important;\n";
$css .= "}\n";
$css .= "body.$id table.lb-table td, body.$id .lb-table td, body.$id table.formtable td, body.$id .lb-content table:not(.ui-datepicker-calendar) td,\n";
$css .= ".$id table.lb-table td, .$id .lb-table td, .$id table.formtable td, .$id .lb-content table:not(.ui-datepicker-calendar) td {\n";
$css .= "  background-color: var(--lb-table-row-bg, var(--lb-table-bg, transparent)) !important;\n";
$css .= "  color: var(--lb-table-row-text, var(--lb-table-text, inherit)) !important;\n";
$css .= "  border-color: var(--lb-table-row-border-color, var(--lb-table-row-border, var(--lb-table-border-color, var(--lb-table-border, rgba(0,0,0,.16))))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 0 0 var(--lb-table-cell-border-width, var(--lb-table-border-width, 1px)) 0 !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-table-hover tbody tr:hover td, body.$id table.lb-table.lb-table-hover tbody tr:hover td, body.$id .cfw-table-hover-enabled tbody tr:hover td,\n";
$css .= ".$id .lb-table-hover tbody tr:hover td, .$id table.lb-table.lb-table-hover tbody tr:hover td, .$id .cfw-table-hover-enabled tbody tr:hover td {\n";
$css .= "  background-color: var(--lb-table-row-hover-bg, var(--lb-table-hover-bg, var(--lb-hover-bg, transparent))) !important;\n";
$css .= "  color: var(--lb-table-row-hover-text, var(--lb-table-hover-text, var(--lb-table-text, inherit))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-table-hover tbody tr:hover td *, body.$id table.lb-table.lb-table-hover tbody tr:hover td *, body.$id .cfw-table-hover-enabled tbody tr:hover td *,\n";
$css .= ".$id .lb-table-hover tbody tr:hover td *, .$id table.lb-table.lb-table-hover tbody tr:hover td *, .$id .cfw-table-hover-enabled tbody tr:hover td * {\n";
$css .= "  color: inherit !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-sidebar a:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= "body.$id .lb-sidebar .lb-sidebar-link:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= "body.$id .lb-sidebar .lb-nav-link:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= "body.$id .lb-sidebar .ui-btn:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= "body.$id .lb-sidebar li:not(.active):not(.ui-btn-active):not(.lb-active):hover > a,\n";
$css .= ".$id .lb-sidebar a:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= ".$id .lb-sidebar .lb-sidebar-link:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= ".$id .lb-sidebar .lb-nav-link:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= ".$id .lb-sidebar .ui-btn:not(.active):not(.ui-btn-active):not(.lb-active):hover,\n";
$css .= ".$id .lb-sidebar li:not(.active):not(.ui-btn-active):not(.lb-active):hover > a {\n";
$css .= "  background-color: var(--lb-sidebar-link-hover-bg, var(--lb-sidebar-hover-bg, var(--lb-nav-hover-bg, var(--lb-hover-bg, transparent)))) !important;\n";
$css .= "  color: var(--lb-sidebar-link-hover-text, var(--lb-sidebar-hover-text, var(--lb-nav-hover-text, var(--lb-sidebar-text, inherit)))) !important;\n";
$css .= "  border-radius: var(--lb-sidebar-link-radius, var(--lb-radius-sm, 10px)) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-sidebar a:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= "body.$id .lb-sidebar .lb-sidebar-link:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= "body.$id .lb-sidebar .lb-nav-link:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= "body.$id .lb-sidebar .ui-btn:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= "body.$id .lb-sidebar li:not(.active):not(.ui-btn-active):not(.lb-active):hover > a *,\n";
$css .= ".$id .lb-sidebar a:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= ".$id .lb-sidebar .lb-sidebar-link:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= ".$id .lb-sidebar .lb-nav-link:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= ".$id .lb-sidebar .ui-btn:not(.active):not(.ui-btn-active):not(.lb-active):hover *,\n";
$css .= ".$id .lb-sidebar li:not(.active):not(.ui-btn-active):not(.lb-active):hover > a * {\n";
$css .= "  color: inherit !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-input, body.$id .lb-select, body.$id .lb-textarea,\n";
$css .= "body.$id .lb-content input[type=text], body.$id .lb-content input[type=password], body.$id .lb-content input[type=email], body.$id .lb-content input[type=url], body.$id .lb-content input[type=number], body.$id .lb-content input[type=tel], body.$id .lb-content input[type=search], body.$id .lb-content input[type=time], body.$id .lb-content textarea, body.$id .lb-content select,\n";
$css .= "body.$id .ui-input-text, body.$id .ui-input-search, body.$id .ui-select, body.$id .ui-select .ui-btn,\n";
$css .= ".$id .lb-input, .$id .lb-select, .$id .lb-textarea,\n";
$css .= ".$id .lb-content input[type=text], .$id .lb-content input[type=password], .$id .lb-content input[type=email], .$id .lb-content input[type=url], .$id .lb-content input[type=number], .$id .lb-content input[type=tel], .$id .lb-content input[type=search], .$id .lb-content input[type=time], .$id .lb-content textarea, .$id .lb-content select,\n";
$css .= ".$id .ui-input-text, .$id .ui-input-search, .$id .ui-select, .$id .ui-select .ui-btn {\n";
$css .= "  border-radius: var(--lb-select-radius, var(--lb-radius-select, var(--lb-textarea-radius, var(--lb-input-radius, var(--lb-radius-input, var(--lb-radius-sm, 10px)))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group, body.$id .lb-btn-group .lb-btn, body.$id .lb-btn-group button, body.$id .lb-btn-group label, body.$id .lb-btn-group .ui-btn,\n";
$css .= ".$id .lb-btn-group, .$id .lb-btn-group .lb-btn, .$id .lb-btn-group button, .$id .lb-btn-group label, .$id .lb-btn-group .ui-btn {\n";
$css .= "  border-radius: var(--lb-btn-group-radius, var(--lb-btn-group-item-radius, var(--lb-btn-radius, var(--lb-radius-button, var(--lb-radius-sm, 10px))))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.active),\n";
$css .= "body.$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.active),\n";
$css .= ".$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.active),\n";
$css .= ".$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.active) {\n";
$css .= "  background-color: var(--lb-btn-group-inactive-bg, var(--lb-btn-group-active-text, #fff)) !important;\n";
$css .= "  color: var(--lb-btn-group-inactive-text, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-border-color, var(--lb-border, #d7e7d9))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.active):hover,\n";
$css .= "body.$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.active):hover,\n";
$css .= ".$id .lb-btn-group button:not(.ui-btn-active):not(.lb-active):not(.active):hover,\n";
$css .= ".$id .lb-btn-group .ui-btn:not(.ui-btn-active):not(.lb-active):not(.active):hover {\n";
$css .= "  background-color: var(--lb-btn-group-hover-bg, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  color: var(--lb-btn-group-hover-text, var(--lb-btn-group-active-text, var(--lb-active-text, #fff))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:checked + label, .$id .lb-btn-group input:checked + label {\n";
$css .= "  background-color: var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff)) !important;\n";
$css .= "  color: var(--lb-btn-group-active-text, var(--lb-active-text, #fff)) !important;\n";
$css .= "  border-color: var(--lb-btn-group-active-border, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:not(:checked) + label, .$id .lb-btn-group input:not(:checked) + label {\n";
$css .= "  background-color: var(--lb-btn-group-inactive-bg, var(--lb-btn-group-active-text, #fff)) !important;\n";
$css .= "  color: var(--lb-btn-group-inactive-text, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-btn-group-inactive-border, var(--lb-border-color, var(--lb-border, #d7e7d9))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-btn-group input:not(:checked) + label:hover, .$id .lb-btn-group input:not(:checked) + label:hover {\n";
$css .= "  background-color: var(--lb-btn-group-hover-bg, var(--lb-btn-group-active-bg, var(--lb-active-bg, #007aff))) !important;\n";
$css .= "  color: var(--lb-btn-group-hover-text, var(--lb-btn-group-active-text, var(--lb-active-text, #fff))) !important;\n";
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
$css .= "  --lb-slider-fill-bg: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-range-active-bg, var(--lb-primary, var(--lb-btn-primary-bg, #007aff)))));\n";
$css .= "  --lb-slider-track-bg: var(--lb-slider-track-bg, var(--lb-slider-bg, var(--lb-range-track-bg, rgba(0,0,0,.22))));\n";
$css .= "  accent-color: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-primary, var(--lb-btn-primary-bg, #007aff)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-webkit-slider-runnable-track, .$id .lb-slider::-webkit-slider-runnable-track {\n";
$css .= "  height: var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) !important;\n";
$css .= "  min-height: 0 !important;\n";
$css .= "  border-radius: var(--lb-slider-track-radius, 999px) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "  background: linear-gradient(to right, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff))) 0%, var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff))) var(--lb-slider-fill, 50%), var(--lb-slider-track-bg, var(--lb-slider-bg, rgba(0,0,0,.22))) var(--lb-slider-fill, 50%), var(--lb-slider-track-bg, var(--lb-slider-bg, rgba(0,0,0,.22))) 100%) !important;\n";
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
$css .= "  background-color: var(--lb-slider-fill-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-webkit-slider-thumb, .$id .lb-slider::-webkit-slider-thumb {\n";
$css .= "  margin-top: var(--lb-slider-thumb-offset, calc((var(--lb-slider-track-height, var(--lb-range-track-height, 6px)) - var(--lb-slider-thumb-size, 20px)) / 2)) !important;\n";
$css .= "  background-color: var(--lb-slider-thumb-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-slider-thumb-border, var(--lb-slider-thumb-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-slider::-moz-range-thumb, .$id .lb-slider::-moz-range-thumb {\n";
$css .= "  background-color: var(--lb-slider-thumb-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff))) !important;\n";
$css .= "  border-color: var(--lb-slider-thumb-border, var(--lb-slider-thumb-bg, var(--lb-slider-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-tooltip, body.$id [role=tooltip], .$id .lb-tooltip, .$id [role=tooltip] {\n";
$css .= "  background-color: var(--lb-tooltip-bg, var(--lb-primary-hover, #2e8b57)) !important;\n";
$css .= "  color: var(--lb-tooltip-text, var(--lb-sidebar-text, #fff)) !important;\n";
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
        _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot write file: $file" });
    }
    print {$fh} $content;
    if (!close($fh)) {
        _respond('500 Internal Server Error', { ok => JSON::PP::false, error => "Cannot close/write file: $file" });
    }
    chmod 0664, $file;
}

my $orphan_css_deleted = _cleanup_orphan_studio_css();

if (!-f "$theme_dir/$css_file" || -s "$theme_dir/$css_file" <= 0) {
    _respond('500 Internal Server Error', {
        ok => JSON::PP::false,
        error => "CSS was not created or is empty: $theme_dir/$css_file"
    });
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
