/** Prepare a review-only packet for case 25 without touching the live preview. */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import corrections from './case25-source-corrections.json' with { type: 'json' };
import { stageSourceGeometryPacket } from './source-geometry-corrections.ts';

const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
export async function stageCase25SourceCorrection(root = '.') {
  const inputPath = path.join(root, 'public/data/facade-repair-preview/cases.json');
  const inputBytes = await fs.readFile(inputPath), input = JSON.parse(inputBytes.toString());
  const staged = stageSourceGeometryPacket(input, corrections.cases as any);
  const original = input.cases.find((item: any) => item.caseId === 'case-25');
  const candidate = staged.cases.find((item: any) => item.caseId === 'case-25');
  if (!original || !candidate) throw Error('Case 25 unavailable');
  if (JSON.stringify(original.shapeFeatures.ground) !== JSON.stringify(candidate.shapeFeatures.ground)) throw Error('Ground tier changed');
  for (const source of input.cases) {
    if (source.caseId === 'case-25') continue;
    const target = staged.cases.find((item: any) => item.caseId === source.caseId);
    if (JSON.stringify(source) !== JSON.stringify(target)) throw Error(`Unrelated case changed: ${source.caseId}`);
  }
  const output = JSON.stringify(staged, null, 2) + '\n';
  const folder = path.join(root, 'review-data/case25-source-correction');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'staged-cases.json'), output);
  const report = { version: 1, sourcePacket: { path: 'public/data/facade-repair-preview/cases.json', sha256: sha256(inputBytes) }, correction: { path: 'scripts/review/case25-source-corrections.json', sha256: sha256(await fs.readFile(path.join(root, 'scripts/review/case25-source-corrections.json'))) }, stagedPacket: { path: 'review-data/case25-source-correction/staged-cases.json', sha256: sha256(output) }, caseId: 'case-25', source: candidate.source.full, addedFeatures: corrections.cases[0].add?.map((item: any) => item.id), replacements: Object.keys(corrections.cases[0].replace ?? {}), preserved: { otherCases: 27, groundTier: true, releaseActivated: false } };
  await fs.writeFile(path.join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) stageCase25SourceCorrection().then(value => console.log(JSON.stringify(value))).catch(error => { console.error(error); process.exitCode = 1; });
