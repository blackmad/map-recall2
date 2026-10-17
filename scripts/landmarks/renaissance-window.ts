import * as T from 'three';

/**
 * Round-headed Dutch Renaissance church window (Hendrick de Keyser's Westerkerk, 1620-31), as a kit component.
 *
 * The photo (Gemeente Amsterdam panoramas 2025, Westermarkt side) shows: a white sandstone surround with blocked jambs and a
 * keystone, standing proud of the brick so the glazing sits in a reveal; a stone mullion splitting the light into two round-headed
 * lights with an oculus in the head; small leaded panes with heavier iron bars every few courses; tall windows under a stone
 * pediment on the transept fronts; and half-round clerestory lunettes with a radiating fan over the lean-to aisle roofs.
 *
 * Geometry is in the window's own frame: x along the wall, y up from the bottom of the opening, z out of the wall face (the wall
 * is z = 0). Layers stand clear of the 2-3 cm z-fight band: the glass 5 cm in front of the brick, the leading (flat strips that run into
 * the reveal) 4 cm in front of the glass, the stone tracery in front of the leading, the surround's front 21 cm out (the reveal). Nothing here crosses x = +-w/2+s,
 * so a window placed on an exposed wall span never reaches round a corner.
 */
export type WindowColour = 'stone' | 'glass' | 'white';
export interface RenaissanceWindowSpec {
  /** Opening width and height (m); the head is a half circle of radius w/2. */
  w: number; h: number;
  /** 2: mullion, two round-headed lights and an oculus. 1: one light; with `fan`, a radiating fan in the head (the lunettes). */
  lights?: 1 | 2;
  fan?: boolean;
  /** Surround face width (m) and depth out of the wall (m). */
  surround?: number; depth?: number;
  pediment?: boolean;
  /** Blocked jambs (alternating long and short stones). */
  blocked?: boolean;
  keystone?: boolean;
  /** Leaded pane size (m). */
  pane?: [number, number];
}
export interface WindowPart { g: T.BufferGeometry; c: WindowColour }

const GLASS_Z = 0.05, LEAD_Z = 0.09, TRACERY_Z = 0.11;

function roundHeaded(w: number, h: number, x0 = 0, y0 = 0): T.Path {
  const p = new T.Path(), r = w / 2;
  p.moveTo(x0 - r, y0); p.lineTo(x0 + r, y0); p.lineTo(x0 + r, y0 + h - r); p.absarc(x0, y0 + h - r, r, 0, Math.PI, false); p.lineTo(x0 - r, y0);
  return p;
}
function roundHeadedShape(w: number, h: number, x0 = 0, y0 = 0): T.Shape {
  const s = new T.Shape(), r = w / 2;
  s.moveTo(x0 - r, y0); s.lineTo(x0 + r, y0); s.lineTo(x0 + r, y0 + h - r); s.absarc(x0, y0 + h - r, r, 0, Math.PI, false); s.lineTo(x0 - r, y0);
  return s;
}
function extrude(shape: T.Shape, depth: number, z: number, segments = 16): T.BufferGeometry {
  const g = new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: segments});
  g.translate(0, 0, z);
  return g;
}
function bar(x: number, y: number, w: number, h: number, z: number, d: number): T.BufferGeometry {
  return new T.BoxGeometry(w, h, d).translate(x, y + h / 2, z + d / 2);
}
/** Leading: a flat strip (two triangles) at z, facing out; it reaches the reveal or mullion so it is attached, not floating. */
function lead(x: number, y: number, w: number, h: number, z: number): T.BufferGeometry {
  return new T.PlaneGeometry(w, h).translate(x, y + h / 2, z);
}
/** Band of a circle between radii r - t/2 and r + t/2 over [a0, a1] (radians). */
function arcBand(cx: number, cy: number, r: number, t: number, a0: number, a1: number): T.Shape {
  const s = new T.Shape();
  s.absarc(cx, cy, r + t / 2, a0, a1, false);
  s.absarc(cx, cy, Math.max(0.01, r - t / 2), a1, a0, true);
  s.closePath();
  return s;
}
/** Bar from p to q (in the window plane), thickness t, depth d at z. */
function strut(p: [number, number], q: [number, number], t: number, z: number, d: number): T.BufferGeometry {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return new T.BoxGeometry(len, t, d).rotateZ(Math.atan2(q[1] - p[1], q[0] - p[0])).translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z + d / 2);
}

