#!/bin/bash
# postinstall.sh - Executed after all plugin files have been copied.
# Based on LoxBerry-Plugin-SamplePlugin-V4 conventions.

COMMAND=$0
PTEMPDIR=$1
PSHNAME=$2
PDIR=$3
PVERSION=$4
PTEMPPATH=$6

PCGI=$LBPCGI/$PDIR
PHTML=$LBPHTML/$PDIR
PTEMPL=$LBPTEMPL/$PDIR
PDATA=$LBPDATA/$PDIR
PLOG=$LBPLOG/$PDIR
PCONFIG=$LBPCONFIG/$PDIR

THEME_MASTER="$PDATA/themes"
THEME_PUBLIC="$PHTML/themes"

printf "<INFO> CSS Framework Design Studio postinstall\n"
printf "<INFO> Plugin short name: %s\n" "$PSHNAME"
printf "<INFO> Plugin folder: %s\n" "$PDIR"
printf "<INFO> Plugin version: %s\n" "$PVERSION"
printf "<INFO> CGI folder: %s\n" "$PCGI"
printf "<INFO> HTML folder: %s\n" "$PHTML"
printf "<INFO> Config folder: %s\n" "$PCONFIG"
printf "<INFO> Data folder: %s\n" "$PDATA"
printf "<INFO> Theme master folder: %s\n" "$THEME_MASTER"
printf "<INFO> Theme public mirror: %s\n" "$THEME_PUBLIC"

publish_theme_mirror() {
  MASTER="$1"
  PUBLIC="$2"

  echo "<INFO> Publishing theme mirror"
  echo "<INFO> Theme master: $MASTER"
  echo "<INFO> Theme public: $PUBLIC"

  mkdir -p "$PUBLIC"

  if [ ! -d "$MASTER" ]; then
    echo "<INFO> Theme master missing, mirror skipped"
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
      echo "<WARNING> Could not publish theme assets"
    fi
  else
    echo "<INFO> No theme assets folder found"
  fi

  return 0
}

mkdir -p "$PCONFIG/manifests" \
         "$THEME_MASTER/assets/images" \
         "$THEME_MASTER/assets/icons" \
         "$THEME_MASTER/assets/fonts" \
         "$THEME_MASTER/assets/options" \
         "$PDATA/docs" \
         "$THEME_PUBLIC"

if [ -d "$PCGI" ]; then
  find "$PCGI" -type f -name '*.cgi' -exec chmod 0755 {} \;
  find "$PCGI" -type f -name '*.pm' -exec chmod 0644 {} \;
fi

publish_theme_mirror "$THEME_MASTER" "$THEME_PUBLIC"

if [ -d "$PCONFIG" ]; then
  chown -R loxberry:loxberry "$PCONFIG" 2>/dev/null || true
  chmod -R u+rwX,g+rwX "$PCONFIG" 2>/dev/null || true
fi

if [ -d "$THEME_MASTER" ]; then
  chown -R loxberry:loxberry "$THEME_MASTER" 2>/dev/null || true
  chmod -R u+rwX,g+rwX "$THEME_MASTER" 2>/dev/null || true
fi

if [ -d "$THEME_PUBLIC" ]; then
  chown -R loxberry:loxberry "$THEME_PUBLIC" 2>/dev/null || true
  chmod -R u+rwX,g+rwX "$THEME_PUBLIC" 2>/dev/null || true
fi

printf "<OK> CSS Framework Design Studio postinstall completed\n"
exit 0
