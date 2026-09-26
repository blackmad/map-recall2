/**
 * Build the signage sample (S0).
 *
 * Stratified per SIGNAGE_EXPLORATION_PLAN.md §4 / §9.3, drawn from the full
 * 2,746 ground crops across six areas rather than the release's 585:
 *   A 40 frontages where Apple Vision read at least one sign (accuracy/invention),
 *   B 25 where it read nothing but the street is retail (misses),
 *   C 15 where it read nothing on a residential street (invented signs).
 *
 * B and C are separated by street character rather than a shopfront classifier,
 * which does not exist yet: B is drawn from the Jordaan and Da Costabuurt
 * (retail streets), C from Tuindorp Nieuwendam (low-rise garden village). That
 * is recorded in the sample so the distinction is not mistaken for a measurement.
 *
 * Crops are copied to a served directory and the existing 110 px/m ground crop is
 * kept; the native ceiling is recorded per frontage so we know where a re-render
 * would add real detail.
 *
 * Usage: npx tsx scripts/facade-eval/build-signage-sample.ts
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { nativeCeilingPixelsPerMetre } from '../../src/canalRecall/facade/evalCrop.ts';

const OUT_DIR = path.resolve('review-data/signage/v1');
const PUBLIC_DIR = path.resolve('public/data/signage/v1/crops');
const CACHE_DIR = path.resolve('.cache/facade-eval');

const AREAS = [
  { id: 'apollobuurt-v1', group: 'apollobuurt', character: 'mixed' },
  { id: 'tuindorp-nieuwendam-v1', group: 'tuindorp-nieuwendam', character: 'residential' },
  { id: 'jordaan-sample-v1', group: 'jordaan', character: 'retail' },
  { id: 'da-costabuurt-v1', group: 'da-costa', character: 'retail' },
  { id: 'da-costa-expansion-550m-v1', group: 'da-costa', character: 'retail' },
  { id: 'da-costa-tranche-400m-v1', group: 'da-costa', character: 'retail' },
];

interface Ground { file: string; width: number; height: number; standoff: number; obliquity: number; panoramaId: string; date?: string; plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number } }
interface Evidence { id?: string; buildingId?: string; elevationId?: string; street?: string; address?: string; images?: Record<string, Ground | undefined> }
interface VisionSign { text: string; confidence: number; boxWallM: { along: number; up: number; width: number; height: number } }
interface VisionFile { records: Array<{ elevationId?: string; signs: VisionSign[]; cropFile?: string }> }

const manifestPath = async (area: string) => {
  const { readdir } = await import('node:fs/promises');
  const audits = path.join('.cache/city-appearance/areas', area, 'panorama-audit');
  for (const entry of await readdir(audits)) {
    const candidate = path.join(audits, entry, 'evidence', 'manifest.json');
    try { await readFile(candidate); return candidate; } catch { /* keep looking */ }
  }
  return null;
};

interface Candidate {
  area: string; group: string; character: string;
  buildingId?: string; elevationId?: string; street?: string; address?: string;
  cropFile: string; width: number; height: number; standoff: number; obliquity: number;
  panoramaId: string; date?: string; plane: Ground['plane'];
  nativeCeiling: number; signs: VisionSign[];
}

const pool: Candidate[] = [];
for (const area of AREAS) {
  const manifest = await manifestPath(area.id);
  if (!manifest) { process.stdout.write(`no manifest for ${area.id}\n`); continue; }
  const evidence = JSON.parse(await readFile(manifest, 'utf8')) as { records: Evidence[] };
  const vision = JSON.parse(await readFile(path.join(CACHE_DIR, `vision-ocr-${area.id}.json`), 'utf8')) as VisionFile;
  const byElevation = new Map(vision.records.map((record) => [record.elevationId ?? '', record]));
  const evidenceDir = path.dirname(manifest);
  for (const record of evidence.records ?? []) {
    const ground = record.images?.ground;
    if (!ground?.file) continue;
    const seen = byElevation.get(record.elevationId ?? '');
    pool.push({
      area: area.id, group: area.group, character: area.character,
      buildingId: record.buildingId, elevationId: record.elevationId,
      street: record.street, address: record.address,
      cropFile: path.join(evidenceDir, 'images', ground.file),
      width: ground.width, height: ground.height,
      standoff: ground.standoff, obliquity: ground.obliquity,
      panoramaId: ground.panoramaId, date: ground.date, plane: ground.plane,
      nativeCeiling: nativeCeilingPixelsPerMetre({ standoff: ground.standoff, obliquity: ground.obliquity }),
      signs: seen?.signs ?? [],
    });
  }
}

// Deterministic pick: stable order, at most one per street, and never the
// hand-tuned retail repair cases.
const REPAIR_ADDRESSES = /elandsgracht 96|lauriergracht 50|de clercqstraat 27/i;
const withText = pool.filter((candidate) => candidate.signs.length > 0 && !REPAIR_ADDRESSES.test(candidate.address ?? ''));
const withoutText = pool.filter((candidate) => candidate.signs.length === 0 && !REPAIR_ADDRESSES.test(candidate.address ?? ''));

