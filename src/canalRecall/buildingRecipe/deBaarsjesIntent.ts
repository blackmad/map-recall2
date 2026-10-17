/**
 * Validation of the De Baarsjes component set (Jan Evertsenstraat 1925-1927, docs/de-baarsjes-types-20261014.md):
 * the tall plain parapet (`parapet`), two-tone piers under painted bands (`bandPiers`), the single-bay box frame with a
 * hood (`bayWindows.hood`), stacked balconettes with hood slabs (`balconies.style: slab-hood`), the glass-block band of
 * a counted height and the measured wall band over a rigid canopy (`awning.glassBlocks: {rows}`, `awning.wallCourses`).
 * Every field is optional and never checked when absent. Kept out of intent.ts so that file does not grow; type-only
 * imports, so there is no runtime cycle.
 */
import type {FrontIntent, PaletteIntent, ShopAwningIntent, WindowKind} from './intent.ts';

/** Window kinds an `axisWindows` entry may name (kept in step with intent.ts WINDOWS; a type-only import keeps the cycle out). */
export const WINDOW_KINDS: readonly WindowKind[] = ['sash', 'sash-small-panes', 'cross', 'plain', 'arched', 'shop', 'two-light', 'ladder', 'sash-6-over-6', 'sash-8-over-8', 'sash-9-over-9', 'six-pane', 't-window', 'small-over-one', 'cross-transom', 'casement-toplight', 'casement-gridded-toplight', 'casement-triple', 'casement-toplight-double', 'casement-gridded-toplight-double', 'casement-pair', 'casement-small-panes', 'casement-sidelights-toplight'];

