#!/bin/bash

# preupgrade.sh - Executed as the first step when updating an already-installed plugin.
# Runs as user "loxberry" BEFORE preinstall.sh, only during updates (not on fresh install).
# Use this to preserve existing user data before new files overwrite them,
# e.g. copy config files to /tmp so postinstall.sh or postupgrade.sh can restore them.
# Use with caution - remember that all target systems may differ.
#
# Exit codes:
#   0 = success, installation continues
#   1 = warning, installation continues but a warning is shown
#   2 = error, installation is cancelled
#
# All variables from /etc/environment are available in this script.
#
# Arguments passed to this script:
#   $0 = path to this script
#   $1 = temporary folder used during installation (short form)
#   $2 = plugin short name (NAME from plugin.cfg, used for scripts/cron)
#   $3 = plugin installation folder (FOLDER from plugin.cfg, may have 01/02 suffix)
#   $4 = plugin version (VERSION from plugin.cfg)
#   $5 = (unused, was LBHOMEDIR - now comes from /etc/environment)
#   $6 = full temporary path during installation
#
# Output tags for colorized installer log:
#   <OK>      green  - operation successful
#   <INFO>    blue   - informational message
#   <WARNING> yellow - non-fatal warning
#   <ERROR>   red    - error (combined with exit 2 to cancel)
#   <FAIL>    red    - failure

COMMAND=$0      # Path to this script
PTEMPDIR=$1     # Temporary folder (short) during installation
PSHNAME=$2      # Plugin short name for scripts/cron
PDIR=$3         # Plugin installation folder
PVERSION=$4     # Plugin version
# $5 unused - LBHOMEDIR now comes from /etc/environment
PTEMPPATH=$6    # Full temporary path during installation

# Build full plugin-specific paths from environment variables
PCGI=$LBPCGI/$PDIR
PHTML=$LBPHTML/$PDIR
PTEMPL=$LBPTEMPL/$PDIR
PDATA=$LBPDATA/$PDIR
PLOG=$LBPLOG/$PDIR       # Stored on a RAM disk - not persistent across reboots!
PCONFIG=$LBPCONFIG/$PDIR
PSBIN=$LBPSBIN/$PDIR
PBIN=$LBPBIN/$PDIR

# Keep the historical backup base path.
# Do not change this path, because postupgrade.sh/rollback logic may rely on it.
BACKUP_BASE="/tmp/${PTEMPDIR}_upgrade"

# LBHOMEDIR should come from /etc/environment.
# Fallback is only used for safety on unusual systems.
LBHOME="${LBHOMEDIR:-REPLACELBHOMEDIR}"

echo "<INFO> Starting pre-upgrade backup for plugin folder: $PDIR"
echo "<INFO> Plugin short name: $PSHNAME"
echo "<INFO> Plugin version: $PVERSION"
echo "<INFO> Backup base path: $BACKUP_BASE"

echo "<INFO> Creating temporary folders for upgrading"

mkdir -p "$BACKUP_BASE"
mkdir -p "$BACKUP_BASE/config"
mkdir -p "$BACKUP_BASE/data"
mkdir -p "$BACKUP_BASE/webfrontend/html/plugins"
mkdir -p "$BACKUP_BASE/webfrontend/htmlauth/plugins"
mkdir -p "$BACKUP_BASE/templates/plugins"
mkdir -p "$BACKUP_BASE/templates/system/themes"
mkdir -p "$BACKUP_BASE/bin/plugins"
mkdir -p "$BACKUP_BASE/sbin/plugins"

echo "<OK> Temporary backup folders created"

backup_dir() {
    SRC="$1"
    DST="$2"
    LABEL="$3"

    if [ -d "$SRC" ]; then
        echo "<INFO> Backing up $LABEL"
        echo "<INFO> Source: $SRC"
        echo "<INFO> Target: $DST"

        mkdir -p "$DST"

        if cp -p -v -r "$SRC" "$DST"; then
            echo "<OK> Backup completed: $LABEL"
        else
            echo "<WARNING> Backup failed: $LABEL"
        fi

        echo "<INFO> Finished backup step: $LABEL"
        return 0
    fi

    echo "<INFO> Skipping missing folder: $SRC"
    echo "<INFO> Backup skipped: $LABEL"
    echo "<INFO> Finished backup step: $LABEL"
    return 0
}

echo "<INFO> Backing up existing CSS Framework / Design Studio files"

# Keep existing backup path:
# Result: /tmp/<PTEMPDIR>_upgrade/config/<PDIR>/
backup_dir "$PCONFIG" \
           "$BACKUP_BASE/config" \
           "plugin configuration"

# Plugin data, including docs and plugin-managed assets:
# Result: /tmp/<PTEMPDIR>_upgrade/data/<PDIR>/
backup_dir "$PDATA" \
           "$BACKUP_BASE/data" \
           "plugin data"

# Public webfrontend:
# Result: /tmp/<PTEMPDIR>_upgrade/webfrontend/html/plugins/<PDIR>/
backup_dir "$PHTML" \
           "$BACKUP_BASE/webfrontend/html/plugins" \
           "public webfrontend"

# Authenticated webfrontend / CGI:
# Result: /tmp/<PTEMPDIR>_upgrade/webfrontend/htmlauth/plugins/<PDIR>/
backup_dir "$PCGI" \
           "$BACKUP_BASE/webfrontend/htmlauth/plugins" \
           "authenticated webfrontend"

# Plugin templates:
# Result: /tmp/<PTEMPDIR>_upgrade/templates/plugins/<PDIR>/
backup_dir "$PTEMPL" \
           "$BACKUP_BASE/templates/plugins" \
           "plugin templates"

# Plugin bin files:
# Result: /tmp/<PTEMPDIR>_upgrade/bin/plugins/<PDIR>/
backup_dir "$PBIN" \
           "$BACKUP_BASE/bin/plugins" \
           "plugin bin files"

# Plugin sbin files:
# Result: /tmp/<PTEMPDIR>_upgrade/sbin/plugins/<PDIR>/
backup_dir "$PSBIN" \
           "$BACKUP_BASE/sbin/plugins" \
           "plugin sbin files"

# CSS Framework / Design Studio help pages.
# Important: This is outside templates/plugins/<PDIR>.
# Result: /tmp/<PTEMPDIR>_upgrade/templates/system/themes/help/
backup_dir "$LBHOME/templates/system/themes/help" \
           "$BACKUP_BASE/templates/system/themes" \
           "system theme help pages"

echo "<OK> Pre-upgrade backup finished"
echo "<INFO> Backup stored in: $BACKUP_BASE"

# Exit with Status 0
exit 0