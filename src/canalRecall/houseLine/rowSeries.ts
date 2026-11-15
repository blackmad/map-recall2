/**
 * House rows (lane R, docs/handoffs/house-rows-plan-20261114.md): lane D's solved row record (houseSpec/row/types.ts)
 * to the renderer's front records. Lane D's `rowFrontRecords` (houseSpec/row/emit.ts) gives each pand its wall top,
 * storeys, bays and sub-fronts; this joins each record to the design its series states:
 *
 *  - `series`: the series id (seeds the bay preset, the extras' dice and the roof tone), its cornice, the head dressing
 *    per front span (a two-series pand gets one span per sub-front), the roof storey with `dormersPerFront` dormers
 *    centred in each front, the extras beyond ROW_FRONT_EXTRAS, and the souterrain a stoop-and-windows ground reads;
 *  - `wall`: the series' judged family tone (`series[].design.wall.hex`, judgedColour.ts) as source `judged`. A front
 *    record's own wall stays `reviewed` / `strip-measured` only.
 *
 * Nothing here is rolled: a field the series does not state is left out and the renderer draws no component for it.
 */
import { frontDesign, type RowDesign, type RowGroundWall, type RowFront, type RowRecord } from '../houseSpec/row/types.ts';
import { rowFrontRecords, statedGable } from '../houseSpec/row/emit.ts';
import { headsList } from '../houseSpec/row/solve.ts';
import { SOUTERRAIN_FACTOR } from '../houseSpec/storeyPlan.ts';
import { ROW_FRONT_EXTRAS, ROW_RAISED_FRONT_M, rowGroundM, rowWallOnlyOf, type RowDormerDraw, type RowFrontRecord, type RowGroundWallDraw, type RowHeadsDraw, type RowSeriesDraw } from './rowFront.ts';

/** Grounds that put the ground storey on a souterrain (stoop over basement windows). */
const SOUTERRAIN_GROUNDS: ReadonlySet<string> = new Set(['souterrain', 'stoop-and-windows', 'windows']);
/** A raised ground over low basement windows with no stoop read (Weteringschans 168096, `basement: 'windows'`): the
 *  basement row is this share of the upper pitch (lower than a souterrain's SOUTERRAIN_FACTOR). */
export const BASEMENT_WINDOWS_FACTOR = 0.35;

/** A stated stoop (ground basement `stoop` / `stoop-and-windows`) and the street door's side; none stated: none drawn. */
function stoopOf(fronts: readonly RowFront[]): { stoop: NonNullable<RowSeriesDraw['stoop']> } | null {
  const f = fronts.find(x => x.ground.basement === 'stoop' || x.ground.basement === 'stoop-and-windows' || x.ground.basement === 'windows');
  if (!f) return null;
  const side = f.ground.doorSide === 'right' ? 'right' : f.ground.doorSide === 'centre' ? 'centre' : f.ground.doorSide === 'left' ? 'left' : null;
  // `windows`: the door is at the raised ground, but no stoop was read, so none is drawn (steps: false), unless the ground
  // states the flight's form (Herengracht 148: the raised door's short flight).
  const form = f.ground.stoopForm, extra = { ...(form ? { form } : {}), ...(f.ground.stoopRailing ? { railing: true as const } : {}), ...(f.ground.doorcase ? { doorcase: { ...f.ground.doorcase } } : {}) };
  return side ? { stoop: { side, ...(f.ground.basement === 'windows' && !form ? { steps: false as const } : {}), ...extra } } : null;
}
/** The street door as read on the pand's first front with one (left/right/centre; index of the ground openings). */
function doorOf(fronts: readonly RowFront[]): { door?: NonNullable<RowSeriesDraw['door']> } {
  const f = fronts.find(x => x.ground.doorSide === 'left' || x.ground.doorSide === 'right' || x.ground.doorSide === 'centre');
  if (!f) return {};
  const g = f.ground, side = g.doorSide as 'left' | 'right' | 'centre';
  const offset = fronts.length > 1 ? span(f) : null;
  // A pand of several fronts: the door's place as a fraction of the pand (the mesher reads index/bays of the pand front).
  // A stated doorcase (RowGround.doorcase) dresses the street door (row-doorcase; a stoop's door takes it on the stoop).
  const dc = g.doorcase ? { doorcase: { ...g.doorcase } } : {};
  if (offset && g.doorIndex !== undefined && g.groundBays) return { door: { side, index: +(offset[0] + (g.doorIndex + 0.5) / g.groundBays * (offset[1] - offset[0])).toFixed(4) * 1000 | 0, bays: 1000, ...dc } };
  return { door: { side, ...(g.doorIndex !== undefined && g.groundBays ? { index: g.doorIndex, bays: g.groundBays } : {}), ...dc } };
}
/** The ground use as read: a shop ground draws the shop window, a dwelling ground none; other uses leave the extract's. */
function shopOf(fronts: readonly RowFront[]): { shop?: boolean } {
  const uses = fronts.map(f => f.ground.use);
  if (uses.some(u => u === 'shop' || u === 'cafe' || u === 'restaurant')) return { shop: true };
  if (uses.every(u => u === 'dwelling' || u === 'door-only')) return { shop: false };
  return {};
}
/** Named ground colours a reading may state, as drawn. */
export const GROUND_COLOURS: Readonly<Record<string, string>> = { white: '#efece4', light: '#e3ddcf', timber: '#6b4a2f', cream: '#e4d9bf', black: '#1f1d1b', dark: '#2c2824', grey: '#6b6b68', red: '#9b2a24', green: '#3f6b4c', blue: '#2f4a6b', brown: '#4a3426' };
/** The ground colour the record states (`ground.colour`, a hex or a name in GROUND_COLOURS); `shopPaint` is not read:
 *  the integrator routes reviewed colours through `ground.colour` (Kinkerstraat 106-108's shopPaint said white, the
 *  photo shows a dark front). */
