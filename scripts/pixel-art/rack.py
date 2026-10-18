"""An Inventatory rack, modelled from photos of the printed one: a 5 x 5 plate of tube
holes with rounded corners, four corner legs, tubes with screw caps, and the rack's card.
Slots are named as the app shows the rack (Racks page): letters are columns, A to E from left
to right as seen from the card's side; numbers run 1 to 5 down each column, from the far side
toward the card. So B2 is the second column, second row from the back."""
import Part, FreeCAD
from FreeCAD import Vector as V
from pixelize import Scene, box

PITCH = 15.0      # tube spacing
MARGIN = 3.0
SIDE = 5 * PITCH + 2 * MARGIN
PLATE = 3.0
LEVEL = 34.0      # one rack's height; racks stack on their legs
LEG = 20.0        # each corner leg runs this far along both sides
TUBE_R, CAP_R = 5.6, 6.3
HANG = 16.0       # how far a tube hangs below the plate: about half the legs, as in the photos
NECK = 2.0        # the tube's neck between the plate's top and the cap
CAP_H = 8.0
LETTERS = "ABCDE"
# The rack card is the app's rack label (32 x 25 mm stock), hung on the front under the plate's
# edge, centred; it is about 0.3 of the rack's width, as on the printed racks.
CARD_W, CARD_H, CARD_T = 24.0, 18.75, 0.6

def plate_shape(z):
    p = rounded(0, PLATE, z, 6.0)
    for col in range(5):
        for row in range(5):
            p = p.cut(Part.makeCylinder(CAP_R + .4, PLATE + 2, V(*hole(col, row), z - 1)))
    return p

def hole(col, row):
    """Column A..E (0..4) from the left, row 1..5 (0..4) from the back; the card is at the front (y = 0)."""
    return MARGIN + PITCH * (col + .5), MARGIN + PITCH * (4 - row + .5)

def rounded(inset, height, z, r):
    b = Part.makeBox(SIDE - 2 * inset, SIDE - 2 * inset, height, V(inset, inset, z))
    return b.makeFillet(r, [e for e in b.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1])

def legs(z):
    # The legs are the plate's own rounded corners carried down: a 3.2 mm wall, LEG mm each way.
    h, z0 = LEVEL - PLATE, z - LEVEL + PLATE
    wall = rounded(0, h, z0, 6.0).cut(rounded(3.2, h + 2, z0 - 1, 2.8))
    return [wall.common(Part.makeBox(LEG, LEG, h, V(cx, cy, z0)))
            for cx, cy in ((0, 0), (SIDE - LEG, 0), (0, SIDE - LEG), (SIDE - LEG, SIDE - LEG))]

def card_box(z):
    """The card's corners: (x0, x1, y_front, z_top, z_bottom) for the plate at height z."""
    cx = SIDE / 2
    return cx - CARD_W / 2, cx + CARD_W / 2, -CARD_T, z - .2, z - .2 - CARD_H

def tube_foot():
    """How far the tube's foot is below the plate's top, in mm."""
    return PLATE + HANG

def build(levels=1, empty=(), lifted=None, lit=(), labels=True, labelled=(), card=True, only=None):
    """empty: slots without a tube; lifted: (slot, mm) tube raised out of its hole;
    lit: slots whose caps carry the 'slot-XX' tag for the site to switch on;
    labelled: extra slots whose tube label faces the viewer (the front row always does);
    card: hang the rack card (tagged 'card', for the site to print the label on);
    only: draw just this slot's tube (no rack), for a sprite that lines up with the full render
    when given the same bounds."""
    scene = Scene()
    for lv in range(levels):
        z = lv * LEVEL + LEVEL - PLATE
        if only is None:
            scene.add_shape(plate_shape(z), "black", tol=0.2)
            for leg in legs(z):
                scene.add_shape(leg, "black", tol=0.2)
        for col in range(5):
            for row in range(5):
                slot = f"{lv + 1}{LETTERS[col]}{row + 1}"
                if slot in empty or (only is not None and slot != only): continue
                x, y = hole(col, row)
                lift = lifted[1] if lifted and lifted[0] == slot else 0
                bottom = z - HANG + lift
                top = z + PLATE + NECK + lift
                tag = "slot-" + slot if slot in lit or (lifted and lifted[0] == slot) else None
                scene.add_shape(Part.makeCylinder(TUBE_R, top - bottom, V(x, y, bottom)), "vial", tol=0.3)
                if labels and (row == 4 or slot in labelled):
                    lab = Part.makeCylinder(TUBE_R + .15, HANG - 2, V(x, y, bottom + 1), V(0, 0, 1), 150).rotated(V(x, y, 0), V(0, 0, 1), 195)
                    scene.add_shape(lab, "paper", tol=0.3)
                scene.add_shape(Part.makeCylinder(CAP_R, CAP_H, V(x, y, top)), "cap", tag, tol=0.3)
                # The cap's recessed top, a shade under its rim.
                scene.add_shape(Part.makeCylinder(CAP_R - 1.6, .3, V(x, y, top + CAP_H)), "capTop", tag, tol=0.3)
        if labels and card and only is None:
            x0, x1, y0, zt, zb = card_box(z)
            scene.add(box(x0, x1, y0, 0, zb, zt), "paper", "card" if lv == 0 else None)
    return scene
