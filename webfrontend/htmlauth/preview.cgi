#!/usr/bin/perl

use strict;
use warnings;
use utf8;

use lib "/opt/loxberry/libs/perllib";
use CGI qw(:standard);
use JSON::PP qw(decode_json);
use File::Path qw(make_path);
use LoxBerry::System;
use LoxBerry::Web;
use LoxBerry::System::General;

our ($lbpconfigdir, $lbphtmldir, $lbptemplatedir, $lbpdatadir, $lbhomedir);

my $plugin  = 'cssframework';
my $page    = 'preview';
my $cfgdir  = $lbpconfigdir   || $ENV{LBPCONFIG} || "/opt/loxberry/config/plugins/$plugin";
my $htmldir = $lbphtmldir     || $ENV{LBPHTML}   || "/opt/loxberry/webfrontend/html/plugins/$plugin";
my $tpldir  = $lbptemplatedir || $ENV{LBPTEMPL}  || "/opt/loxberry/templates/plugins/$plugin";
my $datadir = $lbpdatadir      || $ENV{LBPDATA}   || "/opt/loxberry/data/plugins/$plugin";

# V79 storage split:
# - JSON/editable Studio state is stored in config/plugins/cssframework/themes.
# - CSS/assets are stored only in data/plugins/cssframework/themes.
# - Browser delivery is handled by theme-file.cgi; no webfrontend theme mirror is used.
my $theme_json_dir = "$cfgdir/themes";
my $theme_dir      = "$datadir/themes";

sub _read_text_file {
    my ($file) = @_;
    return '' if !defined $file || !-f $file || !-r $file;
    my $fh;
    if (!open($fh, '<:encoding(UTF-8)', $file)) { return ''; }
    local $/;
    my $content = <$fh>;
    close($fh);
    return defined $content ? $content : '';
}

sub _read_json_file {
    my ($file) = @_;
    return undef if !defined $file || !-f $file || !-r $file;
    my $fh;
    if (!open($fh, '<:raw', $file)) { return undef; }
    local $/;
    my $content = <$fh>;
    close($fh);
    my $data = eval { decode_json($content) };
    return $@ ? undef : $data;
}

sub _html_escape {
    my ($value) = @_;
    $value = '' if !defined $value;
    $value =~ s/&/&amp;/g;
    $value =~ s/</&lt;/g;
    $value =~ s/>/&gt;/g;
    $value =~ s/"/&quot;/g;
    return $value;
}

sub _url_escape {
    my ($value) = @_;
    $value = '' if !defined $value;
    $value =~ s/([^A-Za-z0-9_.~-])/sprintf('%%%02X', ord($1))/ge;
    return $value;
}

sub _ensure_dir {
    my ($dir) = @_;
    return 1 if -d $dir;
    return eval { make_path($dir, { mode => 0775 }); 1 } ? 1 : 0;
}

sub _safe_theme_id {
    my ($value) = @_;
    $value = '' if !defined $value;
    return $value =~ /\Atheme-user-[a-zA-Z0-9_-]+\z/ ? $value : '';
}

sub _active_loxberry_theme_class {
    my $theme = 'soft-rounded';
    eval {
        my $jsonobj = LoxBerry::System::General->new();
        my $cfg = $jsonobj->open();
        if ($cfg && ref($cfg) eq 'HASH' && $cfg->{Base} && defined $cfg->{Base}->{Theme} && $cfg->{Base}->{Theme} ne '') {
            $theme = $cfg->{Base}->{Theme};
        }
    };
    $theme = lc($theme || 'soft-rounded');
    $theme =~ s/^\s+|\s+$//g;
    $theme =~ s/[^a-z0-9_-]//g;
    $theme = 'soft-rounded' if $theme eq '';
    $theme = 'classic-lb' if $theme eq 'classic';
    return ($theme =~ /^theme-/) ? $theme : "theme-$theme";
}

sub _theme_class_from_id {
    my ($theme_id) = @_;
    return _active_loxberry_theme_class() if !$theme_id;
    my $json = _read_json_file("$theme_json_dir/$theme_id.json");
    if (ref($json) ne 'HASH') {
        return $theme_id if -f "$theme_dir/$theme_id.css";
        return _active_loxberry_theme_class();
    }
    my $css = $json->{css} || "$theme_id.css";
    my ($class) = $css =~ /\A(theme-user-[a-zA-Z0-9_-]+)\.css\z/;
    return $class || $theme_id;
}

sub _build_theme_links {
    my @links;
    my @system_dirs = (
        '/opt/loxberry/webfrontend/html/system/css/themes',
        ($lbhomedir ? "$lbhomedir/webfrontend/html/system/css/themes" : ()),
    );
    my %seen;
    for my $dir (@system_dirs) {
        next if !$dir || $seen{$dir}++ || !-d $dir;
        for my $file (sort glob("$dir/theme-*.css")) {
            my ($name) = $file =~ m{/system/css/themes/([^/]+\.css)\z};
            next if !$name;
            push @links, qq{<link rel="stylesheet" href="/system/css/themes/} . _html_escape($name) . qq{">};
        }
    }
    for my $file (sort glob("$theme_dir/theme-user-*.css")) {
        my ($name) = $file =~ m{/themes/([^/]+\.css)\z};
        next if !$name;
        my $mtime = (stat($file))[9] || 0;
        push @links, qq{<link rel="stylesheet" href="theme-file.cgi?file=} . _html_escape(_url_escape($name)) . qq{&v=$mtime">};
    }
    return join("\n", @links);
}

sub _build_theme_classes_js {
    my %classes = ( _active_loxberry_theme_class() => 1 );
    for my $file (glob('/opt/loxberry/webfrontend/html/system/css/themes/theme-*.css'), glob("$theme_dir/theme-user-*.css")) {
        my ($class) = $file =~ m{/(theme-[a-zA-Z0-9_-]+)\.css\z};
        $classes{$class} = 1 if $class;
    }
    my @classes = sort keys %classes;
    return join(',', map { '"' . $_ . '"' } @classes);
}

my $lblang = eval { lblanguage() } || 'en';
$lblang = lc($lblang);
$lblang = 'de' if $lblang =~ /^de/;
$lblang = 'en' if $lblang !~ /^de/;

my $theme_id = _safe_theme_id(param('theme'));
my $theme_class = _theme_class_from_id($theme_id);
my $template_file = "$tpldir/themes/$page/index_$lblang.html";
$template_file = "$tpldir/themes/$page/index_en.html" if !-f $template_file;

my $html = _read_text_file($template_file);
$html =~ s/__LB_CORE_THEME_LINKS__/_build_theme_links()/ge;
$html =~ s/__LB_PLUGIN_THEME_LINKS__//g;
$html =~ s/__LB_CORE_THEME_OPTIONS__//g;
$html =~ s/__LB_PLUGIN_THEME_OPTIONS__//g;
$html =~ s/__LB_CURRENT_THEME_CLASS__/_html_escape($theme_class)/ge;
$html =~ s/__LB_THEME_CLASSES_JS__/_build_theme_classes_js()/ge;

print header(-type => 'text/html', -charset => 'UTF-8');
binmode STDOUT, ':encoding(UTF-8)';
print $html;
exit 0;
