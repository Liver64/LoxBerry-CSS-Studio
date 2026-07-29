#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "/opt/loxberry/libs/perllib";
use CGI qw(:standard);
use JSON::PP qw(decode_json encode_json);
use File::Path qw(make_path remove_tree);
use LoxBerry::System;
use LoxBerry::Web;

our ($lbpconfigdir, $lbpdatadir);

my $plugin = 'cssframework';
my $cfgdir = $lbpconfigdir || $ENV{LBPCONFIG} || "/opt/loxberry/config/plugins/$plugin";
my $datadir = $lbpdatadir || $ENV{LBPDATA} || "/opt/loxberry/data/plugins/$plugin";

# V79 storage split:
# - JSON/editable Studio state is stored in config/plugins/cssframework/themes.
# - CSS/assets are stored only in data/plugins/cssframework/themes.
# - Browser delivery is handled by theme-file.cgi; no webfrontend theme mirror is used.
my $theme_json_dir = "$cfgdir/themes";
my $theme_dir      = "$datadir/themes";
my $manifest_dir   = "$cfgdir/manifests";

# V480: All volatile save state is centralized in RAM. Theme deletion uses
# the same per-theme lock as theme-save.cgi and removes the theme's retained
# RAM snapshots and stale transaction directories. Final manifests remain
# persistent under config/plugins/cssframework/manifests.
my $shm_root = '/run/shm/cssframework';
my $ram_backup_root = "$shm_root/backups";
my $ram_transaction_root = "$shm_root/transactions";
my $ram_lock_root = "$shm_root/locks";

sub _safe_ram_theme_id {
    my ($id) = @_;
    my $safe = defined($id) ? "$id" : 'theme';
    $safe =~ s/[^A-Za-z0-9_.-]+/_/g;
    return $safe;
}

sub _remove_theme_transactions {
    my ($id) = @_;
    return 0 if !-d $ram_transaction_root;
    my $removed = 0;
    opendir(my $dh, $ram_transaction_root) or return 0;
    my @entries = grep { $_ ne '.' && $_ ne '..' && -d "$ram_transaction_root/$_" } readdir($dh);
    closedir($dh);

    for my $entry (@entries) {
        my $dir = "$ram_transaction_root/$entry";
        my $manifest = "$dir/transaction.json";
        next if !-f $manifest;
        my $raw = _read_text_file($manifest);
        my $tx = eval { decode_json($raw || '{}') };
        next if $@ || ref($tx) ne 'HASH';
        next if !defined($tx->{theme}) || $tx->{theme} ne $id;
        eval { remove_tree($dir); 1 };
        $removed++ if !-d $dir;
    }
    return $removed;
}

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

my $safe_ram_id = _safe_ram_theme_id($id);
make_path($ram_lock_root, { mode => 0775 }) if !-d $ram_lock_root;
my $lock_dir = "$ram_lock_root/$safe_ram_id.lock";
if (-d $lock_dir) {
    my $age = time() - ((stat($lock_dir))[9] || time());
    rmdir($lock_dir) if $age > 300;
}
if (!mkdir($lock_dir, 0775)) {
    _respond('409 Conflict', {
        ok => JSON::PP::false,
        error => 'Theme is currently being saved or deleted',
        error_key => 'themeLocked',
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


my $ram_backup_dir = "$ram_backup_root/$safe_ram_id";
my $deleted_ram_backups = 0;
if (-d $ram_backup_dir) {
    eval { remove_tree($ram_backup_dir); 1 };
    $deleted_ram_backups = !-d($ram_backup_dir) ? 1 : 0;
}
my $deleted_ram_transactions = _remove_theme_transactions($id);
rmdir($lock_dir) if -d $lock_dir;

_respond('200 OK', {
    ok => JSON::PP::true,
    id => $id,
    deleted_json => $deleted_json ? JSON::PP::true : JSON::PP::false,
    deleted_legacy_data_json => $deleted_legacy_data_json ? JSON::PP::true : JSON::PP::false,
    deleted_manifest => $deleted_manifest ? JSON::PP::true : JSON::PP::false,
    deleted_css => $deleted_css ? JSON::PP::true : JSON::PP::false,
    deleted_data_css => $deleted_css ? JSON::PP::true : JSON::PP::false,
    deleted_ram_backups => $deleted_ram_backups ? JSON::PP::true : JSON::PP::false,
    deleted_ram_transactions => 0 + $deleted_ram_transactions,
    css_skipped_manual => $css_skipped_manual ? JSON::PP::true : JSON::PP::false,
});
