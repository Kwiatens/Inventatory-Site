"""Shared pixel-art renderer: triangles in, a grid of material codes out.

Parts are projected orthographically with a z-buffer at SS x SS samples per pixel. Each
pixel takes the part most of its samples hit (empty when under 45 % coverage) and a light
band from the part's averaged normal. A part's material decides which codes its bands use;
the site maps codes to palette colours (src/lib/pixel.ts).
"""
import math
import numpy as np

SS = 8
LIGHT = np.array([-0.35, -0.55, 0.76]); LIGHT /= np.linalg.norm(LIGHT)

# material -> codes from darkest to lightest band
MATERIALS = {
    "shell": "0123",   # printed enclosure
    "black": "4567",   # black PLA racks, bottom plate
    "cap": "abc",      # translucent white caps
    "capTop": "ab",
    "vial": "gh",      # clear tube over a dark background
    "paper": "QP",     # printed labels
    "ink": "I",
    "lcd": "L",
    "key": "kK",
    "pad": "4",
    "lit": "T",
}

def band(lit, n):
    return min(n - 1, int(np.clip((lit - 0.15) / 0.8, 0, 0.999) * n))

class Scene:
    def __init__(self):
        self.tris, self.parts, self.info = [], [], []

    def add(self, tris, material, tag=None):
        """tris: (n,3,3). tag marks pixels the site animates (keys, slots, ...)."""
        pid = len(self.info)
        self.info.append((material, tag))
        self.tris.append(np.asarray(tris, float)); self.parts.append(np.full(len(tris), pid))
        return pid

    def add_shape(self, shape, material, tag=None, tol=0.05):
        v, f = shape.tessellate(tol)
        if not f: return None
        V = np.array([[p.x, p.y, p.z] for p in v])
        return self.add(V[np.array(f)], material, tag)

    def extent(self, az, el):
        """The scene's (xmin, xmax, ymin, ymax) in view space."""
        P = np.concatenate(self.tris).reshape(-1, 3)
        r, u, _ = view(az, el)
        return (float((P @ r).min()), float((P @ r).max()), float((P @ u).min()), float((P @ u).max()))

    def render(self, az, el, width, plane=None, bounds=None):
        """plane: (pid, origin, U, V) -> report (u, v) for that part's pixels.
        bounds: (xmin, xmax, ymin, ymax) in view space, so frames of a moving part share
        one framing; defaults to this scene's own extent (returned as "bounds")."""
        T = np.concatenate(self.tris); I = np.concatenate(self.parts)
        N = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
        nl = np.linalg.norm(N, axis=1); nl[nl == 0] = 1; N /= nl[:, None]
        r, u, d = view(az, el)
        P = T.reshape(-1, 3); X, Y, Z = P @ r, P @ u, P @ d
        xmin, xmax, ymin, ymax = bounds or (X.min(), X.max(), Y.min(), Y.max())
        s = width * SS / (xmax - xmin)
        Wp, Hp = width * SS, int(math.ceil((ymax - ymin) * s / SS)) * SS
        sx = ((X - xmin) * s).reshape(-1, 3); sy = ((ymax - Y) * s).reshape(-1, 3); sz = Z.reshape(-1, 3)
        zb = np.full((Hp, Wp), -1e9); ib = np.full((Hp, Wp), -1); nb = np.zeros((Hp, Wp, 3))
        for k in range(len(T)):
            x0, x1, x2 = sx[k]; y0, y1, y2 = sy[k]
            bx0, bx1 = max(int(min(x0, x1, x2)), 0), min(int(max(x0, x1, x2)) + 1, Wp - 1)
            by0, by1 = max(int(min(y0, y1, y2)), 0), min(int(max(y0, y1, y2)) + 1, Hp - 1)
            if bx1 < bx0 or by1 < by0: continue
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-12: continue
            gx, gy = np.meshgrid(np.arange(bx0, bx1 + 1) + .5, np.arange(by0, by1 + 1) + .5)
            w0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / den
            w1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / den
            w2 = 1 - w0 - w1
            m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
            if not m.any(): continue
            z = w0 * sz[k][0] + w1 * sz[k][1] + w2 * sz[k][2]
            sub = zb[by0:by1 + 1, bx0:bx1 + 1]; upd = m & (z > sub)
            sub[upd] = z[upd]
            ib[by0:by1 + 1, bx0:bx1 + 1][upd] = I[k]
            nb[by0:by1 + 1, bx0:bx1 + 1][upd] = N[k] if N[k] @ d > 0 else -N[k]
        H = Hp // SS
        ids_b = ib.reshape(H, SS, width, SS).transpose(0, 2, 1, 3).reshape(H, width, -1)
        nrm_b = nb.reshape(H, SS, width, SS, 3).transpose(0, 2, 1, 3, 4).reshape(H, width, -1, 3)
        rows, tags, uv = [], {}, []
        for y in range(H):
            row = ""
            for x in range(width):
                vals, counts = np.unique(ids_b[y, x], return_counts=True)
                hit, hc = vals[vals >= 0], counts[vals >= 0]
                if hc.sum() < SS * SS * 0.45:
                    row += "."; continue
                pid = int(hit[np.argmax(hc)])
                nv = nrm_b[y, x][ids_b[y, x] == pid].mean(axis=0); nv /= (np.linalg.norm(nv) or 1)
                material, tag = self.info[pid]
                codes = MATERIALS[material]
                row += codes[band(float(nv @ LIGHT), len(codes))]
                if tag: tags.setdefault(tag, []).append([x, y])
                if plane and pid == plane[0]:
                    _, O, U, V = plane
                    cx = xmin + (x + .5) * SS / s; cy = ymax - (y + .5) * SS / s
                    A = np.array([[U @ r, V @ r], [U @ u, V @ u]])
                    uu, vv = np.linalg.solve(A, [cx - O @ r, cy - O @ u])
                    uv.append([x, y, round(float(uu), 4), round(float(vv), 4)])
            rows.append(row)
        out = {"width": width, "height": H, "rows": rows, "tags": tags, "az": az, "el": el,
               "bounds": [float(xmin), float(xmax), float(ymin), float(ymax)]}
        if plane: out["uv"] = uv
        return out

def view(az, el):
    """Screen right, screen up and toward-the-viewer axes for a camera at azimuth az and
    elevation el (degrees). The site's film projects with the same formula."""
    a, e = math.radians(az), math.radians(el)
    d = np.array([math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)])
    r = np.cross([0, 0, 1.0], d)
    if np.linalg.norm(r) < 1e-9: r = np.array([1.0, 0, 0])
    r /= np.linalg.norm(r)
    return r, np.cross(d, r), d

def quad(a, b, c, d):
    return [[a, b, c], [a, c, d]]

def box(x0, x1, y0, y1, z0, z1):
    P = lambda x, y, z: (x, y, z)
    return (quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)) +
            quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)) +
            quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)) +
            quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)) +
            quad(P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)) +
            quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)))
