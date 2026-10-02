"""Builds src/data/pixel-art.json. Run with FreeCAD's Python, e.g.
  flatpak run --command=FreeCADCmd org.freecad.FreeCAD scripts/pixel-art/build.py
with PIXEL_ART_FCSTD (the Scan R1 FreeCAD file) and PIXEL_ART_OUT set."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scan_r1, rack

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
out["filmFace"] = scanner.render(90, 58.06, 183, plane=lcd)
json.dump(out, open(os.environ["PIXEL_ART_OUT"], "w"), separators=(",", ":"))
print("wrote", {k: (v["width"], v["height"]) if isinstance(v, dict) else len(v) for k, v in out.items()})
