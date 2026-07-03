#!/bin/bash

# postupgrade.sh - Executed as the very last step when updating an already-installed plugin.
# Runs as user "loxberry" AFTER postinstall.sh, only during updates (not on fresh install).
# Use this to restore user data saved by preupgrade.sh, or to run any migration logic
# needed when upgrading from an older plugin version.
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
# Do not change this path, because preupgrade.sh/rollback logic relies on it.
BACKUP_BASE="/tmp/${PTEMPDIR}_upgrade"

# LBHOMEDIR should come from /etc/environment.
# Fallback is only used for safety on unusual systems.
LBHOME="${LBHOMEDIR:-REPLACELBHOMEDIR}"

THEME_MASTER="$PDATA/themes"
THEME_PUBLIC="$PHTML/themes"
LEGACY_CONFIG_THEMES="$PCONFIG/themes"
LEGACY_PUBLIC_THEMES="$BACKUP_BASE/webfrontend/html/plugins/$PDIR/themes"

# Safety switch:
# By default, only persistent user data is restored.
# Restoring package files would overwrite the freshly installed upgrade files.
# Set RESTORE_PACKAGE_FILES=1 manually only for a controlled rollback-style restore.
RESTORE_PACKAGE_FILES="${RESTORE_PACKAGE_FILES:-0}"

echo "<INFO> Starting post-upgrade restore for plugin folder: $PDIR"
echo "<INFO> Plugin short name: $PSHNAME"
echo "<INFO> Plugin version: $PVERSION"
echo "<INFO> Backup base path: $BACKUP_BASE"
echo "<INFO> Theme master folder: $THEME_MASTER"
echo "<INFO> Theme public mirror: $THEME_PUBLIC"

if [ ! -d "$BACKUP_BASE" ]; then
    echo "<WARNING> Backup base path does not exist: $BACKUP_BASE"
    echo "<WARNING> Nothing to restore"
    exit 0
fi

restore_dir() {
    SRC="$1"
    DST="$2"
    LABEL="$3"

    if [ -d "$SRC" ]; then
        echo "<INFO> Restoring $LABEL"
        echo "<INFO> Source: $SRC"
        echo "<INFO> Target: $DST"

        mkdir -p "$DST"

        if cp -p -v -r "$SRC"/. "$DST"/; then
            echo "<OK> Restore completed: $LABEL"
        else
            echo "<WARNING> Restore failed: $LABEL"
        fi

        echo "<INFO> Finished restore step: $LABEL"
        return 0
    fi

    echo "<INFO> Skipping missing backup folder: $SRC"
    echo "<INFO> Restore skipped: $LABEL"
    echo "<INFO> Finished restore step: $LABEL"
    return 0
}

