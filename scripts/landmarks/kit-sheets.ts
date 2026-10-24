/**
 * Gallery-card sheets for the parametric landmark kits (docs/handoffs/lane-kits-review-20261023.md, role A).
 *
 *   node --import tsx scripts/landmarks/kit-sheets.ts [--limit=N] [--only=name,name] [--out=artifacts/strips/kits]
 *     [--per-page=4] [--no-walls] [--walls=artifacts/strips/kit-walls] [--max-minutes=40]
 *
 * Kits are the census rows with tier `landmarkKit` (bespoke-carried kits are already excluded there), ordered by the
 * highest `priority` of a buurt that lists them in public/data/extracts/amsterdam/coverage-v1/buurten.json (kits with no
 * buurt last). Per kit: the kit at gallery-card size (320x240) from the sun side and the shade side (the kit viewer's
 * kitGeometry + buildKitChunk path, drawn in kit-sheets-render.ts), and beside it up to two municipal panorama crops of
 * the kit's main pand (the pand nearest the kit centre; all-walls.ts writes the walls, longest first). Pages of four rows
 * at 1600 px: `<out>-<n>.png` and `<out>-<n>.json` per page. A kit with no pand gets "no photo"; a kit whose parts do not
 * resolve through the BAG index gets "pand unresolved" and still renders from its tile location.
 *
 * Kits on OSM-only parts (GitHub #37: 114 generic worship/public kits and the hand kits of Centraal, Royal Palace, Waag...)
 * take their location from the parts' outlines and their pand from the 3DBAG join in
 * public/data/extracts/amsterdam/kit-pands.json (scripts/landmarks/build-kit-pands.ts): the pand most of the parts stand
 * on. `--only` names kits outside the census too (kits a bespoke model stands in for).
 *
 * Browser: one headless Chromium for the run (serialise with `bash /tmp/canal-pw.sh node --import tsx ...`).
 */
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { census } from './census.ts';
import { KITS, kitIds } from '../../src/canalRecall/landmarkKits.ts';
import { addFeatures, emptyIndex, resolveSuppressed, type BagPandIndex } from '../../src/canalRecall/bagPandIndex.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = path.resolve(ROOT, arg('out', 'artifacts/strips/kits'));
const wallsRoot = path.resolve(ROOT, arg('walls', 'artifacts/strips/kit-walls'));
const only = arg('only') ? arg('only').split(',').filter(Boolean) : null;
const limit = Number(arg('limit', '0')) || Infinity;
const perPage = Number(arg('per-page', '4'));
const noWalls = process.argv.includes('--no-walls');
const maxMinutes = Number(arg('max-minutes', '40'));
const WIDTH = 1600, CARD_W = 320, CARD_H = 240, PHOTO_W = 960, HEAD_H = 40, GAP = 6;
const EXTRACTS = path.join(ROOT, 'public/data/extracts/amsterdam');
// three.js sun in the kit viewer is (-40, 80, 60): the sun side camera sits on the sun's horizontal bearing.
const SUN_AZ = (Math.atan2(-40, -60) * 180 / Math.PI + 360) % 360, SHADE_AZ = (SUN_AZ + 180) % 360;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const digits = (pand: string) => pand.replace('NL.IMBAG.Pand.', '');
const tileCentre = (x: number, y: number): [number, number] => {
  const n = 2 ** 14;
  return [(x + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI];
};

interface Row {
  n: number; kit: string; pand: string | null; centre: [number, number] | null; buurt: string | null; priority: number | null;
  parts: number; tris: number; top: number; contextBuildings: number; contextCulled: number; photos: string[]; noPhoto: boolean; renderError?: string; wallsError?: string; pandVia?: string;
}

/** Kit priority: the highest buurt priority among the buurten whose content lists the kit. */
function kitPriorities(): Map<string, {priority: number; buurt: string}> {
  const map = new Map<string, {priority: number; buurt: string}>();
  const data = JSON.parse(fs.readFileSync(path.join(EXTRACTS, 'coverage-v1/buurten.json'), 'utf8'));
  for (const f of data.features) {
    for (const [name] of f.properties.content?.kits ?? []) {
      const prior = map.get(String(name));
      if (!prior || f.properties.priority > prior.priority) map.set(String(name), {priority: f.properties.priority, buurt: f.properties.name});
    }
  }
  return map;
}

/** BAG pand index over the base tiles, as build-coverage builds it. */
function bagIndex(): BagPandIndex {
  const index = emptyIndex();
  const tiles = path.join(EXTRACTS, 'bag-tiles/14');
  for (const x of fs.readdirSync(tiles).filter(n => /^\d+$/.test(n))) {
    for (const file of fs.readdirSync(path.join(tiles, x)).filter(n => n.endsWith('.geojson.gz'))) {
      addFeatures(index, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tiles, x, file))).toString('utf8')).features);
    }
  }
  return index;
}

