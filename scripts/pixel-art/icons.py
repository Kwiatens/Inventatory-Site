"""Builds src/data/feature-icons.json: the homepage's feature icons, one real object per feature,
all from models through the one renderer (pixelize.py): the vendor bag (import), rack R1 (racks),
the comparator board and its BOM (projects), the Scanner R1 (stock) and the PC showing the app's
History page (history). They share one camera, the film's rack camera (in front, a little to the
left and above), and each is fitted to the same BOX x BOX pixels, so they read as one set. Printed
things (labels, the BOM, the screens) are textures: code maps stretched over a face.
Run with FreeCAD's Python (see icons.sh), with PIXEL_ART_FCSTD (the Scanner R1 FreeCAD file) and
PIXEL_ART_OUT set."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import Part, FreeCAD
from FreeCAD import Vector as V
import scan_r1, rack
from pixelize import Scene, box

BOX = 44
AZ, EL = -10, 35          # as the film's rack (build.py FILM_RACK)

def fit(scene, az=AZ, el=EL, **kw):
    """Render as large as fits BOX x BOX."""
    w = BOX
    while True:
        r = scene.render(az, el, w, **kw)
        if r["height"] <= BOX: break
        w = min(w - 1, int(w * BOX / r["height"]))
    r.pop("bounds", None)
    return r

def solid(shape, r=None):
    """A box with its vertical edges (or all, r as a pair) rounded."""
    if r is None: return shape
    rv, ra = r if isinstance(r, tuple) else (r, 0)
    if rv: shape = shape.makeFillet(rv, [e for e in shape.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-3])
    if ra: shape = shape.makeFillet(ra, shape.Edges)
    return shape

def decal(scene, O, U, Vv, rows, material="paper", lift=(0, -.15, 0), tag=None):
    """A printed face: a sliver on the plane O + u U + v Vv, raised by `lift`, textured with rows."""
    O, U, Vv, L = (FreeCAD.Vector(*p) for p in (O, U, Vv, lift))
    a, b, c, d = O + L, O + U + L, O + U + Vv + L, O + Vv + L
    pid = scene.add([[tuple(a), tuple(b), tuple(c)], [tuple(a), tuple(c), tuple(d)]], material, tag)
    return pid, (tuple(a), tuple(U), tuple(Vv), rows)

out = {}

# ---------- import: the vendor bag, standing, its label to the viewer ----------
# The DigiKey bag as in the film: dark anti-static film with the zip down the right, and the white
# shipping label: part number, description, maker; DataMatrix, barcode and the QTY box.
BAG_LABEL = [
    "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    "PIIIPPIIIIIIIIIIIIIIIIIPPPPP",
    "PIIIPPPPPPPPPPPPPPPPPPPPPPPP",
    "PIIIIIIIIIIIIIIIIIIIIIIIIIIP",
    "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    "PIIIIIIIIIIIIIIIIIIIPPPPPPPP",
    "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    "PIIIIIIIIIIIPPPPPPPPPPPPPPPP",
    "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
    "PIPIPIPPIPIIPIPIIPIPPIIIIIIP",
    "PIIPIIIPIPIIPIPIIPIPPIPPPPIP",
    "PIPIIPIPIPIIPIPIIPIPPIPIIPIP",
    "PIIIPIIPIPIIPIPIIPIPPIPIIPIP",
    "PIPPIIIPIPIIPIPIIPIPPIPPPPIP",
    "PIIIIIIPPPPPPPPPPPPPPIIIIIIP",
    "PPPPPPPPPPPPPPPPPPPPPPPPPPPP",
]
BAG_W, BAG_H, BAG_D, ZIP = 62.0, 42.0, 7.0, 55.0
scene = Scene()
scene.add_shape(solid(Part.makeBox(BAG_W, BAG_D, BAG_H, V(0, 0, 0)), (0, 2.4)), "bag", tol=.1)
# the zip: two tracks down the right
for x in (ZIP, ZIP + 2.2):
    scene.add(box(x, x + .9, -.25, 0, 2, BAG_H - 2), "black")
pid, tex = decal(scene, (5, 0, 37), (44, 0, 0), (0, 0, -30), BAG_LABEL)
out["import"] = fit(scene, textures={pid: tex})

# ---------- racks: rack R1, filled as the film leaves it, B3 lit, its card printed ----------
FILLED = ["1A1", "1A2", "1A3", "1A4", "1A5", "1B1", "1B2", "1B3", "1B4", "1C1", "1C2", "1C3", "1D1"]
everything = [f"1{r}{c}" for r in "ABCDE" for c in range(1, 6)]
scene = rack.build(empty=[s for s in everything if s not in FILLED], lit=["1B3"])
# The rack label at the card's few pixels: header bar, the number block, the symbol and the name.
CARD = [
    "PPPPPPPPPPPP",
    "PIIIIIIIIIIP",
    "PPPPPPPPPPPP",
    "PIIIIPPPPPPP",
    "PIPPIPIIIIPP",
    "PIIIIPIPPIIP",
    "PIPPIPIIIIPP",
    "PIIIIPPPPPPP",
    "PIIIIPIIIIIP",
    "PPPPPPPPPPPP",
]
card = next(i for i, (m, t) in enumerate(scene.info) if t == "card")
x0, x1, y0, zt, zb = rack.card_box(rack.LEVEL - rack.PLATE)
out["racks"] = fit(scene, textures={card: ((x0, y0 - .01, zt), (x1 - x0, 0, 0), (0, 0, zb - zt), CARD)})
out["racks"]["tags"] = {k: v for k, v in out["racks"]["tags"].items() if k.startswith("slot")}

# ---------- projects: the comparator board in front of its BOM, propped up behind it ----------
# The BOM as the film prints it: a header row, then one line per part, the rack lines' Where in
# the app's teal, J1 and U1 (Drawer 2) in ink.
BOM = [
    "PPPPPPPPPPPPPPPP",
    "PaaPaaaPaaPaaaaP",
    "PQQQQQQQQQQQQQQP",
    "PIIPIIIPIIPAAAPP",
    "PPPPPPPPPPPPPPPP",
    "PIIPIIPPIIPAAAPP",
    "PPPPPPPPPPPPPPPP",
    "PIIPIIIPIIPIIIIP",
    "PPPPPPPPPPPPPPPP",
    "PIIPIIIPIIPAAAPP",
    "PPPPPPPPPPPPPPPP",
    "PIIPIIPPIIPAAAPP",
    "PPPPPPPPPPPPPPPP",
    "PPPPPPPPPPPPPPPP",
]
# The board's top: solder mask with its copper under it, pads; parts stand on it as boxes.
TRACES = [
    "rqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr",
    "qrrrrrrrrrrrrrrrrrrrrrrrrrrrrrq",
    "qrqqqqqqqqqqqqqqqqqqqqqqqqqqqrq",
    "qrqqqqqrrrrrrqqqqqqqqqqrrrrqqrq",
    "qrqqqqqrqqqqrqqqqqqqqqqrqqrqqrq",
    "qrqqqqqrqqqqrrrrrrqqqqqrqqrqqrq",
    "qrqqqqqrqqqqqqqqqrqqqqqrqqrrrrq",
    "qrqqqqqrrrrrqqqqqrrrrrrrqqqqqqq",
    "qrqqqqqqqqqrqqqqqqqqqqqqqqqqqqq",
    "qrrrrrrrrrrrrrrrrrrrrrrrrrrrrrq",
    "rqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr",
]
scene = Scene()
SHEET_W, SHEET_H, TILT = 32.0, 40.0, 18.0                   # the sheet, propped up and leaning back
SX, SY, SZ = -4.0, 30.0, 0.0                               # on the desk, just behind the board
sheet = Part.makeBox(SHEET_W, .4, SHEET_H, V(SX, SY, SZ))
rot = FreeCAD.Rotation(V(1, 0, 0), -TILT)
base = V(0, SY, SZ)
sheet = sheet.transformGeometry(FreeCAD.Placement(base - rot.multVec(base), rot).toMatrix())
scene.add_shape(sheet, "paper", tol=.1)
tl = base + rot.multVec(V(SX, SY, SZ + SHEET_H) - base)
U, Vd = rot.multVec(V(SHEET_W, 0, 0)), rot.multVec(V(0, 0, -SHEET_H))
pid_bom, tex_bom = decal(scene, tuple(tl), tuple(U), tuple(Vd), BOM, lift=tuple(rot.multVec(V(0, -.05, 0))))
B = (2, -6, 58, 34)                                         # the board: x, y, width, depth (mm)
scene.add_shape(Part.makeBox(B[2], B[3], 1.6, V(B[0], B[1], 0)), "pcb", tol=.1)
pid_pcb, tex_pcb = decal(scene, (B[0], B[1] + B[3], 1.6), (B[2], 0, 0), (0, -B[3], 0), TRACES, "pcb", lift=(0, 0, .02))
# the comparator (SOIC-8) and its gull-wing legs, the header's three pins, the 0603 parts, the LED
scene.add(box(B[0] + 22, B[0] + 32, B[1] + 11, B[1] + 19, 1.6, 3.6), "ink")
for i in range(4):
    for y in (B[1] + 10.2, B[1] + 19.2):
        scene.add(box(B[0] + 23 + i * 2.5, B[0] + 24.2 + i * 2.5, y - .5, y + .5, 1.6, 2.4), "gold")
for i in range(3):
    scene.add(box(B[0] + 3, B[0] + 5.6, B[1] + 7 + i * 7, B[1] + 9.6 + i * 7, 1.6, 4.2), "black")
    scene.add(box(B[0] + 3.9, B[0] + 4.7, B[1] + 7.9 + i * 7, B[1] + 8.7 + i * 7, 4.2, 9.5), "gold")
for (x, y) in ((12, 5), (12, 25), (40, 7), (40, 24), (49, 15)):
    scene.add(box(B[0] + x, B[0] + x + 3.6, B[1] + y, B[1] + y + 2, 1.6, 2.6), "ink")
    for ex in (0, 2.9):
        scene.add(box(B[0] + x + ex, B[0] + x + ex + .7, B[1] + y, B[1] + y + 2, 1.6, 2.65), "gold")
scene.add(box(B[0] + 49, B[0] + 52.5, B[1] + 25, B[1] + 28.5, 1.6, 3.4), "lit")
out["projects"] = fit(scene, textures={pid_bom: tex_bom, pid_pcb: tex_pcb})

# ---------- stock: the Scanner R1, its screen to the viewer, showing a part's stock ----------
# Its screen (128 x 64 dots) as the marks of the firmware's stock view: the part, the count
# large, the slot.
LCD = [
    "LLLLLLLLLLLL",
    "LIIIIIILIIIL",
    "LLLLLLLLLLLL",
    "LIIILIIILIIL",
    "LIIILIIILIIL",
    "LLLLLLLLLLLL",
    "LIIIIILLLLLL",
    "LLLLLLLLLLLL",
]
scanner, (lcd, O, U, Vl) = scan_r1.build(os.environ["PIXEL_ART_FCSTD"])
s = fit(scanner, az=AZ + 90, textures={lcd: (O, U, Vl, LCD)})
s["tags"] = {}
out["stock"] = s

# ---------- history: the PC, showing the app's History page ----------
# The search bar; commits down the left, each with its source badge in the app's colours
# (project, checkpoint, corrective, ...); the selected checkpoint with the prompt mark; on the
# right its diff, each field's previous value in red, the new one in green.
SCREEN = [
    "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "RJJJJJJJRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    "HHHHHHHHHHHHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHUUUHaaaaaHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHsHaaaaaHHHHHHHHHHHH",
    "NFNNNNNNNNNNNNNNNsHsssssssssssssssHH",
    "NNFJJJNeeeeeeNNNNsHaaaHZZZZZBBBBBHHH",
    "NFNNNNNNNNNNNNNNNsHHHHHZXXXZBUUUBHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHZZZZZBBBBBHHH",
    "HHWWWHaaaaHHHHHHHsHaaaHZZZZZBBBBBHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHZXXXZBUUUBHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHZZZZZBBBBBHHH",
    "HHJJJHaaaaaaHHHHHsHaaaHZZZZZBBBBBHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHZXXXZBUUUBHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHZZZZZBBBBBHHH",
    "HHUUUHaaaHHHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHAAAHaaaaaHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHsHHHHHHHHHHHHHHHHHH",
]
SCREEN = [r.replace("e", "a") for r in SCREEN]
scene = Scene()
MW, MH, MD, LIFT = 64.0, 40.0, 4.0, 9.0                   # the monitor's case, raised on its stand
scene.add_shape(solid(Part.makeBox(MW, MD, MH, V(0, 0, LIFT)), (0, .8)), "steel", tol=.1)
scene.add_shape(Part.makeBox(8, 3, LIFT, V(MW / 2 - 4, MD, 0)), "steel", tol=.1)
scene.add_shape(solid(Part.makeBox(24, 10, 2, V(MW / 2 - 12, -2, 0)), (0, .6)), "steel", tol=.1)
pid, tex = decal(scene, (2.5, 0, LIFT + MH - 2.5), (MW - 5, 0, 0), (0, 0, -(MH - 5)), SCREEN, "screen")
out["history"] = fit(scene, textures={pid: tex})

with open(os.environ["PIXEL_ART_OUT"], "w") as f:
    json.dump({"box": BOX, **out}, f, indent=1)
print("wrote", os.environ["PIXEL_ART_OUT"], {k: (v["width"], v["height"]) for k, v in out.items()}, flush=True)
