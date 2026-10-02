#!/usr/bin/env bash
# Regenerates src/data/pixel-fonts.json from U8g2's bitmap fonts (the Scan R1 firmware's copy).
# Usage: scripts/pixel-font/build.sh [path/to/Inventatory-Firmware]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fw="$(cd "${1:-$here/../../../Inventatory-Firmware}" && pwd)"
u8g2="$(ls -d "$fw"/.pio/libdeps/*/U8g2/src/clib | head -n1)"
out="$(mktemp -d)"; trap 'rm -rf "$out"' EXIT
gcc -O1 -w -I"$u8g2" "$here/dump.c" "$u8g2"/*.c -o "$out/dump"
"$out/dump" > "$here/../../src/data/pixel-fonts.json"
echo "wrote src/data/pixel-fonts.json"