/** One all-walls run per pand, cached: a walls.json (or an error.txt when the run failed, so it is not retried). */
function wallsFor(pand: string, wallsErrors: string[], footprint?: string): {photos: {file: string; tag: string; date?: string}[]} {
  const dir = path.join(wallsRoot, digits(pand));
  const json = path.join(dir, 'walls.json');
  if (!fs.existsSync(json) && !fs.existsSync(path.join(dir, 'error.txt')) && !noWalls) {
    try {
      execFileSync(process.execPath, ['--import', 'tsx', path.join(ROOT, 'scripts/pand-reference/all-walls.ts'), `--pand=${pand}`, ...(footprint ? [`--footprint=${footprint}`] : []), '--max=2', '--min-len=8', `--out=${wallsRoot}`],
        {cwd: ROOT, timeout: 600_000, stdio: ['ignore', 'pipe', 'pipe']});
    } catch (e: any) {
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.join(dir, 'error.txt'), String(e.stderr ?? e.message).slice(-2000));
      wallsErrors.push(`all-walls failed for ${digits(pand)}`);
    }
  }
  if (!fs.existsSync(json)) return {photos: []};
  const walls = JSON.parse(fs.readFileSync(json, 'utf8')).walls ?? [];
  const photos = walls.map((w: any) => ({file: path.join(dir, `${w.tag}.jpg`), tag: w.tag, date: w.date})).filter((p: any) => fs.existsSync(p.file)).slice(0, 2);
  return {photos};
}

/** A card-size grey placeholder with its reason in the middle (never a transparent or black card). */
async function blank(w: number, h: number, text: string): Promise<Buffer> {
  return sharp({create: {width: w, height: h, channels: 3, background: '#d9d4c7'}})
    .composite([{input: Buffer.from(`<svg width="${w}" height="${h}"><text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="Helvetica, Arial" font-size="18" fill="#5a2e2e">${esc(text)}</text></svg>`), top: 0, left: 0}])
    .png().toBuffer();
}

