"""Pure roof compiler: planar triangles with shared join/boundary vertices.

The owner footprint and eaves are unchanged. The front roof is capped behind
the facade by a planar ramp, an inferred join rather than a hidden measurement.
Courtyard rings and multiple roof volumes require a separate compiler.
"""
from dataclasses import dataclass
import math
from .layout import SURFACES
from .polygons import area, triangulate

EPSILON = 1e-8


def clip_half_plane(polygon, distance):
    """Clip a convex polygon to signed distance >= 0."""
    result = []
    for p, q in zip(polygon, polygon[1:] + polygon[:1]):
        dp, dq = distance(p), distance(q)
        inside_p, inside_q = dp >= 0, dq >= 0
        if inside_p:
            result.append(p)
        if inside_p != inside_q:
            t = dp / (dp - dq)
            result.append(tuple(p[i] + t * (q[i] - p[i]) for i in range(2)))
    clean = []
    for point in result:
        if not clean or math.dist(point, clean[-1]) > EPSILON:
            clean.append(point)
    if len(clean) > 1 and math.dist(clean[0], clean[-1]) <= EPSILON:
        clean.pop()
    return clean


def silhouette_height(profile, x):
    """Lowest intersection: handles reentrant bell/neck outlines."""
    heights = []
    for p, q in zip(profile, profile[1:]):
        if min(p[0], q[0]) - EPSILON <= x <= max(p[0], q[0]) + EPSILON:
            if abs(q[0] - p[0]) < EPSILON:
                heights.extend((p[1], q[1]))
            else:
                heights.append(p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]))
    return min(heights) if heights else None


def roof_height(spec, width, x):
    """Main pitch; footprint extensions beyond the frontage use edge height."""
    eaves, rise = spec['eaves'], spec['top'] - spec['eaves']
    if spec['kind'] == 'flat':
        return eaves
    position = min(1.0, max(0.0, x / width))
    if spec['kind'] == 'shed':
        return eaves + rise * position
    if spec['kind'] in ('pitched', 'gambrel'):
        profile = pitch_profile(spec, width)
        for (left, low), (right, high) in zip(profile, profile[1:]):
            if left <= x <= right:
                return low + (high - low) * (x - left) / (right - left)
        return eaves
    raise ValueError('Unsupported roof kind: ' + str(spec['kind']))


def pitch_breaks(spec, width):
    """Independent structural span/ridge, never derived from a gable outline."""
    span = spec.get('pitchSpan', [0, width])
    if len(span) != 2:
        raise ValueError('Roof pitchSpan requires two x coordinates')
    left, right = span
    ridge = spec.get('ridgeX', (left + right) / 2)
    if not all(math.isfinite(value) for value in (left, ridge, right)) or not left < ridge < right:
        raise ValueError('Roof pitchSpan/ridgeX must be finite and strictly ordered')
    return left, ridge, right


def pitch_profile(spec, width):
    """Authored structural section, independent of the facade silhouette.

    A gambrel has two steep lower pitches and two shallow upper pitches. Its
    knee span and height are mandatory so an unseen structure is not silently
    guessed from the street gable. This is a gabled roof, not a hipped mansard.
    """
    left, ridge, right = pitch_breaks(spec, width)
    eaves, top = spec['eaves'], spec['top']
    if spec['kind'] != 'gambrel':
        return [(left, eaves), (ridge, top), (right, eaves)]
    knees = spec.get('kneeSpan')
    knee_height = spec.get('kneeHeight')
    if not isinstance(knees, (list, tuple)) or len(knees) != 2 or knee_height is None:
        raise ValueError('Gambrel roof requires explicit kneeSpan and kneeHeight')
    a, b = knees
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (a, b, knee_height)):
        raise ValueError('Gambrel knee coordinates and height must be finite')
    if not left < a < ridge < b < right or not eaves < knee_height < top:
        raise ValueError('Gambrel knees must lie between eaves and ridge')
    if ((knee_height-eaves)/(a-left) <= (top-knee_height)/(ridge-a) or
            (knee_height-eaves)/(right-b) <= (top-knee_height)/(b-ridge)):
        raise ValueError('Gambrel lower pitches must be steeper than upper pitches')
    return [(left, eaves), (a, knee_height), (ridge, top),
            (b, knee_height), (right, eaves)]


def _line(p, q):
    if abs(q[0] - p[0]) <= EPSILON:
        return None
    slope = (q[1] - p[1]) / (q[0] - p[0])
    return slope, p[1] - slope * p[0]


