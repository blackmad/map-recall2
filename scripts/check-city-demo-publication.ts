import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { publishDemo, demoPublicationStatus } from './city-appearance/publish-demo.js';
import { sha256 } from './city-appearance/compile-block-tiles.js';
import { reviewEvidenceKey } from './da-costa-block/review-dependencies.mjs';
import { wallObservationIntervals } from '../public/canal-drive/da-costa-block/wall-intervals.js';

const exec = promisify(execFile), read = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'city-demo-publication-'));
const evidencePath = path.join(root, 'neighbourhood.json'), outputRoot = path.join(root, 'public');
const options = { evidenceRoot: root, evidencePath, outputRoot };
const save = (file: string, data: unknown) => fs.writeFile(path.join(root, file), JSON.stringify(data));
try {
  const original = await read('.cache/da-costa-neighbourhood/manifest.json');
  const row = structuredClone(original.records[0]);
  await fs.mkdir(path.join(root, 'images')); await fs.mkdir(path.join(root, 'panoramas'));
  for (const metadata of Object.values(row.images) as any[]) {
    const bytes = Buffer.from(`synthetic crop ${metadata.file}`), pano = Buffer.from(`synthetic original ${metadata.panoramaId}`);
    metadata.sha256 = sha256(bytes); metadata.panoramaSha256 = sha256(pano);
    await fs.writeFile(path.join(root, 'images', metadata.file), bytes);
    await fs.writeFile(path.join(root, 'panoramas', metadata.panoramaId + '.jpg'), pano);
  }
  await save('manifest.json', { ...original, records: [row] });
  await save('spend.json', { results: [] });
  const reviews: any[] = [];
  const compile = async () => {
    await save('reviews.json', { version: 1, events: reviews });
    await exec(process.execPath, ['scripts/da-costa-block/publish-neighbourhood.mjs', `--root=${root}`, `--out=${evidencePath}`]);
  };
  const inspect = async (manifest: any) => {
    let record: any, building: any;
    for (const tile of manifest.tiles) {
      const bytes = await fs.readFile(path.join(outputRoot, 'releases', manifest.releaseId, 'tiles', tile.key + '.json'));
      assert.equal(sha256(bytes), tile.sha256);
      for (const owner of JSON.parse(bytes.toString()).owners) for (const observation of owner.observations) {
        record = observation.payload; building = owner.geometry.building;
      }
    }
    const patches = record.renderSurfaceIndices.flatMap((i: number) => wallObservationIntervals(building.surfaces[i], i, building.id, [record]).intervals);
    return { record, patches };
  };
  await compile();
  const baseline = await publishDemo(options);
  assert.equal(baseline.reviewed, 0); assert.equal(baseline.observations, 1);
  assert.equal((await inspect(baseline)).record.effectiveProposal, null, 'absent extraction is not synthesized from building defaults');
  assert.equal((await demoPublicationStatus(options)).stale, false);
  assert.equal((await publishDemo(options)).releaseId, baseline.releaseId, 'unchanged snapshots are idempotent');
  const baselineBytes = await fs.readFile(path.join(outputRoot, 'releases', baseline.releaseId, 'manifest.json'));
  const decide = (shopfront: string, placement = 'accepted') => reviews.push({
    id: row.id, derivationKey: row.derivationKey, evidenceKey: reviewEvidenceKey(row),
    eventId: `synthetic-${reviews.length}`, at: new Date().toISOString(), origin: 'human-review', reviewer: 'isolated-test-only',
    decision: { targetId: row.id, placement, shopfront, awning: 'unknown', roofShape: 'unknown', facadeTop: 'unknown', notes: 'The building extends past the crop.' },
  });
  decide('yes'); await compile();
  assert.equal((await demoPublicationStatus(options)).stale, true);
  const positive = await publishDemo(options), pos = await inspect(positive);
  assert.notEqual(positive.releaseId, baseline.releaseId); assert.equal(positive.accepted, 1);
  assert.equal(positive.followupCount, 1); assert.equal(positive.followups[0].notes, reviews[0].decision.notes);
  assert.equal(positive.followups[0].reason, 'human-note-needs-triage', 'notes request triage without changing an accepted label');
  assert.ok(pos.patches.some((patch: any) => patch.status === 'human' && patch.observation.effectiveProposal.shopfront === 'yes'));
  assert.equal(pos.record.effectiveProposal.roofShape, 'unknown', 'human unknown never inherits a roof proposal');
  decide('no'); await compile();
  const negative = await publishDemo(options), neg = await inspect(negative);
  assert.ok(neg.patches.some((patch: any) => patch.status === 'human' && patch.observation.effectiveProposal.shopfront === 'no'), 'same-wall negative reaches render interval');
  assert.equal(neg.record.id, pos.record.id, 'review changes never rename a frontage');
  assert.deepEqual(await fs.readFile(path.join(outputRoot, 'releases', baseline.releaseId, 'manifest.json')), baselineBytes, 'older release is immutable');
  decide('unknown', 'crop-repair'); await compile();
  const repair = await publishDemo(options);
  assert.equal((await inspect(repair)).patches.some((patch: any) => patch.observation), false, 'right building/wrong crop withholds appearance');
  const currentBytes = await fs.readFile(path.join(outputRoot, 'current.json'));
  decide('yes'); await save('reviews.json', { version: 1, events: reviews });
  await assert.rejects(publishDemo(options), /Review publication is stale/);
  assert.deepEqual(await fs.readFile(path.join(outputRoot, 'current.json')), currentBytes, 'failed publication cannot replace good current release');
  await compile();
  const image = Object.values(row.images)[0] as any;
  await fs.writeFile(path.join(root, 'images', image.file), 'changed source pixels');
  await assert.rejects(publishDemo(options), /Source pixels changed/);
  const context = await read(path.join(outputRoot, 'releases', baseline.releaseId, 'context.json'));
  assert.deepEqual(context.buildings, []); assert.deepEqual(context.anchors, []); assert.deepEqual(context.references, []);
  assert.ok(context.layers && context.trees && context.origin);
  console.log('City demo publication passed: real publisher → source audit → immutable tiles → human wall intervals; positive/negative/unknown/crop repair, stale reviews/pixels, atomic current, no live reviews touched.');
} finally { await fs.rm(root, { recursive: true, force: true }); }
