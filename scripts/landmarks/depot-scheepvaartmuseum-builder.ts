import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, getSink, ledgeStrip, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './depot-scheepvaartmuseum-footprints.json';

/**
 * DEPOT SCHEEPVAARTMUSEUM, Kattenburgerstraat (BAG pand 0363100012169346; OSM way 269078495 "Depot Scheepvaartmuseum"):
 * the museum's store behind the old brick boundary wall of the naval yard along the Kattenburgerstraat. A long, closed box
 * clad in pale champagne metal panels in courses about 0.5 m high (staggered vertical joints), its roof rising in sloped
 * and curved planes to about 15 m, standing directly over the dark brown-grey brick yard wall (4.7 m, a stone coping,
 * brick piers, a bricked-up round arch with a date stone, timber gates). Louvre grilles in the cladding.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned. Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at
 * 50 px/m, ground at about 585 px; t in metres along each facade-ring edge from the viewer's left (ringFrame):
 *  - Kattenburgerstraat side (edges 9, 11-16, 18, 0 from the south-west): w03-138 recording_2025-06-17_08-04-10_03287
 *    (2025; the arch at t 0-3.3, piers t 5.2-6.5 and 14.4-15.8, the wall top at 4.7 m, a louvre t 12.8-14.5 at 5.1-5.9 m),
 *    w07-130 b_20250108_1041_Track01_Sphere_00031 (2025), w10-139 b_20250108_1041_Track01_Sphere_00029 (2025; a timber
 *    gate t 4.5-7.2 to 4.4 m, a louvre t 8.1-9.6), w12-130 TMX7316010203-001536_pano_0000_001551 (2020; the cladding
 *    courses every 0.5 m from the wall top, the 0.8 m plinth), w06-139 recording_2025-06-19_07-14-50_01897 (2025; a louvre
 *    t 8.2-9.2), w14-130 and w15-129;
 *  - south-west end (edge 8, w04-225, TMX7316010203-001195_pano_0000_003836, 2019, 51 deg oblique): brick with the big
 *    timber gate t 11.4-15.6 under a timber canopy at 4.2 m;
 *  - the north-west side faces the closed Marineterrein (no panorama): cladding to the ground, inferred; the north-east
 *    end (edge 1) inferred as brick wall under cladding, like the south-west.
 * Colours: cladding #dcd3c0 (w04-225, w12-130 lit), brick #5e5246 (w03-138, w04-225, w12-130), coping #7d7a70.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
type Wall = {f: Frame; len: number};
const wall = (i: number): Wall => ringFrame(ring, i);

const CLAD = 'concrete', BRICK = 'brick', COPING = 'stone', SEAM = 'frame', ROOF = 'slate', TIMBER = 'gold', PLINTH = 'greyBrick', LOUVRE = 'bronze';
/** The yard wall's top (w03-138, w12-130: 4.7 m over the pavement). */
const WALL_TOP = 4.7;
/** Ring edges along the Kattenburgerstraat, south-west to north-east, and the two ends. */
const STREET = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 0], ENDS = [8, 1];

export function buildDepotScheepvaartmuseum(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: CLAD, roof: ROOF, roofFor: s => (slopeDeg(s) > 70 ? CLAD : ROOF)});
  const sink0 = getSink();
  setSink(0.1, true);
  for (const i of [...STREET, ...ENDS]) yardWall(wall(i), STREET.includes(i));
  for (const i of [...STREET, ...ENDS]) courses(wall(i));
  arch(wall(9), 1.65);
  for (const t of [5.85, 15.1]) slab(B, wall(9).f, t, 0, 1.3, WALL_TOP, 0.56, BRICK);
  louvre(wall(9), 12.8, 14.5, 5.1, 5.9);
  louvre(wall(13), 8.1, 9.6, 5.3, 5.9);
  louvre(wall(15), 8.2, 9.2, 5.6, 6.0);
  gate(wall(13), 4.5, 7.2, 4.4);
  gate(wall(8), 11.4, 15.6, 4.2, true);
  setSink(sink0);
}

