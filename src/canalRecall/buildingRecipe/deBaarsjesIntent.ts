/**
 * Validation of the De Baarsjes component set (Jan Evertsenstraat 1925-1927, docs/de-baarsjes-types-20261014.md):
 * the tall plain parapet (`parapet`), two-tone piers under painted bands (`bandPiers`), the single-bay box frame with a
 * hood (`bayWindows.hood`), stacked balconettes with hood slabs (`balconies.style: slab-hood`), the glass-block band of
 * a counted height and the measured wall band over a rigid canopy (`awning.glassBlocks: {rows}`, `awning.wallCourses`).
 * Every field is optional and never checked when absent. Kept out of intent.ts so that file does not grow; type-only
 * imports, so there is no runtime cycle.
 */
import type {FrontIntent, PaletteIntent, ShopAwningIntent} from './intent.ts';

/** Problems with a shop awning's rigid-canopy fields (`glassBlocks`, `wallCourses`). */
export function awningProblems(aw: ShopAwningIntent, at: string): string[] {
  const p: string[] = [], g = aw.glassBlocks as unknown;
  if (g !== undefined) {
    const rows = g && typeof g === 'object' ? (g as {rows?: unknown}).rows : undefined;
    const ok = g === true || (g !== null && typeof g === 'object' && Object.keys(g).every(k => k === 'rows') && Number.isInteger(rows) && (rows as number) >= 2 && (rows as number) <= 12);
    if (!ok || aw.style !== 'rigid') p.push(`${at}.shopfront.awning.glassBlocks: true, and only over a rigid canopy (or {rows: 2..12} rows of glass block)`);
  }
  if (aw.wallCourses !== undefined && (aw.style !== 'rigid' || !(Number.isInteger(aw.wallCourses) && aw.wallCourses >= 0 && aw.wallCourses <= 40))) p.push(`${at}.shopfront.awning.wallCourses: integer 0..40 brick courses, only over a rigid canopy`);
  return p;
}

/** Problems with the De Baarsjes front fields. */
export function deBaarsjesProblems(f: FrontIntent, palette: PaletteIntent | undefined, at: string): string[] {
  const p: string[] = [];
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
  const b = f.balconies;
  if (b?.style === 'slab-hood') {
    if (b.projecting) p.push(`${at}.balconies: slab-hood already projects; drop projecting`);
    if (b.styleStoreys !== undefined) p.push(`${at}.balconies.styleStoreys: slab-hood is the whole stack`);
    if (f.repeat) p.push(`${at}.balconies.style: slab-hood not on a repeated front`);
  }
  return p;
}