/** Problems with a shop awning's rigid-canopy fields (`glassBlocks`, `wallCourses`). */
export function awningProblems(aw: ShopAwningIntent, at: string): string[] {
  const p: string[] = [], g = aw.glassBlocks as unknown;
  if (g !== undefined) {
    const rows = g && typeof g === 'object' ? (g as {rows?: unknown}).rows : undefined;
    const panel = g && typeof g === 'object' ? (g as {panel?: unknown}).panel : undefined;
    const ok = g === true || (g !== null && typeof g === 'object' && Object.keys(g).every(k => k === 'rows' || k === 'panel') && Number.isInteger(rows) && (rows as number) >= 2 && (rows as number) <= 12
      && (panel === undefined || (typeof panel === 'string' && /^#[0-9a-f]{6}$/i.test(panel))));
    if (!ok || aw.style !== 'rigid') p.push(`${at}.shopfront.awning.glassBlocks: true, and only over a rigid canopy (or {rows: 2..12} rows of glass block, optionally panel: '#rrggbb' for a painted sign panel)`);
  }
  if (aw.wallCourses !== undefined && (aw.style !== 'rigid' || !(Number.isInteger(aw.wallCourses) && aw.wallCourses >= 0 && aw.wallCourses <= 40))) p.push(`${at}.shopfront.awning.wallCourses: integer 0..40 brick courses, only over a rigid canopy`);
  return p;
}

/** Problems with the De Baarsjes front fields. */
export function deBaarsjesProblems(f: FrontIntent, palette: PaletteIntent | undefined, at: string): string[] {
  const p: string[] = [];
  if (f.bayFill !== undefined) {
    const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays]));
    if (!Array.isArray(f.bayFill) || f.bayFill.length !== grid || f.bayFill.some(x => typeof x !== 'number' || !(x >= 0.3 && x <= 1))) p.push(`${at}.bayFill: ${grid} window shares of their bays (one per axis), each 0.3..1`);
    if (!f.bayWidths) p.push(`${at}.bayFill: needs bayWidths (the bays the windows fill)`);
  }
  if (f.stepBody !== undefined && f.stepBody !== true) p.push(`${at}.stepBody: true (or absent)`);
  if (f.axisWindows !== undefined) {
    const grid = f.axisGrid ?? Math.max(...(Array.isArray(f.bays) ? f.bays.slice(f.storeys > 1 ? 1 : 0) : [f.bays]));
    const o = f.axisWindows as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o) || !Object.keys(o).length) p.push(`${at}.axisWindows: {axis: window kind}`);
    else for (const [k, v] of Object.entries(f.axisWindows)) {
      if (!(Number.isInteger(Number(k)) && Number(k) >= 0 && Number(k) < grid)) p.push(`${at}.axisWindows.${k}: an axis 0..${grid - 1}`);
      if (!(WINDOW_KINDS as readonly string[]).includes(v)) p.push(`${at}.axisWindows.${k}: one of ${WINDOW_KINDS.join('|')}`);
    }
  }
  if (f.parapet !== undefined) {
    const q = f.parapet as unknown as Record<string, unknown>;
    if (!q || typeof q !== 'object' || Object.keys(q).some(k => !['courses', 'coping'].includes(k)) || !(Number.isInteger(q.courses) && (q.courses as number) >= 4 && (q.courses as number) <= 90)) p.push(`${at}.parapet: {courses: 4..90 brick courses, coping?: boolean}`);
    if (q && q.coping !== undefined && typeof q.coping !== 'boolean') p.push(`${at}.parapet.coping must be boolean`);
    if (f.cornice !== 'none') p.push(`${at}.parapet: a plain parapet has no cornice (cornice "none"; coping: true lays its cap)`);
    if (f.gable !== 'flat' && f.gable !== 'cornice') p.push(`${at}.parapet: only on a flat or cornice front`);
  }
  if (f.bandPiers !== undefined) {
    if (f.bandPiers !== true) p.push(`${at}.bandPiers: true (or leave it out)`);
    if (f.bands !== 'painted') p.push(`${at}.bandPiers: only with bands "painted"`);
    if (!(f.palette?.band ?? palette?.band)) p.push(`${at}.bandPiers: the piers are laid in the band brick; give palette.band`);
  }
  const bw = f.bayWindows;
  if (bw?.hood !== undefined) {
    if (bw.hood !== true) p.push(`${at}.bayWindows.hood: true (or leave it out)`);
    if (!bw.bays) p.push(`${at}.bayWindows.hood: a box frame spans axes (bays {from, to})`);
    if (bw.cap !== undefined || bw.finish !== undefined) p.push(`${at}.bayWindows.hood: a box frame has its own hoods and white finish; drop cap/finish`);
    if (f.windows === 'ladder') p.push(`${at}.bayWindows.hood: not on a ladder-window front`);
  }
  const bf = f.bandFloors;
  if (bf !== undefined) {
    if (f.bands !== 'painted') p.push(`${at}.bandFloors: only with bands "painted"`);
    if (!Array.isArray(bf.storeys) || !bf.storeys.length || bf.storeys.some(s => !Number.isInteger(s) || s < 1 || (f.storeys && s >= f.storeys))) p.push(`${at}.bandFloors.storeys: upper storeys (1..storeys-1)`);
    if (!Number.isInteger(bf.courses) || bf.courses < 1 || bf.courses > 9) p.push(`${at}.bandFloors.courses: 1..9 brick courses`);
  }
  const run = f.balconyRun;
  if (run !== undefined) {
    const n = f.storeys ?? 0;
    if (!Number.isInteger(run.storey) || run.storey < 1 || (n && run.storey >= n)) p.push(`${at}.balconyRun.storey: an upper storey (1..storeys-1)`);
    if (!(run.projection >= 0.2 && run.projection <= 1.5)) p.push(`${at}.balconyRun.projection: 0.2..1.5 m`);
    if (run.slab !== undefined && !(run.slab >= 0.08 && run.slab <= 0.5)) p.push(`${at}.balconyRun.slab: 0.08..0.5 m`);
    if (run.guardRise !== undefined && !(run.guardRise >= 0.5 && run.guardRise <= 1.5)) p.push(`${at}.balconyRun.guardRise: 0.5..1.5 m`);
    if (run.guard !== 'iron' && run.guard !== 'brick') p.push(`${at}.balconyRun.guard: iron or brick`);
    if (run.slabColour !== undefined && !/^#[0-9a-f]{6}$/i.test(run.slabColour)) p.push(`${at}.balconyRun.slabColour: #rrggbb`);
    if (!run.evidence) p.push(`${at}.balconyRun.evidence: the strip rows of slab and guard`);
  }
  const b = f.balconies;
  if (b?.style === 'slab-hood') {
    if (b.projecting) p.push(`${at}.balconies: slab-hood already projects; drop projecting`);
    if (b.styleStoreys !== undefined) p.push(`${at}.balconies.styleStoreys: slab-hood is the whole stack`);
    if (f.repeat) p.push(`${at}.balconies.style: slab-hood not on a repeated front`);
  }
  return p;
}
