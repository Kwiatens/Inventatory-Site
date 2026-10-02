"""Scan R1 from its FreeCAD model: shell and bottom from the file, LCD glass and the 4x4
keypad placed in the model's display window and keypad opening. The printed shell is blue-grey;
the bottom plate and the raised grip pads on both flanks (|y| > 37 mm) are black."""
import numpy as np
import FreeCAD
from pixelize import Scene, quad, box

KEYS = "123A456B789C*0#D"

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
    # Keypad opening x -5.2..53.0, y ±30.6. The user holds the keypad end and looks toward
    # the screen (-X): the 1 2 3 A row is the one next to the screen, columns run to +Y.
    scene.add(box(-5.2, 53.0, -30.6, 30.6, 6.0, 8.0), "pad")
    px, py = 58.2 / 4, 61.2 / 4
    for r in range(4):
        for c in range(4):
            x0, y0 = -5.2 + r * px + 2.0, -30.6 + c * py + 2.2
            scene.add(box(x0, x0 + px - 4.0, y0, y0 + py - 4.4, 8.0, 11.0), "key", "key-" + KEYS[r * 4 + c])
    return scene, (lcd, O, U, V)
