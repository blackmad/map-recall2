// Step 1 (#316): what the register's descriptions hold, before any parser. Counts records per fact class with five
// quoted examples each, and the pand-match coverage of the RCE points.
//   npx tsx scripts/register-facts/measure-text.ts > artifacts/register-facts/step1.json
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
type Rec = { src: string; nr: string; text: string };
const recs: Rec[] = [];
for (const r of snap.rce) { const t = r.descriptions.map((d: any) => d.text).join(' '); if (t.trim()) recs.push({ src: 'rce', nr: r.monumentNumber, text: t }); }
for (const r of snap.municipal) { const t = [r.descriptions.map((d: any) => d.text).join(' '), r.metadata?.beschrijvingPubliek ?? '', r.metadata?.redengevendeOmschrijvingPubliek ?? ''].join(' ').trim(); if (t) recs.push({ src: 'municipal', nr: r.monumentNumber, text: t }); }

export const CLASSES: Record<string, RegExp> = {
  'period/date': /\b1[2-9]e\s+eeuw|\b(?:ca\.?|plm\.?|circa)\s*1[2-9]\d\d|\bX[VIX]{1,4}[a-d]?\b|\b1[2-9]\d\d\b|\b(?:vroeg|laat|midden)[- ]?1[2-9]e/i,
  'core-vs-facade dating': /in\s+de\s+kern|gevel\s+(?:uit|van)\s+(?:\d|ca|plm|[XVI])|\bgevel\s*\((?:\d|[XVI]|ca|plm)/i,
  'building type': /koetshuis|pakhuis|woonhuis|winkel-?woonhuis|grachtenhuis|herenhuis|hofje|school|kerk|bedrijfspand|werkplaats|stal\b|dubbel\s+huis|hoekhuis/i,
  gable: /halsgevel|klokgevel|trapgevel|lijstgevel|tuitgevel|punttop|puntgevel|verhoogde|ingezwenkte|rechte\s+\w*lijst|klokvormige|halsvormige/i,
  style: /Lodewijk\s+X[IV]+|classicistisch|\bneo-?\w+|Amsterdamse\s+School|eclectisch|renaissance|jugendstil|art\s+nouveau|art\s+deco|empire|rococo|barok/i,
  'material/finish': /baksteen|siermetselwerk|natuursteen|zandsteen|ge?pleisterd|bepleisterd|geschilderd|\bbanden\b|\bblokken\b|speklagen|hardsteen/i,
  elements: /hijsbalk|\bstoep\b|kelderingang|onderpui|\bpui\b|fronton|kroonlijst|consoles|dakkapel|attiek|festoen|oeil-de-boeuf|ovaal\s+venster|klauwstuk|roedenverdeling|schuiframen|luiken|ingangspartij|deuromlijsting|balkon|erker/i,
  storeys: /(?:één|een|twee|drie|vier|vijf|zes|\d)\s+(?:verdiepingen|bouwlagen|bouwlaag|verdieping|lagen)|souterrain|kelder/i,
  alterations: /verbouwd|gewijzigd|gerestaureerd|vernieuwd|onderpui\s+gewijzigd|veranderd|gemoderniseerd/i,
};
const out: Record<string, { rce: number; municipal: number; examples: string[] }> = {};
for (const [k, re] of Object.entries(CLASSES)) {
  const hits = recs.filter(r => re.test(r.text));
  out[k] = { rce: hits.filter(h => h.src === 'rce').length, municipal: hits.filter(h => h.src === 'municipal').length,
    examples: hits.filter((_, i) => i % Math.max(1, Math.floor(hits.length / 5)) === 0).slice(0, 5).map(h => { const m = re.exec(h.text)!; return `${h.src} ${h.nr}: …${h.text.slice(Math.max(0, m.index - 50), m.index + 70).replace(/\s+/g, ' ')}…`; }) };
}

// Pand-match coverage of RCE points (the monument-gables matcher: point in z14 footprint).
type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n)}`; };
const tiles = new Map<string, any[]>();
const feats = (k: string) => { if (!tiles.has(k)) { const f = `public/data/extracts/amsterdam/building-tiles/14/${k}.geojson.gz`; tiles.set(k, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()).features : []); } return tiles.get(k)!; };
let withText = 0, noPoint = 0, matched = 0, outside = 0, multiPandLinks = 0;
const perPand = new Map<string, number>();
for (const r of snap.rce) {
  if (!r.descriptions.length) continue;
  withText++;
  if (r.bagPandIds.length > 1) multiPandLinks++;
  const m = r.locations.map((l: any) => /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value)).find(Boolean);
  if (!m) { noPoint++; continue; }
  const p = [Number(m[1]), Number(m[2])];
  const hit = feats(tileOf(p[0], p[1])).find(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some((poly: Ring[]) => inside(p, poly[0])));
  if (!hit) { outside++; continue; }
  matched++;
  perPand.set(String(hit.properties.id), (perPand.get(String(hit.properties.id)) ?? 0) + 1);
}
const shared = [...perPand.values()].filter(n => n > 1);
const coverage = { rceWithDescription: withText, noPoint, pointOutsideEveryFootprint: outside, matchedMonuments: matched, matchedPands: perPand.size,
  pandsHoldingSeveralMonuments: shared.length, monumentsOnSharedPands: shared.reduce((a, b) => a + b, 0), monumentsLinkingSeveralPands: multiPandLinks,
  municipalWithText: recs.filter(r => r.src === 'municipal').length, rceTextRecords: recs.filter(r => r.src === 'rce').length };
console.log(JSON.stringify({ classes: out, coverage }, null, 1));
