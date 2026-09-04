"""
BUILD-1 — the parameterised gable library.

Seven gable types, as real 3-D geometry: a wall of masonry thickness with the
mouldings that make each type recognisable at street distance — the stone
treads on a trapgevel, the klauwstukken on a halsgevel, the waist on a
klokgevel, the spout on a tuitgevel, a kroonlijst on brackets for a lijstgevel.

Three rules shape every decision here.

*The silhouette is not mine to invent.* `src/canalRecall/facade/generate.ts`
already owns the seven outlines and `scripts/check-facade-generate.ts` pins
them. `gable_profile()` below is a line-by-line port, `_round2` reproduces
JavaScript's `toFixed(2)` exactly, and `scripts/check-facade-gable-library.ts`
fails if the two ever disagree. Every moulding is then derived from that
outline's own segments rather than re-parameterised from width and rise, so a
change on the TypeScript side moves the mouldings with it instead of leaving
them attached to a silhouette that no longer exists.

*Blender is an offline asset generator and must never appear at runtime.* It is
also, for most of the people who will run this, not installed. So the geometry
is built in plain Python — vertices and triangles, no bpy — and bpy is used
only at the very end, to hand that same mesh to Blender for GLB export when it
happens to be there. Both paths emit identical geometry because there is only
one geometry.

*Nothing here measures a building.* This is drawing vocabulary. It says how to
draw a klokgevel once a record says this house has one; it never says that a
house has one.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

Vec2 = tuple[float, float]
Vec3 = tuple[float, float, float]

GABLE_TYPES: tuple[str, ...] = (
    'trap', 'hals', 'verhoogde-hals', 'klok', 'tuit', 'punt', 'lijst',
)

# Frontage geometry: +x runs along the façade from the left party wall, +y is
# height above the eaves, +z is out of the wall toward the water. The wall
# occupies z ∈ [-thickness, 0] so every moulding's projection is simply its +z
# extent, and a gable can be placed by translating its origin to the eaves
# corner without unwinding a local frame.

# A canal-house front wall is a brick-and-a-half in waalformat: 210 mm brick +
# 10 mm joint + 105 mm = 0.325 m. Rounded to 0.32; the upper storeys of a deep
# house thin to a single brick, which a caller can pass instead.
WALL_THICKNESS_M = 0.32

# Moulding sizes are absolute, not fractions of the frontage. A kroonlijst is
# roughly the same object on a 4.5 m front and an 8 m one — it is sized by the
# timber and the mason's hand, not by the plot — and scaling it with width is
# what makes a generated street read as one building stretched.
DEKPLAAT_DEPTH_M = 0.09        # stone tread capping a step, seen edge-on
DEKPLAAT_PROJECTION_M = 0.11
DEKBAND_DEPTH_M = 0.13         # raking cope along a pointed gable's slope
DEKBAND_PROJECTION_M = 0.09
KLAUWSTUK_DEPTH_M = 0.38       # the claw-piece's band across the shoulder
KLAUWSTUK_PROJECTION_M = 0.15
VOLUTE_RADIUS_M = 0.26         # the scroll at the claw's lower, outer end
TAILLE_DEPTH_M = 0.18          # the klokgevel's waist moulding
TAILLE_PROJECTION_M = 0.10
KROONLIJST_DEPTH_M = 0.24
KROONLIJST_PROJECTION_M = 0.42  # the build prompt's make_cornice(depth_m=0.45)
GABLE_TOP_LIJST_PROJECTION_M = 0.18  # a gable-top cornice is shallower
CONSOLE_PITCH_M = 0.78         # bracket spacing under a kroonlijst
CONSOLE_WIDTH_M = 0.13
CONSOLE_DROP_M = 0.20
SPOUT_PROJECTION_M = 0.20

# Ornament each type carries unless the caller says otherwise. Tokens, not
# booleans, because the register describes ornament in words and a record will
# arrive as words: ornament="klauwstukken+vaas".
DEFAULT_ORNAMENT: dict[str, tuple[str, ...]] = {
    'trap': ('dekplaten',),
    'hals': ('klauwstukken', 'kroonlijst'),
    'verhoogde-hals': ('klauwstukken', 'kroonlijst'),
    'klok': ('taille', 'kroonlijst'),
    'tuit': ('dekband', 'tuit'),
    'punt': ('dekband',),
    'lijst': ('kroonlijst', 'consoles'),
}
KNOWN_ORNAMENT = frozenset(
    {'dekplaten', 'dekband', 'klauwstukken', 'taille', 'kroonlijst', 'consoles', 'tuit', 'vaas', 'none'}
)


def _round2(value: float) -> float:
    """
    JavaScript's `Number(x.toFixed(2))`.

    Not `round(x, 2)`: Python rounds half to even and JavaScript's toFixed
    rounds half away from zero, and the difference is reachable — 0.125 is
    exactly representable, so it becomes 0.12 in Python and 0.13 in JavaScript.
    Decimal(float) takes the exact binary value, which is what toFixed is
    defined against, so ROUND_HALF_UP reproduces it.
    """
    return float(Decimal(value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def gable_profile(kind: str, width_m: float, rise_m: float) -> list[Vec2]:
    """
    Port of `gableProfile()` in src/canalRecall/facade/generate.ts.

    Kept structurally identical to the original — same branch order, same
    constants, same rounding at the same moment — because the only thing that
    makes it safe to have two copies is that a diff between them is obvious.
    The TypeScript side is the source of truth; this one is checked against it.
    """
    w = width_m
    r = max(0.6, rise_m)

    def point(x: float, y: float) -> Vec2:
        return (_round2(x), _round2(y))

    if kind == 'trap':
        steps = max(3, min(7, round_half_up(w / 0.9)))
        tread, riser = w / (2 * steps + 1), r / steps
        points = [point(0, 0)]
        for i in range(steps):
            points.append(point(i * tread, (i + 1) * riser))
            points.append(point((i + 1) * tread, (i + 1) * riser))
        points.append(point(w - steps * tread, r))
        points.append(point(w - steps * tread, r))
        for i in range(steps - 1, -1, -1):
            points.append(point(w - (i + 1) * tread, (i + 1) * riser))
            points.append(point(w - i * tread, (i + 1) * riser))
        points.append(point(w, 0))
        return points

    if kind == 'hals':
        neck = w * 0.46
        side = (w - neck) / 2
        return [
            point(0, 0), point(side * 0.55, r * 0.28), point(side, r * 0.52), point(side, r),
            point(side + neck, r), point(side + neck, r * 0.52), point(w - side * 0.55, r * 0.28), point(w, 0),
        ]

    if kind == 'klok':
        top = w * 0.34
        side = (w - top) / 2
        points = [point(0, 0)]
        STEPS = 7
        for i in range(1, STEPS + 1):
            t = i / STEPS
            points.append(point(side * (t ** 0.62), r * (t ** 1.55)))
        points.append(point(side + top, r))
        for i in range(STEPS, 0, -1):
            t = i / STEPS
            points.append(point(w - side * (t ** 0.62), r * (t ** 1.55)))
        points.append(point(w, 0))
        return points

    if kind == 'tuit':
        spout = min(0.9, w * 0.16)
        return [
            point(0, 0), point(w / 2 - spout / 2, r * 0.82), point(w / 2 - spout / 2, r),
            point(w / 2 + spout / 2, r), point(w / 2 + spout / 2, r * 0.82), point(w, 0),
        ]

    if kind == 'punt':
        return [point(0, 0), point(w / 2, r), point(w, 0)]

    if kind == 'verhoogde-hals':
        neck = w * 0.4
        side = (w - neck) / 2
        return [
            point(0, 0), point(side * 0.5, r * 0.2), point(side, r * 0.4), point(side, r),
            point(side + neck, r), point(side + neck, r * 0.4), point(w - side * 0.5, r * 0.2), point(w, 0),
        ]

    # 'lijst' and anything unrecognised: a straight cornice, the roof behind it.
    return [point(0, 0), point(0, r * 0.5), point(w, r * 0.5), point(w, 0)]


def round_half_up(value: float) -> int:
    """JavaScript's Math.round: halves go up, not to even (round(0.5) is 0 in Python)."""
    return math.floor(value + 0.5)