function slopeDeg(s: Surface) {
  const r = s.rings[0];
  let nx = 0, ny = 0, nz = 0;
  for (let k = 0; k < r.length; k++) {
    const a = r[k], c = r[(k + 1) % r.length];
    nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
  }
  return (Math.acos(Math.abs(ny) / Math.hypot(nx, ny, nz)) * 180) / Math.PI;
}

/** The shell's top over a point `t` along the wall, sampled 0.4 m inside. */
function topAt(w: Wall, t: number) {
  const x = w.f.origin[0] + w.f.tangent[0] * t - w.f.n[0] * 0.4, z = w.f.origin[1] + w.f.tangent[1] * t - w.f.n[1] * 0.4;
  return roofHeightAt(src.surfaces, x, z);
}

/** The brick yard wall in front of the depot's foot: brick to 4.7 m, a stone coping, the plinth on the street side. */
function yardWall(w: Wall, street: boolean) {
  if (w.len < 0.3) return;
  slab(B, w.f, w.len / 2, 0, w.len, WALL_TOP, 0.32, BRICK);
  slab(B, w.f, w.len / 2, WALL_TOP, w.len, 0.12, 0.5, COPING);
  if (street && w.len > 2) slab(B, w.f, w.len / 2, 0, w.len - 0.8, 0.8, 0.42, PLINTH);
}

/** The cladding courses above the wall (w12-130: a joint every 0.5 m), drawn as thin shadow lines up to the shell's eaves. */
function courses(w: Wall) {
  if (w.len < 1) return;
  const tops = [0.3, w.len / 2, w.len - 0.3].map(t => topAt(w, t)).filter((y): y is number => y !== null);
  if (!tops.length) return;
  const top = Math.min(...tops) - 0.25;
  for (let y = WALL_TOP + 0.55; y < top; y += 0.5) ledgeStrip(B, w.f, w.len / 2, y, w.len - 0.1, 0.035, 0.085, SEAM, 0.0);
}

/** A louvre grille in the cladding: a dark frame with five slats. */
function louvre(w: Wall, t0: number, t1: number, y0: number, y1: number) {
  const t = (t0 + t1) / 2;
  slab(B, w.f, t, y0, t1 - t0, y1 - y0, 0.04, LOUVRE);
  for (let k = 0; k < 5; k++) slab(B, w.f, t, y0 + 0.1 + (k * (y1 - y0 - 0.26)) / 4, t1 - t0 - 0.08, 0.04, 0.05, SEAM, 0.04);
}

/** The bricked-up round arch at the south-west end of the street wall (w03-138): a rowlock ring, stone springers and date stone. */
function arch(w: Wall, t: number) {
  archBand(B, w.f, t, 0, 3.0, 3.95, 0.25, 0.12, PLINTH, 0.34);
  for (const s of [-1, 1]) slab(B, w.f, t + s * 1.38, 2.2, 0.3, 0.2, 0.12, COPING, 0.4);
  slab(B, w.f, t, 3.72, 0.4, 0.35, 0.12, COPING, 0.4);
}

/** A boarded timber gate in the wall, with a timber canopy over the south-west one (w04-225). */
function gate(w: Wall, t0: number, t1: number, h: number, canopy = false) {
  const t = (t0 + t1) / 2;
  slab(B, w.f, t, 0, t1 - t0, h, 0.08, TIMBER, 0.46);
  for (let k = 1; k < 4; k++) slab(B, w.f, t0 + ((t1 - t0) * k) / 4, 0, 0.06, h, 0.04, LOUVRE, 0.54);
  if (canopy) slab(B, w.f, t, h + 0.05, t1 - t0 + 0.6, 0.12, 0.8, TIMBER, 0.46);
}
