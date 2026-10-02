"""Scan R1 from its FreeCAD model: shell and bottom from the file, LCD glass and the 4x4
keypad placed in the model's display window and keypad opening. The printed shell is blue-grey;
the bottom plate and the raised grip pads on both flanks (|y| > 37 mm) are black."""
import numpy as np
import FreeCAD, Part
from pixelize import Scene, quad, box

KEYS = "123A456B789C*0#D"
TOP = 10.0                  # the shell's top face round the keypad
KEY = (9.0, 9.5, 2.5)

def build(fcstd):
    doc = FreeCAD.openDocument(fcstd)
    scene = Scene()
    for face in doc.getObject("Body").Shape.Faces:
        b = face.BoundBox
        scene.add_shape(face, "black" if b.YMin < -37.01 or b.YMax > 37.01 else "shell")
    scene.add_shape(doc.getObject("Body001").Shape, "black")
    # LCD: the window on the sloped face (x -47.7..-23.0, z 28.4..12.8, y ±29.6), 1 mm deep.
    # u runs across the glass (+y), v down the slope from its high edge.
    n = np.array([0.53, 0, 0.85]); n /= np.linalg.norm(n)
    hi, lo = np.array([-47.7, 0, 28.4]) - n, np.array([-23.0, 0, 12.8]) - n
    O = hi + [0, -29.6, 0]; U = np.array([0, 59.2, 0]); V = lo - hi
    lcd = scene.add(quad(O, O + U, O + U + V, O + V), "lcd")
    # Keypad opening x -5.2..53.0, y ±30.6, filled flush with the shell's top (z 10): the black
    # keypad is level with the printed case, not sunk in it. The user holds the keypad end and
    # looks toward the screen (-X): the 1 2 3 A row is the one next to the screen, columns run
    # to +Y. Keys: 9 x 9.5 mm, 2.5 mm proud, corners rounded.
    # (its corners rounded like the opening's, and a hair under the top, so the case wins there)
    pad = Part.makeBox(58.2, 61.2, TOP - .1 - 8.0, FreeCAD.Vector(-5.2, -30.6, 8.0))
    scene.add_shape(pad.makeFillet(3.0, [e for e in pad.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1]), "pad")
    px, py = 58.2 / 4, 61.2 / 4
    for r in range(4):
        for c in range(4):
            cx, cy = -5.2 + (r + .5) * px, -30.6 + (c + .5) * py
            key = Part.makeBox(KEY[0], KEY[1], KEY[2], FreeCAD.Vector(cx - KEY[0] / 2, cy - KEY[1] / 2, TOP - .1))
            key = key.makeFillet(2.0, [e for e in key.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1])
            key = key.makeFillet(.6, [e for e in key.Faces[[f.CenterOfMass.z for f in key.Faces].index(max(f.CenterOfMass.z for f in key.Faces))].Edges])
            scene.add_shape(key, "key", "key-" + KEYS[r * 4 + c])
    return scene, (lcd, O, U, V)
