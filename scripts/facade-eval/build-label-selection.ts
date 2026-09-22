/**
 * Build the hand-labelling selection for the façade-model gold set.
 *
 * The measured half of the gold set is Oud-Zuid point-cloud geometry. The
 * hand-labelled half is what decides whether a model transfers to Amsterdam
 * outside that one area, so it is stratified: five buildings from each of
 * Apollobuurt (Zuid), Tuindorp Nieuwendam (Noord), Jordaan (Centrum) and
 * Da Costabuurt (West). A human draws the window/door boxes; a model never
 * labels its own ground truth.
 *
 * Usage: npx tsx scripts/facade-eval/build-label-selection.ts [--per-area=5]
 */
import { copyFile, mkdir, readFile, writeFile, glob as _unused } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

type Vec3 = readonly [number, number, number];
interface EvidenceRecord {
  id: string;
  buildingId: string;
  elevationId: string;
  address?: string;
  street?: string;
  year?: number;
  wallWidthM: number;
  height: number;
  metricEligible?: boolean;
  images: { full?: { file: string; width: number; height: number; standoff?: number; obliquity?: number; plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number } } };
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const perArea = Number(argument('per-area') || 5);
const outDir = path.resolve(argument('out') || 'public/data/facade-label-review/v1');
const areasRoot = path.resolve('.cache/city-appearance/areas');

const GROUPS: Array<{ name: string; areas: string[] }> = [
  { name: 'apollobuurt', areas: ['apollobuurt-v1'] },
  { name: 'tuindorp-nieuwendam', areas: ['tuindorp-nieuwendam-v1'] },
  { name: 'jordaan', areas: ['jordaan-sample-v1'] },
  { name: 'da-costa', areas: ['da-costabuurt-v1', 'da-costa-expansion-550m-v1', 'da-costa-tranche-400m-v1'] },
];

const findManifest = async (area: string): Promise<string | null> => {
  const audits = path.join(areasRoot, area, 'panorama-audit');
  let entries: string[];
  try { entries = await readdir(audits); } catch { return null; }
  for (const entry of entries) {
    const candidate = path.join(audits, entry, 'evidence', 'manifest.json');
    try { await readFile(candidate); return candidate; } catch { /* keep looking */ }
  }
  return null;
};

const chosen: Array<Record<string, unknown>> = [];
const summary: Array<{ group: string; area: string; buildings: number }> = [];
await mkdir(path.join(outDir, 'crops'), { recursive: true });

for (const group of GROUPS) {
  const pool: Array<{ record: EvidenceRecord; manifestDir: string }> = [];
  for (const area of group.areas) {
    const manifestPath = await findManifest(area);
    if (!manifestPath) { process.stdout.write(`no evidence manifest for ${area}\n`); continue; }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { records: EvidenceRecord[] };
    for (const record of manifest.records) {
      if (!record.images?.full?.file) continue;
      pool.push({ record, manifestDir: path.dirname(manifestPath) });
    }
  }
  // Prefer a metric-eligible wall, then the closest standoff (bigger crop detail),
  // one wall per building, and skip anything already taken.
  pool.sort((a, b) => {
    const metric = Number(Boolean(b.record.metricEligible)) - Number(Boolean(a.record.metricEligible));
    if (metric) return metric;
    return (a.record.images.full?.standoff ?? 1e9) - (b.record.images.full?.standoff ?? 1e9);
  });
  const seen = new Set<string>();
  let taken = 0;
  for (const { record, manifestDir } of pool) {
    if (taken >= perArea) break;
    if (seen.has(record.buildingId)) continue;
    seen.add(record.buildingId);
    const full = record.images.full!;
    const file = `${record.id}-full.jpg`;
    try {
      await copyFile(path.join(manifestDir, 'images', full.file), path.join(outDir, 'crops', file));
    } catch { continue; }
    chosen.push({
      id: record.id,
      area: group.name,
      buildingId: record.buildingId,
      elevationId: record.elevationId,
      address: record.address ?? '',
      street: record.street ?? '',
      year: record.year ?? null,
      crop: file,
      widthPx: full.width,
      heightPx: full.height,
      wallWidthM: record.wallWidthM,
      wallHeightM: record.height,
      standoff: full.standoff ?? null,
      obliquity: full.obliquity ?? null,
      plane: full.plane,
      metricEligible: Boolean(record.metricEligible),
    });
    taken += 1;
  }
  summary.push({ group: group.name, area: group.areas.join('+'), buildings: taken });
}

const payload = {
  schemaVersion: 1,
  kind: 'facade-model-gold/labelling',
  generatedAt: new Date().toISOString(),
  frame: 'along = metres from plane.start; up = metres above plane.baseZ',
  instruction: 'Draw one box per window or door. Export the labels; a model must never label its own ground truth.',
  counts: { walls: chosen.length, byGroup: summary },
  walls: chosen,
};
await writeFile(path.join(outDir, 'selection.json'), `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write([
  `label selection: ${chosen.length} walls`,
  summary.map((s) => `  ${s.group}: ${s.buildings}`).join('\n'),
  `wrote ${path.join(outDir, 'selection.json')}`,
].join('\n') + '\n');
