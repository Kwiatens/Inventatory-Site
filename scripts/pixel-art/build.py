"""Builds src/data/pixel-art.json. Run with FreeCAD's Python, e.g.
  flatpak run --command=FreeCADCmd org.freecad.FreeCAD scripts/pixel-art/build.py
with PIXEL_ART_FCSTD (the Scan R1 FreeCAD file) and PIXEL_ART_OUT set. Without
PIXEL_ART_FCSTD only the racks are rebuilt, and the scanner's sprites already in
PIXEL_ART_OUT are kept."""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rack
from pixelize import despeckle, view
FACE_LENS = float(os.environ.get("FACE_LENS", 1200))

FCSTD = os.environ.get("PIXEL_ART_FCSTD")
out = {} if FCSTD else json.load(open(os.environ["PIXEL_ART_OUT"]))
for gone in ("tower", "towerLift"):          # the old feature plate's stacks, no longer drawn
    out.pop(gone, None)
# Intake film: rack R1 (resistors), filled the way the app fills it (A1..A5, B1..), so B3 is
# the first free slot. Three sprites share one framing: the rack with B3 empty, with B3
# filled, and the B3 tube alone, which the film lowers into place. The camera stands in front
# of the card, a little to the left and above, as in the photos of the printed racks.
filled = ["1A1", "1A2", "1A3", "1A4", "1A5", "1B1", "1B2", "1B4", "1C1", "1C2", "1C3", "1D1"]
everything = [f"1{r}{c}" for r in "ABCDE" for c in range(1, 6)]
empty = [s for s in everything if s not in filled]
FILM_RACK = (float(os.environ.get("RACK_AZ", -10)), float(os.environ.get("RACK_EL", 35)), 120)
# Only the front row's labels show on the rack (through an empty hole a label further back reads
# as a stray glint); a tube taken out shows its own label (tube()).
opts = dict()
tube = lambda slot, **kw: rack.build(empty=[], only=slot, labelled=[slot], **kw)
full = rack.build(empty=[s for s in empty if s != "1B3"], lit=filled + ["1B3"], **opts)
frame = full.render(*FILM_RACK)["bounds"]

def card_corners(az, el, width, bounds):
    """The card's top left, and its full width and height as vectors, in sprite pixels: the site
    prints the rack label on the card's pixels with them."""
    r, u, _ = view(az, el)
    s = width / (bounds[1] - bounds[0])
    x0, x1, y0, zt, zb = rack.card_box(rack.LEVEL - rack.PLATE)
    at = lambda P: [round((P[0] * r[0] + P[1] * r[1] + P[2] * r[2] - bounds[0]) * s, 3),
                    round((bounds[3] - (P[0] * u[0] + P[1] * u[1] + P[2] * u[2])) * s, 3)]
    o, a, b = at((x0, y0, zt)), at((x1, y0, zt)), at((x0, y0, zb))
    return {"o": o, "ax": [round(a[0] - o[0], 3), round(a[1] - o[1], 3)], "ay": [round(b[0] - o[0], 3), round(b[1] - o[1], 3)]}

out["filmRackEmpty"] = rack.build(empty=empty, lit=filled, **opts).render(*FILM_RACK, bounds=frame)
out["filmRackFull"] = full.render(*FILM_RACK, bounds=frame)
out["filmRackFull"]["card"] = card_corners(*FILM_RACK, frame)
out["filmTube"] = tube("1B3").render(*FILM_RACK, bounds=frame)
# Finale (src/lib/film/finale.ts): the picked tubes are lifted out of R1 in pick order. The
# film depth-tests each rising tube against the rack, so it needs depth (toward the viewer, in
# half millimetres, two base-36 digits per pixel from z0, ".." where empty): the full rack's,
# and, as patches over filmRackFull ([x, y, code, depth]), the pixels that change as each
# tube leaves (cumulative); and each picked tube alone, cropped to its box.
PICKS = ["1B3", "1C1", "1C2", "1B4", "1B2", "1B1"]          # the comparator, in pick order: the 10K (the part the intake film put away) first, then the BOM's order: 100nF, LED, 100K, 4.7K, 1K
base = [s for s in empty if s != "1B3"]
full_d = full.render(*FILM_RACK, bounds=frame, depth=True)
variants = [rack.build(empty=base + PICKS[:k], lit=filled + ["1B3"], **opts).render(*FILM_RACK, bounds=frame, depth=True)
            for k in range(1, len(PICKS) + 1)]
tubes = {s[1:]: tube(s).render(*FILM_RACK, bounds=frame, depth=True) for s in PICKS}
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
out["buildRack"] = {"z0": Z0, "pxPerMm": FILM_RACK[2] / (frame[1] - frame[0]), "el": FILM_RACK[1], "foot": rack.tube_foot(),
                    "depth": ["".join(zc(z) for z in row) for row in full_d["depth"]], "gone": gone,
                    # each variant's own lit caps: a tube taken out uncovers the cap behind it
                    "goneTags": [{k: c for k, c in v["tags"].items() if k.startswith("slot-")} for v in variants],
                    "tubes": {k: crop(v) for k, v in tubes.items()},
                    "b3Out": ["".join(zc(z) for z in row) for row in empty_d["depth"]]}
if not FCSTD:
    json.dump(out, open(os.environ["PIXEL_ART_OUT"], "w"), separators=(",", ":"))
    print("wrote racks", {k: (v.get("width"), v.get("height")) for k, v in out.items() if k.startswith("filmRack")}, flush=True)
    sys.exit(0)
import scan_r1
scanner, lcd = scan_r1.build(FCSTD)
out["scanner"] = scanner.render(35, 30, 84, plane=lcd)
out["scannerSmall"] = scanner.render(35, 30, 44, plane=lcd)
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
# A long lens in front of the screen: the keys still show a sliver of their sides, but the case
# walls stay straight (a short 260 mm lens flared the case outward toward the keypad, which
# read as the scanner swelling while the camera tilted down). The glass keeps its 2.47 px/mm.
x0, x1, _, _ = scanner.extent(90, 58.06)
face = scanner.render(90, 58.06, 0, plane=lcd, persp=(FACE_LENS, [-35.88, 0, 19.75]), px_per_mm=183 / (x1 - x0))
face["rows"] = despeckle(face["rows"])
out["filmFace"] = face
json.dump(out, open(os.environ["PIXEL_ART_OUT"], "w"), separators=(",", ":"))
print("wrote", {k: (v.get("width"), v.get("height")) if isinstance(v, dict) else len(v) for k, v in out.items()})