function groundColourOf(fronts: readonly RowFront[]): { groundHex?: string } {
  for (const f of fronts) {
    const raw = (f.ground as { colour?: unknown }).colour, c = raw && typeof raw === 'object' ? (raw as { value?: unknown }).value : raw;
    if (typeof c !== 'string') continue;
    const hex = /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : GROUND_COLOURS[c.toLowerCase()];
    if (hex) return { groundHex: hex };
  }
  return {};
}
/**
 * Row type looks: what a type states for every series of it until the record states its own. kinker-1890-plain-brick
 * (Fable, round-6 sheets): the photo's upper windows take ~75 % of their axis pitch frames included; the preset's ~62 %
 * left the piers too wide (106-108, 104, 102, 90).
 */
export const ROW_TYPE_LOOK: Readonly<Record<string, { windowShare?: number }>> = {
  'kinker-1890-plain-brick': { windowShare: 0.75 },
};
/** The stated shop units (`ground.shopUnits`): 1 draws the shop ground as one opening (Weteringschans 168042, blind
 *  review 6: the renderer split a single black-framed shopfront by width into two units with sign tiles). */
function shopUnitsOf(fronts: readonly RowFront[]): { shopUnits?: number } {
  for (const f of fronts) {
    const raw = (f.ground as { shopUnits?: unknown }).shopUnits, n = raw && typeof raw === 'object' ? (raw as { value?: unknown }).value : raw;
    if (typeof n === 'number' && n >= 1) return { shopUnits: Math.round(n) };
  }
  return {};
}
function windowShareOf(designs: readonly RowDesign[], types: readonly (string | undefined)[]): { windowShare?: number } {
  const stated = designs.map(d => (d as { windowShare?: { value?: unknown } }).windowShare?.value).find(v => typeof v === 'number');
  if (typeof stated === 'number') return { windowShare: stated };
  const t = types.find(x => x && ROW_TYPE_LOOK[x]?.windowShare);
  return t ? { windowShare: ROW_TYPE_LOOK[t].windowShare } : {};
}
/** The stated balcony (RowDesign.balcony: storeys over D's ground, 1 = first above it), on the renderer's rows. */
function balconyOf(designs: readonly RowDesign[], shift: number): { balcony?: NonNullable<RowSeriesDraw['balcony']> } {
  const b = designs.find(d => d.balcony?.value)?.balcony?.value;
  return b ? { balcony: { storeys: b.storeys.map(k => k + shift), axis: b.axis } } : {};
}
const span = (f: RowFront) => f.sub ? [f.sub.a0, f.sub.a1] as const : [0, 1] as const;

