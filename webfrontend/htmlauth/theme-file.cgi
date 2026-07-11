#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "REPLACELBHOMEDIR/libs/perllib";
use CGI qw(:standard);
use Cwd qw(abs_path);
use File::Basename qw(dirname);
use POSIX qw(strftime);
use LoxBerry::System;
use LoxBerry::Web;

our ($lbpdatadir);


sub _plugin_dir {
    my ($candidate, $fallback_base, $plugin_name) = @_;
    $plugin_name ||= 'cssframework';
    $candidate = '' if !defined $candidate;
    $candidate =~ s{/+$}{};

    if ($candidate ne '') {
        return $candidate if $candidate =~ m{(?:^|/)\Q$plugin_name\E\z};
        return "$candidate/$plugin_name";
    }

    $fallback_base ||= '';
    $fallback_base =~ s{/+$}{};
    return "$fallback_base/$plugin_name";
}

my $plugin  = 'cssframework';
my $datadir = _plugin_dir($lbpdatadir || $ENV{LBPDATA}, 'REPLACELBHOMEDIR/data/plugins', $plugin);
my $theme_dir = "$datadir/themes";

sub _respond_text {
    my ($status, $message) = @_;
    print header(-type => 'text/plain', -charset => 'utf-8', -status => $status);
    print $message;
    exit;
}

sub _mime_type {
    my ($file) = @_;
    return 'text/css; charset=utf-8' if $file =~ /\.css\z/i;
    return 'image/png'              if $file =~ /\.png\z/i;
    return 'image/jpeg'             if $file =~ /\.jpe?g\z/i;
    return 'image/gif'              if $file =~ /\.gif\z/i;
    return 'image/webp'             if $file =~ /\.webp\z/i;
    return 'image/svg+xml'          if $file =~ /\.svg\z/i;
    return 'image/x-icon'           if $file =~ /\.ico\z/i;
    return 'font/woff'              if $file =~ /\.woff\z/i;
    return 'font/woff2'             if $file =~ /\.woff2\z/i;
    return 'application/octet-stream';
}

sub _is_allowed_relative_file {
    my ($file) = @_;
    return 0 if !defined $file || $file eq '';
    return 0 if $file =~ m{\A/};
    return 0 if $file =~ m{(?:\A|/)\.\.(?:/|\z)};
    return 0 if $file =~ m{(?:\A|/)\.};
    return 0 if $file =~ /\\/;
    return 0 if $file !~ /\A[A-Za-z0-9_\.\-\/]+\z/;

    return 1 if $file =~ /\Atheme-user-[A-Za-z0-9_-]+\.css\z/;
    return 1 if $file =~ /\Aassets\/[A-Za-z0-9_\.\-\/]+\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|css)\z/i;
    return 0;
}

# Accept both forms:
#   theme-file.cgi?file=theme-user-example.css
#   theme-file.cgi/theme-user-example.css
# PATH_INFO is preferred for Core theme injection because head templates may append
# their own cache buster. Relative asset URLs inside the generated CSS also keep
# working with the PATH_INFO form.
my $file = param('file');
if (!defined $file || $file eq '') {
    $file = $ENV{PATH_INFO} || '';
    $file =~ s{^/+}{};
}
$file = '' if !defined $file;
$file =~ s/^\s+|\s+$//g;
$file =~ s/[?&].*\z//;

_respond_text('400 Bad Request', 'Missing or invalid file parameter') if !_is_allowed_relative_file($file);

my $root_abs = abs_path($theme_dir);
_respond_text('404 Not Found', 'Theme data folder not found') if !$root_abs || !-d $root_abs;

my $path = "$theme_dir/$file";
my $dir_abs = abs_path(dirname($path));
_respond_text('404 Not Found', 'File not found') if !$dir_abs;
_respond_text('403 Forbidden', 'Forbidden') if index($dir_abs, $root_abs) != 0;
_respond_text('404 Not Found', 'File not found') if !-f $path || !-r $path;

my $mime = _mime_type($file);
my $mtime = (stat($path))[9] || time;
my $size = -s $path;

# V138: User theme CSS is edited in the Design Studio and must become visible
# immediately after saving/switching themes. Do not allow the browser to keep a
# fresh cached CSS copy for several minutes; this caused changes to appear only
# after Ctrl+F5 in plugin pages.
my @cache_headers;
if ($file =~ /\.css\z/i) {
    @cache_headers = (
        -Cache_Control => 'no-store, no-cache, must-revalidate, max-age=0',
        -Pragma        => 'no-cache',
        -Expires       => 'Thu, 01 Jan 1970 00:00:00 GMT',
        -ETag          => '"' . $mtime . '-' . $size . '"',
    );
} else {
    # Assets may still be cached shortly; changed URLs/filenames are expected for
    # generated assets. Keep Last-Modified for browser revalidation.
    @cache_headers = (
        -Cache_Control => 'private, max-age=300',
    );
}

print header(
    -type           => $mime,
    -status         => '200 OK',
    -Content_Length => $size,
    -Last_Modified  => strftime('%a, %d %b %Y %H:%M:%S GMT', gmtime($mtime)),
    @cache_headers,
);

open(my $fh, '<', $path) or _respond_text('404 Not Found', 'File not readable');
binmode $fh;
binmode STDOUT;
my $buffer;
while (read($fh, $buffer, 8192)) {
    print $buffer;
}
close($fh);

exit 0;