@dataclass
class Part:
    """One solid. Separate so parts can be atlased, instanced and materialled independently."""
    name: str
    material: str
    verts: list[Vec3]
    faces: list[tuple[int, int, int]]

    def signed_volume(self) -> float:
        """
        Divergence theorem over the triangles.

        A closed, outward-wound solid gives a positive volume equal to the shape
        it is meant to be; a triangulation that missed part of the outline, or
        wound a face inward, does not. Cheap, and it catches the failures that
        look fine in a vertex count.
        """
        total = 0.0
        for a, b, c in self.faces:
            (ax, ay, az), (bx, by, bz), (cx, cy, cz) = self.verts[a], self.verts[b], self.verts[c]
            total += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx))
        return total / 6.0


@dataclass
class Gable:
    kind: str
    width_m: float
    rise_m: float
    wall_thickness_m: float
    stone: str
    ornament: list[str]
    outline: list[Vec2]
    parts: list[Part] = field(default_factory=list)

    @property
    def above_rise_m(self) -> float:
        """How far anything reaches above the measured ridge. Only a finial ever does."""
        top = max((v[1] for part in self.parts for v in part.verts), default=0.0)
        return max(0.0, top - self.rise_m)

    def stats(self) -> dict:
        verts = sum(len(p.verts) for p in self.parts)
        faces = sum(len(p.faces) for p in self.parts)
        return {
            'kind': self.kind, 'widthM': self.width_m, 'riseM': self.rise_m,
            'wallThicknessM': self.wall_thickness_m, 'stone': self.stone,
            'ornament': self.ornament, 'outline': [list(p) for p in self.outline],
            'verts': verts, 'faces': faces, 'aboveRiseM': _round2(self.above_rise_m),
            'parts': [
                {
                    'name': p.name, 'material': p.material, 'verts': len(p.verts), 'faces': len(p.faces),
                    'volumeM3': round(p.signed_volume(), 6),
                }
                for p in self.parts
            ],
        }