def _profile_breaks(profile, eaves, clearance):
    breaks = {p[0] for p in profile}
    segments = [(p, q, _line(p, q)) for p, q in zip(profile, profile[1:])]
    for p, q, line in segments:
        if line is None:
            continue
        slope, intercept = line
        if abs(slope) > EPSILON:
            x = (eaves + clearance - intercept) / slope
            if min(p[0], q[0]) < x < max(p[0], q[0]):
                breaks.add(x)
        for a, b, other in segments:
            if other is None or abs(slope - other[0]) <= EPSILON:
                continue
            x = (other[1] - intercept) / (slope - other[0])
            left = max(min(p[0], q[0]), min(a[0], b[0]))
            right = min(max(p[0], q[0]), max(a[0], b[0]))
            if left < x < right:
                breaks.add(x)
    return breaks


@dataclass
class RoofSurface:
    vertices: list
    triangles: list
    boundary: list
    setback: float
    eaves: float

    def height(self, x, y):
        """Query the triangles themselves; reject unsupported attachments."""
        for face in self.triangles:
            a, b, c = [self.vertices[i] for i in face]
            denominator = ((b[1] - c[1]) * (a[0] - c[0]) +
                           (c[0] - b[0]) * (a[1] - c[1]))
            u = ((b[1] - c[1]) * (x - c[0]) +
                 (c[0] - b[0]) * (y - c[1])) / denominator
            v = ((c[1] - a[1]) * (x - c[0]) +
                 (a[0] - c[0]) * (y - c[1])) / denominator
            if min(u, v, 1 - u - v) >= -1e-7:
                return u * a[2] + v * b[2] + (1 - u - v) * c[2]
        raise ValueError(f'Roof attachment ({x:.3f}, {y:.3f}) is outside the roof')


class _RoofMesh:
    """Shared welded tessellation for planar roof patches."""
    def __init__(self,weld_digits=8,weld_xy=False):
        self.vertices, self.triangles, self.indices = [], [], {}
        self.weld_digits=weld_digits
        self.weld_xy=weld_xy

    def vertex(self, point):
        key = tuple(round(value, self.weld_digits) for value in (point[:2] if self.weld_xy else point))
        if key not in self.indices:
            self.indices[key] = len(self.vertices)
            self.vertices.append(tuple(point))
        return self.indices[key]

    def patch(self, polygon, plane):
        if len(polygon) < 3 or abs(area(polygon)) <= EPSILON:
            return
        if area(polygon) < 0:
            polygon.reverse()
        ids = [self.vertex((x, y, plane(x, y))) for x, y in polygon]
        if len(ids) == 3:
            self.triangles.append(tuple(ids))
            return
        # Retain edge subdivisions: removing collinear points opens T junctions.
        x = sum(p[0] for p in polygon) / len(polygon)
        y = sum(p[1] for p in polygon) / len(polygon)
        middle = self.vertex((x, y, plane(x, y)))
        self.triangles.extend((ids[i], ids[(i + 1) % len(ids)], middle)
                              for i in range(len(ids)))

    def surface(self, setback, eaves):
        if self.weld_digits<8:
            self.triangles=[face for face in self.triangles if len(set(face))==3 and abs(area([self.vertices[i][:2] for i in face]))>EPSILON]
        if not self.triangles:
            raise ValueError('Roof setback removes the entire footprint')
        edges = {}
        for face in self.triangles:
            for a, b in zip(face, face[1:] + face[:1]):
                edges.setdefault(tuple(sorted((a, b))), []).append((a, b))
        if any(len(uses) > 2 for uses in edges.values()):
            raise ValueError('Roof surface has overlapping/nonmanifold triangles')
        boundary = [uses[0] for uses in edges.values() if len(uses) == 1]
        return RoofSurface(self.vertices, self.triangles, boundary, setback, eaves)


def _compile_hip(spec, ring, setback, eaves):
    """Four-plane hip over an axis-aligned rectangle; reject concave volumes.

    The depth and width come from the shell itself. The longitudinal run is
    authored separately, because the street cornice cannot measure a hidden hip.
    """
    left, right = min(p[0] for p in ring), max(p[0] for p in ring)
    front, back = min(p[1] for p in ring), max(p[1] for p in ring)
    rectangle_area = (right-left)*(back-front)
    if (abs(abs(area(ring))-rectangle_area) > EPSILON or
            any(abs(a[0]-b[0]) > EPSILON and abs(a[1]-b[1]) > EPSILON
                for a,b in zip(ring,ring[1:]+ring[:1]))):
        raise ValueError('Hip roof requires an axis-aligned rectangular footprint; split concave shells into explicit volumes')
    front = max(front, setback)
    if front >= back:
        raise ValueError('Roof setback removes the entire footprint')
    run = spec.get('hipEndRun')
    if not isinstance(run, (int,float)) or not math.isfinite(run) or not 0 < run <= (back-front)/2:
        raise ValueError('Hip roof requires finite positive hipEndRun no greater than half its roof depth')
    structural = dict(spec)
    structural.setdefault('pitchSpan', [left,right])
    span_left, ridge, span_right = pitch_breaks(structural, right-left)
    if abs(span_left-left)>EPSILON or abs(span_right-right)>EPSILON or not left < ridge < right:
        raise ValueError('Hip pitch span must match the actual rectangular footprint')
    rise = spec['top']-eaves
    if rise <= 0:
        raise ValueError('Hip roof top must be above eaves')
    planes = [lambda x,y:eaves+rise*(x-left)/(ridge-left),
              lambda x,y:eaves+rise*(right-x)/(right-ridge),
              lambda x,y:eaves+rise*(y-front)/run,
              lambda x,y:eaves+rise*(back-y)/run]
    mesh = _RoofMesh()
    for face in triangulate(ring):
        original = clip_half_plane([ring[i] for i in face],lambda p:p[1]-setback)
        for i,plane in enumerate(planes):
            polygon = original
            for j,other in enumerate(planes):
                if i != j:
                    polygon = clip_half_plane(polygon,lambda p:other(*p)-plane(*p))
                if len(polygon)<3:
                    break
            mesh.patch(polygon,plane)
    return mesh.surface(setback,eaves)


