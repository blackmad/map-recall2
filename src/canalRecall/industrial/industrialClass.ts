/**
 * Industrial buildings (lane industrial-kit 2026-11-10; user feedback 2026-11-09 #19-#21 in Westpoort: "these are
 * almost certainly not houses with windows" at the Isarweg storage tanks, "bad design for a building marked
 * warehouse", "bad design for industrial building"). Pure, no DOM.
 *
 * The generic grammar drew every pand as a house or an office: punched windows on every storey and, one in three, a
 * guessed shopfront. Port tanks became round towers with windows and blue-clad sheds grey offices with shops.
 *
 * The classifier reads open data only, built offline (scripts/industrial/build-industrial-buildings.ts) into
 * `industrial-buildings.json`, which the tile enricher stamps as `industrial` on each building:
 *   tank    a storage tank or round silo: OSM man_made=storage_tank|silo|gasometer (or building=storage_tank|silo),
 *           or a round footprint (isoperimetric quotient >= ROUND_Q) in an industrial or port landuse with no live use.
 *   silo    a mapped silo that is not round (a concrete silo block): windowless concrete.
 *   shed    a post-war (>= SHED_FROM_YEAR) warehouse or industrial hall: OSM building=warehouse|industrial|hangar|
 *           manufacture|factory, or BAG industriefunctie as the main use, or a large unregistered hall in industrial
 *           landuse. Never with housing, and never where offices, shops, meeting or education are the main use.
 *   works   a shed with its offices along the street (BAG kantoorfunctie registered beside the industry, or a
 *           multi-tenant hall of WORKS_MIN_VBOS units or more): the shed with an office block at one end of its front.
 *   office  an office (BAG kantoorfunctie the main use) on an industrial estate: keeps its windows but loses the
 *           guessed shopfront.
 * Pre-war warehouses (the canal pakhuizen, tagged building=warehouse) keep the grammar: they have windows.
 */

export type IndustrialKind = 'tank' | 'silo' | 'shed' | 'works' | 'office';
export const INDUSTRIAL_KINDS: readonly IndustrialKind[] = ['tank', 'silo', 'shed', 'works', 'office'];

/** Footprint roundness (4 pi A / P^2) from which an outline is a cylinder. A square is 0.785, a 12-gon 0.989. */
export const ROUND_Q = 0.9;
/** Vertices a round outline needs (a square chamfered once is not a tank). */
export const ROUND_MIN_VERTICES = 10;
/** Largest round footprint drawn as a tank (m2): bigger round buildings are arenas and gasometer halls. */
export const TANK_MAX_M2 = 6000;
/** Smallest footprint the kit takes (m2): kiosks and pump huts keep the grammar's small-building rules. */
export const MIN_M2 = 40;
/** Smallest tank (m2): the Isarweg tanks are 6.4 m across (32 m2). */
export const TANK_MIN_M2 = 8;
/** Profiled-metal sheds are post-war; earlier warehouses are brick with windows. */
export const SHED_FROM_YEAR = 1950;
/** Tallest shed (m): above it a building on an estate is an office or a plant, not a hall. */
export const SHED_MAX_M = 30;
/** An unregistered hall in industrial landuse needs at least this footprint (m2) and at most this height (m). */
export const LANDUSE_HALL_M2 = 400;
export const LANDUSE_HALL_MAX_M = 20;
/** Off an industrial estate, a shed needs at least this footprint (m2): small workshops in the old city's courtyards keep the grammar. */
export const OFF_ESTATE_SHED_M2 = 300;
/** A shed with this many registered units is a multi-tenant hall with an office front. */
export const WORKS_MIN_VBOS = 3;
/** Housing at or above this share of the registered floor area keeps the grammar (it is a home). */
export const HOUSING_SHARE = 0.1;
/** A use is the main use from this share of the registered floor area. */
export const MAIN_SHARE = 0.5;