/**
 * A row's mansard rise measured on its photo (m over the cornice), until the record states one (RowRoofStorey has no
 * rise yet). Weteringschans 2026-11-14: the steep slate band shows 25 px (169016) and 34 px (171218) over the cornice
 * at ~30 px/m (wall 450 px for 14.7 m, 433 px for 14.32 m), 0.8-1.1 m seen, then the flat top: drawn 1.3 m. The
 * period rise (rowFront.ts MANSARD_RISE, 2.2 m) stays for rows without one (Kinkerstraat passed on it).
 */
export const ROW_MANSARD_RISE: Readonly<Record<string, { riseM: number; ref: string }>> = {
  'weteringschans-168096-171218': { riseM: 1.3, ref: 'photo sheet 2026-11-14: 0.8-1.1 m steep band seen over the cornice' },
};
/** The record's window kind as the painter's glazing: a T-window, a tall upper sash and a casement under a toplight all
 *  paint large panes under a transom light (Weteringschans review 5: six-over-six grids read wrong); a casement is one
 *  pane; a plain `sash` keeps the preset's own. */
export const ROW_SASH: Readonly<Record<string, 'plain' | 'transom'>> = { 't-window': 'transom', 'tall-upper': 'transom', 'casement-toplight': 'transom', casement: 'plain' };
/** A ground-storey facing's colour by material (white stucco, a pale stone) and the named colours a reading may give. */
export const ROW_GROUND_WALL_HEX: Readonly<Record<string, string>> = { stucco: '#e8e3d6', render: '#e2dccd', stone: '#cdc4b0', brick: '#7a4a38', white: '#ece8de', cream: '#e4dcc4', grey: '#b9b7b0', sandstone: '#cdbb98' };
/** The stated ground-storey facing (RowDesign.groundWall) as drawn: its colour and top. Unreadable: nothing (today). */
export function groundWallOf(g: RowGroundWall | undefined): Omit<RowGroundWallDraw, 'a0' | 'a1'> | null {
  if (!g || !ROW_GROUND_WALL_HEX[g.material]) return null;
  const c = typeof g.colour === 'string' ? g.colour.toLowerCase() : '';
  const hex = /^#[0-9a-f]{6}$/.test(c) ? c : ROW_GROUND_WALL_HEX[c] ?? ROW_GROUND_WALL_HEX[g.material];
  return { hex, top: g.top === 'plain' || g.top === 'scrolled' ? g.top : 'ledge' };
}
/** The stated joinery (RowDesign.glazing) as the series draws it: the window kind with its frame, bars and panes. */
export const ROW_GLAZING = { frameM: 0.09, barM: 0.035 } as const;
function glazingOf(d: RowDesign): { glazing?: NonNullable<RowSeriesDraw['glazing']> } {
  const g = d.glazing?.value;
  if (!g) return {};
  const ok = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
  return { glazing: { kind: d.windows.value, frameM: ok(g.frameM, 0.03, 0.25) ? g.frameM! : ROW_GLAZING.frameM, barM: ok(g.barM, 0.015, 0.1) ? g.barM! : ROW_GLAZING.barM, ...(ok(g.panes, 1, 24) ? { panes: Math.round(g.panes!) } : {}) } };
}
/** One pand's series draw from its fronts (street order) and their designs. */
export function seriesDraw(fronts: readonly RowFront[], designs: readonly RowDesign[], built?: number | null, rowId = '', types: readonly (string | undefined)[] = []): RowSeriesDraw {
  const d0 = designs[0];
  const heads: RowHeadsDraw[] = [];
  const dormers: RowDormerDraw[] = [];
  const groundWalls: RowGroundWallDraw[] = [];
  let mansard: RowDesign['roofStorey']['value'] | null = null;
  // Over a souterrain the bel-etage (D's ground, storey 0) is the renderer's first upper row: stated storeys shift by one.
  const shift = fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? 1 : 0;
  fronts.forEach((f, i) => {
    const [a0, a1] = span(f), d = designs[i];
    // A front may state several dressings by storey (171218: jack-blocks below, arch rings on the top storey).
    const hs = d.heads.value ? headsList(d.heads.value) : [];
    // A plain arched head (round or segmental, no dressing) still draws its arched glass (headGrammar).
    const gw = groundWallOf(d.groundWall?.value);
    if (gw) groundWalls.push({ a0, a1, ...gw });
    for (const h of hs) if (h && (h.dressing !== 'none' || h.shape === 'round' || h.shape === 'segmental')) heads.push({ a0, a1, shape: h.shape, dressing: h.dressing, ...(h.storeys?.length ? { storeys: h.storeys.map(k => k + shift) } : {}) });
    const rs = d.roofStorey.value;
    if (rs.kind !== 'mansard') return;
    mansard ??= rs;
    const n = Math.max(0, Math.round(rs.dormersPerFront));
    for (let k = 0; k < n; k++) dormers.push({ a: +(a0 + (k + 0.5) / n * (a1 - a0)).toFixed(4), kind: rs.dormerKind ?? 'plain', ...(rs.hoist ? { hoist: true } : {}) });
  });
  // The renderer takes the first head whose span and storeys match a window: storey-specific dressings go first.
  heads.sort((p, q) => (p.storeys ? 0 : 1) - (q.storeys ? 0 : 1));
  const extras = (d0.extras.value ?? []).filter(x => !ROW_FRONT_EXTRAS.includes(x));
  const omitExtras = ROW_FRONT_EXTRAS.filter(x => !(d0.extras.value ?? []).includes(x));
  const m = mansard as RowDesign['roofStorey']['value'] | null;
  return {
    id: fronts[0].seriesId,
    ...(omitExtras.length ? { omitExtras } : {}),
    ...(d0.cornice.value ? { cornice: d0.cornice.value } : {}),
    ...(d0.corniceDress?.value ? { corniceDress: d0.corniceDress.value } : {}),
    roofStorey: m ? { kind: 'mansard', material: m.material ?? 'slate', dormers, ...(m.riseM && m.riseM > 0 ? { riseM: m.riseM } : ROW_MANSARD_RISE[rowId] ? { riseM: ROW_MANSARD_RISE[rowId].riseM } : {}) } : { kind: 'none', riseM: 0, dormers: [] },
    ...(heads.length ? { heads } : {}),
    ...(extras.length ? { extras } : {}),
    ...(fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? { souterrain: true } : {}),
    ...(fronts.some(f => SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) && fronts.every(f => f.ground.basement === 'windows' || !SOUTERRAIN_GROUNDS.has(f.ground.basement ?? '')) ? { souterrainFactor: BASEMENT_WINDOWS_FACTOR } : {}),
    ...(stoopOf(fronts) ?? {}),
    ...doorOf(fronts),
    ...shopOf(fronts),
    ...(shopOf(fronts).shop ? shopUnitsOf(fronts) : {}),
    ...groundColourOf(fronts),
    ...balconyOf(designs, shift),
    ...windowShareOf(designs, types),
    ...glazingOf(d0),
    ...(groundWalls.length ? { groundWalls } : {}),
    // One window preset per window kind in the row (Kinkerstraat: every series states t-windows), not per series.
    look: { bays: d0.bays.value, year: built ?? null, heightM: d0.corniceTopM.value ?? null, seed: `${rowId}:${d0.windows.value}`, whiteFrames: d0.whiteFrames.value, ...(ROW_SASH[d0.windows.value] ? { sash: ROW_SASH[d0.windows.value] } : {}) },
  };
}

