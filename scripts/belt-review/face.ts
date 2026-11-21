/**
 * Belt review (R3): define one block face as an ordered list of BAG pands, from the addresses on one side of a street.
 *
 *   node --import tsx scripts/belt-review/face.ts --face herengracht-2-90-even --street Herengracht --side even --from 2 --to 90 [--write]
 *
 * Source: PDOK BAG OGC API v2 (CC0): every Amsterdam verblijfsobject on the street (filtered by the openbare ruimte id, so
 * the Herengrachten of Almelo and Weesp stay out), grouped by pand; each pand item gives its footprint, which places it on
 * the face. Responses are cached in PAND_REFERENCE_CACHE (one request start per 500 ms). Writes
 * review-data/belt-review/<faceId>/face.json:
 *   {faceId, street, side, from, to, pands: [{pandId, address, order, numbers, buurt, built, ...}]}
 * `order` runs left to right as seen from the street (flags.ts groupFaces convention), so a row strip reads in the same order.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { cachedJson, http, neighbourhood, lngLatToRd, type Footprint, type Rd } from '../pand-reference/core.ts';
import { pickWall } from '../pand-reference/select.ts';
import { centroid } from '../house-crops/buurt.ts';
import { WORLD_TWINS } from '../house-specs/rows/belt-rows.ts';
import { faceOrder, buurtOf, type FacePand, type FaceFile } from './faceModel.ts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const BAG = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections';
export const USER_AGENT = 'MapRecall-BeltReview/1.0 (+https://github.com/blackmad/map-recall2; Gemeente Amsterdam panoramas CC BY 4.0, BAG CC0)';
export const faceDir = (faceId: string) => path.resolve('review-data/belt-review', faceId);

/** Amsterdam's openbare ruimte id for a street name (bronhouder 0363 and an id in the 0363 range: Weesp's 0457 streets are out). */
async function streetId(street: string, from: number, to: number): Promise<string> {
  // The first numbers of the range until one exists (Wolvenstraat has no 2).
  for (let n = from, tries = 0; n <= to && tries < 8; n += 1, tries++) {
    const j: any = await cachedJson(`${BAG}/verblijfsobject/items?openbare_ruimte_naam=${encodeURIComponent(street)}&huisnummer=${n}&f=json&limit=100`);
    const hit = (j.features ?? []).find((f: any) => String(f.properties.openbare_ruimte_identificatie).startsWith('0363'));
    if (hit) return hit.properties.openbare_ruimte_identificatie;
  }
  throw new Error(`no Amsterdam ${street} ${from}-${to} in BAG`);
}

type Unit = { number: number; letter: string | null; suffix: string | null; use: string; pandHref: string };
async function unitsOn(orId: string): Promise<Unit[]> {
  const out: Unit[] = [];
  let url: string | null = `${BAG}/verblijfsobject/items?openbare_ruimte_identificatie=${orId}&f=json&limit=1000`;
  for (let page = 0; url && page < 20; page++) {
    const j: any = await cachedJson(url);
    for (const f of j.features ?? []) {
      const p = f.properties;
      if (/ingetrokken|niet gerealiseerd|ten onrechte/i.test(String(p.status))) continue;
      for (const href of p['pand.href'] ?? []) out.push({ number: p.huisnummer, letter: p.huisletter ?? null, suffix: p.toevoeging ?? null, use: String(p.gebruiksdoel ?? ''), pandHref: href });
    }
    url = j.links?.find((l: any) => l.rel === 'next')?.href ?? null;
  }
  return out;
}