async function main() {
  const t0 = Date.now();
  const names = new Set(census().rows.filter(r => r.tier === 'landmarkKit').map(r => r.name as string));
  const priorities = kitPriorities();
  let kits = KITS.filter(k => (only ? only.includes(k.name) : names.has(k.name)));
  kits.sort((a, b) => (priorities.get(b.name)?.priority ?? -1) - (priorities.get(a.name)?.priority ?? -1) || a.name.localeCompare(b.name));
  kits = kits.slice(0, limit);
  console.log(`kits: ${kits.length} (census landmarkKit rows ${names.size})`);
  const index = bagIndex();
  const kitLocations = JSON.parse(fs.readFileSync(path.join(EXTRACTS, 'kit-locations.json'), 'utf8')).ids as Record<string, string>;
  const kitPands = JSON.parse(fs.readFileSync(path.join(EXTRACTS, 'kit-pands.json'), 'utf8')).ids as Record<string, {centre: [number, number]; areaM2: number; pand: string | null}>;
  console.log(`bag index: ${index.pands.size} pands (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

  const bundle = await build({entryPoints: [path.join(ROOT, 'scripts/landmarks/kit-sheets-render.ts')], bundle: true, format: 'iife', write: false, logLevel: 'error', platform: 'browser'});
  const browser = await chromium.launch({args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal']});
  const page = await browser.newPage({viewport: {width: CARD_W, height: CARD_H}});
  page.setDefaultTimeout(120_000);
  page.on('pageerror', e => console.log('pageerror', e.message));
  const types: Record<string, string> = {'.gz': 'application/octet-stream', '.json': 'application/json', '.js': 'application/javascript', '.html': 'text/html'};
  await page.route('http://kit.local/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p === '/__kit.js') return route.fulfill({body: bundle.outputFiles[0].text, contentType: 'application/javascript'});
    if (p === '/') return route.fulfill({body: '<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/__kit.js"></script>', contentType: 'text/html'});
    const file = path.join(ROOT, 'public', p);
    if (!p.startsWith('/data/') || !file.startsWith(path.join(ROOT, 'public/data')) || !fs.existsSync(file)) return route.fulfill({status: 404, body: ''});
    route.fulfill({body: fs.readFileSync(file), contentType: types[path.extname(file)] ?? 'application/octet-stream'});
  });
  await page.goto('http://kit.local/');

  let pageNo = 0, noPhotoTotal = 0, noPandTotal = 0, renderErrors = 0;
  const wallsErrors: string[] = [];
  try {
    for (let start = 0; start < kits.length; start += perPage) {
      if (Date.now() - t0 > maxMinutes * 60_000) { console.log(`stopped at the ${maxMinutes}-minute cap after ${pageNo} page(s); kit ${start + 1} of ${kits.length} not sheeted`); break; }
      pageNo++;
      const rows: Row[] = [];
      const tiles: {kit: Buffer | null; shade: Buffer | null; photo: Buffer | null}[] = [];
      for (const [i, kit] of kits.slice(start, start + perPage).entries()) {
        const resolved = resolveSuppressed(index, kitIds(kit));
        const pandCentres = resolved.pands.map(p => ({p, c: index.pands.get(p)?.centroid})).filter(x => x.c) as {p: string; c: [number, number]}[];
        let centre: [number, number] | null = null;
        const osmParts = resolved.osmOnly.map(id => kitPands[id]).filter(Boolean);
        if (pandCentres.length) centre = [pandCentres.reduce((s, x) => s + x.c[0], 0) / pandCentres.length, pandCentres.reduce((s, x) => s + x.c[1], 0) / pandCentres.length];
        else if (osmParts.length) centre = [osmParts.reduce((s, x) => s + x.centre[0], 0) / osmParts.length, osmParts.reduce((s, x) => s + x.centre[1], 0) / osmParts.length];
        else {
          const loc = kitIds(kit).map(id => kitLocations[id]).find(Boolean);
          if (loc) { const [x, y] = loc.split('/').map(Number); centre = tileCentre(x, y); }
        }
        const c0 = centre;
        // The pand most of the OSM-only parts stand on (ties: the first part's), when no part is a pand itself.
        const joined = new Map<string, number>();
        for (const x of osmParts) if (x.pand) joined.set(x.pand, (joined.get(x.pand) ?? 0) + 1);
        const pand = pandCentres.length && c0
          ? pandCentres.reduce((best, x) => Math.hypot(x.c[0] - c0[0], x.c[1] - c0[1]) < Math.hypot(best.c[0] - c0[0], best.c[1] - c0[1]) ? x : best).p
          : joined.size ? `NL.IMBAG.Pand.${[...joined].reduce((b, x) => (x[1] > b[1] ? x : b))[0]}` : null;
        const row: Row = {n: start + i + 1, kit: kit.name, pand: pand ? digits(pand) : null, centre, buurt: priorities.get(kit.name)?.buurt ?? null,
          priority: priorities.get(kit.name)?.priority ?? null, parts: resolved.pands.length + resolved.osmOnly.length, tris: 0, top: 0, contextBuildings: 0, contextCulled: 0, photos: [], noPhoto: true,
          ...(pand && !pandCentres.length ? {pandVia: 'kit-pands.json (OSM part joined to 3DBAG)'} : {})};
        let kitPng: Buffer | null = null, shadePng: Buffer | null = null;
        if (centre) {
          try {
            for (const [az, which] of [[SUN_AZ, 'sun'], [SHADE_AZ, 'shade']] as const) {
              const r = await page.evaluate(req => (window as any).KitSheets.renderKit(req), {kit: kit.name, centre, azDeg: az, w: CARD_W, h: CARD_H});
              const buf = Buffer.from(r.png.split(',')[1], 'base64');
              if (which === 'sun') { kitPng = buf; row.parts = r.parts; row.tris = r.tris; row.top = r.top; row.contextBuildings = r.contextBuildings; row.contextCulled = r.contextCulled; }
              else shadePng = buf;
            }
          } catch (e: any) { row.renderError = String(e.message ?? e).slice(0, 300); renderErrors++; }
        } else row.renderError = 'no location';
        let photo: Buffer | null = null;
        if (pand) {
          // A pand joined through OSM parts is not a tile feature: its walls come from the largest OSM part on it (any kit's:
          // Bijlmerbios is ten one-part kits on one pand).
          const viaPart = pandCentres.length ? undefined : Object.keys(kitPands).filter(id => kitPands[id].pand && `NL.IMBAG.Pand.${kitPands[id].pand}` === pand)
            .sort((a, b) => kitPands[b].areaM2 - kitPands[a].areaM2)[0];
          const walls = wallsFor(pand, wallsErrors, viaPart);
          if (walls.photos.length) {
            const panels = await Promise.all(walls.photos.map(p => sharp(p.file).resize(PHOTO_W / 2, CARD_H, {fit: 'contain', background: '#f4f4f2'}).flatten({background: '#f4f4f2'}).png().toBuffer()));
            row.photos = walls.photos.map(p => `${p.tag}${p.date ? ` ${p.date}` : ''}`);
            row.noPhoto = false;
            photo = await sharp({create: {width: PHOTO_W, height: CARD_H, channels: 3, background: '#f4f4f2'}})
              .composite(panels.map((input, j) => ({input, left: j * (PHOTO_W / 2), top: 0}))).png().toBuffer();
          }
          if (wallsErrors.length && row.noPhoto) row.wallsError = wallsErrors[wallsErrors.length - 1];
        }
        if (row.noPhoto) noPhotoTotal++;
        if (!pand) noPandTotal++;
        rows.push(row);
        tiles.push({kit: kitPng, shade: shadePng, photo});
      }
      // Compose the page: a header per row, then sun side | shade side | street photo.
      const parts: {input: Buffer; top: number; left: number}[] = [];
      let y = 0;
      for (const [i, row] of rows.entries()) {
        const t = tiles[i];
        const noPhotoLabel = row.noPhoto ? (row.pand ? 'NO PHOTO' : 'NO PHOTO (pand unresolved)') : '';
        const head = `${row.n}. ${row.kit}  ·  ${row.pand ? `pand ${row.pand}` : 'pand unresolved'}  ·  ${row.parts} parts  ·  ${row.tris} tris  ·  top ${row.top} m  ·  buurt ${row.buurt ?? '-'} (priority ${row.priority?.toFixed(3) ?? '-'})`
          + (row.renderError ? `  ·  RENDER ERROR ${row.renderError}` : '') + (noPhotoLabel ? `  ·  ${noPhotoLabel}` : '');
        parts.push({input: Buffer.from(`<svg width="${WIDTH}" height="${HEAD_H}"><rect width="100%" height="100%" fill="#1f2328"/><text x="10" y="26" font-family="Helvetica, Arial" font-size="17" fill="#fff">${esc(head.slice(0, 200))}</text></svg>`), top: y, left: 0});
        y += HEAD_H;
        const cardLabel = (text: string) => Buffer.from(`<svg width="${CARD_W}" height="22"><rect width="100%" height="100%" fill="#000000aa"/><text x="6" y="15" font-family="Helvetica, Arial" font-size="13" fill="#fff">${text}</text></svg>`);
        const sun = t.kit ?? await blank(CARD_W, CARD_H, row.renderError ?? 'no render');
        const shade = t.shade ?? await blank(CARD_W, CARD_H, 'no render');
        parts.push({input: await sharp(sun).composite([{input: cardLabel('sun side'), top: CARD_H - 22, left: 0}]).png().toBuffer(), top: y, left: 0});
        parts.push({input: await sharp(shade).composite([{input: cardLabel('shade side'), top: CARD_H - 22, left: 0}]).png().toBuffer(), top: y, left: CARD_W});
        const photo = t.photo ?? await blank(PHOTO_W, CARD_H, row.pand ? 'no photo' : 'no photo (pand unresolved)');
        parts.push({input: photo, top: y, left: 2 * CARD_W});
        y += CARD_H + GAP;
      }
      const file = `${out}-${pageNo}.png`;
      fs.mkdirSync(path.dirname(file), {recursive: true});
      await sharp({create: {width: WIDTH, height: y, channels: 3, background: '#f4f4f2'}}).composite(parts).png().toFile(file);
      fs.writeFileSync(`${out}-${pageNo}.json`, JSON.stringify({page: pageNo, generatedAt: new Date().toISOString(), rows}, null, 1) + '\n');
      console.log(`page ${pageNo}: ${rows.map(r => r.kit).join(' | ')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  } finally {
    await browser.close();
  }
  console.log(`kit sheets: ${kits.length} kits on ${pageNo} page(s) in ${path.relative(ROOT, out)}-N.png; no photo ${noPhotoTotal}, pand unresolved ${noPandTotal}, render errors ${renderErrors}, walls errors ${wallsErrors.length}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

await main();
