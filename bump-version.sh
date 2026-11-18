#!/bin/sh
# Neue Version setzen, damit installierte Apps das Update laden: ./bump-version.sh 2026.11.18-1
V="$1"
printf '%s' "$V" | grep -Eq '^[0-9A-Za-z._-]+$' || { echo "Version angeben (nur Ziffern, Buchstaben, . _ -)"; exit 1; }
sed -i -E "s/\?v=[^\"]*\"/?v=$V\"/g" index.html
printf '{"v":"%s"}\n' "$V" > version.json
