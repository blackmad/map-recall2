import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Opening = {
  id: string;
  state: string;
  box: number[];
  contextCheck?: { state: string };
  fit?: { applied: boolean; rawBox: number[]; candidateBox: number[]; maximumMovePx: number };
  appearance?: { bars?: Array<{ state: string }> };
};
type Record = {
  source: { pandId: string; address: string };
  sourceSha256: string;
  status: string;
  reason?: string;
  openings: Opening[];
  fitting?: { adjustedCount: number; attemptedCount: number };
  appearance?: { coverage?: { imageRowsFraction: number } };
  wallColour?: { hex: string };
};

const arg = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const beforeDir = path.resolve(arg('before') ?? 'public/canal-drive/facade-photo-review/local/dino-base-city-variety-raw-01');
const afterDir = path.resolve(arg('after') ?? 'public/canal-drive/facade-photo-review/local/dino-base-city-variety-fit-01');
const outputDir = path.resolve(arg('out') ?? '.cache/facade-rebuild/reports/city-variety-photo-01');
const digest = (value: Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const [beforeBytes, afterBytes] = await Promise.all([
  readFile(path.join(beforeDir, 'manifest.json')),
  readFile(path.join(afterDir, 'manifest.json')),
]);
const before = JSON.parse(beforeBytes.toString()) as { records: Record[]; openingStage: unknown; acceptance: string };
const after = JSON.parse(afterBytes.toString()) as { records: Record[]; openingStage: unknown; acceptance: string };
const beforeByHash = new Map(before.records.map((record) => [record.sourceSha256, record]));
assert.deepEqual(new Set(beforeByHash.keys()), new Set(after.records.map((record) => record.sourceSha256)));

const rows = after.records.map((record) => {
  const raw = beforeByHash.get(record.sourceSha256)!;
  assert.equal(raw.source.pandId, record.source.pandId);
  const moved = record.openings.filter((opening) => opening.fit?.applied);
  for (const opening of moved) {
    assert.ok(Math.max(...opening.fit!.rawBox.map((value, index) => Math.abs(value-opening.fit!.candidateBox[index]))) <= 5);
  }
  const contextUnknown = record.openings.filter((opening) => opening.contextCheck?.state === 'unknown').length;
  const contextDecisions = record.openings.filter((opening) => opening.contextCheck && opening.contextCheck.state !== 'unknown').length;
  assert.equal(contextDecisions, 0, `semantic abstention changed for ${record.source.pandId}`);
  return {
    pandId: record.source.pandId,
    address: record.source.address,
    status: record.status,
    reason: record.reason ?? null,
    detections: record.openings.length,
    rawRenderable: raw.openings.filter((opening) => opening.state === 'proposed').length,
    fittedRenderable: record.openings.filter((opening) => opening.state === 'proposed').length,
    fitAttempts: record.fitting?.attemptedCount ?? 0,
    appliedFits: moved.length,
    maximumMovementPx: moved.length ? Math.max(...moved.map((opening) => opening.fit!.maximumMovePx)) : 0,
    semanticAbstentions: contextUnknown,
    appearanceRowsFraction: record.appearance?.coverage?.imageRowsFraction ?? null,
    wallCameraColour: record.wallColour?.hex ?? null,
    proposedBarCandidates: record.openings.reduce((sum, opening) => sum+(opening.appearance?.bars?.filter((bar) => bar.state === 'proposed').length ?? 0), 0),
  };
});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  inputs: {
    before: path.relative(process.cwd(), beforeDir),
    beforeManifestSha256: digest(beforeBytes),
    after: path.relative(process.cwd(), afterDir),
    afterManifestSha256: digest(afterBytes),
  },
  totals: {
    sources: rows.length,
    renderableSources: rows.filter((row) => row.status === 'proposed').length,
    abstainedSources: rows.filter((row) => row.status !== 'proposed').length,
    detections: rows.reduce((sum, row) => sum+row.detections, 0),
    rawRenderable: rows.reduce((sum, row) => sum+row.rawRenderable, 0),
    fittedRenderable: rows.reduce((sum, row) => sum+row.fittedRenderable, 0),
    fitAttempts: rows.reduce((sum, row) => sum+row.fitAttempts, 0),
    appliedFits: rows.reduce((sum, row) => sum+row.appliedFits, 0),
    semanticAbstentions: rows.reduce((sum, row) => sum+row.semanticAbstentions, 0),
    proposedBarCandidates: rows.reduce((sum, row) => sum+row.proposedBarCandidates, 0),
  },
  rows,
  acceptance: 'None. Unlabelled development summary; counts measure pipeline workload and abstention, not opening accuracy.',
};
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2)+'\n');
const cells = rows.map((row) => `<tr><td>${row.pandId}</td><td>${row.status}</td><td>${row.detections}</td><td>${row.fittedRenderable}</td><td>${row.appliedFits}/${row.fitAttempts}</td><td>${row.appearanceRowsFraction ?? '—'}</td><td><span class="swatch" style="background:${row.wallCameraColour ?? 'transparent'}"></span>${row.wallCameraColour ?? '—'}</td><td>${row.proposedBarCandidates}</td><td>${row.reason ?? ''}</td></tr>`).join('');
await writeFile(path.join(outputDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Registered panorama photo pipeline</title><style>body{font:14px system-ui;margin:24px;background:#f2efe8;color:#25332e}main{max-width:1300px;margin:auto;background:white;padding:20px;border:1px solid #ccd2cd}table{border-collapse:collapse;width:100%}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.swatch{display:inline-block;width:18px;height:18px;border:1px solid #777;vertical-align:middle;margin-right:6px}code{overflow-wrap:anywhere}</style><main><h1>Registered panorama → opening-family pipeline</h1><p>Ten raw-panorama-reviewed wall sources. The semantic baseline deliberately abstains; DINO/SAM supplies opening candidates, while fitting can move supported edges by at most five pixels.</p><p><strong>${report.totals.renderableSources}</strong> sources render automatically; <strong>${report.totals.abstainedSources}</strong> abstain for insufficient repeated-opening support. ${report.totals.appliedFits} of ${report.totals.fitAttempts} attempted adjustments applied across ${report.totals.detections} detections.</p><table><thead><tr><th>BAG</th><th>state</th><th>detections</th><th>renderable</th><th>fits</th><th>row coverage</th><th>wall RGB</th><th>bar candidates</th><th>reason</th></tr></thead><tbody>${cells}</tbody></table><p>${report.acceptance}</p><h2>Provenance</h2><pre>${JSON.stringify(report.inputs, null, 2)}</pre></main></html>`);
console.log(`${outputDir}: ${JSON.stringify(report.totals)}`);
