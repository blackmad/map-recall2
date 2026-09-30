/** Frozen, source-bound material diagnostic. Never publishes appearance or training labels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const flag = (args, name) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);

// Boxes are manually selected target-upper-wall regions, not measured material masks.
// Windows/shadows remain; the same classifier prompt excludes them in both conditions.
export const GATE_REGIONS = {
  0: [.03, .26, .96, .79], 1: [.65, .40, .98, .86], 3: [.03, .27, .96, .76],
  4: [.02, .19, .98, .76], 10: [.04, .08, .84, .69], 11: [.19, .13, .94, .80],
  15: [.07, .24, .98, .72], 17: [.04, .18, .99, .73], 30: [.04, .30, .95, .72],
  64: [.05, .31, .99, .72],
};
export const MATERIAL_MAP = { 'fired-clay-brick': 'brick', 'painted-brick': 'painted-brick', 'render-plaster': 'render', unknown: 'unknown', mixed: 'unknown' };
export const COLOUR_MAP = { brown: ['brown'], 'red-brown': ['red', 'brown'], buff: ['buff', 'cream'], grey: ['grey'], 'blue-grey': ['grey'], charcoal: ['black', 'grey'], 'off-white': ['white', 'cream'] };
export function selectPilot(entries, gate) {
  if (new Set(entries.map(e => e.buildingId)).size !== entries.length || new Set(entries.map(e => e.sourceSha256)).size !== entries.length) throw Error('Duplicate owner or image');
  // A whole street is held out before running this experiment. Prior reviews exist,
  // so this is a prospective pilot split, not an untouched independent gold set.
  const evaluation = entries.filter(e => e.street === 'Lauriergracht');
  if (evaluation.length !== 20 || evaluation.some(e => gate.includes(e.index))) throw Error('Evaluation street changed');
  const development = entries.filter(e => gate.includes(e.index));
  if (development.length !== 10) throw Error('Incomplete render gate');
  const candidates = entries.filter(e => e.street !== 'Lauriergracht' && !gate.includes(e.index));
  const groups = new Map();
  for (const e of candidates) {
    const key = `${e.assessment.material}:${e.assessment.materialColourFamily}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const values of groups.values()) values.sort((a,b) => hash(a.buildingId).localeCompare(hash(b.buildingId)));
  while (development.length < 40) {
    let added = false;
    for (const key of [...groups.keys()].sort()) {
      if (development.length === 40) break;
      const next = groups.get(key).shift(); if (next) { development.push(next); added = true; }
    }
    if (!added) throw Error('Insufficient development examples');
  }
  return [...development.map(e => ({...e, split:'development'})), ...evaluation.map(e => ({...e, split:'evaluation'}))];
}
export async function prepare(args = process.argv.slice(2)) {
  const evidenceRoot = path.resolve(flag(args, 'evidence-root') ?? '.');
  const out = path.resolve(flag(args, 'out') ?? 'review-data/material-pilot/v1');
  const inputFile = 'public/data/wall-materials/assignments.json';
  const input = await fs.readFile(inputFile), data = JSON.parse(input);
  const entries = selectPilot(data.entries, data.gate), rows = [], cropped = [];
  await fs.mkdir(out, {recursive:true});
  for (const e of entries) {
    const a=e.assessment;
    if(a.buildingId!==e.buildingId || a.observationId!==e.observationId || a.sourceSha256!==e.sourceSha256) throw Error(`Stale assessment ${e.index}`);
    if (!(a.material in MATERIAL_MAP) || !(a.materialColourFamily in COLOUR_MAP)) throw Error(`Unmapped reference ${e.index}`);
    const bytes = await fs.readFile(path.join(evidenceRoot, 'public', e.crop.slice(1)));
    if (hash(bytes) !== e.sourceSha256) throw Error(`Changed photo ${e.index}`);
    const metadata = await sharp(bytes).metadata();
    const box = GATE_REGIONS[e.index];
    // Correct a visible contradiction in the previous reference; retain its source label.
    const material = e.index===4 ? 'brick' : MATERIAL_MAP[a.material];
    rows.push({index:e.index,buildingId:e.buildingId,observationId:e.observationId,address:e.address,street:e.street,
      split:e.split,crop:e.crop,sourceSha256:e.sourceSha256,dimensions:[metadata.width,metadata.height],
      reference:{origin:'model-visual-review',materialFamily:material,colourFamilies:COLOUR_MAP[a.materialColourFamily],
        priorMaterial:a.material,requiresAbstention:material==='unknown',
        correction:e.index===4?'Native source shows regular brick courses and masonry heads; prior unknown material contradicted visible evidence. Broad grey/brown illumination remains uncertain.':null,
        materialOnly:true,exactColourAccepted:false,identityCertified:false},
      targetRegion:box?{normalizedXYXY:box,origin:'model-visual-review',scope:'upper-wall crop; not segmentation or geographic identity certification'}:null});
    const destination=path.resolve('public',e.crop.slice(1));await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
    if (box) {
      const left=Math.floor(box[0]*metadata.width),top=Math.floor(box[1]*metadata.height);
      const right=Math.ceil(box[2]*metadata.width),bottom=Math.ceil(box[3]*metadata.height);
      const image=await sharp(bytes).extract({left,top,width:right-left,height:bottom-top}).jpeg({quality:95}).toBuffer();
      const sha256=hash(image),crop=`/data/city-expansion/evidence/${sha256}.jpg`;
      await fs.writeFile(path.resolve('public',crop.slice(1)),image);
      cropped.push({index:e.index,buildingId:e.buildingId,observationId:e.observationId,sourceSha256:sha256,crop,
        parentSourceSha256:e.sourceSha256,rectangle:{left,top,width:right-left,height:bottom-top}});
    }
  }
  const manifest={version:1,scope:'Broad upper-wall material diagnostic; no training/publication acceptance',
    assignmentSha256:hash(input),budget:{authorizedApiCeilingUsd:25,paidCalls:0,trainingAuthorized:false},
    splitPolicy:'40 development including all ten renderer cases; 20 Lauriergracht evaluation. Owner/image/street disjoint. Shared panorama identity unavailable; no panorama-disjoint claim. Existing model references are not independent ground truth.',
    acceptance:{materialAgreementOnKnown:.95,falseAcceptOnUnknown:0,minimumKnownCoverage:.8,renderGate:'All ten cases independently demonstrated in both views; currently incomplete'},
    limitations:['No stone/concrete reference examples','Colour bins may overlap; compatibility is not exact colour accuracy','No region masks or metric texture labels','Evaluation street is geographically narrow'],entries:rows};
  await fs.writeFile(path.join(out,'selection.json'),JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(out,'target-crops.json'),JSON.stringify({version:1,selectionSha256:hash(JSON.stringify(manifest,null,2)+'\n'),entries:cropped},null,2)+'\n');
  return {selected:rows.length,development:40,evaluation:20,targetCrops:cropped.length,paidCalls:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(await prepare()));
