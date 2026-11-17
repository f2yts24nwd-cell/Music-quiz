#!/bin/sh
# Neue Version setzen, damit installierte Apps das Update laden: ./bump-version.sh 2026.11.18-1
V="$1"; [ -z "$V" ] && { echo "Version angeben"; exit 1; }
sed -i -E "s/\?v=[^\"]*\"/?v=$V\"/g; s/window\.APP_V=\"[^\"]*\"/window.APP_V=\"$V\"/" index.html
printf '{"v":"%s"}\n' "$V" > version.json
