"""Builds src/data/pixel-art.json. Run with FreeCAD's Python, e.g.
  flatpak run --command=FreeCADCmd org.freecad.FreeCAD scripts/pixel-art/build.py
with PIXEL_ART_FCSTD (the Scan R1 FreeCAD file) and PIXEL_ART_OUT set."""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scan_r1, rack
from pixelize import despeckle
FACE_LENS = float(os.environ.get("FACE_LENS", 260))

out = {}
scanner, lcd = scan_r1.build(os.environ["PIXEL_ART_FCSTD"])
out["scanner"] = scanner.render(35, 30, 84, plane=lcd)
out["scannerSmall"] = scanner.render(35, 30, 44, plane=lcd)
# Feature plate: a stack of three, turned so the cards sit on the far side of the view and
# the tubes show; one tube lifted out of the top rack (frame b).
TOWER = (float(os.environ.get("TOWER_AZ", 58)), 26, 52)
out["tower"] = rack.build(levels=3).render(*TOWER)
out["towerLift"] = rack.build(levels=3, lifted=("3B3", 14)).render(*TOWER)
# Intake film: rack R1 (resistors), filled the way the app fills it (A1..A5, B1..), so B3 is
# the first free slot. Three sprites share one framing: the rack with B3 empty, with B3
# filled, and the B3 tube alone, which the film lowers into place.
filled = ["1A1", "1A2", "1A3", "1A4", "1A5", "1B1", "1B2", "1B4", "1C1", "1C2", "1C3", "1D1"]
everything = [f"1{r}{c}" for r in "ABCDE" for c in range(1, 6)]
empty = [s for s in everything if s not in filled]
FILM_RACK = (32, 40, 120)
opts = dict(card=False, labelled=["1B3"] + filled)
full = rack.build(empty=[s for s in empty if s != "1B3"], lit=filled + ["1B3"], **opts)
frame = full.render(*FILM_RACK)["bounds"]

out["filmRackEmpty"] = rack.build(empty=empty, lit=filled, **opts).render(*FILM_RACK, bounds=frame)
out["filmRackFull"] = full.render(*FILM_RACK, bounds=frame)
out["filmTube"] = rack.build(empty=[], only="1B3", **opts).render(*FILM_RACK, bounds=frame)
# Build film: Find in racks walks R1 and the picked tubes are lifted out in pick order. The
# film depth-tests each rising tube against the rack, so it needs depth (toward the viewer, in
# half millimetres, two base-36 digits per pixel from z0, ".." where empty): the full rack's,
# and, as patches over filmRackFull ([x, y, code, depth]), the pixels that change as each
# tube leaves (cumulative); and each picked tube alone, cropped to its box.
PICKS = ["1A2", "1A4", "1B3", "1C1", "1D1"]
base = [s for s in empty if s != "1B3"]
full_d = full.render(*FILM_RACK, bounds=frame, depth=True)
variants = [rack.build(empty=base + PICKS[:k], lit=filled + ["1B3"], **opts).render(*FILM_RACK, bounds=frame, depth=True)
            for k in range(1, len(PICKS) + 1)]
tubes = {s[1:]: rack.build(empty=[], only=s, **opts).render(*FILM_RACK, bounds=frame, depth=True) for s in PICKS}
# Intake film: the rack with B3 out, for the B3 tube to be lowered in depth-tested.
empty_d = rack.build(empty=empty, lit=filled, **opts).render(*FILM_RACK, bounds=frame, depth=True)
everything_z = [z for r in [full_d, empty_d] + variants + list(tubes.values()) for row in r["depth"] for z in row if z is not None]
Z0 = math.floor(min(everything_z) * 2)
def zc(z):
    if z is None: return ".."
    n = round(z * 2) - Z0
    assert 0 <= n < 36 * 36
    return "0123456789abcdefghijklmnopqrstuvwxyz"[n // 36] + "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36]
gone = []
for v in variants:
    gone.append([[x, y, q, zc(v["depth"][y][x])] for y, (ra, rb) in enumerate(zip(full_d["rows"], v["rows"]))
                 for x, (p, q) in enumerate(zip(ra, rb)) if p != q])
def crop(r):
    cells = [(x, y) for y, row in enumerate(r["rows"]) for x, ch in enumerate(row) if ch != "."]
    x0, x1 = min(c[0] for c in cells), max(c[0] for c in cells)
    y0, y1 = min(c[1] for c in cells), max(c[1] for c in cells)
    return {"x": x0, "y": y0, "width": x1 - x0 + 1, "height": y1 - y0 + 1,
            "rows": [row[x0:x1 + 1] for row in r["rows"][y0:y1 + 1]],
            "depth": ["".join(zc(z) for z in row[x0:x1 + 1]) for row in r["depth"][y0:y1 + 1]]}
out["buildRack"] = {"z0": Z0, "pxPerMm": FILM_RACK[2] / (frame[1] - frame[0]), "el": FILM_RACK[1],
                    "depth": ["".join(zc(z) for z in row) for row in full_d["depth"]], "gone": gone,
                    "tubes": {k: crop(v) for k, v in tubes.items()},
                    "b3Out": ["".join(zc(z) for z in row) for row in empty_d["depth"]]}
# The film's scanner turns from face-on (az 90, the LCD toward the viewer) to its aim (az 35).
# All poses share one framing, so the model's origin stays on the same pixel while it turns.
# 16 steps, so the turn reads smooth; framed on the original 8 (the end poses keep their pixels).
POSES = [90 - 55 * k / 15 for k in range(16)]
ext = [scanner.extent(90 - 55 * k / 7, 30) for k in range(8)]
union = (min(e[0] for e in ext), max(e[1] for e in ext), min(e[2] for e in ext), max(e[3] for e in ext))
x0, x1, _, _ = scanner.extent(35, 30)
width = round(120 * (union[1] - union[0]) / (x1 - x0))
out["filmScanner"] = [scanner.render(az, 30, width, plane=lcd, bounds=union) for az in POSES]
# Close-up: square to the sloped screen (its normal is (0.53, 0, 0.85)). The ERC12864's dots
# sit at a 0.43 mm pitch, smaller than the case window (59.2 x 29.2 mm), so at 2.47 px/mm the
# firmware's 128 x 64 frame is drawn 1:1 with glass showing around it, as on the real unit.
# A short lens in front of the screen, so the keypad below it, nearer the camera, comes up a
# little larger and its keys show their sides; the glass keeps its 2.47 px/mm.
x0, x1, _, _ = scanner.extent(90, 58.06)
face = scanner.render(90, 58.06, 0, plane=lcd, persp=(FACE_LENS, [-35.88, 0, 19.75]), px_per_mm=183 / (x1 - x0))
face["rows"] = despeckle(face["rows"])
out["filmFace"] = face
json.dump(out, open(os.environ["PIXEL_ART_OUT"], "w"), separators=(",", ":"))
print("wrote", {k: (v.get("width"), v.get("height")) if isinstance(v, dict) else len(v) for k, v in out.items()})
