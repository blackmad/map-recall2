/** Merge autonomous reviews without pretending several facades are one measurement. */
import fs from 'node:fs/promises';
import { sha256, type WallGrade } from '../../src/canalRecall/facade/wallColourPublication.js';
const files = process.argv.slice(2);
if (!files.length) throw Error('Supply the model review JSON files');
const sample = JSON.parse(await fs.readFile('public/data/wall-colour/v1/sample.json', 'utf8'));
const { sha256: sampleHash, ...body } = sample;
if (sha256(JSON.stringify(body)) !== sampleHash) throw Error('Sample content hash mismatch');
const entries = new Map<string, any>(sample.entries.map((entry: any) => [entry.observationId, entry]));
const grades: Record<string, WallGrade & Record<string, any>> = {};
for (const file of files) {
  const doc = JSON.parse(await fs.readFile(file, 'utf8'));
  if (doc.sampleSha256 !== sampleHash) throw Error(`Stale review sample: ${file}`);
  for (const [id, grade] of Object.entries(doc.grades) as Array<[string, any]>) {
    const entry = entries.get(id);
    if (!['accept', 'adjust', 'skip', 'unusable'].includes(grade.verdict) || !entry || grade.observationId !== id || grade.buildingId !== entry.buildingId || grade.sourceSha256 !== entry.sourceSha256 || grade.reviewOrigin !== 'model-visual-review' || !grade.grader?.trim() || !Number.isFinite(Date.parse(grade.gradedAt))) throw Error(`Invalid review identity/provenance: ${id}`);
    if (grades[id]) throw Error(`Duplicate visual review: ${id}`);
    if (sha256(await fs.readFile(`public${entry.crop}`)) !== grade.sourceSha256) throw Error(`Stale crop: ${id}`);
    if (grade.supportingReference) {
      const reference = grade.supportingReference;
      if (reference.kind !== 'owner-provided-street-view-screenshot' || !/^\/data\/city-expansion\/evidence\/[a-f0-9]{64}\.png$/.test(reference.crop) || sha256(await fs.readFile(`public${reference.crop}`)) !== reference.sourceSha256) throw Error(`Invalid supporting photo: ${id}`);
    }
    grades[id] = grade;
  }
}
const missing = [...entries.keys()].filter(id => !grades[id]);
if (missing.length) throw Error(`Incomplete visual review: ${missing.length} entries, starting ${missing.slice(0, 5).join(', ')}`);
const byBuilding = new Map<string, string[]>();
for (const [id, grade] of Object.entries(grades)) if (['accept', 'adjust'].includes(grade.verdict)) {
  const hex = grade.correctedHex ?? entries.get(id).hex;
  if (!/^#[a-f0-9]{6}$/i.test(hex)) throw Error(`Missing reviewed colour: ${id}`);
  byBuilding.set(grade.buildingId, [...(byBuilding.get(grade.buildingId) ?? []), id]);
}
const rgb = (id: string) => (grades[id].correctedHex ?? entries.get(id).hex).slice(1).match(/../g).map((v: string) => parseInt(v, 16));
const resolutionDoc = await fs.readFile('review-data/wall-colour/model-conflict-resolutions.json', 'utf8')
  .then(bytes => JSON.parse(bytes)).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
if (resolutionDoc && resolutionDoc.sampleSha256 !== sampleHash) throw Error('Stale conflict-resolution sample');
const resolutions = resolutionDoc?.resolutions ?? {};
const resolvedConflicts: any[] = [];
const selected: string[] = [], conflicts: Array<{ buildingId: string; observations: string[] }> = [], alternates: Array<{ selected: string; observations: string[] }> = [];
for (const [buildingId, ids] of byBuilding) {
  // A model adjustment corroborated by the owner's photograph takes priority.
  const ownerBound = ids.filter(id => grades[id].supportingReference?.kind === 'owner-provided-street-view-screenshot');
  if (!ownerBound.length && ids.some(a => ids.some(b => Math.hypot(...rgb(a).map((v: number, i: number) => v-rgb(b)[i])) > 60))) {
    const decision = resolutions[buildingId];
    if (decision) {
      if (decision.reviewOrigin !== 'model-visual-review' || !decision.reviewer?.trim() || !decision.reason?.trim() || !Number.isFinite(Date.parse(decision.gradedAt))) throw Error(`Invalid conflict provenance: ${buildingId}`);
      if (decision.selectedObservationId !== null) {
        const chosen = decision.selectedObservationId;
        if (!ids.includes(chosen) || decision.sourceSha256 !== grades[chosen].sourceSha256) throw Error(`Conflict selection is not an approved current observation: ${buildingId}`);
        selected.push(chosen);
        resolvedConflicts.push({ buildingId, observations: ids, decision });
        continue;
      }
    }
    conflicts.push({ buildingId, observations: ids });
    continue; // Keep genuinely different or unresolved wall appearances withheld.
  }
  const ordered = [...(ownerBound.length ? ownerBound : ids)].sort((a, b) =>
    Number(Boolean(grades[b].sampleRegionPx))-Number(Boolean(grades[a].sampleRegionPx)) ||
    String(entries.get(b).capturedAt).localeCompare(String(entries.get(a).capturedAt)) || a.localeCompare(b));
  selected.push(ordered[0]);
  if (ids.length > 1) alternates.push({ selected: ordered[0], observations: ids.filter(id => id !== ordered[0]) });
}
const meta = { version: 1, sampleSha256: sampleHash, reviewOrigin: 'model-visual-review', reviewer: 'model-review-team', gradedAt: new Date().toISOString() };
const audit = { ...meta, kind: 'wall-colour/all-model-reviews', reviewedObservations: Object.keys(grades).length, reviewedBuildings: new Set(sample.entries.map((entry: any) => entry.buildingId)).size, selectedBuildings: selected.length, conflicts, resolvedConflicts, alternates, grades };
await fs.writeFile('review-data/wall-colour/all-model-reviews.json', JSON.stringify(audit, null, 2)+'\n');
await fs.writeFile('review-data/wall-colour/combined-model-grades.json', JSON.stringify({ ...meta, kind: 'wall-colour/selected-model-grades', selectionPolicy: 'one-source-per-building; explicit pixel region then newest agreeing source; colour conflicts withheld', grades: Object.fromEntries(selected.map(id => [id, grades[id]])) }, null, 2)+'\n');
console.log(JSON.stringify({ reviewed: audit.reviewedObservations, buildings: audit.reviewedBuildings, selected: selected.length, conflicts: conflicts.length, resolvedConflicts: resolvedConflicts.length, alternates: alternates.length }));