const TANK_MAN_MADE = new Set(['storage_tank', 'silo', 'gasometer', 'tank']);
const TANK_BUILDING = new Set(['storage_tank', 'silo', 'gasometer']);
const SHED_BUILDING = new Set(['warehouse', 'industrial', 'hangar', 'manufacture', 'factory']);
const HOME_BUILDING = new Set(['house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'houseboat']);
/** BAG uses of a working hall: industry, and 'overige gebruiksfunctie' (storage, plant rooms, parking). */
const WORK_USES = ['industriefunctie', 'overige gebruiksfunctie'];
/** BAG uses that mean people live, work at desks, shop, meet or learn there. */
const PEOPLE_USES = ['kantoorfunctie', 'winkelfunctie', 'bijeenkomstfunctie', 'onderwijsfunctie', 'gezondheidszorgfunctie', 'logiesfunctie', 'sportfunctie', 'celfunctie'];

export interface IndustrialFacts {
  id: string;
  heightM: number;
  minHeightM: number;
  areaM2: number;
  /** 4 pi A / P^2 of the outer ring. */
  roundness: number;
  vertices: number;
  year: number | null;
  /** OSM tags on the building (matched by ref:bag) or on a man_made outline over it. */
  osmBuilding?: string;
  manMade?: string;
  /** Inside an OSM landuse=industrial|port. */
  industrialLand?: boolean;
  /** Registered floor area per BAG gebruiksdoel (live VBOs); absent: no VBO in the register. */
  uses?: Record<string, number>;
  /** Live VBOs in the pand. */
  vbos?: number;
  /** A landmark, kit or hand-modelled pand: never reclassified. */
  landmark?: boolean;
}

export interface IndustrialVerdict { kind: IndustrialKind | null; why: string }

const share = (uses: Record<string, number> | undefined, keys: readonly string[]) => {
  if (!uses) return 0;
  const total = Object.values(uses).reduce((s, v) => s + v, 0);
  return total > 0 ? keys.reduce((s, k) => s + (uses[k] ?? 0), 0) / total : 0;
};

export function classifyIndustrial(f: IndustrialFacts): IndustrialVerdict {
  if (f.landmark) return { kind: null, why: 'landmark or kit' };
  if (f.minHeightM > 1) return { kind: null, why: 'raised part' };
  if (f.osmBuilding && HOME_BUILDING.has(f.osmBuilding)) return { kind: null, why: `building=${f.osmBuilding}` };
  if (!(f.areaM2 >= TANK_MIN_M2)) return { kind: null, why: `footprint ${Math.round(f.areaM2)} m2 < ${TANK_MIN_M2}` };
  const housing = share(f.uses, ['woonfunctie']);
  if (housing >= HOUSING_SHARE) return { kind: null, why: `housing ${(housing * 100).toFixed(0)} %` };
  // A VBO registered for several uses counts its floor area to each in equal parts (scripts/industrial/fetch-bag-uses.ts),
  // so a hall registered 'industriefunctie,kantoorfunctie' is half work, half office: work wins ties.
  const people = share(f.uses, PEOPLE_USES), office = share(f.uses, ['kantoorfunctie']), industry = share(f.uses, ['industriefunctie']), work = share(f.uses, WORK_USES);
  const round = f.roundness >= ROUND_Q && f.vertices >= ROUND_MIN_VERTICES;
  const mappedTank = (f.manMade && TANK_MAN_MADE.has(f.manMade)) || (f.osmBuilding && TANK_BUILDING.has(f.osmBuilding));
  if (mappedTank && people <= work) {
    if (round) return { kind: 'tank', why: `mapped ${f.manMade ?? f.osmBuilding}, round` };
    return { kind: 'silo', why: `mapped ${f.manMade ?? f.osmBuilding}, not round` };
  }
  if (round && f.industrialLand && people === 0 && f.areaM2 <= TANK_MAX_M2 && (f.osmBuilding === undefined || f.osmBuilding === 'yes' || f.osmBuilding === 'industrial')) {
    return { kind: 'tank', why: `round (q ${f.roundness.toFixed(2)}) in industrial landuse, no people use` };
  }
  if (!(f.areaM2 >= MIN_M2)) return { kind: null, why: `footprint ${Math.round(f.areaM2)} m2 < ${MIN_M2}` };
  const onEstate = !!f.industrialLand || (f.osmBuilding !== undefined && SHED_BUILDING.has(f.osmBuilding)) || industry >= MAIN_SHARE;
  if (onEstate && office > MAIN_SHARE && office > work) return { kind: 'office', why: `office ${(office * 100).toFixed(0)} % on an industrial estate` };
  if (f.year !== null && f.year < SHED_FROM_YEAR) return { kind: null, why: `built ${f.year}, before ${SHED_FROM_YEAR}` };
  if (people > work) return { kind: null, why: `people use ${(people * 100).toFixed(0)} % over work ${(work * 100).toFixed(0)} %` };
  if (f.heightM > SHED_MAX_M) return { kind: null, why: `${f.heightM.toFixed(1)} m tall` };
  if (!f.industrialLand && f.areaM2 < OFF_ESTATE_SHED_M2) return { kind: null, why: `${Math.round(f.areaM2)} m2 off an industrial estate` };
  const works = office > 0 || (f.vbos ?? 0) >= WORKS_MIN_VBOS;
  const hall = (why: string): IndustrialVerdict => works ? { kind: 'works', why: `${why}; office front (office ${(office * 100).toFixed(0)} %, ${f.vbos ?? 0} units)` } : { kind: 'shed', why };
  if (f.osmBuilding !== undefined && SHED_BUILDING.has(f.osmBuilding)) return hall(`building=${f.osmBuilding}`);
  if (industry >= MAIN_SHARE || (industry > 0 && work >= MAIN_SHARE)) return hall(`industriefunctie ${(industry * 100).toFixed(0)} %, work ${(work * 100).toFixed(0)} %`);
  if (f.industrialLand && !f.uses && f.areaM2 >= LANDUSE_HALL_M2 && f.heightM <= LANDUSE_HALL_MAX_M) return { kind: 'shed', why: `unregistered ${Math.round(f.areaM2)} m2 hall in industrial landuse` };
  return { kind: null, why: 'no industrial evidence' };
}

/** Roundness of a planar ring ([x, y] metres, open or closed). */
export function ringRoundness(ring: readonly (readonly number[])[]): { areaM2: number; perimeterM: number; roundness: number; vertices: number } {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let a = 0, p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0; p += Math.hypot(x1 - x0, y1 - y0);
  }
  const areaM2 = Math.abs(a) / 2;
  return { areaM2, perimeterM: p, roundness: p > 0 ? (4 * Math.PI * areaM2) / (p * p) : 0, vertices: pts.length };
}
