#!/usr/bin/env bash
# Regenerates src/data/pixel-art.json: the Scan R1 from its FreeCAD file, and the racks.
# Usage: scripts/pixel-art/build.sh path/to/InventaScan.FCStd
# Needs FreeCAD 1.x (its bundled Python has numpy); uses the Flatpak build when there is no
# FreeCADCmd on PATH. Both paths must be readable from the Flatpak sandbox (e.g. under $HOME).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fcstd="$(realpath "$1")"
out="$here/../../src/data/pixel-art.json"
if command -v FreeCADCmd >/dev/null; then
  run=(env PIXEL_ART_FCSTD="$fcstd" PIXEL_ART_OUT="$out" FreeCADCmd)
else
  run=(flatpak run --env=PIXEL_ART_FCSTD="$fcstd" --env=PIXEL_ART_OUT="$out" --command=FreeCADCmd org.freecad.FreeCAD)
fi
"${run[@]}" "$here/build.py" 2>&1 | grep -E "wrote|Error|Traceback" || true