/** The look's year: the earliest build year of every member whose series states the same window kind (the look's
 *  seed), so one window preset is one period (Kinkerstraat 90 and 86-88 picked another preset on their own years). */
function seriesYear(row: RowRecord, seriesId: string): number | null {
  const kind = row.series.find(x => x.id === seriesId)?.design.windows.value;
  const same = new Set(row.series.filter(x => x.design.windows.value === kind).flatMap(x => x.fronts));
  const years = row.members.filter(m => m.built && m.fronts.some(f => same.has(f))).map(m => m.built!);
  return years.length ? Math.min(...years) : null;
}

/** Lane D's front records for a row, each joined to its series draw and its series' judged wall tone. */
export function rowFrontsWithSeries(row: RowRecord): RowFrontRecord[] {
  const byPand = new Map(row.members.map(m => [m.pandId, m]));
  return rowFrontRecords(row).map(rec => {
    const member = byPand.get(rec.pandId);
    if (!member) return rec;
    const fronts = member.fronts.map(id => row.fronts.find(f => f.id === id)).filter((f): f is RowFront => !!f);
    if (!fronts.length) return rec;
    const designs = fronts.map(f => frontDesign(row, f));
    const walls = designs.map(d => d.wall.value);
    // The world draws every pand from flat ground (no terrain under the mesher), so a row stands to its series line in
    // the street datum: per-pand 3DBAG ground offsets stepped the drawn cornice (Kinkerstraat 104 0.2 m, 110 0.7 m low).
    // A pand whose fronts stand to different lines stands to the tallest line of a front that is not a stated gable (a
    // gable stands on its own line): Herengracht/Kinkerstraat 69-73, 69's neck at 14.6 m beside 71-73's cornice at 16.3 m.
    // The lower fronts step down to their own lines (rowFront.ts rowRaisedFronts). One front, or one line: the first's.
    const line0 = designs[0].corniceTopM.value;
    const flat = rec.subFronts ? designs.filter(d => !statedGable(d)).map(d => d.corniceTopM.value).filter((v): v is number => v !== null) : [];
    const line = line0 !== null && flat.length && Math.max(...flat) > line0 + ROW_RAISED_FRONT_M ? Math.max(...flat) : line0;
    // A stated gable (RowDesign.gable) stands its rise over the front's line: the top is the gable's apex.
    const lift = (v: number, d: RowDesign | undefined) => { const g = d ? statedGable(d) : null; return g ? +(v + g.riseM).toFixed(2) : v; };
    // A stated gable below a taller pand line stands on that line: stepped down, its gable stood in the pand's notch under
    // the roof storey's face (Kinkerstraat 69's neck under 71-73's mansard, round 4). Other fronts keep their own line.
    const footOf = (d: RowDesign | undefined): number => { const v = d?.corniceTopM.value ?? line!; return d && statedGable(d) && line !== null && line > v ? line : v; };
    const lined = line !== null && line > 2 ? { topM: lift(line, designs[0]), eavesM: line, ...(rec.subFronts ? { subFronts: rec.subFronts.map((sf, i) => { const own = footOf(designs[i]); return { ...sf, topM: lift(own, designs[i]), eavesM: own }; }) } : {}) } : {};
    const out: RowFrontRecord = {
      ...rec, ...lined, series: seriesDraw(fronts, designs, seriesYear(row, fronts[0].seriesId), row.id, fronts.map(f => (row.series.find(x => x.id === f.seriesId) as { type?: string } | undefined)?.type)),
      wall: { hex: walls[0].hex, source: 'judged', finish: walls[0].material },
      sources: { ...rec.sources, ...(line !== null ? { eaves: `${rec.sources.eaves}; drawn at the series line ${line} m (street datum: the world has no terrain)` } : {}), series: `house-rows ${row.id}: ${[...new Set(fronts.map(f => f.seriesId))].join(', ')}`, wall: `judged ${walls[0].family} (${designs[0].wall.source}: ${designs[0].wall.ref})` },
    };
    if (rec.subFronts && walls.some(w => w.hex !== walls[0].hex)) out.subFronts = rec.subFronts.map((s, i) => ({ ...s, wallHex: walls[i]?.hex ?? walls[0].hex }));
    // A member whose fronts stand to different series lines gets its width, so the renderer can size each front's
    // raised top (rowFront.ts rowRaisedFronts); a member on one line is unchanged.
    // A one-front member with a stated gable gets it too (the gable's width).
    if (!out.spanM && member.widthM && member.widthM > 1 && line !== null && (out.subFronts ? out.subFronts.some(f => (f.topM ?? line) > line + ROW_RAISED_FRONT_M || (f.eavesM ?? line) < line - ROW_RAISED_FRONT_M) : !!statedGable(designs[0]))) out.spanM = member.widthM;
    // Stated window heights per storey (RowDesign.windowHeights): the storeys share the wall by them, each window low in
    // its storey; the renderer places the windows on these rows (levels: windowBoxes).
    const rows = line !== null && line > 2 && out.storeys ? rowWindowRows(designs[0].windowHeights?.value, line, out.storeys, out.series?.souterrain ? out.series.souterrainFactor ?? SOUTERRAIN_FACTOR : null) : null;
    // The floor lines between the stated rows: the series draws its floor bands on them (row-floors), not on the even grid.
    if (rows) { out.rows = rows.rows; out.groundTopM = rows.groundTopM; if (out.series) out.series.floorsM = rows.floorsM; }
    const joins = mansardJoins(row, rec.pandId);
    if (joins && out.series?.roofStorey?.kind === 'mansard') out.series.roofStorey.joins = joins;
    // A corner member's roof faces its row's street, not the side street nearer its outline (Kinkerstraat 110).
    if (out.series?.roofStorey?.kind === 'mansard' && member.widthM && member.widthM > 1) out.series.roofStorey.frontM = member.widthM;
    // A chunk-owned pand whose street wall the row draws (lane D states the chunk and the edge on the member).
    const wallOnly = rowWallOnlyOf((member as { wallOnly?: unknown }).wallOnly);
    if (wallOnly) out.wallOnly = wallOnly;
    return out;
  });
}

