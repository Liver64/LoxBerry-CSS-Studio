#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "/opt/loxberry/libs/perllib";
use FindBin qw($Bin);
use lib "$Bin/lib";

use CGI qw(:standard);
use HTML::Template;
use JSON::PP qw(encode_json decode_json);
use File::Basename qw(dirname);
use File::Copy qw(copy);
use File::Path qw(make_path);
use LoxBerry::System;
use LoxBerry::Web;
use LoxBerry::JSON;

use CSSFramework::CoreFiles qw(scan_core_files);

our ($lbpconfigdir, $lbphtmldir, $lbptemplatedir, $lbpdatadir);

my $plugin  = 'cssframework';
my $version = '0.9.0-v87-utf8-text-read';

my $cfgdir  = $lbpconfigdir   || $ENV{LBPCONFIG} || "/opt/loxberry/config/plugins/$plugin";
my $htmldir = $lbphtmldir     || $ENV{LBPHTML}   || "/opt/loxberry/webfrontend/html/plugins/$plugin";
my $tpldir  = $lbptemplatedir || $ENV{LBPTEMPL}  || "/opt/loxberry/templates/plugins/$plugin";
my $datadir = $lbpdatadir      || $ENV{LBPDATA}   || "/opt/loxberry/data/plugins/$plugin";

# V79 storage split:
# - JSON/editable Studio state stays in config/plugins/cssframework/themes.
# - CSS/assets live only in data/plugins/cssframework/themes.
# - Browser delivery is handled by theme-file.cgi; no webfrontend theme mirror is used.
my $theme_json_dir = "$cfgdir/themes";
my $theme_dir      = "$datadir/themes";
my $manifest_dir   = "$cfgdir/manifests";

sub _json {
    my ($data) = @_;
    return encode_json($data);
}

sub _url_escape {
    my ($value) = @_;
    $value = '' if !defined $value;
    $value =~ s/([^A-Za-z0-9_.~-])/sprintf('%%%02X', ord($1))/ge;
    return $value;
}


sub _read_text_file {
    my ($file) = @_;
    return '' if !defined $file || !-f $file || !-r $file;
    my $fh;
    if (!open($fh, '<:encoding(UTF-8)', $file)) {
        return '';
    }
    local $/;
    my $content = <$fh>;
    close($fh);
    return defined $content ? $content : '';
}

sub _loxberry_language {
    my $lblang = eval { lblanguage() };
    $lblang = '' if $@ || !defined $lblang;
    $lblang = lc($lblang);

    # The Design Studio currently ships German and English dictionaries.
    # The active language must follow the language selected in LoxBerry,
    # not browser headers or URL parameters.
    return 'de' if $lblang =~ /^de/;
    return 'en';
}

sub _read_json_file {
    my ($file) = @_;
    return undef if !defined $file || !-f $file || !-r $file;

    my $fh;
    if (!open($fh, '<:raw', $file)) {
        return undef;
    }
    local $/;
    my $content = <$fh>;
    close($fh);

    my $data = eval { decode_json($content) };
    return $@ ? undef : $data;
}

sub _ensure_dir {
    my ($dir) = @_;
    return 1 if -d $dir;
    return eval { make_path($dir, { mode => 0775 }); 1 } ? 1 : 0;
}

sub _copy_if_newer {
    my ($src, $dst) = @_;
    return 0 if !defined $src || !defined $dst || !-f $src;
    if (-f $dst) {
        my $src_mtime = (stat($src))[9] || 0;
        my $dst_mtime = (stat($dst))[9] || 0;
        my $src_size  = -s $src || 0;
        my $dst_size  = -s $dst || 0;
        return 1 if $dst_mtime >= $src_mtime && $dst_size == $src_size;
    }
    return 0 if !_ensure_dir(dirname($dst));
    return copy($src, $dst) ? (chmod(0664, $dst), 1) : 0;
}

my $do = param('do') || '';

if ($do eq 'cleanup_bak') {
    my $deleted = cleanup_bak_files();

    print "Content-Type: text/plain; charset=utf-8\n\n";
    print "Deleted .bak files: $deleted\n";
    exit;
}

sub _migrate_legacy_theme_json {
    # V76 temporarily stored JSON next to CSS in data/themes.
    # Move these files back to config/themes and remove the misplaced copies.
    _ensure_dir($theme_json_dir);
    return if !-d $theme_dir;

    for my $file (sort glob("$theme_dir/theme-user-*.json")) {
        my ($name) = $file =~ m{/([^/]+\.json)\z};
        next if !$name;
        my $target = "$theme_json_dir/$name";

        if (!-f $target) {
            copy($file, $target);
            chmod 0664, $target if -f $target;
        }

        unlink($file) if -f $target;
    }
}

sub _extract_theme_tokens_from_css_file {
    my ($file) = @_;
    my $css = _read_text_file($file);
    my %tokens;
    while ($css =~ /(--lb-[a-z0-9-]+)\s*:\s*([^;{}]+)\s*;/ig) {
        my ($name, $value) = ($1, $2);
        $value =~ s/^\s+|\s+$//g;
        next if $value eq '';
        $tokens{$name} = $value;
    }
    return \%tokens;
}