async function main() {
  const faceId = arg('face'), street = arg('street'), side = arg('side') as 'even' | 'odd' | undefined;
  const from = Number(arg('from')), to = Number(arg('to'));
  if (!faceId || !street || !side || !Number.isFinite(from) || !Number.isFinite(to)) {
    console.error('usage: face.ts --face <id> --street <name> --side even|odd --from <n> --to <n> [--exclude n,n] [--write]'); process.exit(2);
  }
  const exclude = new Set((arg('exclude') ?? '').split(',').filter(Boolean).map(Number));
  http.minGapMs = 500; http.maxAttempts = 6; http.userAgent = USER_AGENT;
  const orId = await streetId(street, from, to);
  const parity = side === 'even' ? 0 : 1;
  const units = (await unitsOn(orId)).filter(u => u.number >= from && u.number <= to && u.number % 2 === parity && !exclude.has(u.number));
  const byHref = new Map<string, Unit[]>();
  for (const u of units) byHref.set(u.pandHref, [...(byHref.get(u.pandHref) ?? []), u]);
  console.log(`${street} ${from}-${to} ${side}: ${units.length} units in ${byHref.size} pands (openbare ruimte ${orId})`);

  const pands: (FacePand & { fp: Footprint })[] = [];
  for (const [href, list] of byHref) {
    const item: any = await cachedJson(`${href}?f=json`);
    const bagId = String(item.properties.identificatie);
    if (/gesloopt|niet gerealiseerd|ten onrechte/i.test(String(item.properties.status))) continue;
    const ring: Rd[] = (item.geometry.type === 'Polygon' ? item.geometry.coordinates[0] : item.geometry.coordinates[0][0]).map((q: number[]) => lngLatToRd([q[0], q[1]]));
    const worldId = WORLD_TWINS[bagId] ?? bagId;
    // Twins (Herengracht 2-4: BAG holds two pands on one footprint, the world draws one): merge into the world's pand.
    const twin = pands.find(p => p.pandId === worldId);
    if (twin) {
      twin.numbers = [...new Set([...twin.numbers, ...list.map(u => u.number)])].sort((a, b) => a - b); twin.units += list.length;
      twin.address = twin.numbers.length > 1 ? `${street} ${twin.numbers[0]}–${twin.numbers.at(-1)}` : `${street} ${twin.numbers[0]}`;
      if (worldId !== bagId) twin.bagPandId = bagId;
      continue;
    }
    const tiles = await neighbourhood(centroid(ring));
    const fp = tiles.find(f => f.id === `NL.IMBAG.Pand.${worldId}`) ?? { id: `NL.IMBAG.Pand.${worldId}`, ring, height: 0 };
    const numbers = [...new Set(list.map(u => u.number))].sort((a, b) => a - b);
    const letters = [...new Set(list.filter(u => u.letter).map(u => `${u.number}${u.letter}`))].sort();
    pands.push({
      pandId: worldId, ...(worldId !== bagId ? { bagPandId: bagId } : {}), address: numbers.length > 1 ? `${street} ${numbers[0]}–${numbers.at(-1)}` : `${street} ${numbers[0]}`,
      order: 0, numbers, ...(letters.length ? { letters } : {}), built: item.properties.bouwjaar ?? null, units: list.length,
      groundUses: [...new Set(list.filter(u => !u.suffix || /^h$/i.test(u.suffix)).map(u => u.use))], buurt: await buurtOf(centroid(fp.ring)),
      inWorldTiles: tiles.some(f => f.id === fp.id), fp,
    });
  }
  // Street-facing wall per pand, then order left to right along the face as seen from the street.
  const walls = new Map<string, { mid: Rd; nx: number; ny: number }>();
  for (const p of pands) { const { wall } = await pickWall(p.fp, await neighbourhood(centroid(p.fp.ring))); if (wall) walls.set(p.pandId, wall); }
  const ordered = faceOrder(pands.map(p => ({ id: p.pandId, mid: walls.get(p.pandId)?.mid ?? centroid(p.fp.ring), normal: walls.get(p.pandId) ? [walls.get(p.pandId)!.nx, walls.get(p.pandId)!.ny] as [number, number] : undefined, firstNumber: p.numbers[0] })));
  const out: FaceFile = {
    faceId, street, side, from, to, orderNote: 'order runs left to right as seen from the street (scripts/belt-review/faceModel.ts faceOrder)',
    source: 'PDOK BAG OGC API v2 (verblijfsobject + pand), CC0', fetchedAt: new Date().toISOString().slice(0, 10),
    pands: ordered.map((id, i) => { const { fp, ...p } = pands.find(q => q.pandId === id)!; return { ...p, order: i }; }),
  };
  for (const p of out.pands) console.log(`${String(p.order).padStart(3)} ${p.pandId} ${p.address.padEnd(22)} ${p.built ?? '?'} ${p.buurt ?? '-'}${p.inWorldTiles ? '' : ' (not in world tiles)'}${p.bagPandId ? ` (BAG ${p.bagPandId})` : ''}`);
  const buurten = [...new Set(out.pands.map(p => p.buurt))];
  console.log(`buurten: ${buurten.join(', ')}; ${http.requests} requests`);
  if (process.argv.includes('--write')) {
    await fs.mkdir(faceDir(faceId), { recursive: true });
    await fs.writeFile(path.join(faceDir(faceId), 'face.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`wrote ${path.relative(process.cwd(), path.join(faceDir(faceId), 'face.json'))}`);
  }
}

if (process.argv[1]?.endsWith('belt-review/face.ts')) await main();
