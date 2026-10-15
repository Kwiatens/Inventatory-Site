"""Builds src/data/feature-icons.json: rack R1 and the Scan R1 from CAD at icon size (27 px box), for
the homepage's feature list. Run with FreeCAD's Python (see icons.sh), with PIXEL_ART_FCSTD
(the Scan R1 FreeCAD file) and PIXEL_ART_OUT set."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scan_r1, rack
from pixelize import despeckle

out = {}

# Rack R1 from straight above, row A at the bottom, column 1 on the left, filled the way the
# film leaves it: A1-A5, B1-B4, C1-C3, D1. A render at this size runs the caps' lit rims across
# the 0.5 px web between holes, so the rack reads as a lattice of crosses. It is laid out from the
# model's measurements instead: at 27 px across the 81 mm plate the 15 mm pitch is exactly 5 px and
# the 3 mm margin 1 px; holes (13.4 mm) and caps (12.6 mm) are both 4 px circles, lit from the top
# left as the renders are. B3 is tagged, for the page to light it.
FILLED = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "D1"]
S = 27 / rack.SIDE
assert abs(rack.PITCH * S - 5) < 1e-9 and abs(rack.MARGIN * S - 1) < 1e-9
assert round(2 * (rack.CAP_R + .4) * S) == round(2 * rack.CAP_R * S) == 4
HOLE = [".44.", "4444", "4444", ".44."]
CAP = [".cc.", "cbbb", "bbba", ".aa."]
plate = [["7"] * 27 for _ in range(27)]
for x, y in ((0, 0), (26, 0), (0, 26), (26, 26)): plate[y][x] = "."
tags = {}
for r in range(5):
    for c in range(5):
        slot = rack.ROWS[r] + str(c + 1)
        x0, y0 = 1 + 5 * c, 1 + 5 * (4 - r)
        art = CAP if slot in FILLED else HOLE
        for dy, row in enumerate(art):
            for dx, ch in enumerate(row):
                if ch == ".": continue
                plate[y0 + dy][x0 + dx] = "." if ch == "4" else ch
                if slot == "B3": tags.setdefault("slot-1B3", []).append([x0 + dx, y0 + dy])
out["rack"] = {"width": 27, "height": 27, "rows": ["".join(r) for r in plate], "tags": tags}

# The Scan R1 face-on, square to its keypad. At 27 px tall (the icon box) the shell and the LCD window render
# cleanly, but a 4 x 4 keypad does not fit as pixels (keys alias into a smear). So the keys are
# measured instead, from a large render on the same framing: the keypad's centre and its pitch
# across and down. Snapping each key on its own spaces the columns unevenly (3, 2, 3), which reads
# as a fault on a keypad that is a regular grid; so the keys are a regular grid at the measured
# pitch rounded to whole pixels, each key the pitch less a one-pixel gap (2 x 1: the real keys
# are wider than tall), centred where the real keypad is.
scanner, _ = scan_r1.build(os.environ["PIXEL_ART_FCSTD"])
AZ, EL = 90, 58
small = scanner.render(AZ, EL, 15)
big = scanner.render(AZ, EL, 15 * 16, bounds=small["bounds"])
k = small["width"] / big["width"]
rows = [list(r) for r in despeckle(small["rows"])]
keys = {t: c for t, c in big["tags"].items() if t.startswith("key-")}
assert len(keys) == 16, sorted(keys)
for y, row in enumerate(rows):                      # the recess, keys and all
    for x, ch in enumerate(row):
        if ch in "kK": row[x] = "4"
centres = [(sum(c[0] + .5 for c in cells) / len(cells) * k, sum(c[1] + .5 for c in cells) / len(cells) * k)
           for cells in keys.values()]
xs, ys = sorted(c[0] for c in centres), sorted(c[1] for c in centres)
mx, my = sum(xs) / 16, sum(ys) / 16
px, py = max(2, round((xs[-1] - xs[0]) / 3)), max(2, round((ys[-1] - ys[0]) / 3))
x0, y0 = round(mx - (4 * px - 1) / 2), round(my - (4 * py - 1) / 2)
for i in range(4):
    for j in range(4):
        for dx in range(px - 1):
            for dy in range(py - 1):
                x, y = x0 + i * px + dx, y0 + j * py + dy
                assert rows[y][x] == "4", (x, y, rows[y][x])
                rows[y][x] = "K"
small["rows"] = ["".join(r) for r in rows if "".join(r).strip(".")]
small["height"] = len(small["rows"])
small["tags"] = {}
out["scanner"] = small

for v in out.values():
    v.pop("bounds", None)
with open(os.environ["PIXEL_ART_OUT"], "w") as f:
    json.dump(out, f, indent=1)
print("wrote", os.environ["PIXEL_ART_OUT"])