const pick = (candidates: Candidate[], count: number, prefer?: (candidate: Candidate) => boolean) => {
  const ordered = [...candidates].sort((a, b) =>
    (prefer ? Number(prefer(b)) - Number(prefer(a)) : 0)
    || (b.signs.length - a.signs.length)
    || a.elevationId!.localeCompare(b.elevationId!));
  const chosen: Candidate[] = [];
  // The plan allows at most two per street segment.
  const streets = new Map<string, number>();
  for (const candidate of ordered) {
    if (chosen.length >= count) break;
    const key = `${candidate.street ?? ''}|${candidate.group}`;
    const used = candidate.street ? streets.get(key) ?? 0 : 0;
    if (candidate.street && used >= 2) continue;
    if (candidate.street) streets.set(key, used + 1);
    chosen.push(candidate);
  }
  return chosen;
};

// A: spread across areas, the clearest readings first.
const a = pick(withText.filter((c) => c.group === 'apollobuurt'), 10)
  .concat(pick(withText.filter((c) => c.group === 'jordaan'), 10))
  .concat(pick(withText.filter((c) => c.group === 'da-costa'), 10))
  .concat(pick(withText.filter((c) => c.group === 'tuindorp-nieuwendam'), 10));
const b = pick(withoutText.filter((c) => c.character === 'retail'), 25, (c) => c.nativeCeiling >= 110);
const c = pick(withoutText.filter((c) => c.character === 'residential'), 15, (c) => c.nativeCeiling >= 110);

const sample = [
  ...a.map((candidate) => ({ ...candidate, stratum: 'A-text' as const })),
  ...b.map((candidate) => ({ ...candidate, stratum: 'B-retail-no-text' as const })),
  ...c.map((candidate) => ({ ...candidate, stratum: 'C-residential-no-text' as const })),
];

await mkdir(OUT_DIR, { recursive: true });
await mkdir(PUBLIC_DIR, { recursive: true });
const entries = [];
for (const candidate of sample) {
  const key = candidate.elevationId!.replace(/[^A-Za-z0-9]+/g, '_');
  const target = `${key}-ground.jpg`;
  try {
    await copyFile(candidate.cropFile, path.join(PUBLIC_DIR, target));
  } catch { process.stdout.write(`missing crop for ${candidate.elevationId}\n`); continue; }
  entries.push({
    id: candidate.elevationId,
    stratum: candidate.stratum,
    area: candidate.area,
    group: candidate.group,
    character: candidate.character,
    buildingId: candidate.buildingId,
    street: candidate.street ?? '',
    address: candidate.address ?? '',
    crop: target,
    widthPx: candidate.width,
    heightPx: candidate.height,
    pixelsPerMetre: candidate.width / Math.hypot(candidate.plane.end.x - candidate.plane.start.x, candidate.plane.end.y - candidate.plane.start.y),
    nativeCeilingPxPerM: Number(candidate.nativeCeiling.toFixed(1)),
    standoffM: candidate.standoff,
    obliquityDeg: candidate.obliquity,
    panoramaId: candidate.panoramaId,
    captureDate: candidate.date ?? null,
    visionSigns: candidate.signs.map((sign) => ({ text: sign.text, confidence: Number(sign.confidence.toFixed(3)), boxWallM: sign.boxWallM })),
  });
}

const payload = {
  schemaVersion: 1,
  kind: 'signage/sample',
  generatedAt: new Date().toISOString(),
  reader: 'apple-vision (bytefer/macos-vision-ocr) on the ground tier',
  strata: {
    'A-text': `${a.length} frontages where Vision read a sign`,
    'B-retail-no-text': `${b.length} retail-street frontages where Vision read nothing (misses)`,
    'C-residential-no-text': `${c.length} residential-street frontages where Vision read nothing (invented signs)`,
  },
  note: 'B and C are separated by street character, not a shopfront classifier, which does not exist yet.',
  counts: { pool: pool.length, sample: entries.length },
  entries,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;
const sha256 = createHash('sha256').update(text).digest('hex');
await writeFile(path.join(OUT_DIR, 'sample.json'), text);
await writeFile(path.join(OUT_DIR, 'sample.sha256'), `${sha256}\n`);

const nativeBelow = entries.filter((entry) => entry.nativeCeilingPxPerM < 110).length;
process.stdout.write([
  `pool ${pool.length} (${withText.length} with Vision text, ${withoutText.length} without)`,
  `sample ${entries.length}: A ${a.length}, B ${b.length}, C ${c.length}`,
  `native ceiling >= 110 px/m on ${entries.length - nativeBelow}/${entries.length}; below on ${nativeBelow}`,
  `sha256 ${sha256}`,
  `wrote ${path.join(OUT_DIR, 'sample.json')} and ${PUBLIC_DIR}`,
].join('\n') + '\n');
