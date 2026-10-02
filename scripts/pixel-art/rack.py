"""An Inventatory rack, modelled from photos of the printed one: a 5 x 5 plate of tube
holes with rounded corners, four corner legs, tubes with screw caps, and the rack's card.
Rows A-E run front to back, columns 1-5 left to right, as on the tube labels (R1 - B5)."""
import Part, FreeCAD
from FreeCAD import Vector as V
from pixelize import Scene, box

PITCH = 15.0      # tube spacing
MARGIN = 3.0
SIDE = 5 * PITCH + 2 * MARGIN
PLATE = 3.0
LEVEL = 46.0      # one rack's height; racks stack on their legs
TUBE_R, CAP_R = 5.6, 6.3
ROWS = "ABCDE"

def plate_shape(z):
    p = rounded(0, PLATE, z, 6.0)
    for r in range(5):
        for c in range(5):
            p = p.cut(Part.makeCylinder(CAP_R + .4, PLATE + 2, V(*hole(r, c), z - 1)))
    return p

def hole(r, c):
    # row A at the front (y = 0), column 1 on the left (x = 0)
    return MARGIN + PITCH * (c + .5), MARGIN + PITCH * (r + .5)

def rounded(inset, height, z, r):
    b = Part.makeBox(SIDE - 2 * inset, SIDE - 2 * inset, height, V(inset, inset, z))
    return b.makeFillet(r, [e for e in b.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1])

def legs(z):
    # The legs are the plate's own rounded corners carried down: a 3.2 mm wall, 17 mm each way.
    h, z0 = LEVEL - PLATE, z - LEVEL + PLATE
    wall = rounded(0, h, z0, 6.0).cut(rounded(3.2, h + 2, z0 - 1, 2.8))
    w = 17.0
    return [wall.common(Part.makeBox(w, w, h, V(cx, cy, z0)))
            for cx, cy in ((0, 0), (SIDE - w, 0), (0, SIDE - w), (SIDE - w, SIDE - w))]

def build(levels=1, empty=(), lifted=None, lit=(), labels=True, labelled=(), card=True, only=None):
    """empty: slots without a tube; lifted: (slot, mm) tube raised out of its hole;
    lit: slots whose caps carry the 'slot-XX' tag for the site to switch on;
    labelled: extra slots whose tube label faces the viewer (the front row always does);
    card: hang the rack card; only: draw just this slot's tube (no rack), for a sprite that
    lines up with the full render when given the same bounds."""
    scene = Scene()
    for lv in range(levels):
        z = lv * LEVEL + LEVEL - PLATE
        if only is None:
            scene.add_shape(plate_shape(z), "black", tol=0.2)
            for leg in legs(z):
                scene.add_shape(leg, "black", tol=0.2)
        for r in range(5):
            for c in range(5):
                slot = f"{lv + 1}{ROWS[r]}{c + 1}"
                if slot in empty or (only is not None and slot != only): continue
                x, y = hole(r, c)
                lift = lifted[1] if lifted and lifted[0] == slot else 0
                bottom = z - 30 + lift
                tag = "slot-" + slot if slot in lit or (lifted and lifted[0] == slot) else None
                scene.add_shape(Part.makeCylinder(TUBE_R, 38, V(x, y, bottom)), "vial", tol=0.3)
                if labels and (r == 0 or slot in labelled):
                    lab = Part.makeCylinder(TUBE_R + .15, 14, V(x, y, bottom + 8), V(0, 0, 1), 150).rotated(V(x, y, 0), V(0, 0, 1), 195)
                    scene.add_shape(lab, "paper", tol=0.3)
                scene.add_shape(Part.makeCylinder(CAP_R, 9, V(x, y, bottom + 38)), "cap", tag, tol=0.3)
                # The cap's recessed top, a shade under its rim.
                scene.add_shape(Part.makeCylinder(CAP_R - 1.6, .3, V(x, y, bottom + 47)), "capTop", tag, tol=0.3)
        if labels and card and only is None:
            # The rack card, hung on the front edge under the plate.
            cx = SIDE / 2
            scene.add(box(cx - 13, cx + 13, -3.4, -2.6, z - 22, z - 1), "paper")
            scene.add(box(cx - 9, cx + 9, -3.6, -3.4, z - 19.5, z - 16.5), "ink")
    return scene
