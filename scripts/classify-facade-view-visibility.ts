/** Propose which candidate panorama actually shows the intended centred façade. */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Crop = { buildingId: string; panoId: string | null; image: string; viewRank?: number };
type Proposal = { targetVisibility: string; occlusion: string; confidence: number; rationale: string };
const visibility = ['full', 'partial', 'none', 'uncertain'] as const;
const occlusions = ['none', 'vegetation', 'vehicle', 'wrong-side-or-angle', 'other-building', 'mixed', 'unknown'] as const;
const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg('root') || '.cache/building-enrichment/panorama');
const model = arg('model') || 'qwen2.5vl:7b';
const limit = Math.max(1, Number(arg('limit') || 100));
const outputFile = path.resolve(arg('output') || path.join(root, 'facade-view-machine-proposals.json'));
const manifest = JSON.parse(await readFile(path.join(root, 'wide-crop-manifest.json'), 'utf8')) as { crops: Crop[] };
let proposals: Array<Record<string, unknown>> = [];
try { proposals = (JSON.parse(await readFile(outputFile, 'utf8')) as { proposals?: Array<Record<string, unknown>> }).proposals || []; } catch { /* first run */ }
const key = (value: { buildingId: string; panoId?: unknown }) => `${value.buildingId}|${value.panoId}`;
const processed = new Set(proposals.map((proposal) => key(proposal as { buildingId: string; panoId?: unknown })));
const candidates = manifest.crops.filter((crop) => crop.panoId && !processed.has(key(crop))).slice(0, limit);
const prompt = `This is a panorama crop aimed at one Amsterdam BAG building. Judge only whether the intended building facade at the image centre is useful evidence; do not classify its architecture. targetVisibility must be one of: ${visibility.join(', ')}. "full" means the facade's ground floor and upper structure are substantially visible; "partial" means enough facade remains for some reliable labels; "none" means the image is aimed down a street/canal, at foliage, or at another building. occlusion must be one of: ${occlusions.join(', ')}. Return JSON with targetVisibility, occlusion, confidence 0..1 and a short factual rationale. This is a triage proposal for a human, so use uncertain rather than guessing.`;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function save(): Promise<void> {
  const temporary = `${outputFile}.tmp`;
  await writeFile(temporary, JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), model, reviewStatus: 'machine-proposals-only', proposals }, null, 2));
  await rename(temporary, outputFile);
}

for (let index = 0; index < candidates.length; index++) {
  const crop = candidates[index];
  try {
    const bytes = await readFile(path.join(root, crop.image));
    let response: Response | undefined;
    let failure: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'user', content: prompt, images: [bytes.toString('base64')] }], options: { temperature: 0 } }),
        });
        if (response.ok) break;
        failure = new Error(`Ollama HTTP ${response.status}`);
      } catch (error) { failure = error; }
      await wait(500 * 2 ** attempt);
    }
    if (!response?.ok) throw failure;
    const body = await response.json() as { message?: { content?: string } };
    const proposal = JSON.parse(body.message?.content || '{}') as Proposal;
    if (!visibility.includes(proposal.targetVisibility as typeof visibility[number])) throw new Error('invalid targetVisibility');
    if (!occlusions.includes(proposal.occlusion as typeof occlusions[number])) throw new Error('invalid occlusion');
    proposal.confidence = Math.max(0, Math.min(1, Number(proposal.confidence) || 0));
    proposals.push({ schemaVersion: 1, buildingId: crop.buildingId, panoId: crop.panoId, image: crop.image, viewRank: crop.viewRank || null, source: 'model-panorama-view-triage', reviewStatus: 'machine-proposal', acceptedForNow: false, model, ...proposal });
    await save();
    process.stdout.write(`${index + 1}/${candidates.length} ${crop.buildingId} view ${crop.viewRank || '?'} → ${proposal.targetVisibility}, ${proposal.occlusion} (${Math.round(proposal.confidence * 100)}%)\n`);
  } catch (error) {
    process.stderr.write(`${crop.buildingId} ${crop.panoId}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
process.stdout.write(`Wrote ${proposals.length} façade-view triage proposals\n`);
