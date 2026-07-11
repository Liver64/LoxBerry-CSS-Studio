package CSSFramework::CoreFiles;
use strict;
use warnings;
use JSON::PP qw(decode_json);
use File::Basename qw(dirname basename);
use Exporter 'import';
our @EXPORT_OK = qw(scan_core_files parse_css_tokens);

sub _read_file {
    my ($path) = @_;
    return undef if !$path || !-f $path || !-r $path;
    open(my $fh, '<:encoding(UTF-8)', $path) or return undef;
    local $/;
    my $content = <$fh>;
    close($fh);
    return $content;
}

sub parse_css_tokens {
    my ($css) = @_;
    my %tokens;
    return \%tokens if !defined $css;
    while ($css =~ /(--lb-[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)\s*;/g) {
        my $name = $1;
        my $value = $2;
        $value =~ s/^\s+|\s+$//g;
        next if $value eq '';
        $tokens{$name} = $value;
    }
    return \%tokens;
}

sub _read_manifest {
    my ($file) = @_;
    my $content = _read_file($file);
    return undef if !defined $content;
    my $json = eval { decode_json($content) };
    return undef if $@ || ref($json) ne 'HASH';
    $json->{_source_file} = $file;
    return $json;
}

sub scan_core_files {
    my ($opts) = @_;
    $opts ||= {};
    my $lbhtml = $opts->{lbhtml} || $ENV{LBHTML} || 'REPLACELBHOMEDIR/webfrontend/html';
    my $system_css_dir = $lbhtml . '/system/css';

    my %wanted = (
        design_tokens => $system_css_dir . '/design-tokens.css',
        components    => $system_css_dir . '/components.css',
        utilities     => $system_css_dir . '/utilities.css',
    );

    my %result = (
        base_dir       => $system_css_dir,
        files          => {},
        tokens         => {},
        tokens_by_file => {},
        themes         => [],
        manifests      => [],
        missing        => [],
    );

    for my $key (sort keys %wanted) {
        my $path = $wanted{$key};
        $result{files}{$key} = $path;
        my $css = _read_file($path);
        if (!defined $css) {
            push @{$result{missing}}, $path;
            next;
        }
        my $tokens = parse_css_tokens($css);
        $result{tokens_by_file}{$key} = $tokens;
        for my $name (keys %{$tokens}) {
            $result{tokens}{$name} = $tokens->{$name};
        }
    }

    for my $theme_css (glob($system_css_dir . '/themes/*.css')) {
        my $css = _read_file($theme_css);
        push @{$result{themes}}, {
            file   => $theme_css,
            name   => basename($theme_css),
            tokens => defined $css ? parse_css_tokens($css) : {},
        };
    }

    for my $pattern (
        $system_css_dir . '/themes/*.manifest.json',
        $system_css_dir . '/themes/*.json',
        dirname($system_css_dir) . '/cssframework/manifests/*.json'
    ) {
        for my $manifest_file (glob($pattern)) {
            my $manifest = _read_manifest($manifest_file);
            push @{$result{manifests}}, $manifest if defined $manifest;
        }
    }

    return \%result;
}

1;
