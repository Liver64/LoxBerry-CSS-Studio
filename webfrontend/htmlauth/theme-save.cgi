#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "/opt/loxberry/libs/perllib";
use FindBin qw($Bin);
use lib "$Bin/lib";

use CGI qw(:standard);
use JSON::PP qw(decode_json encode_json);
use File::Path qw(make_path remove_tree);
use File::Copy qw(move copy);
use File::Basename qw(dirname basename);
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


my $shm_root = '/run/shm/cssframework';
my $ram_backup_limit = 5;

sub _prune_ram_theme_backups {
    my ($theme_backup_root) = @_;
    return if !defined($theme_backup_root) || !-d $theme_backup_root;

    opendir(my $dh, $theme_backup_root) or die "open-backup-root:$theme_backup_root:$!";
    my @snapshots = grep {
        $_ ne '.' && $_ ne '..' && -d "$theme_backup_root/$_"
    } readdir($dh);
    closedir($dh);

    @snapshots = sort {
        my $am = (stat("$theme_backup_root/$a"))[9] || 0;
        my $bm = (stat("$theme_backup_root/$b"))[9] || 0;
        $bm <=> $am || $b cmp $a;
    } @snapshots;

    for my $index ($ram_backup_limit .. $#snapshots) {
        remove_tree("$theme_backup_root/$snapshots[$index]");
    }
}

sub _archive_transaction_backups {
    my ($theme_id, $backup_dir, $manifest) = @_;
    return '' if !defined($backup_dir) || !-d $backup_dir;
    return '' if ref($manifest) ne 'ARRAY';

    my @existing = grep { $_->{existed} && -f $_->{backup} } @{$manifest};
    return '' if !@existing;

    my $safe_id = $theme_id || 'theme';
    $safe_id =~ s/[^A-Za-z0-9_.-]+/_/g;
    my $theme_backup_root = "$shm_root/backups/$safe_id";
    make_path($theme_backup_root, { mode => 0775 }) if !-d $theme_backup_root;

    my $stamp = strftime('%Y%m%d-%H%M%S', localtime);
    my $snapshot_name = join('-', $stamp, $$, int(rand(1_000_000)));
    my $snapshot_dir = "$theme_backup_root/$snapshot_name";

    my @backup_manifest = map {
        {
            target => $_->{target},
            backup => basename($_->{backup}),
        }
    } @existing;
    make_path($snapshot_dir, { mode => 0775 });
    for my $entry (@existing) {
        my $destination = "$snapshot_dir/" . basename($entry->{backup});
        copy($entry->{backup}, $destination)
            or die "archive-backup-file:$entry->{backup}:$destination:$!";
        chmod 0664, $destination;
    }
    _write_raw_file("$snapshot_dir/backup-manifest.json", _pretty_json({
        theme      => $theme_id,
        created_at => strftime('%Y-%m-%dT%H:%M:%S%z', localtime),
        files      => \@backup_manifest,
    }));
    chmod 0775, $snapshot_dir;
    return $snapshot_dir;
}

sub _read_raw_file {
    my ($path) = @_;
    return undef if !defined $path || !-f $path;
    open(my $fh, '<:raw', $path) or return undef;
    local $/;
    my $content = <$fh>;
    close($fh);
    return defined $content ? $content : '';
}

sub _write_raw_file {
    my ($path, $content) = @_;
    open(my $fh, '>:raw', $path) or die "open:$path:$!";
    print {$fh} defined($content) ? $content : '' or die "write:$path:$!";
    close($fh) or die "close:$path:$!";
    return 1;
}

