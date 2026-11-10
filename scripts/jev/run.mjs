/**
 * Jev facade spike (lane J1, #326): ask jev-1.14.0 thirteen typed questions about each crop in <dir>/set.json.
 *
 *   zsh -lic 'node scripts/jev/run.mjs --dir=.cache/jev-facades --run=run1 [--limit=1] [--concurrency=4]'
 *
 * The key is read only from process.env.TYPESAFE_API_KEY; it is never printed, logged or written. Saved files hold the
 * request JSON (image parts by reference, no bytes, no headers) and the response body with client-side latency.
 * Any 401/403 stops the run at once (fail closed; no retries anywhere).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const DIR = path.resolve(arg('dir', '.cache/jev-facades')), RUN = arg('run', 'run1'), LIMIT = +arg('limit', '1e9'), CONC = +arg('concurrency', '4');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone', MODEL = 'jev-1.14.0';
if (!process.env.TYPESAFE_API_KEY) { console.error('TYPESAFE_API_KEY is not set in this shell; stopping.'); process.exit(2); }

// Reference crops for the bay picture-choice: single-module block-face houses outside the set, one per bay count.
export const REFERENCE_PANDS = {1: '0363100012131498', 2: '0363100012101228', 3: '0363100012061473', 4: '0363100012166843', 5: '0363100012237004'};
const set = JSON.parse(await fs.readFile(path.join(DIR, 'set.json'), 'utf8')).slice(0, LIMIT);
const cands = JSON.parse(await fs.readFile(path.join(DIR, 'candidates.json'), 'utf8'));
await fs.mkdir(path.join(DIR, 'refs'), {recursive: true});
const refs = {};
for (const [n, pand] of Object.entries(REFERENCE_PANDS)) {
  const c = cands.find(x => x.pandId === pand);
  if (!c || c.truth.bays !== +n) throw Error(`reference ${n}: ${pand} is not a ${n}-bay candidate`);
  const file = path.join(DIR, 'refs', `${n}-bays.jpg`);
  const s = Math.max(1, 320 / Math.min(c.widthPx, c.heightPx), 0) && Math.min(1400 / Math.max(c.widthPx, c.heightPx), Math.max(1, 320 / Math.min(c.widthPx, c.heightPx)));
  await sharp(c.image).extract({left: c.px[0], top: 0, width: c.widthPx, height: c.heightPx}).resize(Math.round(c.widthPx * s), Math.round(c.heightPx * s)).jpeg({quality: 88}).toFile(file);
  refs[n] = file;
}

const WORDS = ['one', 'two', 'three', 'four', 'five'];
export function questions(ref) {
  const q = (instructions, criteria) => ({type: 'noul', instructions, criteria});
  return {
    gable: {type: 'choice', instructions: 'What is the shape of the top of the house front in `facade` (the gable or roofline of the main house in the middle of the image)?', criteria: {
      neck: 'Neck gable (halsgevel): a tall narrow raised centre panel with straight sides, flanked by shoulder pieces or small scrolls, often topped by a small pediment.',
      bell: 'Bell gable (klokgevel): a raised centre whose outline curves like a bell, convex then concave, often with a small arched or rounded top.',
      step: 'Step gable (trapgevel): the outline climbs in stair steps on both sides to a central peak.',
      cornice: 'Cornice or flat top (lijstgevel): the front ends in a horizontal cornice or straight parapet with no raised gable shape; dormers or a roof may show behind it.',
      spout: 'Spout gable (tuitgevel): a narrow pointed or triangular top with a spout-like tip, typical of old warehouses and wooden houses.',
      plain: 'Plain pointed gable (puntgevel): a simple triangular gable following the roof slope, without steps, curves or a neck.',
    }},
    finish: {type: 'choice', instructions: 'What is the main wall surface of the house front in `facade` above the ground floor?', criteria: {
      brick: 'Exposed brick: individual bricks and mortar joints visible in natural red, brown, yellow or dark brick colours.',
      'painted brick': 'Painted brick: brick bonding still shows but the whole wall is painted one flat colour (often black, grey, white or dark green).',
      plaster: 'Plaster or render: a smooth rendered surface with no brick joints, usually white, cream or grey.',
      stone: 'Natural stone: the wall is faced in sandstone or other cut stone blocks.',
      mixed: 'Mixed: large parts of the front are clearly different finishes (for example brick with a fully rendered upper storey).',
    }},
    white_frames: q('Are the window frames on the upper storeys of the house front in `facade` painted white or off-white (cream)?', {true: 'Window frames and sashes are white or cream.', false: 'Window frames are dark, coloured, natural wood or metal.'}),
    stone_bands: q('Does the house front in `facade` have horizontal light-coloured stone or stucco bands running across the brick (speklagen, string courses or continuous light lintel bands)?', {true: 'One or more horizontal light bands cross the brick wall.', false: 'No horizontal light bands; only window heads or sills.'}),
    shopfront: q('Does the ground floor of the house front in `facade` have a shopfront (large display windows, a shop or cafe front, a fascia or a sign)?', {true: 'The ground floor is a shop, cafe, bar or other commercial front.', false: 'The ground floor is residential: house doors and ordinary windows.'}),
    basement_entrance: q('Does the house front in `facade` have a basement or raised ground floor reached by a stoop (outside steps up to the front door, with basement windows or a basement door below street level)?', {true: 'There is a stoop with steps to a raised door, or a basement entrance/windows at pavement level.', false: 'The front door is at street level with no stoop or basement.'}),
    dormer: q('Is there at least one dormer window (a window projecting from the roof or set above the cornice line) on the house front in `facade`?', {true: 'A dormer or roof window rises above the cornice/eaves line of this front.', false: 'No dormer on this front.'}),
    bays_picture: {type: 'choice', instructions: 'How many vertical window axes (bays: columns of windows side by side) does the house front in the middle of `facade` have on its upper storeys? Compare with the example fronts.', criteria: Object.fromEntries([1, 2, 3, 4, 5].map(n => [String(n), {description: `${WORDS[n - 1]} window ax${n === 1 ? 'is' : 'es'} per upper storey`, example: ref[n]}]))},
    bays_word: {type: 'choice', instructions: 'How many vertical window axes (bays: columns of windows side by side) does the house front in the middle of `facade` have on its upper storeys?', criteria: Object.fromEntries(WORDS.map((w, i) => [w, `${w} window ax${i ? 'es' : 'is'} per upper storey`]))},
    door_present: q('Is the main front door of the house visible in `facade`?', {true: 'A front door of this house is visible.', false: 'No front door of this house is visible (out of frame, hidden, or the ground floor is all shop windows).'}),
    door_box: {type: 'box', instructions: 'The main front door of the house in `facade`.'},
    crown_present: q('Is the top of the house front (its gable top or cornice) fully visible in `facade`?', {true: 'The gable top or cornice is inside the image with sky above it.', false: 'The top of the front is cut off or hidden.'}),
    crown_box: {type: 'box', instructions: 'The crown of the house front in `facade`: the gable top or the cornice/parapet at the top of the front.'},
  };
}

let stop = false, done = 0;
const outDir = path.join(DIR, 'runs', RUN);
await fs.mkdir(outDir, {recursive: true});
async function ask(c) {
  const ids = {facade: `${randomUUID()}-facade`, ...Object.fromEntries(Object.keys(refs).map(n => [n, `${randomUUID()}-ref${n}`]))};
  const assets = {[ids.facade]: {type: 'image', part: 'facade'}};
  for (const n of Object.keys(refs)) assets[ids[n]] = {type: 'image', part: `ref${n}`};
  const body = {model: MODEL, state: {facade: ids.facade, note: 'A rectified street-panorama crop of one Amsterdam house front; the house in question fills the middle of the image and neighbours may show at the edges.'}, assets, questions: questions(Object.fromEntries(Object.keys(refs).map(n => [n, ids[n]])))};
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(body)], {type: 'application/json'}));
  form.append('facade', new Blob([await fs.readFile(path.join(DIR, c.crop.file))], {type: 'image/jpeg'}), 'facade.jpg');
  for (const [n, f] of Object.entries(refs)) form.append(`ref${n}`, new Blob([await fs.readFile(f)], {type: 'image/jpeg'}), `ref${n}.jpg`);
  const t0 = performance.now();
  let status = 0, text = '';
  try {
    const res = await fetch(ENDPOINT, {method: 'POST', headers: {Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'TypeSafe-Danger-Zone-Images': 'true'}, body: form});
    status = res.status; text = await res.text();
  } catch (e) { text = `network: ${e.message}`; }
  const ms = Math.round(performance.now() - t0);
  if (status === 401 || status === 403) { stop = true; console.error(`auth error ${status}; stopping the run (fail closed)`); }
  let response = null; try { response = JSON.parse(text); } catch { /* keep text */ }
  const record = {pandId: c.pandId, run: RUN, model: MODEL, status, latencyMs: ms, at: new Date().toISOString(), request: {...body, assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, {...v, file: v.part === 'facade' ? c.crop.file : `refs/${v.part.slice(3)}-bays.jpg`}]))}, response: response ?? {raw: text.slice(0, 2000)}};
  await fs.writeFile(path.join(outDir, `${c.pandId}.json`), JSON.stringify(record, null, 1));
  done++;
  console.log(`${done}/${set.length} ${c.pandId} ${status} ${ms} ms ${response?.usage ? `in ${response.usage.input_tokens}` : text.slice(0, 160)}`);
}
const queue = [...set];
await Promise.all(Array.from({length: CONC}, async () => { while (queue.length && !stop) await ask(queue.shift()); }));
if (stop) process.exit(3);