# ---------------------------------------------------------------------------
# Mesh primitives. Plain lists of vertices and triangles: no bpy, no numpy.


def _clean_ring(ring: list[Vec2]) -> list[Vec2]:
    """
    Drop repeated and collinear vertices, then wind counter-clockwise.

    Both cases are really in the data. `gableProfile('trap')` emits its apex
    point twice, and the top run of a step gable is three collinear treads.
    Extruding either produces zero-area side quads — geometry that passes a
    vertex count and fails every renderer, exporter and manifold test — so it is
    removed before anything is built on it. Winding is normalised here because
    the profiles are clockwise and every face routine below assumes CCW.
    """
    points: list[Vec2] = []
    for p in ring:
        if not points or abs(p[0] - points[-1][0]) > 1e-9 or abs(p[1] - points[-1][1]) > 1e-9:
            points.append(p)
    while len(points) > 1 and abs(points[0][0] - points[-1][0]) < 1e-9 and abs(points[0][1] - points[-1][1]) < 1e-9:
        points.pop()

    changed = True
    while changed and len(points) > 3:
        changed = False
        for i in range(len(points)):
            a, b, c = points[i - 1], points[i], points[(i + 1) % len(points)]
            if abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9:
                points.pop(i)
                changed = True
                break

    if _shoelace(points) < 0:
        points.reverse()
    return points


def _shoelace(ring: list[Vec2]) -> float:
    total = 0.0
    for i, (x0, y0) in enumerate(ring):
        x1, y1 = ring[(i + 1) % len(ring)]
        total += x0 * y1 - x1 * y0
    return total / 2.0


def _in_triangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2) -> bool:
    def side(u: Vec2, v: Vec2) -> float:
        return (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0])
    return side(a, b) > 1e-12 and side(b, c) > 1e-12 and side(c, a) > 1e-12