def compile_roof(recipe,*,source_ownership=False):
    """Weld one covering, preserving concave boundaries and planar facets.

    Clipping footprint triangles avoids spanning footprint notches. Each patch
    uses exactly one plane, so the exporter never chooses a warped diagonal.
    """
    spec = recipe['roof']
    ring = [tuple(p) for p in recipe['footprint']]
    profile = recipe['gable']['profile']
    width = recipe['frontages'][0]['width']
    eaves = spec['eaves']
    setback = spec.get('setback', SURFACES['roof_start'])
    transition = spec.get('frontTransition', 1.5)
    clearance = spec.get('gableClearance', .02)
    if width <= 0 or transition <= 0 or clearance < 0:
        raise ValueError('Roof width/transition must be positive; clearance nonnegative')
    if not source_ownership and setback < SURFACES['shell_back'] - EPSILON:
        raise ValueError('Roof setback crosses the facade-owned slab')
    if len(profile) < 2:
        raise ValueError('Roof join requires a facade profile with at least two points')
    if spec['top'] < eaves or not all(math.isfinite(value) for value in
                                    (width, eaves, spec['top'], setback, transition, clearance)):
        raise ValueError('Roof heights and join parameters must be finite and ordered')
    if any(len(point) != 2 or not all(math.isfinite(value) for value in point)
           for point in ring + list(profile)):
        raise ValueError('Roof footprint/profile require finite 2D points')
    if recipe.get('holes'):
        raise ValueError('Roof courtyard holes require explicit roof volumes')
    join=spec.get('frontJoin','silhouette')
    if join not in ('silhouette','hip'):raise ValueError('Unsupported roof frontJoin')
    if join=='hip' and spec['kind'] not in ('pitched','gambrel'):raise ValueError('Front hip join requires pitched or gambrel roof')
    if spec['kind'] == 'hip':
        return _compile_hip(spec, ring, setback, eaves)
    if spec['kind'] == 'mansard':
        return _compile_mansard(spec, ring, setback, eaves)
    join=spec.get('frontJoin','silhouette')
    if join not in ('silhouette','hip'):raise ValueError('Unsupported roof frontJoin')
    hip_run=spec.get('frontHipRun')
    if join=='hip':
        if spec['kind'] not in ('pitched','gambrel'):raise ValueError('Front hip join requires pitched or gambrel roof')
        if isinstance(hip_run,bool) or not isinstance(hip_run,(int,float)) or not math.isfinite(hip_run) or not .05<hip_run<max(p[1] for p in ring)-setback:
            raise ValueError('frontHipRun must be finite, positive and shorter than roof depth')
        if spec['top']<=eaves:raise ValueError('Front hip join requires a positive roof rise')
    roof_height(spec, width, 0)
    breaks = {min(p[0] for p in ring), max(p[0] for p in ring), 0, width, width / 2}
    if spec['kind'] in ('pitched', 'gambrel'):
        breaks.update(point[0] for point in pitch_profile(spec, width))
        breaks.update(_profile_breaks(profile, eaves, clearance))
    breaks = sorted(breaks)
    drops = []
    for x in breaks:
        front = silhouette_height(profile, x)
        if front is not None:
            drops.append(roof_height(spec, width, x) - max(eaves, front - clearance))
    longitudinal = (spec['top']-eaves)/hip_run if join=='hip' else max([0] + drops) / transition
    mesh = _RoofMesh()

    footprint_triangles = triangulate(ring)
    for left, right in zip(breaks, breaks[1:]):
        if right - left <= EPSILON:
            continue
        middle = (left + right) / 2
        base_left, base_right = roof_height(spec, width, left), roof_height(spec, width, right)
        base_slope = (base_right - base_left) / (right - left)
        base = lambda x, y: base_left + base_slope * (x - left)
        # At a vertical gable step, use the lower knot on both adjoining
        # regions. This stays behind the silhouette and avoids a discontinuity
        # in the covering; the roof need not reproduce the facade's step.
        left_profile = silhouette_height(profile, left)
        right_profile = silhouette_height(profile, right)
        left_height = max(eaves, left_profile - clearance) if left_profile is not None else eaves
        right_height = max(eaves, right_profile - clearance) if right_profile is not None else eaves
        slope = (right_height - left_height) / (right - left)
        intercept = left_height - slope * left
        front = (lambda x,y:eaves+longitudinal*(y-setback)) if join=='hip' else (lambda x, y: slope * x + intercept + longitudinal * (y - setback))
        for face in footprint_triangles:
            polygon = [ring[i] for i in face]
            for distance in (lambda p: p[0] - left, lambda p: right - p[0],
                             lambda p: p[1] - setback):
                polygon = clip_half_plane(polygon, distance)
                if len(polygon) < 3:
                    break
            if len(polygon) < 3:
                continue
            if spec['kind'] not in ('pitched', 'gambrel') or longitudinal <= EPSILON:
                mesh.patch(polygon, base)
                continue
            differences = [front(*p) - base(*p) for p in polygon]
            if min(differences) >= -EPSILON:
                mesh.patch(polygon, base)
            elif max(differences) <= EPSILON:
                mesh.patch(polygon, front)
            else:
                mesh.patch(clip_half_plane(polygon, lambda p: front(*p) - base(*p)), base)
                mesh.patch(clip_half_plane(polygon, lambda p: base(*p) - front(*p)), front)
    return mesh.surface(setback, eaves)