sub cleanup_bak_files {
    my @dirs = (
        $theme_json_dir,
        $theme_dir,
    );

    my $deleted = 0;

    foreach my $dir (@dirs) {
        next if (!$dir || !-d $dir);

        opendir(my $dh, $dir) or next;
        while (my $file = readdir($dh)) {
            next if ($file !~ /\.bak$/i);

            my $path = "$dir/$file";
            next if (!-f $path);

            if (unlink($path)) {
                $deleted++;
            }
        }
        closedir($dh);
    }

    return $deleted;
}

sub _theme_name_from_css_file {
    my ($file, $fallback_id) = @_;
    my $head = substr(_read_text_file($file), 0, 4096);
    if ($head =~ /^\s*\*\s*Name:\s*(.+?)\s*$/mi) {
        my $name = $1;
        $name =~ s/^\s+|\s+$//g;
        return $name if $name ne '';
    }
    if ($head =~ /^\s*\*\s*Theme:\s*(.+?)\s*\(/mi) {
        my $name = $1;
        $name =~ s/^\s+|\s+$//g;
        return $name if $name ne '';
    }
    my $name = $fallback_id || 'User Theme';
    $name =~ s/^theme-user-//;
    $name =~ s/-/ /g;
    $name =~ s/\b(\w)/\U$1/g;
    return $name;
}

for my $dir ($theme_json_dir, $theme_dir, $manifest_dir) {
    _ensure_dir($dir);
}

_migrate_legacy_theme_json();
my @plugin_manifests;
for my $file (glob("$manifest_dir/*.manifest.json")) {
    my $data = _read_json_file($file);
    push @plugin_manifests, $data if ref($data) eq 'HASH' && $data->{id};
}

my @user_themes;
my %seen_user_theme;
for my $file (glob("$theme_json_dir/theme-user-*.json")) {
    my $data = _read_json_file($file);
    next if ref($data) ne 'HASH';
    my ($name) = $file =~ m{/([^/]+)\.json$};
    $data->{_source_file} = $file;
    $data->{_file_name} = $name . '.json' if defined $name;
    $data->{id} ||= $name if defined $name;
    $data->{name} ||= $data->{id};
    if ($data->{id}) {
        $seen_user_theme{$data->{id}} = 1;
        push @user_themes, $data;
    }
}

# CSS-only themes are intentionally not listed in the User Theme dropdown.
# Only JSON-backed Studio themes from config/plugins/cssframework/themes are editable/listed.
@user_themes = sort { lc($a->{name} || $a->{id}) cmp lc($b->{name} || $b->{id}) } @user_themes;

my $core_data = scan_core_files();
my $token_count = scalar keys %{$core_data->{tokens} || {}};
my $missing = join(', ', @{$core_data->{missing} || []});

my $default_theme = {
    id           => 'theme-user-demo',
    name         => 'Demo User Theme',
    type         => 'user-theme',
    version      => '0.1.0',
    loxberry_min => '4.0',
    css          => 'theme-user-demo.css',
    features     => {
        custom_css   => JSON::PP::true,
        wallpaper    => JSON::PP::true,
        design_studio => JSON::PP::true,
    },
};

my $language = _loxberry_language();
my $lang_de_js = _read_text_file("$tpldir/lang/lang_de.js");
my $lang_en_js = _read_text_file("$tpldir/lang/lang_en.js");
my $guard_de_js = _read_text_file("$tpldir/lang/guard_de.js");
my $guard_en_js = _read_text_file("$tpldir/lang/guard_en.js");
my $color_style_map = _read_json_file("$cfgdir/translations/de_en_color_style_map.json") || {};


my $template_file = "$tpldir/index.html";
my $tmpl = HTML::Template->new(
    filename          => $template_file,
    die_on_bad_params => 0,
    loop_context_vars => 1,
    utf8              => 1,
);

$tmpl->param(
    VERSION               => $version,
    CFW_LANGUAGE          => $language,
    LBLANG                => $language,
    LANG_DE_JS            => $lang_de_js,
    LANG_EN_JS            => $lang_en_js,
    GUARD_DE_JS           => $guard_de_js,
    GUARD_EN_JS           => $guard_en_js,
    COLOR_STYLE_MAP_JSON  => _json($color_style_map),
    TOKEN_COUNT           => $token_count,
    MISSING_FILES         => $missing,
    HAS_MISSING_FILES     => $missing ne '' ? 1 : 0,
    CORE_DATA_JSON        => _json($core_data),
    CORE_TOKENS_JSON      => _json($core_data->{tokens} || {}),
    DEFAULT_THEME_JSON    => _json($default_theme),
    PLUGIN_MANIFESTS_JSON => _json(\@plugin_manifests),
    PLUGIN_MANIFEST_COUNT => scalar @plugin_manifests,
    USER_THEMES_JSON     => _json(\@user_themes),
    USER_THEME_COUNT     => scalar @user_themes,
);

LoxBerry::Web::lbheader('CSS Framework Design Studio', '', '', 1);
print $tmpl->output;
LoxBerry::Web::lbfooter();

exit 0;