/** Where a stated window sits in its storey: this share of the storey's spare height under the sill. */
export const ROW_WINDOW_SILL_SHARE = 0.35;
/**
 * The upper window rows a series states by height (RowDesign.windowHeights, m, lowest first) on a front `storeys` high
 * to `line`: the ground storey (or a souterrain cell, `souterrain` its share of the pitch) as the series draws it, the
 * storeys above in proportion to their windows, each window ROW_WINDOW_SILL_SHARE of its spare height up. Null when no
 * heights are stated, their count does not match the storeys that draw windows, or a window would not fit.
 */
export function rowWindowRows(heights: readonly number[] | undefined, line: number, storeys: number, souterrain: number | null): { rows: Array<{ sillM: number; headM: number }>; groundTopM: number; floorsM: number[] } | null {
  if (!heights?.length || !heights.every(h => Number.isFinite(h) && h > 0.3)) return null;
  const upper = souterrain !== null ? storeys : storeys - 1;
  if (heights.length !== upper || upper < 1) return null;
  const ground = souterrain !== null ? +(souterrain * line / (storeys + souterrain)).toFixed(2) : rowGroundM(line, storeys);
  const sum = heights.reduce((a, b) => a + b, 0), wall = line - ground;
  if (!(sum < wall * 0.85)) return null;
  let z = ground;
  const floorsM: number[] = [];
  const rows = heights.map(h => {
    const pitch = wall * h / sum, sill = +(z + (pitch - h) * ROW_WINDOW_SILL_SHARE).toFixed(2);
    floorsM.push(+z.toFixed(2));
    z += pitch;
    return { sillM: sill, headM: +(sill + h).toFixed(2) };
  });
  return { rows, groundTopM: ground, floorsM };
}

