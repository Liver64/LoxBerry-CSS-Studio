#!/bin/bash

# uninstall.sh - CSS Framework / Design Studio cleanup
# Executed when the plugin is uninstalled via the LoxBerry Plugin Manager.
# Runs as user "ROOT".
#
# Goal:
#   Remove the CSS Framework / Design Studio plugin directories as completely
#   as possible.
#
# Important:
#   This script intentionally does NOT remove or overwrite LoxBerry Core files.
#   Core patches must be handled separately.
#
# Exit codes:
#   0 = success, uninstallation continues
#   1 = warning, uninstallation continues but a warning is shown
#
# All variables from /etc/environment are available in this script.
#
# Arguments passed to this script:
#   $0 = path to this script
#   $1 = temporary folder used during uninstallation
#   $2 = plugin short name (NAME from plugin.cfg)
#   $3 = plugin installation folder (FOLDER from plugin.cfg)
#   $4 = plugin version (VERSION from plugin.cfg)
#
# Output tags for colorized uninstaller log:
#   <OK>      green  - operation successful
#   <INFO>    blue   - informational message
#   <WARNING> yellow - non-fatal warning
#   <ERROR>   red    - error
#   <FAIL>    red    - failure

COMMAND=$0      # Path to this script
PTEMPDIR=$1     # Temporary folder during uninstallation
PSHNAME=$2      # Plugin short name
PDIR=$3         # Plugin installation folder
PVERSION=$4     # Plugin version

# Fallback for unusual systems where /etc/environment variables are incomplete.
LBHOME="${LBHOMEDIR:-REPLACELBHOMEDIR}"

# Build full plugin-specific paths from environment variables.
PCGI="${LBPCGI:-$LBHOME/webfrontend/htmlauth/plugins}/$PDIR"
PHTML="${LBPHTML:-$LBHOME/webfrontend/html/plugins}/$PDIR"
PTEMPL="${LBPTEMPL:-$LBHOME/templates/plugins}/$PDIR"
PDATA="${LBPDATA:-$LBHOME/data/plugins}/$PDIR"
PLOG="${LBPLOG:-$LBHOME/log/plugins}/$PDIR"
PCONFIG="${LBPCONFIG:-$LBHOME/config/plugins}/$PDIR"
PSBIN="${LBPSBIN:-$LBHOME/sbin/plugins}/$PDIR"
PBIN="${LBPBIN:-$LBHOME/bin/plugins}/$PDIR"

echo "<INFO> Starting CSS Framework / Design Studio uninstall cleanup"
echo "<INFO> Command is: $COMMAND"
echo "<INFO> Temporary folder is: $PTEMPDIR"
echo "<INFO> Plugin short name is: $PSHNAME"
echo "<INFO> Installation folder is: $PDIR"
echo "<INFO> Plugin version is: $PVERSION"
echo "<INFO> LoxBerry home is: $LBHOME"

if [ -z "$PDIR" ]; then
    echo "<WARNING> Plugin folder argument is empty. Refusing cleanup."
    exit 1
fi

if [ "$PDIR" = "/" ] || [ "$PDIR" = "." ] || [ "$PDIR" = ".." ]; then
    echo "<WARNING> Unsafe plugin folder argument: $PDIR"
    echo "<WARNING> Refusing cleanup."
    exit 1
fi

safe_remove_dir() {
    TARGET="$1"
    LABEL="$2"

    if [ -z "$TARGET" ]; then
        echo "<WARNING> Empty target for $LABEL - skipped"
        return 0
    fi

    case "$TARGET" in
        "/"|"/opt"|"REPLACELBHOMEDIR"|"$LBHOME")
            echo "<WARNING> Unsafe directory target for $LABEL: $TARGET"
            echo "<WARNING> Directory cleanup skipped"
            return 0
            ;;
    esac

    if [ -d "$TARGET" ]; then
        echo "<INFO> Removing $LABEL"
        echo "<INFO> Path: $TARGET"

        if rm -rf "$TARGET"; then
            echo "<OK> Removed $LABEL"
        else
            echo "<WARNING> Could not remove $LABEL"
        fi
    else
        echo "<INFO> Not found, skipped $LABEL: $TARGET"
    fi

    return 0
}

echo "<INFO> Removing plugin-owned directories"

# LoxBerry normally removes plugin directories automatically.
# These explicit removals catch leftovers and make uninstall idempotent.
safe_remove_dir "$PCGI"    "plugin htmlauth/cgi directory"
safe_remove_dir "$PHTML"   "plugin public html directory"
safe_remove_dir "$PTEMPL"  "plugin template directory"
safe_remove_dir "$PDATA"   "plugin data directory including generated theme CSS/assets"
safe_remove_dir "$PCONFIG" "plugin config directory including theme JSON files"
safe_remove_dir "$PLOG"    "plugin log directory"
safe_remove_dir "$PBIN"    "plugin bin directory"
safe_remove_dir "$PSBIN"   "plugin sbin directory"

echo "<INFO> Core files intentionally left untouched"
echo "<INFO> Not modified by this uninstall script:"
echo "<INFO> - $LBHOME/libs/perllib/LoxBerry/Web.pm"
echo "<INFO> - $LBHOME/libs/perllib/LoxBerry/System.pm"
echo "<INFO> - $LBHOME/templates/system/myloxberry.html"
echo "<INFO> - $LBHOME/webfrontend/htmlauth/system/ajax/ajax-config-handler.cgi"
echo "<INFO> - $LBHOME/webfrontend/htmlauth/system/cssframework.cgi"

echo "<OK> CSS Framework / Design Studio uninstall cleanup finished"

exit 0
