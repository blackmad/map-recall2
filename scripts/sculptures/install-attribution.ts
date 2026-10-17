/**
 * Attribution for installed statue reconstructions (scripts/sculptures/installed/<id>.json): rewrites the landmark's
 * `attribution` in manualCatalogue.json and in its scripts/landmarks/*-spec.json from the provenance record
 * (scripts/sculptures/rebuild-sources/<id>.json): sculptor and year, every photograph used with author, licence and Commons
 * page, the route, and what stays kit. A figure derived from any CC BY-SA photograph is shared alike (CC BY-SA 4.0); else any
 * CC BY photograph gives CC BY 4.0; CC0/PD inputs only leave it an original project asset. `--unhold=<id,...>` also clears a
 * `status: held` (the reconstruction replaces the held kit figure).
 *
 *   node --import tsx scripts/sculptures/install-attribution.ts [--unhold=kinderbrug-meisje-eekhoorns,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import {installedRecord} from '../landmarks/installed-figures.js';

interface Photo { title: string; pageUrl: string; author: string; licence: string }
interface Provenance { sculptor?: {name: string; year?: number}; photos: Record<string, Photo>; figures: Record<string, {route: string; views: {title: string}[]}> }

const unhold = new Set((process.argv.find(a => a.startsWith('--unhold='))?.slice(9) ?? '').split(',').filter(Boolean));
const ids = fs.readdirSync('scripts/sculptures/installed').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();

export function attributionFor(name: string, prov: Provenance, rec: NonNullable<ReturnType<typeof installedRecord>>) {
  const used = new Map<string, Photo>();
  for (const f of rec.figures) for (const v of prov.figures[f.name]?.views ?? []) if (prov.photos[v.title]) used.set(v.title, prov.photos[v.title]);
  const photos = [...used.values()];
  const lic = photos.map(p => p.licence);
  const licence = lic.some(l => /BY-SA/i.test(l)) ? {licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'}
    : lic.some(l => /^CC BY/i.test(l)) ? {licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/'}
      : {licence: 'Original project asset', licenceUrl: './LICENSE'};
  const routes = [...new Set(rec.figures.map(f => /TRELLIS/.test(prov.figures[f.name]?.route ?? f.route ?? '') ? 'TRELLIS.2 multi-view' : 'TripoSR single-view'))].join(' and ');
  const authors = [...new Set(photos.map(p => p.author.replace(/ \(uploader; no Artist field\)$/, '')))];
  const sculptor = prov.sculptor ? `${prov.sculptor.name}${prov.sculptor.year ? ` (${prov.sculptor.year})` : ''}` : 'unknown sculptor';
  return {
    title: `${name} - reconstruction from photographs`,
    author: `Map Recall; sculpture by ${sculptor}; figure reconstructed from photographs by ${authors.join(', ')}`,
    sourceUrl: photos[0]?.pageUrl ?? '',
    ...licence,
    modifications: `Figure${rec.figures.length > 1 ? 's' : ''} reconstructed (${routes}) from Wikimedia Commons photographs: `
      + photos.map(p => `"${p.title.replace(/^File:/, '')}" by ${p.author} (${p.licence}, ${p.pageUrl})`).join('; ')
      + `. Decimated to about 6,000 triangles per figure in the kit's material, no photo colour; plinth, pier and setting are the original low-poly kit model. Provenance: ${rec.provenance}.`,
  };
}

const cat = 'src/canalRecall/landmarks/manualCatalogue.json';
const list = JSON.parse(fs.readFileSync(cat, 'utf8')) as Record<string, unknown>[];
const specs = fs.readdirSync('scripts/landmarks').filter(f => f.endsWith('-spec.json')).map(f => path.join('scripts/landmarks', f));
const specOf = (id: string) => specs.find(f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).id === id; } catch { return false; } });
const patch = (e: Record<string, unknown>, attribution: object, id: string) => {
  e.attribution = attribution;
  if (unhold.has(id)) { delete e.status; delete e.heldReason; }
};
if (import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  for (const id of ids) {
    const rec = installedRecord(id)!;
    const prov = JSON.parse(fs.readFileSync(rec.provenance, 'utf8')) as Provenance;
    const entry = list.find(e => e.id === id);
    if (!entry) throw new Error(`${id}: no catalogue entry`);
    const attribution = attributionFor(String(entry.name), prov, rec);
    patch(entry, attribution, id);
    const spec = specOf(id);
    if (spec) {
      const s = JSON.parse(fs.readFileSync(spec, 'utf8'));
      patch(s, attribution, id);
      fs.writeFileSync(spec, JSON.stringify(s, null, 2) + '\n');
    }
    console.log(id, attribution.licence, spec ?? '(no spec)');
  }
  fs.writeFileSync(cat, JSON.stringify(list, null, 2) + '\n');
}
