#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "REPLACELBHOMEDIR/libs/perllib";
use CGI qw(:standard);
use JSON::PP qw(decode_json encode_json);
use LoxBerry::System;
use LoxBerry::Web;

our ($lbpconfigdir, $lbpdatadir);

my $plugin = 'cssframework';
my $cfgdir = $lbpconfigdir || $ENV{LBPCONFIG} || "REPLACELBHOMEDIR/config/plugins/$plugin";
my $datadir = $lbpdatadir || $ENV{LBPDATA} || "REPLACELBHOMEDIR/data/plugins/$plugin";

# V79 storage split:
# - JSON/editable Studio state is stored in config/plugins/cssframework/themes.
# - CSS/assets are stored only in data/plugins/cssframework/themes.
# - Browser delivery is handled by theme-file.cgi; no webfrontend theme mirror is used.
my $theme_json_dir = "$cfgdir/themes";
my $theme_dir      = "$datadir/themes";
my $manifest_dir   = "$cfgdir/manifests";

sub _respond {
    my ($status, $payload) = @_;
    print header(-type => 'application/json', -charset => 'utf-8', -status => $status);
    print encode_json($payload);
    exit;
}

sub _safe_id {
    my ($id) = @_;
    $id = defined $id ? "$id" : '';
    $id =~ s/^\s+|\s+$//g;
    return $id if $id =~ /^theme-user-[A-Za-z0-9_-]+$/;
    return '';
}

sub _read_text_file {
    my ($file) = @_;
    return '' if !defined $file || !-f $file || !-r $file;
    my $fh;
    return '' if !open($fh, '<:encoding(UTF-8)', $file);
    local $/;
    my $content = <$fh>;
    close($fh);
    return defined $content ? $content : '';
}

sub _css_is_studio_generated_for_id {
    my ($file, $id) = @_;
    my $head = substr(_read_text_file($file), 0, 8192);
    return 0 if $head !~ /CSS-Studio/;
    return 1 if $head =~ m{Source-JSON:\s*(?:config|data)/plugins/cssframework/themes/\Q$id\E\.json}i;
    return 1 if $head =~ m{Theme:\s*.*\(\Q$id\E\)}i;
    return 0;
}

my $raw = do { local $/; <STDIN> };
my $data = eval { decode_json($raw || '{}') };
_respond('400 Bad Request', { ok => JSON::PP::false, error => 'Invalid JSON payload' }) if $@ || ref($data) ne 'HASH';

my $id = _safe_id($data->{id});
_respond('400 Bad Request', { ok => JSON::PP::false, error => 'Invalid or missing theme id' }) if !$id;

# V311: package-owned themes are protected from Studio and direct backend
# deletion. Liquid Glass remains wallpaper-only; Classic Mac is fully read-only.
my %protected_package_theme = (
    'theme-user-liquid-glass' => 'Liquid Glass',
    'theme-user-classic-mac'  => 'Classic Mac',
);
if (exists $protected_package_theme{lc($id)}) {
    _respond('403 Forbidden', {
        ok => JSON::PP::false,
        error => 'Protected package theme cannot be deleted',
        error_key => 'protectedPackageTheme',
        message_key => 'protectedPackageTheme',
        args => { theme => $protected_package_theme{lc($id)}, id => $id },
        id => $id,
    });
}

my $json_path = "$theme_json_dir/$id.json";
my $legacy_data_json_path = "$theme_dir/$id.json";
my $manifest_path = "$manifest_dir/$id.manifest.json";
my $css_path = "$theme_dir/$id.css";

my $deleted_json = 0;
my $deleted_manifest = 0;
my $deleted_css = 0;
my $deleted_legacy_data_json = 0;
my $css_skipped_manual = 0;

if (-f $json_path) {
    $deleted_json = unlink($json_path) ? 1 : 0;
}
if (-f $legacy_data_json_path) {
    $deleted_legacy_data_json = unlink($legacy_data_json_path) ? 1 : 0;
}
if (-f $manifest_path) {
    $deleted_manifest = unlink($manifest_path) ? 1 : 0;
}
if (-f $css_path) {
    if (_css_is_studio_generated_for_id($css_path, $id)) {
        $deleted_css = unlink($css_path) ? 1 : 0;
    } else {
        $css_skipped_manual = 1;
    }
}


_respond('200 OK', {
    ok => JSON::PP::true,
    id => $id,
    deleted_json => $deleted_json ? JSON::PP::true : JSON::PP::false,
    deleted_legacy_data_json => $deleted_legacy_data_json ? JSON::PP::true : JSON::PP::false,
    deleted_manifest => $deleted_manifest ? JSON::PP::true : JSON::PP::false,
    deleted_css => $deleted_css ? JSON::PP::true : JSON::PP::false,
    deleted_data_css => $deleted_css ? JSON::PP::true : JSON::PP::false,
    css_skipped_manual => $css_skipped_manual ? JSON::PP::true : JSON::PP::false,
});