def _compile_mansard(spec, ring, setback, eaves):
    """Authored nested rectangular courses, independent of street gables."""
    left, right = min(p[0] for p in ring), max(p[0] for p in ring)
    original_front, back = min(p[1] for p in ring), max(p[1] for p in ring)
    if (abs(abs(area(ring))-(right-left)*(back-original_front)) > EPSILON or
            any(abs(a[0]-b[0]) > EPSILON and abs(a[1]-b[1]) > EPSILON
                for a,b in zip(ring, ring[1:]+ring[:1]))):
        raise ValueError('Mansard roof requires an axis-aligned rectangular footprint')
    front = max(original_front, setback)
    knee, deck, knee_height = (spec.get(k) for k in ('kneeInset','topInset','kneeHeight'))
    if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (knee,deck,knee_height)):
        raise ValueError('Mansard requires explicit finite kneeInset, topInset and kneeHeight')
    if not 0 < knee < deck < min(right-left,back-front)/2 or not eaves < knee_height < spec['top']:
        raise ValueError('Mansard courses must be ordered inside the actual roof footprint')
    if (knee_height-eaves)/knee <= (spec['top']-knee_height)/(deck-knee):
        raise ValueError('Mansard lower pitch must be steeper than upper pitch')
    mesh = _RoofMesh()
    rings = [[(left+d,front+d,z),(right-d,front+d,z),
              (right-d,back-d,z),(left+d,back-d,z)]
             for d,z in ((0,eaves),(knee,knee_height),(deck,spec['top']))]
    for outer,inner in zip(rings,rings[1:]):
        for i in range(4):
            points=[outer[i],outer[(i+1)%4],inner[(i+1)%4],inner[i]]
            ids=[mesh.vertex(p) for p in points]
            mesh.triangles.extend(((ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])))
    ids=[mesh.vertex(p) for p in rings[-1]]
    mesh.triangles.extend(((ids[0],ids[1],ids[2]),(ids[0],ids[2],ids[3])))
    return mesh.surface(setback,eaves)


def boundary_infill(surface, close_front=False):
    """Wall closures share the covering's exact top edges.

    Pitched/flat street cuts belong to the facade. Shed end closure is at the
    facade's back plane, never a triangular surface across the street front.
    """
    vertices, triangles = [], []
    for ai, bi in surface.boundary:
        a, b = surface.vertices[ai], surface.vertices[bi]
        if not close_front and abs(a[1] - surface.setback) < 1e-7 and abs(b[1] - surface.setback) < 1e-7:
            continue
        offset = len(vertices)
        vertices.extend(((a[0], a[1], surface.eaves), (b[0], b[1], surface.eaves), b, a))
        if b[2] - surface.eaves > EPSILON:
            triangles.append((offset, offset + 1, offset + 2))
        if a[2] - surface.eaves > EPSILON:
            triangles.append((offset, offset + 2, offset + 3))
    return vertices, triangles