/** Cornice lines within this step (m, street datum) read as one line: the mansard runs on across the party wall. */
export const ROW_LINE_STEP_M = 0.2;
/** The member's mansard runs on into its street-order neighbour's (left / right as seen) when their cornice lines agree
 *  within ROW_LINE_STEP_M: no hip at the party wall, inside a series or across two, and also into a neighbour with no
 *  stated roof storey on the same line (Kinkerstraat 90 into 86-88: 3DBAG 16.84 / 16.62 m, both cornices at ~14.2 m on
 *  the face strip, so 86-88's top is not clearly lower). */
export function mansardJoins(row: RowRecord, pandId: string): { left?: true; right?: true } | null {
  const i = row.members.findIndex(m => m.pandId === pandId);
  if (i < 0) return null;
  const edge = (m: RowRecord['members'][number], end: 'first' | 'last') => {
    const id = end === 'first' ? m.fronts[0] : m.fronts[m.fronts.length - 1];
    const f = row.fronts.find(x => x.id === id);
    return f ? frontDesign(row, f).corniceTopM.value : null;
  };
  const near = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) <= ROW_LINE_STEP_M + 1e-9;
  const m = row.members[i], left = row.members[i - 1], right = row.members[i + 1];
  // A row end (no member beyond it) has no evidence of a hip: the mansard runs on to a plain end, closed by a plate
  // (Kinkerstraat 110's left end, review 4: no photo, so no hip).
  const out = {
    ...(!left || near(edge(m, 'first'), edge(left, 'last')) ? { left: true as const } : {}),
    ...(!right || near(edge(m, 'last'), edge(right, 'first')) ? { right: true as const } : {}),
  };
  return out.left || out.right ? out : null;
}
