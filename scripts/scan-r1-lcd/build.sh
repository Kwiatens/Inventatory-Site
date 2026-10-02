#!/usr/bin/env bash
# Regenerates src/data/scan-r1-lcd.json from the Scan R1 firmware's own display code.
# Usage: scripts/scan-r1-lcd/build.sh [path/to/Inventatory-Firmware]
# The firmware checkout needs its PlatformIO libraries installed (pio run once), for U8g2.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fw="$(cd "${1:-$here/../../../Inventatory-Firmware}" && pwd)"
u8g2="$(ls -d "$fw"/.pio/libdeps/*/U8g2/src/clib | head -n1)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
# u8g2 is C; build it once as C, then the firmware display code as C++17.
for c in "$u8g2"/*.c; do gcc -O1 -w -c "$c" -I"$u8g2" -o "$out/$(basename "$c" .c).o" & done; wait
g++ -std=gnu++17 -O1 -w \
  -I"$here/shim" -I"$fw/include" -I"$fw/src" -I"$u8g2" \
  "$here/main.cpp" "$fw/src/display/display_controller.cpp" "$fw/src/display/display_renderer.cpp" \
  "$out"/*.o -o "$out/scan-r1-lcd"
"$out/scan-r1-lcd" > "$here/../../src/data/scan-r1-lcd.json"
echo "wrote src/data/scan-r1-lcd.json from $(git -C "$fw" rev-parse --short HEAD)"