sub _transactional_write_files {
    my ($theme_id, $items) = @_;
    die 'invalid transaction items' if ref($items) ne 'ARRAY' || !@{$items};

    my $tx_root = "$shm_root/transactions";
    my $lock_root = "$shm_root/locks";
    make_path($tx_root, { mode => 0775 }) if !-d $tx_root;
    make_path($lock_root, { mode => 0775 }) if !-d $lock_root;

    my $safe_id = $theme_id || 'theme';
    $safe_id =~ s/[^A-Za-z0-9_.-]+/_/g;
    my $lock_dir = "$lock_root/$safe_id.lock";
    if (-d $lock_dir) {
        my $age = time() - ((stat($lock_dir))[9] || time());
        rmdir($lock_dir) if $age > 300;
    }
    mkdir($lock_dir, 0775) or die "locked:$lock_dir:$!";

    my $tx_id = join('-', 'save', $$, time(), int(rand(1_000_000)));
    my $tx_dir = "$tx_root/$tx_id";
    my $stage_dir = "$tx_dir/stage";
    my $backup_dir = "$tx_dir/backup";
    my @committed;
    my @target_tmps;
    my $archived_backup = '';
    my $ok = eval {
        make_path($stage_dir, { mode => 0775 });
        make_path($backup_dir, { mode => 0775 });

        my @manifest;
        for my $index (0 .. $#{$items}) {
            my ($target, $content, $kind) = @{$items->[$index]};
            die "invalid-target" if !defined($target) || $target eq '';
            my $stage = sprintf('%s/%03d-%s', $stage_dir, $index, basename($target));
            _write_raw_file($stage, $content);
            die "empty-stage:$target" if !-s $stage;
            if (($kind || '') eq 'json') {
                my $parsed = eval { decode_json(_read_raw_file($stage)) };
                die "invalid-stage-json:$target" if $@ || ref($parsed) ne 'HASH';
            }
            my $backup = sprintf('%s/%03d-%s.bak', $backup_dir, $index, basename($target));
            my $existed = -f $target ? 1 : 0;
            if ($existed) {
                copy($target, $backup) or die "backup:$target:$!";
            }
            push @manifest, {
                target => $target, stage => $stage, backup => $backup,
                existed => $existed ? JSON::PP::true : JSON::PP::false,
            };
        }
        _write_raw_file("$tx_dir/transaction.json", _pretty_json({ theme => $theme_id, files => \@manifest }));

        for my $index (0 .. $#manifest) {
            my $entry = $manifest[$index];
            my $target = $entry->{target};
            my $dir = dirname($target);
            make_path($dir, { mode => 0775 }) if !-d $dir;
            my $tmp = "$dir/." . basename($target) . ".cssframework-tx-$$-$index.tmp";
            push @target_tmps, $tmp;
            copy($entry->{stage}, $tmp) or die "copy-to-target:$target:$!";
            chmod 0664, $tmp;
            rename($tmp, $target) or die "rename-target:$target:$!";
            push @committed, $entry;
        }

        # V481: Create the retained RAM snapshot only after every target has
        # been committed successfully. Verify that the snapshot really exists
        # and contains its manifest before reporting a successful save.
        # V485: The atomic target commit must not be rolled back merely because
        # the optional retained RAM history cannot be archived. Transactional
        # rollback backups remain available until this block has completed.
        my $archive_ok = eval {
            $archived_backup = _archive_transaction_backups($theme_id, $backup_dir, \@manifest);
            if ($archived_backup ne '') {
                die "ram-backup-missing:$archived_backup" if !-d $archived_backup;
                die "ram-backup-manifest-missing:$archived_backup" if !-s "$archived_backup/backup-manifest.json";
                _prune_ram_theme_backups(dirname($archived_backup));
            }
            1;
        };
        if (!$archive_ok) {
            remove_tree($archived_backup) if $archived_backup ne '' && -d $archived_backup;
            $archived_backup = '';
        }
        1;
    };
    my $error = $@;

    if (!$ok) {
        remove_tree($archived_backup) if $archived_backup ne '' && -d $archived_backup;
        for my $entry (reverse @committed) {
            my $target = $entry->{target};
            my $dir = dirname($target);
            my $rollback_tmp = "$dir/." . basename($target) . ".cssframework-rollback-$$.tmp";
            if ($entry->{existed}) {
                if (copy($entry->{backup}, $rollback_tmp)) {
                    chmod 0664, $rollback_tmp;
                    rename($rollback_tmp, $target);
                }
            } else {
                unlink($target) if -e $target;
            }
            unlink($rollback_tmp) if -e $rollback_tmp;
        }
    }

    unlink($_) for grep { defined($_) && -e $_ } @target_tmps;
    remove_tree($tx_dir) if -d $tx_dir;
    rmdir($lock_dir) if -d $lock_dir;
    die $error if !$ok;
    return $archived_backup;
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


# V488: Remove obsolete generated jQM flipswitch experiments from every input
# and from the final CSS. Older generated themes may still carry these blocks
# through imported custom CSS or stale persisted state. They must never survive
# a new save because V483 recolors the complete moving ON anchor and V486
# replaces Core/jQM geometry.
sub _strip_obsolete_jqm_flipswitch_css {
    my ($value) = @_;
    $value = '' if !defined $value;

    # V483 consists of one marked declaration block.
    $value =~ s{
?/\*\s*V483:\s*JQM\s+ACTIVE\s+FLIPSWITCH\s+KNOB\s*=\s*PRIMARY\s*\*/[\s\S]*?\}\s*}{}ig;

    # V486 has explicit start/end markers.
    $value =~ s{
?/\*\s*V486:\s*FINAL\s+JQM\s+FLIPSWITCH\s+GEOMETRY\s+CONTRACT\s*\*/[\s\S]*?/\*\s*V486:\s*FINAL\s+JQM\s+FLIPSWITCH\s+GEOMETRY\s+CONTRACT\s+END\s*\*/\s*}{}ig;

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



# V467: Parse alpha-bearing CSS colors and composite them over their actual
# underlay before contrast decisions. The old helper intentionally normalised
# rgba() to its opaque RGB channels, which is unsuitable for translucent jQM
# switch labels.
sub _parse_css_rgba {
    my ($value) = @_;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;
    return undef if $value eq '';
    return { r => 0, g => 0, b => 0, a => 0 } if lc($value) eq 'transparent';

    if ($value =~ /^#([0-9a-fA-F]{3,8})$/) {
        my $h = lc($1);
        if (length($h) == 3 || length($h) == 4) {
            $h = join('', map { $_ . $_ } split(//, $h));
        }
        return undef if length($h) != 6 && length($h) != 8;
        return {
            r => hex(substr($h, 0, 2)),
            g => hex(substr($h, 2, 2)),
            b => hex(substr($h, 4, 2)),
            a => length($h) == 8 ? hex(substr($h, 6, 2)) / 255 : 1,
        };
    }

    if ($value =~ /^rgba?\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)(?:\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?))?\s*\)$/i) {
        my @raw = ($1, $2, $3);
        my @rgb;
        for my $part (@raw) {
            my $percent = $part =~ /%$/ ? 1 : 0;
            $part =~ s/%$//;
            my $n = 0 + $part;
            $n *= 2.55 if $percent;
            $n = 0 if $n < 0;
            $n = 255 if $n > 255;
            push @rgb, $n;
        }
        my $alpha = defined $4 && $4 ne '' ? $4 : 1;
        my $alpha_percent = $alpha =~ /%$/ ? 1 : 0;
        $alpha =~ s/%$//;
        $alpha = 0 + $alpha;
        $alpha /= 100 if $alpha_percent;
        $alpha = 0 if $alpha < 0;
        $alpha = 1 if $alpha > 1;
        return { r => $rgb[0], g => $rgb[1], b => $rgb[2], a => $alpha };
    }
    return undef;
}

sub _composite_css_rgba {
    my ($top, $bottom) = @_;
    $top ||= { r => 0, g => 0, b => 0, a => 0 };
    $bottom ||= { r => 255, g => 255, b => 255, a => 1 };
    my $out_a = $top->{a} + $bottom->{a} * (1 - $top->{a});
    return { r => 0, g => 0, b => 0, a => 0 } if $out_a <= 0.000001;
    return {
        r => ($top->{r} * $top->{a} + $bottom->{r} * $bottom->{a} * (1 - $top->{a})) / $out_a,
        g => ($top->{g} * $top->{a} + $bottom->{g} * $bottom->{a} * (1 - $top->{a})) / $out_a,
        b => ($top->{b} * $top->{a} + $bottom->{b} * $bottom->{a} * (1 - $top->{a})) / $out_a,
        a => $out_a,
    };
}

sub _opaque_hex_from_rgba {
    my ($rgba) = @_;
    my $rendered = _composite_css_rgba($rgba, { r => 255, g => 255, b => 255, a => 1 });
    my @rgb = map {
        my $n = int($_ + 0.5);
        $n = 0 if $n < 0;
        $n = 255 if $n > 255;
        $n;
    } ($rendered->{r}, $rendered->{g}, $rendered->{b});
    return sprintf('#%02x%02x%02x', @rgb);
}

sub _first_resolved_css_color {
    my ($tokens, @names) = @_;
    for my $name (@names) {
        next if !defined $tokens->{$name};
        my $raw = _resolve_css_token_value($tokens, $tokens->{$name}, 0);
        my $rgba = _parse_css_rgba($raw);
        return { token => $name, value => $raw, rgba => $rgba } if $rgba;
    }
    return undef;
}