def _triangulate(ring: list[Vec2]) -> list[tuple[int, int, int]]:
    """Ear clipping. The rings here are a dozen vertices and simple, so O(n²) is free."""
    idx = list(range(len(ring)))
    tris: list[tuple[int, int, int]] = []
    while len(idx) > 3:
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = ring[i0], ring[i1], ring[i2]
            if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-12:
                continue  # reflex corner, not an ear
            if any(_in_triangle(ring[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            raise ValueError(f'no ear found in a {len(idx)}-vertex ring; is it self-intersecting?')
    tris.append((idx[0], idx[1], idx[2]))
    return tris


def _has_area(ring: list[Vec2], minimum: float = 1e-4) -> bool:
    """
    Whether a band survived being clipped under the silhouette.

    On a step gable both neighbours of a tread turn toward it, so the coping is
    clipped from both sides and can collapse to a sliver or to nothing. That is
    the correct answer geometrically — there is no room for a moulding in that
    corner — but emitting the collapsed ring anyway produces a zero-volume solid
    that renders as a crack of z-fighting. Half the trapgevel's copings came out
    that way before this guard.
    """
    return len(ring) >= 3 and abs(_shoelace(ring)) >= minimum


def _extrude(ring: list[Vec2], z_back: float, z_front: float, name: str, material: str) -> Part:
    """A CCW ring in the façade plane, given depth. Outward-wound and closed."""
    ring = _clean_ring(ring)
    n = len(ring)
    verts: list[Vec3] = [(x, y, z_front) for x, y in ring] + [(x, y, z_back) for x, y in ring]
    tris = _triangulate(ring)
    faces = [t for t in tris] + [(c + n, b + n, a + n) for a, b, c in tris]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, i + n, j + n))
        faces.append((i, j + n, j))
    return Part(name, material, verts, faces)


def _box(x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, name: str, material: str) -> Part:
    return _extrude([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, name, material)


def _lathe(cx: float, cz: float, base_y: float, levels: list[tuple[float, float]], segments: int,
           name: str, material: str) -> Part:
    """A turned form about the vertical axis, from (height above base, radius) levels."""
    verts: list[Vec3] = []
    for dy, radius in levels:
        for s in range(segments):
            angle = 2 * math.pi * s / segments
            verts.append((cx + radius * math.cos(angle), base_y + dy, cz + radius * math.sin(angle)))
    faces: list[tuple[int, int, int]] = []
    for level in range(len(levels) - 1):
        for s in range(segments):
            a = level * segments + s
            b = level * segments + (s + 1) % segments
            faces.append((a, b, b + segments))
            faces.append((a, b + segments, a + segments))
    bottom = len(verts)
    verts.append((cx, base_y + levels[0][0], cz))
    top = len(verts)
    verts.append((cx, base_y + levels[-1][0], cz))
    last = (len(levels) - 1) * segments
    for s in range(segments):
        faces.append((bottom, (s + 1) % segments, s))
        faces.append((top, last + s, last + (s + 1) % segments))
    return Part(name, material, verts, faces)


# ---------------------------------------------------------------------------
# Reading the outline. Mouldings are placed against the silhouette's own
# segments so they cannot drift away from it, and so they cannot escape it:
# every band is offset *into* the polygon, which for a CCW ring is the left of
# travel, so no moulding rises above the profile at any point along the front.


def _segments(ring: list[Vec2]) -> list[tuple[Vec2, Vec2]]:
    return [(ring[i], ring[(i + 1) % len(ring)]) for i in range(len(ring))]


def _inward_normal(p0: Vec2, p1: Vec2) -> Vec2:
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = math.hypot(dx, dy)
    return (-dy / length, dx / length)  # interior side of a CCW ring


def _clip_half_plane(ring: list[Vec2], through: Vec2, normal: Vec2) -> list[Vec2]:
    """Sutherland–Hodgman against one inward half-plane. Keeps what is on the normal's side."""
    def depth_of(p: Vec2) -> float:
        return (p[0] - through[0]) * normal[0] + (p[1] - through[1]) * normal[1]

    out: list[Vec2] = []
    for i, p in enumerate(ring):
        q = ring[(i + 1) % len(ring)]
        dp, dq = depth_of(p), depth_of(q)
        if dp >= -1e-12:
            out.append(p)
        if (dp > 1e-12 and dq < -1e-12) or (dp < -1e-12 and dq > 1e-12):
            t = dp / (dp - dq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def _edge_band(ring: list[Vec2], index: int, depth: float) -> list[Vec2]:
    """
    A moulding band lying on one outline edge, offset into the masonry.

    Offsetting an edge inward is only inside the polygon if the polygon is that
    thick perpendicular to it, and at a sharp corner it is not: the raking cope
    of a puntgevel, offset a flat 0.13 m from its slope, runs out under the
    eaves at the bottom and through the opposite slope at the apex. Both are
    corners where the outline turns *toward* the band, so the band is clipped by
    the neighbouring edges at exactly those corners and left alone at the
    others. A corner that turns away — the reflex vertex where a halsgevel's
    shoulder meets its neck — needs no clip, because there the wall is wider
    than the band, and clipping against it would delete most of the claw.

    That is what keeps every moulding under the silhouette without a separate
    containment fudge per type.
    """
    n = len(ring)
    p0, p1 = ring[index], ring[(index + 1) % n]
    nx, ny = _inward_normal(p0, p1)
    band = [p0, p1, (p1[0] + nx * depth, p1[1] + ny * depth), (p0[0] + nx * depth, p0[1] + ny * depth)]
    for prev, at, nxt, neighbour in (
        (ring[index - 1], p0, p1, (ring[index - 1], p0)),
        (p0, p1, ring[(index + 2) % n], (p1, ring[(index + 2) % n])),
    ):
        turn = (at[0] - prev[0]) * (nxt[1] - at[1]) - (at[1] - prev[1]) * (nxt[0] - at[0])
        if turn <= 1e-12:
            continue  # reflex: the wall opens out here, nothing to clip against
        band = _clip_half_plane(band, neighbour[0], _inward_normal(*neighbour))
    return band


def _x_span_at(ring: list[Vec2], y: float) -> tuple[float, float]:
    """Where the silhouette is, at one height. Used to fit a band between the flanks."""
    crossings: list[float] = []
    for (x0, y0), (x1, y1) in _segments(ring):
        if (y0 - y) * (y1 - y) <= 0 and abs(y1 - y0) > 1e-9:
            crossings.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
    if not crossings:
        raise ValueError(f'the outline does not reach {y:.2f} m')
    return min(crossings), max(crossings)


def _top_segment(ring: list[Vec2]) -> tuple[Vec2, Vec2] | None:
    """The flat top a neck, bell or cornice ends in. None for a pointed gable."""
    top = max(p[1] for p in ring)
    flat = [s for s in _segments(ring) if abs(s[0][1] - top) < 1e-6 and abs(s[1][1] - top) < 1e-6]
    return max(flat, key=lambda s: abs(s[1][0] - s[0][0])) if flat else None


# ---------------------------------------------------------------------------
# The seven types.


def make_gable(
    kind: str,
    width_m: float,
    rise_m: float,
    *,
    wall_thickness_m: float = WALL_THICKNESS_M,
    ornament: str | None = None,
    stone: str = 'sandstone',
) -> Gable:
    """
    One gable, as geometry.

    `width_m` is the measured plot width and `rise_m` the measured ridge height
    less the measured eaves height — both come from a record, never from here.
    `ornament` is a '+'-separated token set overriding this type's default; pass
    'none' for the bare silhouette. `stone` names the dressing material for
    BUILD-5 to resolve; this lane emits the name and no appearance.
    """
    if kind not in GABLE_TYPES:
        raise ValueError(f'{kind!r} is not one of {GABLE_TYPES}')
    if width_m <= 0 or rise_m <= 0:
        raise ValueError('width and rise are measurements and must be positive')

    tokens = list(DEFAULT_ORNAMENT[kind]) if ornament is None else [
        t.strip() for t in ornament.replace(',', '+').split('+') if t.strip()
    ]
    unknown = set(tokens) - KNOWN_ORNAMENT
    if unknown:
        raise ValueError(f'unknown ornament {sorted(unknown)}; known: {sorted(KNOWN_ORNAMENT)}')
    if 'none' in tokens:
        tokens = []

    outline = gable_profile(kind, width_m, rise_m)
    ring = _clean_ring(outline)
    gable = Gable(kind, width_m, max(0.6, rise_m), wall_thickness_m, stone, tokens, outline)

    # The wall itself: the silhouette given masonry depth, its face at z=0.
    gable.parts.append(_extrude(ring, -wall_thickness_m, 0.0, 'wall', 'brick'))

    if 'dekplaten' in tokens:
        gable.parts.extend(_dekplaten(ring, stone))
    if 'dekband' in tokens:
        gable.parts.extend(_dekbanden(ring, stone))
    if 'klauwstukken' in tokens:
        gable.parts.extend(_klauwstukken(ring, stone))
    if 'taille' in tokens:
        gable.parts.extend(_taille(ring, gable.rise_m, stone))
    if 'kroonlijst' in tokens:
        gable.parts.extend(_kroonlijst(ring, kind, stone))
    if 'consoles' in tokens:
        gable.parts.extend(_consoles(ring, width_m, stone))
    if 'tuit' in tokens:
        gable.parts.extend(_spout(ring, gable.rise_m, stone))
    if 'vaas' in tokens:
        gable.parts.extend(_vaas(ring, stone))
    return gable


def _dekplaten(ring: list[Vec2], stone: str) -> list[Part]:
    """
    The stone treads of a trapgevel.

    A step gable is brick; what makes it read as a staircase from across a canal
    is the sandstone capping each tread, catching light on its top edge and
    throwing a shadow line under its nose. Without these it is a stepped
    silhouette and nothing more. One per horizontal run above the eaves,
    spanning exactly that run so nothing overhangs a step below it.
    """
    parts: list[Part] = []
    for i, (p0, p1) in enumerate(_segments(ring)):
        if abs(p0[1] - p1[1]) > 1e-9 or p0[1] < 1e-9 or abs(p1[0] - p0[0]) < 0.05:
            continue
        band = _edge_band(ring, i, DEKPLAAT_DEPTH_M)
        if not _has_area(band):
            continue  # no room for a moulding in this corner
        parts.append(_extrude(
            band, 0.0, DEKPLAAT_PROJECTION_M, f'dekplaat_{i:02d}', stone,
        ))
    return parts


def _dekbanden(ring: list[Vec2], stone: str) -> list[Part]:
    """The raking cope along a pointed gable's slopes — the same job, on the diagonal."""
    parts: list[Part] = []
    for i, (p0, p1) in enumerate(_segments(ring)):
        dx, dy = abs(p1[0] - p0[0]), abs(p1[1] - p0[1])
        if dx < 0.05 or dy < 0.05 or math.hypot(dx, dy) < 0.4:
            continue
        band = _edge_band(ring, i, DEKBAND_DEPTH_M)
        if not _has_area(band):
            continue  # no room for a moulding in this corner
        parts.append(_extrude(
            band, 0.0, DEKBAND_PROJECTION_M, f'dekband_{i:02d}', stone,
        ))
    return parts


def _klauwstukken(ring: list[Vec2], stone: str) -> list[Part]:
    """
    The claw-pieces of a halsgevel.

    The neck is a rectangle standing on the wall, and it looks like one until
    the klauwstukken are on it: scrolled sandstone wings that carry the eye from
    the shoulder up to the neck and hide the join. They are the defining feature
    of the type — the register names them for only 0.3% of monuments, but a
    halsgevel without them is not one.

    Built along the shoulder segments themselves and offset into the polygon, so
    the wing stays under the silhouette at every point — the difference between
    a claw-piece and an object floating past the gable's edge. The scroll goes
    on the upper segment, against the neck, where it actually turns, and sits on
    the band's own centreline with a radius under half the band's depth, so
    containment follows from the band's rather than from a second calculation.
    """
    centre_x = (min(p[0] for p in ring) + max(p[0] for p in ring)) / 2
    shoulders: dict[str, list[tuple[int, tuple[Vec2, Vec2]]]] = {'l': [], 'r': []}
    for i, (p0, p1) in enumerate(_segments(ring)):
        if abs(p1[0] - p0[0]) < 0.05 or abs(p1[1] - p0[1]) < 0.05:
            continue
        shoulders['l' if (p0[0] + p1[0]) / 2 < centre_x else 'r'].append((i, (p0, p1)))

    parts: list[Part] = []
    for side, segments in shoulders.items():
        if not segments:
            continue
        scroll_at = max(segments, key=lambda s: max(s[1][0][1], s[1][1][1]))[0]
        for i, (p0, p1) in segments:
            length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
            depth = min(KLAUWSTUK_DEPTH_M, length * 0.75)
            band = _edge_band(ring, i, depth)
            if not _has_area(band):
                continue
            parts.append(_extrude(
                band, 0.0, KLAUWSTUK_PROJECTION_M, f'klauwstuk_{side}_{i:02d}', stone,
            ))
            if i != scroll_at:
                continue
            radius = min(VOLUTE_RADIUS_M, depth * 0.45, length * 0.28)
            ux, uy = (p1[0] - p0[0]) / length, (p1[1] - p0[1]) / length
            t = 0.34 if p1[1] > p0[1] else 0.66  # a third of the way down from the neck
            cx = p0[0] + ux * length * t - uy * depth * 0.5
            cy = p0[1] + uy * length * t + ux * depth * 0.5
            circle = [(cx + radius * math.cos(2 * math.pi * s / 12), cy + radius * math.sin(2 * math.pi * s / 12))
                      for s in range(12)]
            parts.append(_extrude(circle, 0.0, KLAUWSTUK_PROJECTION_M * 1.4, f'volute_{side}_{i:02d}', stone))
    return parts


def _taille(ring: list[Vec2], rise_m: float, stone: str) -> list[Part]:
    """
    The klokgevel's waist.

    The bell's flanks are a smooth curve, and a smooth curve rendered in brick
    reads as a bulge rather than a bell. The waist moulding is the horizontal
    line that tells the eye where the curve changes its mind. Placed at 0.58 of
    the rise and fitted between the flanks at that height, so it shortens as the
    gable narrows, exactly as the drawn ones do.
    """
    y = rise_m * 0.58
    x0, x1 = _x_span_at(ring, y)
    return [_box(x0, x1, y - TAILLE_DEPTH_M, y, 0.0, TAILLE_PROJECTION_M, 'taille', stone)]


def _kroonlijst(ring: list[Vec2], kind: str, stone: str) -> list[Part]:
    """
    The crowning cornice, across whatever flat top the type ends in.

    For a lijstgevel this is the entire gable — 42% of the described monuments
    in the register are this and nothing else, so it has to be a real projecting
    box with a shadow under it rather than a line. On a neck or bell gable the
    same moulding is present but shallower, capping the neck.
    """
    top = _top_segment(ring)
    if top is None:
        return []
    x0, x1 = sorted((top[0][0], top[1][0]))
    y = top[0][1]
    projection = KROONLIJST_PROJECTION_M if kind == 'lijst' else GABLE_TOP_LIJST_PROJECTION_M
    depth = min(KROONLIJST_DEPTH_M, y * 0.6)
    return [_box(x0, x1, y - depth, y, 0.0, projection, 'kroonlijst', 'timber' if kind == 'lijst' else stone)]


def _consoles(ring: list[Vec2], width_m: float, stone: str) -> list[Part]:
    """
    Brackets under the cornice.

    Evenly spaced at about 0.78 m, which is what a 5.7 m front with seven of
    them gives — the build prompt's own `make_cornice(width_m=5.4, brackets=7)`.
    They are small, and they are the reason a kroonlijst has depth at a distance
    where the cornice itself is one bright line.
    """
    top = _top_segment(ring)
    if top is None:
        return []
    x0, x1 = sorted((top[0][0], top[1][0]))
    y = top[0][1] - min(KROONLIJST_DEPTH_M, top[0][1] * 0.6)
    count = max(2, round_half_up((x1 - x0) / CONSOLE_PITCH_M))
    drop = min(CONSOLE_DROP_M, max(0.06, y * 0.5))
    parts: list[Part] = []
    for i in range(count):
        centre = x0 + (x1 - x0) * (i + 0.5) / count
        parts.append(_box(
            centre - CONSOLE_WIDTH_M / 2, centre + CONSOLE_WIDTH_M / 2, y - drop, y,
            0.0, KROONLIJST_PROJECTION_M * 0.72, f'console_{i:02d}', stone,
        ))
    return parts


def _spout(ring: list[Vec2], rise_m: float, stone: str) -> list[Part]:
    """
    The tuit.

    The spout is the whole name of the type: a narrow chimney-like block finished
    with a stone cap, standing where a pointed gable would have come to a point.
    Fitted to the flat top the profile already provides, with the cap flush to
    the measured ridge rather than above it.
    """
    top = _top_segment(ring)
    if top is None:
        return []
    x0, x1 = sorted((top[0][0], top[1][0]))
    y = top[0][1]
    shaft_base = max(0.0, y - min(0.55, rise_m * 0.22))
    cap = min(0.12, (y - shaft_base) * 0.4)
    return [
        _box(x0, x1, shaft_base, y - cap, 0.0, SPOUT_PROJECTION_M * 0.6, 'tuit_shaft', 'brick'),
        _box(x0, x1, y - cap, y, 0.0, SPOUT_PROJECTION_M, 'tuit_cap', stone),
    ]


def _vaas(ring: list[Vec2], stone: str) -> list[Part]:
    """
    A finial vase on the apex.

    Off by default and the only part of this library that goes above the
    measured ridge, because that is what a finial is. `Gable.above_rise_m`
    reports how far, so an assembly can decide whether it clears its neighbours
    rather than discovering it in a screenshot.
    """
    top = _top_segment(ring)
    if top is None:
        return []
    cx = (top[0][0] + top[1][0]) / 2
    y = top[0][1]
    levels = [(0.0, 0.16), (0.06, 0.16), (0.09, 0.11), (0.30, 0.20), (0.48, 0.13), (0.55, 0.16), (0.62, 0.07)]
    return [_lathe(cx, 0.0, y, levels, 12, 'vaas', stone)]


# ---------------------------------------------------------------------------
# Export. One geometry, two destinations.


def to_obj(gables: list[Gable], mtllib: str | None = None) -> str:
    """
    Wavefront OBJ, one object per part.

    OBJ because it is the format that needs nothing installed to write and
    nothing installed to read: it is what makes this lane checkable on a machine
    with no Blender, which is every machine this has run on so far.
    """
    lines: list[str] = ['# Amsterdam façade twin — BUILD-1 gable library', '# +x along the frontage, +y above the eaves, +z toward the water']
    if mtllib:
        lines.append(f'mtllib {mtllib}')
    offset = 1
    for gable in gables:
        lines.append(f'# {gable.kind} {gable.width_m:.2f} m × {gable.rise_m:.2f} m rise, ornament {"+".join(gable.ornament) or "none"}')
        for part in gable.parts:
            lines.append(f'o {gable.kind}__{part.name}')
            lines.append(f'usemtl {part.material}')
            for x, y, z in part.verts:
                lines.append(f'v {x:.6f} {y:.6f} {z:.6f}')
            for a, b, c in part.faces:
                lines.append(f'f {a + offset} {b + offset} {c + offset}')
            offset += len(part.verts)
    return '\n'.join(lines) + '\n'


def to_mtl(gables: list[Gable]) -> str:
    """
    Material *names* only.

    BUILD-5 owns the brick bonds, sandstone and paint. Writing plausible Kd
    values here would be a second, worse material library that someone would
    later have to notice was fake, so the names are declared and left empty.
    """
    names = sorted({part.material for gable in gables for part in gable.parts})
    lines = ['# Names for BUILD-5 to resolve. Deliberately without appearance values.']
    for name in names:
        lines.append(f'newmtl {name}')
    return '\n'.join(lines) + '\n'


def has_bpy() -> bool:
    try:
        import bpy  # noqa: F401
    except ImportError:
        return False
    return True


def to_blender(gable: Gable, collection_name: str | None = None):
    """
    Hand the already-built mesh to Blender.

    Deliberately the last step and nothing but a transfer: Blender is not asked
    to generate anything, so a machine with Blender and a machine without emit
    the same vertices. Returns the created objects.
    """
    import bpy  # imported here so the module loads without Blender

    name = collection_name or f'gable_{gable.kind}'
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    objects = []
    for part in gable.parts:
        mesh = bpy.data.meshes.new(f'{name}_{part.name}')
        mesh.from_pydata([tuple(v) for v in part.verts], [], [list(f) for f in part.faces])
        mesh.validate()
        mesh.update()
        material = bpy.data.materials.get(part.material) or bpy.data.materials.new(part.material)
        mesh.materials.append(material)
        obj = bpy.data.objects.new(f'{name}_{part.name}', mesh)
        collection.objects.link(obj)
        objects.append(obj)
    return objects


def export_glb(path: str) -> None:
    """Compressed GLB for the runtime, which is the only thing the game ever loads."""
    import bpy

    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_draco_mesh_compression_enable=True,
        export_apply=True, use_selection=False,
    )


# ---------------------------------------------------------------------------
# Verification entry point.
#
# Emits, for each type, the silhouette this library builds from and a summary of
# the solids it produced, so scripts/check-facade-gable-library.ts can hold it
# against gableProfile() in generate.ts — which is the source of truth and is
# itself pinned by 59 checks. Nothing here regenerates that profile; the point of
# the check is that two implementations of one shape agree.

def _dump(width_m: float = 5.66, rise_m: float = 3.2) -> str:
    import json

    out = []
    for kind in GABLE_TYPES:
        gable = make_gable(kind, width_m, rise_m)
        parts = [
            {
                'name': part.name,
                'material': part.material,
                'verts': len(part.verts),
                'faces': len(part.faces),
                # Six decimals, not two: a step coping is 0.44 x 0.09 x 0.11 m,
                # which is 0.004 m³ and rounds to zero at two — making a correct
                # solid look like a triangulation failure to anything checking it.
                'volume': round(part.signed_volume(), 6),
            }
            for part in gable.parts
        ]
        out.append({
            'kind': kind,
            'widthM': width_m,
            'riseM': rise_m,
            'profile': [[_round2(x), _round2(y)] for x, y in gable_profile(kind, width_m, rise_m)],
            'parts': parts,
            'totalVolume': round(sum(p['volume'] for p in parts), 6),
        })
    return json.dumps({'widthM': width_m, 'riseM': rise_m, 'gables': out}, indent=1)


if __name__ == '__main__':
    import sys

    width = float(sys.argv[1]) if len(sys.argv) > 1 else 5.66
    rise = float(sys.argv[2]) if len(sys.argv) > 2 else 3.2
    print(_dump(width, rise))
