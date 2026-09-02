/** Package panorama crops and two-teacher grammar labels for later vision-model distillation. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/facade-review');
const output = path.resolve(arg('output') || '.cache/facade-distillation');
type Item = { osmId: string; panoId: string; image: string; centre: [number, number] };
type Label = Record<string, unknown> & { targetVisible?: boolean; visibilityConfidence?: number };
type Result = { osmId: string; panoId: string; proposals: Array<{ model: string; label?: Label; error?: string }>; consensus: Record<string, unknown> };
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as { source?: unknown; items: Item[] };
const teachers = JSON.parse(await readFile(path.join(root, 'facade-grammar-proposals.json'), 'utf8')) as { models: string[]; results: Result[] };
const items = new Map(manifest.items.map(item => [`${item.osmId}\0${item.panoId}`, item]));
const blockId = ([lon, lat]: [number, number]) => `${Math.floor(lon / .002)}:${Math.floor(lat / .0015)}`;
const blockSplit = (block: string) => parseInt(createHash('sha1').update(block).digest('hex').slice(0, 8), 16) % 5 === 0 ? 'validation' : 'train';
const rows = teachers.results.flatMap(result => {
  const item = items.get(`${result.osmId}\0${result.panoId}`), labels = result.proposals.flatMap(proposal => proposal.label ? [{ model: proposal.model, label: proposal.label }] : []);
  if (!item || labels.length < 2 || !labels.every(value => value.label.targetVisible)) return [];
  const fields = new Set(labels.flatMap(value => Object.keys(value.label)).filter(key => !['rationale', 'targetVisible', 'visibilityConfidence'].includes(key)));
  const targets = Object.fromEntries([...fields].map(field => {
    const votes = labels.map(value => ({ model: value.model, value: value.label[field], visibilityConfidence: value.label.visibilityConfidence }));
    const exactAgreement = votes.every(vote => JSON.stringify(vote.value) === JSON.stringify(votes[0].value));
    return [field, { value: exactAgreement ? votes[0].value : null, exactAgreement, votes }];
  }));
  const block = blockId(item.centre);
  return [{ id: `${item.osmId}:${item.panoId}`, osmId: item.osmId, panoId: item.panoId, image: path.relative(output, path.join(root, item.image)), centre: item.centre, spatialBlock: block, split: blockSplit(block), targets }];
});
if (!rows.length) throw new Error('No two-teacher, target-visible examples matched the panorama manifest');
await mkdir(output, { recursive: true });
for (const split of ['train', 'validation']) {
  const lines = rows.filter(row => row.split === split).map(row => JSON.stringify(row));
  await writeFile(path.join(output, `${split}.jsonl`), lines.length ? `${lines.join('\n')}\n` : '');
}
const agreed = rows.flatMap(row => Object.values(row.targets)).filter(target => target.exactAgreement).length;
const total = rows.flatMap(row => Object.values(row.targets)).length;
const summary = { schemaVersion: 1, generatedAt: new Date().toISOString(), teachers: teachers.models, source: manifest.source, policy: { splitUnit: 'spatial-block', blockSizeApproxMetres: [136, 167], requireTwoTeachers: true, requireTargetVisible: true, disagreementTarget: null, status: 'teacher-proposal' }, counts: { examples: rows.length, train: rows.filter(row => row.split === 'train').length, validation: rows.filter(row => row.split === 'validation').length, exactAgreementFields: agreed, totalFields: total, agreementRate: Number((agreed / total).toFixed(3)) } };
await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`Built ${rows.length} distillation examples (${summary.counts.train} train / ${summary.counts.validation} validation; ${summary.counts.agreementRate} field agreement).\n`);
