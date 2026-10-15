#!/usr/bin/env bash
# Regenerates src/data/feature-icons.json: rack R1 and the Scan R1 at icon size, from CAD.
# Usage: scripts/pixel-art/icons.sh path/to/InventaScan.FCStd (as build.sh)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fcstd="$(realpath "$1")"
out="$here/../../src/data/feature-icons.json"
if command -v FreeCADCmd >/dev/null; then
  run=(env PIXEL_ART_FCSTD="$fcstd" PIXEL_ART_OUT="$out" FreeCADCmd)
else
  run=(flatpak run --env=PIXEL_ART_FCSTD="$fcstd" --env=PIXEL_ART_OUT="$out" --command=FreeCADCmd org.freecad.FreeCAD)
fi
"${run[@]}" "$here/icons.py" 2>&1 | grep -E "wrote|Error|Traceback|Assertion|line [0-9]" || true