sub _effective_switch_surface {
    my ($tokens, $state) = @_;
    my $on = defined $state && $state eq 'on';
    my @state_names = $on
        ? ('--lb-switch-on-bg', '--lb-toggle-active-bg', '--lb-active-bg', '--lb-primary', '--lb-btn-primary-bg')
        : ('--lb-switch-off-bg', '--lb-toggle-bg', '--lb-btn-bg');
    my $top = _first_resolved_css_color($tokens, @state_names);
    if (!$top) {
        my $fallback = $on ? '#007aff' : 'rgba(0,0,0,.18)';
        $top = {
            token => $on ? 'jQM ON fallback' : 'jQM OFF fallback',
            value => $fallback,
            rgba => _parse_css_rgba($fallback),
        };
    }

    my @layers = ($top);
    my %seen = ($top->{token} => 1);
    if ($on) {
        my $off = _first_resolved_css_color($tokens, '--lb-switch-off-bg', '--lb-toggle-bg', '--lb-btn-bg');
        if ($off && !$seen{$off->{token}}) {
            push @layers, $off;
            $seen{$off->{token}} = 1;
        }
    }
    my $base = _first_resolved_css_color($tokens, '--lb-bg', '--lb-card-bg', '--lb-input-bg');
    if ($base && !$seen{$base->{token}}) {
        push @layers, $base;
        $seen{$base->{token}} = 1;
    }

    my $rendered = { r => 255, g => 255, b => 255, a => 1 };
    for (my $i = $#layers; $i >= 0; $i--) {
        $rendered = _composite_css_rgba($layers[$i]->{rgba}, $rendered);
    }
    return {
        token => $top->{token},
        raw => $top->{value},
        value => _opaque_hex_from_rgba($rendered),
        layers => \@layers,
    };
}

sub _rendered_css_contrast_ratio {
    my ($foreground, $background) = @_;
    my $fg = _parse_css_rgba($foreground);
    my $bg = _parse_css_rgba($background);
    return undef if !$fg || !$bg;
    my $opaque_bg = _composite_css_rgba($bg, { r => 255, g => 255, b => 255, a => 1 });
    my $opaque_fg = _composite_css_rgba($fg, $opaque_bg);
    return _css_contrast_ratio(_opaque_hex_from_rgba($opaque_fg), _opaque_hex_from_rgba($opaque_bg));
}

sub _css_relative_luminance {
    my ($value) = @_;
    my $hex = _normalize_hex_color($value);
    return undef if $hex eq '';
    my @rgb = map { hex($_) / 255 } ($hex =~ /^#(..)(..)(..)$/);
    my @linear = map { $_ <= 0.03928 ? $_ / 12.92 : (($_ + 0.055) / 1.055) ** 2.4 } @rgb;
    return 0.2126 * $linear[0] + 0.7152 * $linear[1] + 0.0722 * $linear[2];
}

sub _css_contrast_ratio {
    my ($foreground, $background) = @_;
    my $fg = _css_relative_luminance($foreground);
    my $bg = _css_relative_luminance($background);
    return undef if !defined $fg || !defined $bg;
    my ($lighter, $darker) = $fg >= $bg ? ($fg, $bg) : ($bg, $fg);
    return ($lighter + 0.05) / ($darker + 0.05);
}

sub _readable_text_for_surface {
    my ($background, $light, $dark) = @_;
    $light ||= '#f8fafc';
    $dark  ||= '#111827';
    my $light_ratio = _css_contrast_ratio($light, $background);
    my $dark_ratio  = _css_contrast_ratio($dark, $background);
    return $light if !defined $dark_ratio;
    return $dark if !defined $light_ratio;
    return $light_ratio >= $dark_ratio ? $light : $dark;
}

sub _enforce_saved_text_contrast {
    my ($tokens, $text_token, $background_token, $minimum, $light, $dark) = @_;
    return if ref($tokens) ne 'HASH';
    my $background = _first_clean_token_value($tokens, $background_token);
    return if _normalize_hex_color($background) eq '';
    my $text = _first_clean_token_value($tokens, $text_token);
    my $ratio = $text ne '' ? _css_contrast_ratio($text, $background) : undef;
    if (!defined $ratio || $ratio < $minimum) {
        $tokens->{$text_token} = _readable_text_for_surface($background, $light, $dark);
    }
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
    # V402 persistence contract: Save is lossless. Do not replace explicit
    # white surfaces with --lb-bg. Theme generation remains responsible for
    # choosing coordinated defaults before the payload reaches this endpoint.
    return;
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

# V465: Resolve simple and nested CSS custom-property references before
# semantic contrast checks. V464 only accepted direct hexadecimal values, so
# common values such as var(--lb-primary) bypassed the switch derivation.
sub _resolve_css_token_value {
    my ($tokens, $value, $depth) = @_;
    $depth ||= 0;
    return '' if $depth > 10;
    $value = defined $value ? "$value" : '';
    $value =~ s/^\s+|\s+$//g;
    return '' if $value eq '';

    if ($value =~ /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*(.+))?\)$/s) {
        my ($name, $fallback) = ($1, defined $2 ? $2 : '');
        my $resolved = '';
        if (defined $tokens->{$name}) {
            $resolved = _resolve_css_token_value($tokens, $tokens->{$name}, $depth + 1);
        }
        return $resolved if $resolved ne '';
        return _resolve_css_token_value($tokens, $fallback, $depth + 1) if $fallback ne '';
        return '';
    }
    return $value;
}