export function renaissanceWindow(spec: RenaissanceWindowSpec): WindowPart[] {
  const {w, h} = spec, lights = spec.lights ?? 2, s = spec.surround ?? Math.min(0.42, 0.11 * w), D = spec.depth ?? 0.24;
  const [pw, ph] = spec.pane ?? [0.45, 0.62], R = w / 2, ys = h - R, out: WindowPart[] = [];
  const add = (g: T.BufferGeometry, c: WindowColour) => out.push({g, c});
  // Surround: a round-headed ring, embedded 3 cm in the brick, its inner faces are the reveal.
  const ring = roundHeadedShape(w + 2 * s, h + 2 * s, 0, -s);
  ring.holes.push(roundHeaded(w, h));
  add(extrude(ring, D + 0.03, -0.03, 7), 'stone');
  // Projecting sill.
  add(new T.BoxGeometry(w + 2 * s + 0.3, 0.18, D + 0.15).translate(0, -s - 0.09, (D + 0.15) / 2 - 0.03), 'stone');
  if (spec.keystone ?? true) add(new T.BoxGeometry(Math.min(0.7, w * 0.2), s + 0.35, D + 0.08).translate(0, h + s / 2 - 0.05, (D + 0.08) / 2 - 0.03), 'stone');
  if (spec.blocked ?? true) {
    // Alternate long and short jamb stones, 6 cm proud of the surround face.
    let k = 0;
    for (let y = -s + 0.05; y + 0.4 < h - R; y += 0.85, k++) {
      const bw = s + (k % 2 ? 0.12 : 0.3);
      for (const side of [-1, 1]) add(new T.BoxGeometry(bw, 0.4, D + 0.09).translate(side * (w / 2 + bw / 2), y + 0.2, (D + 0.09) / 2 - 0.03), 'stone');
    }
  }
  if (spec.pediment) {
    const pw2 = w + 2 * s + 0.9, base = h + s + 0.1, tri = new T.Shape();
    tri.moveTo(-pw2 / 2, 0); tri.lineTo(pw2 / 2, 0); tri.lineTo(0, Math.min(1.3, pw2 * 0.22)); tri.closePath();
    add(new T.BoxGeometry(pw2 + 0.2, 0.26, D + 0.12).translate(0, base + 0.13, (D + 0.12) / 2 - 0.03), 'stone');
    add(extrude(tri, D + 0.06, -0.03).translate(0, base + 0.26, 0), 'stone');
  }
  // Glass in the reveal.
  add(new T.ShapeGeometry(roundHeadedShape(w, h), 7).translate(0, 0, GLASS_Z), 'glass');
  // Lights: [x0, x1, arc centre x, arc radius, springing].
  const m = lights === 2 ? Math.max(0.16, w * 0.06) : 0, r = lights === 2 ? (w - m) / 4 : R;
  const lightList: [number, number, number, number][] = lights === 2 ? [[-R, -m / 2, -(m / 2 + r), r], [m / 2, R, m / 2 + r, r]] : [[-R, R, 0, R]];
  const leadW = 0.035, iron = 0.07;
  for (const [x0, x1, cx, rr] of lightList) {
    const top = (x: number) => ys + Math.sqrt(Math.max(0, rr * rr - (x - cx) * (x - cx)));
    // Leaded panes: verticals up to the light's arch, horizontals across the light (chord width in the head).
    const n = Math.max(2, Math.round((x1 - x0) / pw));
    for (let i = 1; i < n; i++) { const x = x0 + ((x1 - x0) * i) / n, t = top(x) + 0.02; if (t > 0.1) add(lead(x, -0.02, leadW, t, LEAD_Z), 'white'); }
    let k = 0;
    for (let y = ph; y < ys + rr - 0.15; y += ph, k++) {
      const half = y <= ys ? (x1 - x0) / 2 : Math.sqrt(Math.max(0, rr * rr - (y - ys) * (y - ys)));
      if (half < 0.08) continue;
      const mid = y <= ys ? (x0 + x1) / 2 : cx;
      add(lead(mid, y, 2 * half + 0.04, (k % 3 === 2 && y < ys) ? iron : leadW, LEAD_Z), 'white');
    }
  }
  if (lights === 2) {
    // Stone mullion to the springing, the two light heads and the oculus between them and the main arch.
    add(bar(0, 0, m, ys, TRACERY_Z - 0.05, 0.12), 'stone');
    const t = 0.12;
    for (const [, , cx, rr] of lightList) add(extrude(arcBand(cx, ys, rr, t, 0, Math.PI), 0.1, TRACERY_Z - 0.05, 5), 'stone');
    const a = m / 2 + r, rho = (a * a + R * R - r * r) / (2 * (R + r)), oy = ys + R - rho;
    if (rho > 0.25) {
      add(extrude(arcBand(0, oy, rho - t / 2, t, 0, Math.PI * 2), 0.1, TRACERY_Z - 0.05, 7), 'stone');
      for (const ang of [0, Math.PI / 2]) add(strut([Math.cos(ang) * (rho - t), oy + Math.sin(ang) * (rho - t)], [-Math.cos(ang) * (rho - t), oy - Math.sin(ang) * (rho - t)], 0.06, TRACERY_Z - 0.04, 0.06), 'stone');
    }
  } else if (spec.fan) {
    // Lunette: a hub and radiating spokes in the half-round head.
    add(extrude(arcBand(0, ys, R * 0.18, 0.1, 0, Math.PI), 0.1, TRACERY_Z - 0.05, 4), 'stone');
    for (let i = 1; i < 6; i++) { const ang = (i * Math.PI) / 6; add(strut([Math.cos(ang) * R * 0.18, ys + Math.sin(ang) * R * 0.18], [Math.cos(ang) * (R - 0.02), ys + Math.sin(ang) * (R - 0.02)], 0.08, TRACERY_Z - 0.04, 0.08), 'stone'); }
    if (ys > 0.3) add(bar(0, ys - 0.05, w - 0.02, 0.1, TRACERY_Z - 0.05, 0.1), 'stone');
  }
  return out;
}