restore_data_without_docs() {
    SRC="$1"
    DST="$2"
    LABEL="$3"

    if [ ! -d "$SRC" ]; then
        echo "<INFO> Skipping missing backup folder: $SRC"
        echo "<INFO> Restore skipped: $LABEL"
        echo "<INFO> Finished restore step: $LABEL"
        return 0
    fi

    echo "<INFO> Restoring $LABEL"
    echo "<INFO> Source: $SRC"
    echo "<INFO> Target: $DST"
    echo "<INFO> Documentation folder 'docs' is not restored to keep the upgraded documentation"

    mkdir -p "$DST"

    FAILED=0
    COPIED=0

    for ITEM in "$SRC"/* "$SRC"/.[!.]* "$SRC"/..?*; do
        [ -e "$ITEM" ] || continue

        NAME="$(basename "$ITEM")"

        if [ "$NAME" = "docs" ]; then
            echo "<INFO> Skipping upgraded documentation folder: $ITEM"
            continue
        fi

        if cp -p -v -r "$ITEM" "$DST"/; then
            COPIED=1
        else
            FAILED=1
        fi
    done

    if [ "$FAILED" -eq 0 ]; then
        echo "<OK> Restore completed: $LABEL"
    else
        echo "<WARNING> Restore finished with warnings: $LABEL"
    fi

    if [ "$COPIED" -eq 0 ]; then
        echo "<INFO> No user data files restored for: $LABEL"
    fi

    echo "<INFO> Finished restore step: $LABEL"
    return 0
}

keep_backup_only() {
    SRC="$1"
    LABEL="$2"

    if [ -d "$SRC" ]; then
        echo "<INFO> Backup available for $LABEL"
        echo "<INFO> Backup path: $SRC"
        echo "<INFO> Automatic restore skipped: $LABEL"
        echo "<INFO> Reason: Restoring this folder would overwrite freshly installed upgrade files"
    else
        echo "<INFO> No backup found for $LABEL"
        echo "<INFO> Backup path missing: $SRC"
    fi

    echo "<INFO> Finished restore step: $LABEL"
    return 0
}

migrate_legacy_config_theme_json() {
    echo "<INFO> Migrating legacy config theme JSON files"
    echo "<INFO> Legacy source: $LEGACY_CONFIG_THEMES"
    echo "<INFO> Theme master: $THEME_MASTER"

    mkdir -p "$THEME_MASTER"

    if [ ! -d "$LEGACY_CONFIG_THEMES" ]; then
        echo "<INFO> No legacy config theme folder found"
        echo "<INFO> Finished migration step: legacy config theme JSON files"
        return 0
    fi

    FOUND=0
    find "$LEGACY_CONFIG_THEMES" -maxdepth 1 -type f -name 'theme-user-*.json' -print | while IFS= read -r JSONFILE; do
        FOUND=1
        BASENAME="$(basename "$JSONFILE")"
        TARGET="$THEME_MASTER/$BASENAME"
        if [ -f "$TARGET" ]; then
            echo "<INFO> Keeping existing data theme JSON: $BASENAME"
        elif cp -p "$JSONFILE" "$TARGET"; then
            echo "<OK> Migrated theme JSON to data: $BASENAME"
        else
            echo "<WARNING> Could not migrate theme JSON: $BASENAME"
        fi
    done

    echo "<INFO> Finished migration step: legacy config theme JSON files"
    return 0
}

migrate_legacy_public_themes() {
    echo "<INFO> Migrating legacy public themes into data master"
    echo "<INFO> Legacy source: $LEGACY_PUBLIC_THEMES"
    echo "<INFO> Theme master: $THEME_MASTER"

    mkdir -p "$THEME_MASTER"

    if [ ! -d "$LEGACY_PUBLIC_THEMES" ]; then
        echo "<INFO> No legacy public theme folder found"
        echo "<INFO> Finished migration step: legacy public themes"
        return 0
    fi

    find "$LEGACY_PUBLIC_THEMES" -maxdepth 1 -type f -name '*.css' -print | while IFS= read -r CSSFILE; do
        BASENAME="$(basename "$CSSFILE")"
        TARGET="$THEME_MASTER/$BASENAME"
        if [ -f "$TARGET" ]; then
            echo "<INFO> Keeping existing data theme CSS: $BASENAME"
        elif cp -p "$CSSFILE" "$TARGET"; then
            echo "<OK> Migrated legacy theme CSS to data: $BASENAME"
        else
            echo "<WARNING> Could not migrate legacy theme CSS: $BASENAME"
        fi
    done

    if [ -d "$LEGACY_PUBLIC_THEMES/assets" ]; then
        mkdir -p "$THEME_MASTER/assets"
        if cp -p -r -n "$LEGACY_PUBLIC_THEMES/assets/." "$THEME_MASTER/assets/"; then
            echo "<OK> Migrated legacy theme assets to data"
        else
            echo "<WARNING> Legacy theme asset migration finished with warnings"
        fi
    else
        echo "<INFO> No legacy public theme assets found"
    fi

    echo "<INFO> Finished migration step: legacy public themes"
    return 0
}

publish_theme_mirror() {
    MASTER="$1"
    PUBLIC="$2"

    echo "<INFO> Publishing theme master to public mirror"
    echo "<INFO> Theme master: $MASTER"
    echo "<INFO> Theme public: $PUBLIC"

    mkdir -p "$PUBLIC"

    if [ ! -d "$MASTER" ]; then
        echo "<INFO> Theme master missing, mirror skipped"
        echo "<INFO> Finished publish step: theme mirror"
        return 0
    fi

    find "$MASTER" -maxdepth 1 -type f -name '*.css' -print | while IFS= read -r CSSFILE; do
        BASENAME="$(basename "$CSSFILE")"
        if cp -p "$CSSFILE" "$PUBLIC/$BASENAME"; then
            echo "<OK> Published theme CSS: $BASENAME"
        else
            echo "<WARNING> Could not publish theme CSS: $BASENAME"
        fi
    done

    if [ -d "$MASTER/assets" ]; then
        mkdir -p "$PUBLIC/assets"
        if cp -p -r "$MASTER/assets/." "$PUBLIC/assets/"; then
            echo "<OK> Published theme assets"
        else
            echo "<WARNING> Theme asset publishing finished with warnings"
        fi
    else
        echo "<INFO> No theme assets folder found"
    fi

    echo "<INFO> Finished publish step: theme mirror"
    return 0
}

echo "<INFO> Restoring persistent CSS Framework / Design Studio data"

# Restore plugin configuration.
# Backup source:
#   /tmp/<PTEMPDIR>_upgrade/config/<PDIR>/
# Restore target:
#   $LBPCONFIG/<PDIR>/
restore_dir "$BACKUP_BASE/config/$PDIR" \
            "$PCONFIG" \
            "plugin configuration"

# Restore plugin data, but keep upgraded documentation.
# Backup source:
#   /tmp/<PTEMPDIR>_upgrade/data/<PDIR>/
# Restore target:
#   $LBPDATA/<PDIR>/
restore_data_without_docs "$BACKUP_BASE/data/$PDIR" \
                          "$PDATA" \
                          "plugin data"

echo "<INFO> Migrating theme storage to data/plugins/$PDIR/themes"
migrate_legacy_config_theme_json
migrate_legacy_public_themes
publish_theme_mirror "$THEME_MASTER" "$THEME_PUBLIC"

if [ -d "$THEME_MASTER" ]; then
    chown -R loxberry:loxberry "$THEME_MASTER" 2>/dev/null || true
    chmod -R u+rwX,g+rwX "$THEME_MASTER" 2>/dev/null || true
fi

if [ -d "$THEME_PUBLIC" ]; then
    chown -R loxberry:loxberry "$THEME_PUBLIC" 2>/dev/null || true
    chmod -R u+rwX,g+rwX "$THEME_PUBLIC" 2>/dev/null || true
fi

echo "<INFO> Handling package file backups"

if [ "$RESTORE_PACKAGE_FILES" = "1" ]; then
    echo "<WARNING> RESTORE_PACKAGE_FILES=1 is active"
    echo "<WARNING> Package files will be restored from backup and may overwrite the upgraded version"

    restore_dir "$BACKUP_BASE/webfrontend/html/plugins/$PDIR" \
                "$PHTML" \
                "public webfrontend"

    restore_dir "$BACKUP_BASE/webfrontend/htmlauth/plugins/$PDIR" \
                "$PCGI" \
                "authenticated webfrontend"

    restore_dir "$BACKUP_BASE/templates/plugins/$PDIR" \
                "$PTEMPL" \
                "plugin templates"

    restore_dir "$BACKUP_BASE/bin/plugins/$PDIR" \
                "$PBIN" \
                "plugin bin files"

    restore_dir "$BACKUP_BASE/sbin/plugins/$PDIR" \
                "$PSBIN" \
                "plugin sbin files"

    restore_dir "$BACKUP_BASE/templates/system/themes/help" \
                "$LBHOME/templates/system/themes/help" \
                "system theme help pages"
else
    keep_backup_only "$BACKUP_BASE/webfrontend/html/plugins/$PDIR" \
                     "public webfrontend"

    keep_backup_only "$BACKUP_BASE/webfrontend/htmlauth/plugins/$PDIR" \
                     "authenticated webfrontend"

    keep_backup_only "$BACKUP_BASE/templates/plugins/$PDIR" \
                     "plugin templates"

    keep_backup_only "$BACKUP_BASE/bin/plugins/$PDIR" \
                     "plugin bin files"

    keep_backup_only "$BACKUP_BASE/sbin/plugins/$PDIR" \
                     "plugin sbin files"

    keep_backup_only "$BACKUP_BASE/templates/system/themes/help" \
                     "system theme help pages"
fi

echo "<OK> Post-upgrade restore finished"
echo "<INFO> Backup remains available in: $BACKUP_BASE"

# Exit with Status 0
exit 0
