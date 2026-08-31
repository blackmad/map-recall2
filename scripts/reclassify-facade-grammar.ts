/** Add renderer-useful façade grammar labels to cached panorama observations. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
type Proposal = { visibleStoreys: number | null; bayCount: number | null; windowPattern: string; windowToWall: string; windowFrameColour: string; windowRecess: string; groundFloorType: string; entranceType: string; groundFloorDistinct: boolean | null; balconyType: string; facadeComposition: string; roofline: string; ornament: string; confidence: number; rationale: string };
type Item = { buildingId: string; bagId?: string; panoId: string; observedAt?: string; image: string; proposal?: Record<string, unknown> };
const arg = (name: string) => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment/panorama'), model = arg('model') || 'qwen2.5vl:7b', limit = Math.max(1, Number(arg('limit') || 25));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as { items: Item[] };
const outputFile = path.join(root, 'facade-grammar-machine-labels.json');
let labels: Array<Record<string, unknown>> = [];
try { labels = (JSON.parse(await readFile(outputFile, 'utf8')) as { labels: Array<Record<string, unknown>> }).labels || []; } catch { /* first run */ }
const processed = new Set(labels.map(x => String(x.buildingId)));
const candidates = manifest.items.filter(x => !processed.has(x.buildingId)).slice(0, limit);
const enums = {
  windowPattern: ['narrow-vertical','regular-grid','wide-horizontal','curtain-wall','irregular','mostly-blank','unknown'], windowToWall: ['low','medium','high','unknown'],
  windowFrameColour: ['white','cream','grey','black','brown','green','blue','red','metal','mixed','unknown'], windowRecess: ['flush','shallow','deep','unknown'],
  groundFloorType: ['same-as-upper','residential-base','shopfront','commercial-glazing','arcade','garage-loading','mostly-blank','unknown'], entranceType: ['single-residential','shared-residential','multiple-doors','commercial','garage-loading','mixed','none-visible','unknown'],
  balconyType: ['none','projecting','recessed','gallery','mixed','not-visible','unknown'], facadeComposition: ['single-field','base-body','ground-floor-distinct','vertical-zones','mixed','unknown'],
  roofline: ['flat-parapet','stepped-gable','bell-gable','neck-gable','spout-gable','triangular-gable','mansard-eave','other','not-visible','unknown'], ornament: ['minimal','moderate','elaborate','unknown'],
} as const;
const prompt = `Analyze only the intended building facade in this Amsterdam street crop. Describe structural facts useful for procedurally generating windows, doors and facade zones. Count visible above-ground storeys and repeated vertical bays only when clear; otherwise null. Do not count individual panes as bays. Use these exact enums: ${Object.entries(enums).map(([k,v]) => `${k}=[${v.join(',')}]`).join('; ')}. groundFloorDistinct is boolean or null. Return JSON with visibleStoreys integer|null, bayCount integer|null, every enum field, groundFloorDistinct, confidence 0..1 and short rationale. Abstain with unknown rather than inventing occluded details.`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
for (let index = 0; index < candidates.length; index++) {
  const item = candidates[index], bytes = await readFile(path.join(root, item.image)); let response: Response | undefined, error: unknown;
  for (let attempt = 0; attempt < 4; attempt++) { try { response = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'user', content: prompt, images: [bytes.toString('base64')] }], options: { temperature: 0 } }) }); if (response.ok) break; error = new Error(`Ollama HTTP ${response.status}`); } catch (caught) { error = caught; } await wait(500 * 2 ** attempt); }
  if (!response?.ok) { process.stderr.write(`${item.buildingId}: ${String(error)}\n`); continue; }
  try {
    const body = await response.json() as { message?: { content?: string } }, proposal = JSON.parse(body.message?.content || '{}') as Proposal;
    for (const [field, values] of Object.entries(enums)) if (!(values as readonly string[]).includes(String(proposal[field as keyof Proposal]))) throw new Error(`invalid ${field}`);
    proposal.visibleStoreys = Number.isInteger(proposal.visibleStoreys) && proposal.visibleStoreys! > 0 && proposal.visibleStoreys! <= 80 ? proposal.visibleStoreys : null;
    proposal.bayCount = Number.isInteger(proposal.bayCount) && proposal.bayCount! > 0 && proposal.bayCount! <= 100 ? proposal.bayCount : null;
    proposal.confidence = Math.max(0, Math.min(1, Number(proposal.confidence) || 0));
    labels.push({ schemaVersion: 1, buildingId: item.buildingId, bagId: item.bagId || null, panoId: item.panoId, observedAt: item.observedAt || null, source: 'model-panorama-facade-grammar', model, acceptedForNow: true, ...proposal });
    await writeFile(outputFile, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), model, labels }, null, 2));
    process.stdout.write(`${index + 1}/${candidates.length} ${item.buildingId} → ${proposal.visibleStoreys ?? '?'} storeys, ${proposal.bayCount ?? '?'} bays\n`);
  } catch (caught) { process.stderr.write(`${item.buildingId}: invalid proposal ${String(caught)}\n`); }
}
process.stdout.write(`Wrote ${labels.length} façade grammar labels\n`);