sub _first_resolved_token_value {
    my ($tokens, @names) = @_;
    for my $name (@names) {
        next if !defined $tokens->{$name};
        my $value = _resolve_css_token_value($tokens, $tokens->{$name}, 0);
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
    # V402: Explicit primary values are authoritative and survive Save/Reload.
    if ($candidate ne '' && $primary eq '') {
        $tokens->{'--lb-primary'} = $candidate;
        $primary = $candidate;
    }
    # V400: Preserve an explicitly selected slider value text color.
    # Only provide the primary-color fallback when the token is genuinely
    # absent or empty. Previous versions overwrote every saved user choice.
    my $slider_value_text = _first_clean_token_value(
        $tokens,
        '--lb-slider-value-text'
    );
    if ($primary ne '' && $slider_value_text eq '') {
        $tokens->{'--lb-slider-value-text'} = 'var(--lb-primary)';
    }
}

# V468: jQM slider-switch and flipswitch labels use one deterministic
# black/white contract. Both states are evaluated against the common neutral
# switch/input surface over the page background: light surface => #000000,
# dark surface => #ffffff. This mirrors the actual generated jQM markup where
# the ON anchor is also the moving handle and its active color is not a reliable
# text underlay.
sub _effective_switch_label_surface {
    my ($tokens) = @_;
    return undef if ref($tokens) ne 'HASH';

    my $top = _first_resolved_css_color($tokens,
        '--lb-switch-off-bg',
        '--lb-toggle-bg',
        '--lb-input-bg',
        '--lb-card-bg',
        '--lb-bg'
    );
    my $base = _first_resolved_css_color($tokens,
        '--lb-bg',
        '--lb-card-bg',
        '--lb-input-bg'
    );
    return { token => 'jQM label fallback', raw => '#ffffff', value => '#ffffff', layers => [] }
        if !$top && !$base;

    my @layers;
    push @layers, $top if $top;
    push @layers, $base if $base && (!$top || $base->{token} ne $top->{token});
    my $rendered = { r => 255, g => 255, b => 255, a => 1 };
    for (my $i = $#layers; $i >= 0; $i--) {
        $rendered = _composite_css_rgba($layers[$i]->{rgba}, $rendered);
    }
    return {
        token => $top ? $top->{token} : $base->{token},
        raw => $top ? $top->{value} : $base->{value},
        value => _opaque_hex_from_rgba($rendered),
        layers => \@layers,
    };
}

sub _sync_switch_text_tokens {
    my ($tokens) = @_;
    return if ref($tokens) ne 'HASH';

    my $surface = _effective_switch_label_surface($tokens);
    my $value = '#000000';
    if ($surface && _normalize_hex_color($surface->{value}) ne '') {
        $value = _readable_text_for_surface($surface->{value}, '#ffffff', '#000000');
    }

    $tokens->{'--lb-switch-on-text'} = $value;
    $tokens->{'--lb-toggle-active-text'} = $value;
    $tokens->{'--lb-switch-off-text'} = $value;
    $tokens->{'--lb-toggle-text'} = $value;
}

my $custom_css = _strip_obsolete_jqm_flipswitch_css(_normalize_custom_css_value($data->{custom_css}));

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

sub _clamp_num {
    my ($value, $min, $max, $default) = @_;
    $value = $default
        if !defined $value || $value !~ /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
    $value = 0 + $value;
    $value = $min if $value < $min;
    $value = $max if $value > $max;
    return int($value * 10 + 0.5) / 10;
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

my $wallpaper_is_liquid_glass = $id eq 'theme-user-liquid-glass' ? 1 : 0;
my $wallpaper = {
    enabled    => ($wallpaper_src->{enabled} && $wallpaper_image ne '') ? JSON::PP::true : JSON::PP::false,
    image      => $wallpaper_image,
    # V349: Liquid Glass stores the mapped real values, not the 0-100 UI
    # positions. The backend independently enforces the supported contract.
    brightness => $wallpaper_is_liquid_glass
        ? _clamp_num($wallpaper_src->{brightness}, 85, 140, 100)
        : _clamp_num($wallpaper_src->{brightness}, 0, 150, 100),
    opacity    => $wallpaper_is_liquid_glass
        ? _clamp_num($wallpaper_src->{opacity}, 85, 100, 100)
        : _clamp_num($wallpaper_src->{opacity}, 0, 100, 100),
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
    my $opacity = sprintf('%.2f', _clamp_num($wallpaper_ref->{opacity}, 85, 100, 100) / 100);
    my $brightness = sprintf('%.2f', _clamp_num($wallpaper_ref->{brightness}, 85, 140, 100) / 100);

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

    eval {
        _transactional_write_files($theme_id, [
            [$css_path, $css_content, 'css'],
            [$json_path, _pretty_json($editable_wallpaper), 'json'],
        ]);
        1;
    } or _respond('500 Internal Server Error', _error_payload('transactionalSaveFailed', 'transactionalSaveFailed', { detail => "$@" }));

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
_sync_switch_text_tokens(\%clean_tokens) if keys(%clean_tokens);
_sync_tinted_surface_tokens(\%clean_tokens) if keys(%clean_tokens);

# V423: Server-side save validation for dark and light themes. The browser
# rules engine is helpful for preview, but the saved CSS is the final contract.
# Validate the text tokens used by LoxBerry system apps and LBV4 forms against
# their actual surfaces so dark themes cannot persist black labels/values.
if (keys(%clean_tokens)) {
    _enforce_saved_text_contrast(\%clean_tokens, '--lb-text', '--lb-bg', 4.5, '#f8fafc', '#111827');
    _enforce_saved_text_contrast(\%clean_tokens, '--lb-text-secondary', '--lb-bg', 4.5, '#e5e7eb', '#374151');
    _enforce_saved_text_contrast(\%clean_tokens, '--lb-text-muted', '--lb-bg', 3.0, '#cbd5e1', '#4b5563');
    _enforce_saved_text_contrast(\%clean_tokens, '--lb-sidebar-text', '--lb-sidebar-bg', 4.5, '#f8fafc', '#111827');
    _enforce_saved_text_contrast(\%clean_tokens, '--lb-card-text', '--lb-card-bg', 4.5, '#f8fafc', '#111827');
}

# V420: Cards in generated themes must never fall through to a light-theme
# hard default. Keep the semantic card/note text tokens aligned with the
# theme's effective text color when no dedicated value was supplied.
if (!exists $clean_tokens{'--lb-card-text'} || $clean_tokens{'--lb-card-text'} eq '') {
    my $card_text = _first_clean_token_value(\%clean_tokens, '--lb-text');
    $clean_tokens{'--lb-card-text'} = $card_text ne '' ? $card_text : 'var(--lb-text)';
}
if (!exists $clean_tokens{'--lb-note-text'} || $clean_tokens{'--lb-note-text'} eq '') {
    my $note_text = _first_clean_token_value(\%clean_tokens, '--lb-card-text', '--lb-text');
    $clean_tokens{'--lb-note-text'} = $note_text ne '' ? $note_text : 'var(--lb-card-text, var(--lb-text))';
}


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
if (!exists $clean_tokens{'--lb-btn-group-hover-text'} || $clean_tokens{'--lb-btn-group-hover-text'} eq '') {
    if ($btn_group_active_text ne '') {
        $clean_tokens{'--lb-btn-group-hover-text'} = $btn_group_active_text;
    } else {
        $clean_tokens{'--lb-btn-group-hover-text'} = 'var(--lb-btn-group-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))';
    }
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
# V489: The internal jQM flipswitch anchor also carries .ui-btn. It is not a
# normal button and must stay entirely under Core legacy-jqm-compat.css.
$css .= "body.$id .ui-btn:not(.ui-flipswitch-on), body.$id .ui-btn:not(.ui-flipswitch-on):visited, body.$id .ui-btn:not(.ui-flipswitch-on):link, body.$id a.ui-btn:not(.ui-flipswitch-on), body.$id button.ui-btn:not(.ui-flipswitch-on),\n";
$css .= ".$id .ui-btn:not(.ui-flipswitch-on), .$id .ui-btn:not(.ui-flipswitch-on):visited, .$id .ui-btn:not(.ui-flipswitch-on):link, .$id a.ui-btn:not(.ui-flipswitch-on), .$id button.ui-btn:not(.ui-flipswitch-on) {\n";
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
$css .= "body.$id .ui-btn:not(.ui-flipswitch-on):hover, body.$id a.ui-btn:not(.ui-flipswitch-on):hover, body.$id button.ui-btn:not(.ui-flipswitch-on):hover,\n";
$css .= ".$id .ui-btn:not(.ui-flipswitch-on):hover, .$id a.ui-btn:not(.ui-flipswitch-on):hover, .$id button.ui-btn:not(.ui-flipswitch-on):hover {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-btn-hover-bg, var(--lb-btn-bg, var(--lb-card-bg, #fff))) !important;\n";
$css .= "  color: var(--lb-btn-hover-text, var(--lb-btn-text, var(--lb-text, inherit))) !important;\n";
$css .= "  border-color: var(--lb-btn-hover-border, var(--lb-btn-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-btn:not(.ui-flipswitch-on).ui-btn-active, body.$id .ui-btn:not(.ui-flipswitch-on).ui-state-persist, body.$id .ui-btn-active:not(.ui-flipswitch-on),\n";
$css .= ".$id .ui-btn:not(.ui-flipswitch-on).ui-btn-active, .$id .ui-btn:not(.ui-flipswitch-on).ui-state-persist, .$id .ui-btn-active:not(.ui-flipswitch-on) {\n";
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
$css .= "  box-shadow: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label, .$id .ui-slider-switch .ui-slider-label {\n";
$css .= "  background-image: none !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  font-family: var(--lb-font) !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-a, body.$id .ui-slider-switch .ui-slider-label-a .ui-btn-text,\n";
$css .= ".$id .ui-slider-switch .ui-slider-label-a, .$id .ui-slider-switch .ui-slider-label-a .ui-btn-text {\n";
$css .= "  background-color: var(--lb-switch-on-bg, var(--lb-toggle-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  color: var(--lb-switch-on-text, var(--lb-toggle-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-switch-on-text, var(--lb-toggle-active-text, var(--lb-active-text, var(--lb-btn-primary-text, #fff)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-b, body.$id .ui-slider-switch .ui-slider-label-b .ui-btn-text,\n";
$css .= ".$id .ui-slider-switch .ui-slider-label-b, .$id .ui-slider-switch .ui-slider-label-b .ui-btn-text {\n";
$css .= "  background-color: var(--lb-switch-off-bg, var(--lb-toggle-bg, var(--lb-btn-bg, rgba(0,0,0,.18)))) !important;\n";
$css .= "  color: var(--lb-switch-off-text, var(--lb-toggle-text, var(--lb-btn-text, var(--lb-text, inherit)))) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-switch-off-text, var(--lb-toggle-text, var(--lb-btn-text, var(--lb-text, inherit)))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .ui-slider-switch .ui-slider-handle, body.$id .ui-slider-switch .ui-btn.ui-slider-handle,\n";
$css .= ".$id .ui-slider-switch .ui-slider-handle, .$id .ui-slider-switch .ui-btn.ui-slider-handle {\n";
$css .= "  background-image: none !important;\n";
$css .= "  background-color: var(--lb-switch-thumb-bg, var(--lb-toggle-thumb-bg, var(--lb-toggle-knob-bg, var(--lb-slider-thumb-bg, #fff)))) !important;\n";
$css .= "  border-color: var(--lb-switch-thumb-border, var(--lb-toggle-thumb-border, var(--lb-slider-thumb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  box-shadow: var(--lb-switch-thumb-shadow, var(--lb-toggle-thumb-shadow, 0 1px 4px rgba(0,0,0,.22))) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
# V489: Do not emit any .ui-flipswitch styling here. Generated themes provide
# switch color tokens only; Core legacy-jqm-compat.css owns the complete jQM
# flipswitch implementation, including state, disabled handling and geometry.
$css .= "/* DESIGN STUDIO JQM COMPAT END */\n";

# Design Studio generated compatibility helpers. These are scoped to the user
# theme and keep protected/compound components consistent without touching Core.
$css .= "/* V431: LoxBerry Core dark-surface text contract.\n";
$css .= "   The active user theme supplies the page foreground. Core widgets then\n";
$css .= "   receive explicit component foreground/background pairs instead of broad\n";
$css .= "   label/table overrides. Plugin component rules remain untouched. */\n";

# Base LoxBerry system page foreground. This is inheritance-first on purpose.
$css .= "body.$id #page_content, .$id #page_content,\n";
$css .= "body.$id .page_content, .$id .page_content,\n";
$css .= "body.$id .lb-content, .$id .lb-content {\n";
$css .= "  color: var(--lb-text, inherit);\n";
$css .= "  text-shadow: none;\n";
$css .= "}\n";

# Standard Core prose, captions and form labels on the page surface.
$css .= "body.$id #page_content > p, .$id #page_content > p,\n";
$css .= "body.$id #page_content > h1, body.$id #page_content > h2, body.$id #page_content > h3, body.$id #page_content > h4,\n";
$css .= ".$id #page_content > h1, .$id #page_content > h2, .$id #page_content > h3, .$id #page_content > h4,\n";
$css .= "body.$id #page_content .lb-form-label, .$id #page_content .lb-form-label,\n";
$css .= "body.$id #page_content .formlabel, .$id #page_content .formlabel,\n";
$css .= "body.$id #page_content fieldset > legend, .$id #page_content fieldset > legend {\n";
$css .= "  color: var(--lb-text, inherit) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id #page_content .lb-form-help, .$id #page_content .lb-form-help,\n";
$css .= "body.$id #page_content .hint, .$id #page_content .hint,\n";
$css .= "body.$id #page_content [style*='color: var(--lb-gray-400)'], .$id #page_content [style*='color: var(--lb-gray-400)'],\n";
$css .= "body.$id #page_content [style*='color: var(--lb-gray-500)'], .$id #page_content [style*='color: var(--lb-gray-500)'],\n";
$css .= "body.$id #page_content [style*='color: var(--lb-gray-600)'], .$id #page_content [style*='color: var(--lb-gray-600)'] {\n";
$css .= "  color: var(--lb-text-secondary, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

# Native Core checkbox/radio captions. Limit the selector to labels that actually
# own such a control so component labels and status badges are not recoloured.
$css .= "body.$id #page_content label:has(input[type='checkbox']), .$id #page_content label:has(input[type='checkbox']),\n";
$css .= "body.$id #page_content label:has(input[type='radio']), .$id #page_content label:has(input[type='radio']) {\n";
$css .= "  color: var(--lb-text, inherit) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

# Log Manager uses normal lb-table components. Keep semantic status cells with
# their inline foreground/background, and theme only ordinary cells/captions.
$css .= "body.$id #page_content details.lb-collapsible > h4, .$id #page_content details.lb-collapsible > h4,\n";
$css .= "body.$id #page_content table.lb-table td:not([style*='background-color']), .$id #page_content table.lb-table td:not([style*='background-color']),\n";
$css .= "body.$id #page_content table.lb-table th, .$id #page_content table.lb-table th {\n";
$css .= "  color: var(--lb-table-text, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

# MQTT Core pages: pair every dark-theme component surface with its own text
# token. This avoids both black-on-dark and the previous white-on-light regression.
$css .= "body.$id #page_content .mqttgw-group, .$id #page_content .mqttgw-group,\n";
$css .= "body.$id #page_content .mqttgw-group > summary, .$id #page_content .mqttgw-group > summary,\n";
$css .= "body.$id #page_content .mqttgw-group > .lb-collapsible-content, .$id #page_content .mqttgw-group > .lb-collapsible-content,\n";
$css .= "body.$id #page_content .mqttgw-subgroup, .$id #page_content .mqttgw-subgroup,\n";
$css .= "body.$id #page_content .mqttgw-topic-row, .$id #page_content .mqttgw-topic-row,\n";
$css .= "body.$id #page_content .mqttgw-traffic-panel, .$id #page_content .mqttgw-traffic-panel,\n";
$css .= "body.$id #page_content .mqttgw-traffic-panel-header, .$id #page_content .mqttgw-traffic-panel-header,\n";
$css .= "body.$id #page_content .mqttgw-traffic-toolbar, .$id #page_content .mqttgw-traffic-toolbar,\n";
$css .= "body.$id #page_content .mqttgw-traffic-colheader, .$id #page_content .mqttgw-traffic-colheader,\n";
$css .= "body.$id #page_content .mqttgw-tgroup, .$id #page_content .mqttgw-tgroup,\n";
$css .= "body.$id #page_content .mqttgw-tgroup > summary, .$id #page_content .mqttgw-tgroup > summary,\n";
$css .= "body.$id #page_content #topic_groups_container > details, .$id #page_content #topic_groups_container > details,\n";
$css .= "body.$id #page_content #topic_groups_container details > summary, .$id #page_content #topic_groups_container details > summary {\n";
$css .= "  background-color: var(--lb-card-bg, var(--lb-bg-elevated, var(--lb-bg, transparent))) !important;\n";
$css .= "  color: var(--lb-card-text, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

$css .= "body.$id #page_content .mqttgw-filter-label, .$id #page_content .mqttgw-filter-label,\n";
$css .= "body.$id #page_content .mqttgw-filter-count, .$id #page_content .mqttgw-filter-count,\n";
$css .= "body.$id #page_content .mqttgw-topic-name, .$id #page_content .mqttgw-topic-name,\n";
$css .= "body.$id #page_content .mqttgw-traffic-title, .$id #page_content .mqttgw-traffic-title,\n";
$css .= "body.$id #page_content .mqttgw-traffic-name, .$id #page_content .mqttgw-traffic-name,\n";
$css .= "body.$id #page_content .mqttgw-traffic-cmd-text, .$id #page_content .mqttgw-traffic-cmd-text,\n";
$css .= "body.$id #page_content .mqttgw-traffic-value, .$id #page_content .mqttgw-traffic-value,\n";
$css .= "body.$id #page_content #topic_groups_container summary, .$id #page_content #topic_groups_container summary,\n";
$css .= "body.$id #page_content #topic_groups_container strong, .$id #page_content #topic_groups_container strong,\n";
$css .= "body.$id #page_content #topic_groups_container label, .$id #page_content #topic_groups_container label {\n";
$css .= "  color: var(--lb-card-text, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id #page_content .mqttgw-topic-payload, .$id #page_content .mqttgw-topic-payload,\n";
$css .= "body.$id #page_content .mqttgw-group-count, .$id #page_content .mqttgw-group-count,\n";
$css .= "body.$id #page_content .mqttgw-status-detail, .$id #page_content .mqttgw-status-detail,\n";
$css .= "body.$id #page_content .mqttgw-status-uptime, .$id #page_content .mqttgw-status-uptime,\n";
$css .= "body.$id #page_content .mqttgw-traffic-count, .$id #page_content .mqttgw-traffic-count,\n";
$css .= "body.$id #page_content .mqttgw-traffic-topic, .$id #page_content .mqttgw-traffic-topic,\n";
$css .= "body.$id #page_content .mqttgw-traffic-ms-label, .$id #page_content .mqttgw-traffic-ms-label,\n";
$css .= "body.$id #page_content .mqttgw-traffic-time, .$id #page_content .mqttgw-traffic-time,\n";
$css .= "body.$id #page_content .mqttgw-traffic-proc, .$id #page_content .mqttgw-traffic-proc {\n";
$css .= "  color: var(--lb-text-secondary, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

# Legacy MQTT Finder/Transformer output rendered directly on the dark page.
$css .= "body.$id #page_content .topic, .$id #page_content .topic,\n";
$css .= "body.$id #page_content .topic_time, .$id #page_content .topic_time,\n";
$css .= "body.$id #page_content .trans_table, .$id #page_content .trans_table,\n";
$css .= "body.$id #page_content .trans_table td, .$id #page_content .trans_table td,\n";
$css .= "body.$id #page_content .trans_table th, .$id #page_content .trans_table th {\n";
$css .= "  color: var(--lb-text, inherit) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id #page_content .topic_payload, .$id #page_content .topic_payload {\n";
$css .= "  color: var(--lb-primary, var(--lb-text, inherit)) !important;\n";
$css .= "}\n";

$css .= "/* V422: Generated LBV4 card content text compatibility. */\n";
$css .= "body.$id .lb-card, .$id .lb-card,\n";
$css .= "body.$id .lb-card .lb-card-body, .$id .lb-card .lb-card-body,\n";
$css .= "body.$id .lb-card .lb-form-row, .$id .lb-card .lb-form-row,\n";
$css .= "body.$id .lb-card .lb-form-field, .$id .lb-card .lb-form-field,\n";
$css .= "body.$id .lb-card .lb-form-value, .$id .lb-card .lb-form-value,\n";
$css .= "body.$id .lb-card p, .$id .lb-card p,\n";
$css .= "body.$id .lb-card li, .$id .lb-card li,\n";
$css .= "body.$id .lb-card small, .$id .lb-card small {\n";
$css .= "  color: var(--lb-card-text, var(--lb-text, inherit)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
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
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-toggle-slider-radius, 999px))) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle input:checked + .lb-toggle-slider, .$id .lb-toggle input:checked + .lb-toggle-slider {\n";
$css .= "  background-color: var(--lb-switch-on-bg, var(--lb-toggle-active-bg, var(--lb-active-bg, var(--lb-primary, #007aff)))) !important;\n";
$css .= "  border-color: var(--lb-switch-border, var(--lb-toggle-border, var(--lb-border-color, rgba(0,0,0,.18)))) !important;\n";
$css .= "  border-style: solid !important;\n";
$css .= "  border-width: 1px !important;\n";
$css .= "  border-radius: var(--lb-switch-radius, var(--lb-toggle-radius, var(--lb-toggle-slider-radius, 999px))) !important;\n";
$css .= "  box-sizing: border-box !important;\n";
$css .= "}\n";
$css .= "body.$id .lb-toggle .lb-toggle-slider:before, body.$id .lb-toggle .lb-toggle-slider:after, .$id .lb-toggle .lb-toggle-slider:before, .$id .lb-toggle .lb-toggle-slider:after {\n";
$css .= "  background-color: var(--lb-switch-thumb-bg, var(--lb-toggle-thumb-bg, var(--lb-toggle-knob-bg, #fff))) !important;\n";
$css .= "  border-radius: var(--lb-toggle-thumb-radius, var(--lb-toggle-knob-radius, var(--lb-switch-radius, 999px))) !important;\n";
$css .= "  top: 50% !important;\n";
$css .= "  bottom: auto !important;\n";
$css .= "  translate: 0 -50% !important;\n";
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

# V416: Legacy Core overview widgets use a.nolinkstyle for their captions.
# Those links can retain the old jQuery-Mobile/Core link color instead of the
# generated theme text token. Bind only widget captions to the effective theme
# text color; keep ordinary links and plugin content untouched.
$css .= "\n/* DESIGN STUDIO CORE WIDGET LABEL COMPAT START */\n";
$css .= "/* V416: Core plugin/system widget labels follow the generated theme text tokens. */\n";
$css .= "body.$id .widget a.nolinkstyle,\n";
$css .= "body.$id .widget a.nolinkstyle:link,\n";
$css .= "body.$id .widget a.nolinkstyle:visited,\n";
$css .= ".$id .widget a.nolinkstyle,\n";
$css .= ".$id .widget a.nolinkstyle:link,\n";
$css .= ".$id .widget a.nolinkstyle:visited {\n";
$css .= "  color: var(--lb-text, inherit) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-text, inherit) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "body.$id .widget a.nolinkstyle:hover,\n";
$css .= "body.$id .widget a.nolinkstyle:focus-visible,\n";
$css .= ".$id .widget a.nolinkstyle:hover,\n";
$css .= ".$id .widget a.nolinkstyle:focus-visible {\n";
$css .= "  color: var(--lb-primary-hover, var(--lb-primary, var(--lb-text, inherit))) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-primary-hover, var(--lb-primary, var(--lb-text, inherit))) !important;\n";
$css .= "}\n";
$css .= "/* DESIGN STUDIO CORE WIDGET LABEL COMPAT END */\n";

# V367: Legacy LoxBerry page/content wrappers are layout surfaces and must
# always remain transparent. The generated JQM bridge above intentionally
# paints .ui-page and legacy body classes with --lb-bg, but #page_content is
# often also a .ui-content/.ui-body-* element. Without this final rule the
# content wrapper becomes an opaque color block although table.formtable
# itself is already transparent. Keep real components such as .lb-table,
# .lb-card, inputs and buttons untouched; only the legacy wrapper chain and
# the direct structure of table.formtable are reset here.
$css .= "\n/* DESIGN STUDIO LEGACY CONTENT TRANSPARENCY START */\n";
$css .= "/* V367: Default legacy content/form surfaces are always transparent. */\n";
$css .= "html body.$id #page_content,\n";
$css .= "html body.$id #page_content.page_content,\n";
$css .= "html body.$id #page_content.lb-content,\n";
$css .= "html body.$id #page_content.ui-content,\n";
$css .= "html body.$id .page_content,\n";
$css .= "html body.$id .lb-content,\n";
$css .= "body.$id #page_content, body.$id .page_content, body.$id .lb-content,\n";
$css .= ".$id #page_content, .$id .page_content, .$id .lb-content,\n";
$css .= "html body.$id #page_content > form,\n";
$css .= "html body.$id #page_content form,\n";
$css .= "html body.$id #page_content > form > div.form-group,\n";
$css .= "html body.$id #page_content form div.form-group,\n";
$css .= "body.$id #page_content form, body.$id #page_content div.form-group,\n";
$css .= ".$id #page_content form, .$id #page_content div.form-group,\n";
$css .= "html body.$id #page_content table.formtable,\n";
$css .= "html body.$id #page_content table.formtable > thead,\n";
$css .= "html body.$id #page_content table.formtable > tbody,\n";
$css .= "html body.$id #page_content table.formtable > tfoot,\n";
$css .= "html body.$id #page_content table.formtable > thead > tr,\n";
$css .= "html body.$id #page_content table.formtable > tbody > tr,\n";
$css .= "html body.$id #page_content table.formtable > tfoot > tr,\n";
$css .= "html body.$id #page_content table.formtable > thead > tr > th,\n";
$css .= "html body.$id #page_content table.formtable > thead > tr > td,\n";
$css .= "html body.$id #page_content table.formtable > tbody > tr > th,\n";
$css .= "html body.$id #page_content table.formtable > tbody > tr > td,\n";
$css .= "html body.$id #page_content table.formtable > tfoot > tr > th,\n";
$css .= "html body.$id #page_content table.formtable > tfoot > tr > td,\n";
$css .= "body.$id table.formtable,\n";
$css .= "body.$id table.formtable > thead, body.$id table.formtable > tbody, body.$id table.formtable > tfoot,\n";
$css .= "body.$id table.formtable > thead > tr, body.$id table.formtable > tbody > tr, body.$id table.formtable > tfoot > tr,\n";
$css .= "body.$id table.formtable > thead > tr > th, body.$id table.formtable > thead > tr > td,\n";
$css .= "body.$id table.formtable > tbody > tr > th, body.$id table.formtable > tbody > tr > td,\n";
$css .= "body.$id table.formtable > tfoot > tr > th, body.$id table.formtable > tfoot > tr > td,\n";
$css .= ".$id table.formtable,\n";
$css .= ".$id table.formtable > thead, .$id table.formtable > tbody, .$id table.formtable > tfoot,\n";
$css .= ".$id table.formtable > thead > tr, .$id table.formtable > tbody > tr, .$id table.formtable > tfoot > tr,\n";
$css .= ".$id table.formtable > thead > tr > th, .$id table.formtable > thead > tr > td,\n";
$css .= ".$id table.formtable > tbody > tr > th, .$id table.formtable > tbody > tr > td,\n";
$css .= ".$id table.formtable > tfoot > tr > th, .$id table.formtable > tfoot > tr > td {\n";
$css .= "  background: transparent !important;\n";
$css .= "  background-color: transparent !important;\n";
$css .= "  background-image: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  backdrop-filter: none !important;\n";
$css .= "  -webkit-backdrop-filter: none !important;\n";
$css .= "}\n";
$css .= "/* V433: The historical LoxBerry form wrapper is a pure layout wrapper.\n";
$css .= "   Its FONT placeholder and every structural descendant must never become\n";
$css .= "   a card/table surface through generic theme rules. Real controls keep\n";
$css .= "   their own component styling. */\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable),\n";
$css .= "html body.$id #page_content div.form-group:has(> font + table.formtable),\n";
$css .= "html body.$id #page_content div.form-group:has(> font + table.formtable) > font,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable,\n";
$css .= "html body.$id #page_content div.form-group:has(> font + table.formtable) > table.formtable,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > thead,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tbody,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tfoot,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > thead > tr,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tbody > tr,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tfoot > tr,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > thead > tr > th,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > thead > tr > td,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tbody > tr > th,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tbody > tr > td,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tfoot > tr > th,\n";
$css .= "html body.$id #page_content div.form-group:has(> table.formtable) > table.formtable > tfoot > tr > td {\n";
$css .= "  background: transparent !important;\n";
$css .= "  background-color: transparent !important;\n";
$css .= "  background-image: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  backdrop-filter: none !important;\n";
$css .= "  -webkit-backdrop-filter: none !important;\n";
$css .= "}\n";

# V435: Legacy plugin/system form rows are layout containers, not cards.
# Several LBv3/LBV4 pages wrap controls in fieldcontain/formtable helper DIVs.
# Generic component backgrounds must never turn those wrappers into white strips
# on light themes. Only structural wrappers are reset; controls and explicit
# components keep their own surfaces.
$css .= "/* V435: Legacy layout-row transparency invariant. */\n";
$css .= "html body.$id #page_content [data-role='fieldcontain'],\n";
$css .= "html body.$id #page_content .ui-field-contain,\n";
$css .= "html body.$id #page_content .ui-field-contain > div,\n";
$css .= "html body.$id #page_content table.formtable td > div:not(.lb-card):not(.lb-panel):not(.lb-modal):not(.lb-tooltip):not(.lb-alert),\n";
$css .= "html body.$id #page_content table.formtable th > div:not(.lb-card):not(.lb-panel):not(.lb-modal):not(.lb-tooltip):not(.lb-alert),\n";
$css .= "html body.$id #page_content div.form-group > div:not(.lb-card):not(.lb-panel):not(.lb-modal):not(.lb-tooltip):not(.lb-alert),\n";
$css .= "body.$id #page_content [data-role='fieldcontain'],\n";
$css .= "body.$id #page_content .ui-field-contain,\n";
$css .= ".$id #page_content [data-role='fieldcontain'],\n";
$css .= ".$id #page_content .ui-field-contain {\n";
$css .= "  background: transparent !important;\n";
$css .= "  background-color: transparent !important;\n";
$css .= "  background-image: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  backdrop-filter: none !important;\n";
$css .= "  -webkit-backdrop-filter: none !important;\n";
$css .= "}\n";
# V436: Many legacy plugins use additional anonymous layout tables inside the
# outer table.formtable. These nested tables are not semantic lb-table
# components; they only align labels, controls and hints. Generic table rules
# can otherwise paint them white. Reset the complete anonymous nested table
# structure while excluding explicit framework/data table components.
$css .= "/* V436: Nested legacy layout-table transparency invariant. */\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table),\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > thead,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tbody,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tfoot,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > thead > tr,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tbody > tr,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tfoot > tr,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > thead > tr > th,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > thead > tr > td,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tbody > tr > th,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tbody > tr > td,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tfoot > tr > th,\n";
$css .= "html body.$id #page_content table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) > tfoot > tr > td,\n";
$css .= "body.$id table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table),\n";
$css .= ".$id table.formtable table:not(.lb-table):not(.dataTable):not(.ui-table) {\n";
$css .= "  background: transparent !important;\n";
$css .= "  background-color: transparent !important;\n";
$css .= "  background-image: none !important;\n";
$css .= "  box-shadow: none !important;\n";
$css .= "  backdrop-filter: none !important;\n";
$css .= "  -webkit-backdrop-filter: none !important;\n";
$css .= "}\n";

$css .= "/* V435: Keep actual controls/components out of the wrapper reset. */\n";
$css .= "html body.$id #page_content [data-role='fieldcontain'] :is(input, select, textarea, button, .lb-btn, .lb-select, .lb-input, .lb-card, .lb-panel, .lb-modal, .lb-tooltip, .lb-alert),\n";
$css .= "html body.$id #page_content .ui-field-contain :is(input, select, textarea, button, .lb-btn, .lb-select, .lb-input, .lb-card, .lb-panel, .lb-modal, .lb-tooltip, .lb-alert) {\n";
$css .= "  /* component-specific rules remain authoritative */\n";
$css .= "}\n";
$css .= "/* DESIGN STUDIO LEGACY CONTENT TRANSPARENCY END */\n";

# V468: Final jQM label foreground guard. Emitted after every generated
# compatibility/layout rule so generic .ui-btn, .ui-btn-inherit and
# .ui-btn-active declarations cannot restore an unsuitable foreground.
$css .= "/* V468: FINAL JQM SWITCH LABEL FOREGROUND GUARD */\n";
$css .= "html body.$id #page_content .ui-slider-switch .ui-slider-label-a,\n";
$css .= "html body.$id #page_content .ui-slider-switch .ui-slider-label-a *,\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-a, body.$id .ui-slider-switch .ui-slider-label-a *,\n";
$css .= ".$id .ui-slider-switch .ui-slider-label-a, .$id .ui-slider-switch .ui-slider-label-a * {\n";
$css .= "  color: var(--lb-switch-on-text, var(--lb-toggle-active-text, #000000)) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-switch-on-text, var(--lb-toggle-active-text, #000000)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";
$css .= "html body.$id #page_content .ui-slider-switch .ui-slider-label-b,\n";
$css .= "html body.$id #page_content .ui-slider-switch .ui-slider-label-b *,\n";
$css .= "body.$id .ui-slider-switch .ui-slider-label-b, body.$id .ui-slider-switch .ui-slider-label-b *,\n";
$css .= ".$id .ui-slider-switch .ui-slider-label-b, .$id .ui-slider-switch .ui-slider-label-b * {\n";
$css .= "  color: var(--lb-switch-off-text, var(--lb-toggle-text, #000000)) !important;\n";
$css .= "  -webkit-text-fill-color: var(--lb-switch-off-text, var(--lb-toggle-text, #000000)) !important;\n";
$css .= "  text-shadow: none !important;\n";
$css .= "}\n";

# V489: No generated flipswitch foreground/geometry guards. Core owns them.

# V489: jQM/Core owns flipswitch state, colors and geometry. Generated themes only expose tokens.

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

# V488: Final output guard. Even if a stale block entered through an older
# persisted state, imported CSS or future merge path, it is removed before the
# transactional write.
$css = _strip_obsolete_jqm_flipswitch_css($css);

my @writes = (
    [$json_path, _pretty_json($editable)],
    ["$manifest_dir/$id.manifest.json", _pretty_json($manifest)],
    ["$theme_dir/$css_file", $css],
);

eval {
    $previous_backup = _transactional_write_files($id, [
        [$json_path, _pretty_json($editable), 'json'],
        ["$manifest_dir/$id.manifest.json", _pretty_json($manifest), 'json'],
        ["$theme_dir/$css_file", $css, 'css'],
    ]);
    1;
} or _respond('500 Internal Server Error', _error_payload('transactionalSaveFailed', 'transactionalSaveFailed', { detail => "$@" }));

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
    transactional => JSON::PP::true,
    transaction_root => '/run/shm/cssframework',
    tokens      => \%clean_tokens,
    previous_backup => $previous_backup,
    ram_backup_created => $previous_backup ne '' ? JSON::PP::true : JSON::PP::false,
    ram_backup_limit => $ram_backup_limit,
    orphan_css_deleted => scalar(@{$orphan_css_deleted || []}),
});
