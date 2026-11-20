/**
 * belt-review fixture: writes `review-data/belt-review/_fixture-<face>/{face,candidates}.json` from an existing block face
 * (scripts/block-face/faces/<face>/) and the house-crops archive (`<archive>/pand-crops/<pand>/front.json`, `years/*.jpg`),
 * so the review page has real photos to pick from before lane B's prepare step exists. Candidate files are relative to
 * the archive root: start the server with BELT_REVIEW_IMAGE_ROOT=<archive>.
 *
 *   node --import tsx scripts/belt-review/fixture.ts --face prinsengracht-130-150 --archive ~/Code/map-recall2-source-data-belt-nieuwmarkt-build-20261110
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CandidatesFile, FaceFile, PhotoCandidate } from '../../src/canalRecall/beltReview/types.ts';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const faceKey = arg('face'), archive = arg('archive');
if (!faceKey || !archive) { console.error('usage: fixture.ts --face <block-face id> --archive <source-data root>'); process.exit(2); }
const faceDir = path.join('scripts/block-face/faces', faceKey);
const discovery = JSON.parse(await fs.readFile(path.join(faceDir, 'discovery.json'), 'utf8'));
const uses = JSON.parse(await fs.readFile(path.join(faceDir, 'uses.json'), 'utf8').catch(() => '{"pands":[]}'));
const address = (id: string) => uses.pands.find((p: { pandId: string }) => p.pandId === id)?.addresses?.[0] ?? `pand ${id.slice(-6)}`;
const ordered = [...discovery.pands].sort((a: { alongM: number }, b: { alongM: number }) => a.alongM - b.alongM);
const faceId = `_fixture-${faceKey}`;
const face: FaceFile = {
  schemaVersion: 1, faceId, street: discovery.street, side: faceKey.replace(/^[a-z-]+?-(?=\d)/, ''), fixture: true, pxPerM: 50,
  note: `Fixture from scripts/block-face/faces/${faceKey} and the house-crops archive; not a pilot face.`,
  pands: ordered.map((p: { pandId: string; widthM: number }, order: number) => ({ pandId: p.pandId, address: address(p.pandId), order, widthM: p.widthM })),
};
const candidates: CandidatesFile = { schemaVersion: 1, faceId, generatedAt: new Date().toISOString(), pands: [] };
for (const p of face.pands) {
  const dir = path.join(archive, 'pand-crops', p.pandId);
  const front = JSON.parse(await fs.readFile(path.join(dir, 'front.json'), 'utf8').catch(() => 'null'));
  if (!front) { candidates.pands.push({ pandId: p.pandId, candidates: [], autoPick: null }); continue; }
  const years = (await fs.readdir(path.join(dir, 'years')).catch(() => [] as string[])).filter(f => f.endsWith('.jpg'));
  const chosenPano = front.panoramas?.[0];
  const make = (year: number, file: string): PhotoCandidate => {
    const c = front.candidates?.find((k: { year: number }) => k.year === year);
    const chosen = year === front.chosenYear;
    const date: string = c?.date ?? (chosen ? front.missionDate : `${year}`);
    return {
      id: `${year}-${c?.panoId ?? chosenPano?.panoId ?? 'unknown'}`.slice(0, 120), file: path.posix.join('pand-crops', p.pandId, file), year,
      month: /^\d{4}-\d{2}/.test(date) ? Number(date.slice(5, 7)) : null,
      distM: chosen ? chosenPano?.cameraDistM ?? null : null, obliquityDeg: c?.obliquity ?? (chosen ? chosenPano?.obliquityDeg ?? null : null),
      source: (c?.method ?? front.method) === 'strip' ? 'strip' : 'wall', flags: c?.reasons ?? [],
      pano: { id: c?.panoId ?? chosenPano?.panoId ?? 'unknown', date },
      widthPx: front.crop?.width, heightPx: front.crop?.height, pxPerM: front.crop?.pixelsPerMetre,
    };
  };
  const list = years.length ? years.map(f => make(Number(f.slice(0, 4)), path.posix.join('years', f))) : [make(front.chosenYear, 'front.jpg')];
  list.sort((a, b) => Number(b.year === front.chosenYear) - Number(a.year === front.chosenYear) || b.year - a.year);
  candidates.pands.push({ pandId: p.pandId, candidates: list.slice(0, 6), autoPick: list.find(c => c.year === front.chosenYear)?.id ?? null });
}
const out = path.join('review-data/belt-review', faceId);
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'face.json'), `${JSON.stringify(face, null, 2)}\n`);
await fs.writeFile(path.join(out, 'candidates.json'), `${JSON.stringify(candidates, null, 2)}\n`);
console.log(`${out}: ${face.pands.length} pands, ${candidates.pands.reduce((n, p) => n + p.candidates.length, 0)} candidates`);
