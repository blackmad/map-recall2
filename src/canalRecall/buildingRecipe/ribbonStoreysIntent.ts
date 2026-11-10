/**
 * Validation of `walls[].ribbonStoreys` (large tier; geometry in blockBuilding/ribbonStoreys.ts). Kept out of
 * largeIntent.ts so that file does not grow. Proportions only: sill and h of the storey, rows, spandrel.h and head.h of the band.
 */
import type {LargeWallIntent} from './intent.ts';

export const RIBBON_STOREYS_RANGE = {sill: [0, 0.6], h: [0.15, 0.96], top: 0.97, lights: [1, 12], rows: [0.05, 0.95], maxRows: 4, spandrel: [0.05, 0.75], panels: 0.85} as const;
/** systems whose storey rows a ribbon storey may replace (a curtain wall or glazed hall is glass already) */
export const RIBBON_STOREYS_SYSTEMS = ['brick-bay-grid', 'ribbon-windows', 'plinth-shopfronts', 'blank', 'french-window-ledge'] as const;
const KEYS = ['storeys', 'bays', 'sill', 'h', 'lights', 'rows', 'spandrel', 'head', 'frame'];
const HEX = /^#[0-9a-f]{6}$/i;

export function ribbonStoreysProblems(w: LargeWallIntent, at: string): string[] {
  const p: string[] = [], list = w.ribbonStoreys, R = RIBBON_STOREYS_RANGE;
  if (list === undefined) return p;
  if (!Array.isArray(list) || !list.length) return [`${at}.ribbonStoreys: list of {storeys, sill, h, lights, rows?, spandrel?, head?, frame?, bays?}`];
  if (!(RIBBON_STOREYS_SYSTEMS as readonly string[]).includes(w.system)) p.push(`${at}.ribbonStoreys: needs ${RIBBON_STOREYS_SYSTEMS.join(', ')} (not ${w.system})`);
  const num = (v: unknown, lo: number, hi: number, where: string) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) p.push(`${where}: number ${lo}..${hi}`); };
  const int = (v: unknown, lo: number, hi: number, where: string) => { if (!(Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi)) p.push(`${where}: integer ${lo}..${hi}`); };
  const seen = new Set<number>();
  const claimed = (s: number) => w.blankStoreys?.includes(s) || w.glazedStoreys?.includes(s) || w.balconies?.storeys?.includes(s) || w.loggias?.storeys?.includes(s)
    || (w.plinth && (w.plinth.storeys ?? [0]).includes(s)) || w.storeyShapes?.some(e => e.storeys.includes(s)) || w.bayWindows?.some(e => e.storeys.includes(s));
  list.forEach((r, k) => {
    const a = `${at}.ribbonStoreys[${k}]`;
    if (!r || typeof r !== 'object') { p.push(`${a}: object`); return; }
    for (const key of Object.keys(r)) if (!KEYS.includes(key)) p.push(`${a}.${key}: unknown field (${KEYS.join(', ')})`);
    if (!Array.isArray(r.storeys) || !r.storeys.length) p.push(`${a}.storeys: list of storeys (0 = ground)`);
    else for (const s of r.storeys) {
      int(s, 0, 39, `${a}.storeys`);
      if (seen.has(s)) p.push(`${a}.storeys: storey ${s} is in two ribbon entries`); seen.add(s);
      if (claimed(s)) p.push(`${a}.storeys: storey ${s} is also a blank, glazed, balcony, loggia, plinth, shaped or bay-window storey`);
      if (s === 0 && (w.hoist || w.gateways || w.hallDoors || w.souterrain || w.garageDoors || w.garageBays || (w.ground !== undefined && w.ground !== 'system'))) p.push(`${a}.storeys: a ground ribbon not with hoist, gateways, hallDoors, souterrain, garage doors or a ground other than "system"`);
    }
    if (r.bays !== undefined) {
      if (!Array.isArray(r.bays) || !r.bays.length) p.push(`${a}.bays: list of bay indices`);
      else r.bays.forEach(b => int(b, 0, (w.baysPerStorey ?? 80) - 1, `${a}.bays`));
      if (w.baysPerStorey === undefined) p.push(`${a}.bays needs baysPerStorey`);
    }
    num(r.sill, R.sill[0], R.sill[1], `${a}.sill`); num(r.h, R.h[0], R.h[1], `${a}.h`);
    if (typeof r.sill === 'number' && typeof r.h === 'number' && r.sill + r.h > R.top) p.push(`${a}: sill + h must leave a head (<= ${R.top} of the storey)`);
    int(r.lights, R.lights[0], R.lights[1], `${a}.lights`);
    if (r.rows !== undefined) {
      if (!Array.isArray(r.rows) || !r.rows.length || r.rows.length > R.maxRows) p.push(`${a}.rows: 1..${R.maxRows} fractions of the band height`);
      else r.rows.forEach((v, i) => { num(v, R.rows[0], R.rows[1], `${a}.rows`); if (i && !(v > r.rows![i - 1])) p.push(`${a}.rows: ascending`); });
    }
    for (const key of ['spandrel', 'head'] as const) {
      const pn = r[key];
      if (pn === undefined) continue;
      if (!pn || typeof pn !== 'object') { p.push(`${a}.${key}: {h, colour}`); continue; }
      for (const k2 of Object.keys(pn)) if (k2 !== 'h' && k2 !== 'colour') p.push(`${a}.${key}.${k2}: unknown field (h, colour)`);
      num(pn.h, R.spandrel[0], R.spandrel[1], `${a}.${key}.h`);
      if (!(typeof pn.colour === 'string' && HEX.test(pn.colour))) p.push(`${a}.${key}.colour: #rrggbb`);
    }
    if (typeof r.spandrel?.h === 'number' && typeof r.head?.h === 'number' && r.spandrel.h + r.head.h > R.panels) p.push(`${a}: spandrel.h + head.h must leave glass (<= ${R.panels} of the band)`);
    if (r.frame !== undefined && !(typeof r.frame === 'string' && HEX.test(r.frame))) p.push(`${a}.frame: #rrggbb`);
  });
  return p;
}
