/**
 * Publish the reviewed street-art photos (feedback deb3fc). Reads the staged sidecar
 * `staging/street-art-commons.json` (from `street-art-commons-images.ts`) and the review
 * `scripts/data/street-art-photo-review.json` (accept / reject / replace, one reason each), then
 *   - writes the published sidecar `street-art-commons.json` (accepted and replaced photos with file page, author and
 *     licence; `build-street-art.ts` reads it on a full rebuild), and
 *   - gives each point of the published `street-art.json` that has no image its reviewed photo, touching nothing else.
 * Offline: replacements are recorded in the review with their resolved URLs, author and licence.
 *
 * Usage: node --import tsx scripts/publish-street-art-photos.ts [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StreetArtFile } from '../src/canalRecall/streetArt.ts';
import { applyPhotosToPoints, publishReviewedPhotos, type PhotoReview, type StagedStreetArtPhotos } from '../src/canalRecall/streetArtPhotoReview.ts';

const directory = path.resolve('public/data/extracts/amsterdam');
const stagedFile = path.join(directory, 'staging', 'street-art-commons.json');
const reviewFile = path.resolve('scripts/data/street-art-photo-review.json');
const sidecarFile = path.join(directory, 'street-art-commons.json');
const artFile = path.join(directory, 'street-art.json');
const dryRun = process.argv.includes('--dry-run');

const staged = JSON.parse(await readFile(stagedFile, 'utf8')) as StagedStreetArtPhotos;
const review = JSON.parse(await readFile(reviewFile, 'utf8')) as PhotoReview;
const photos = publishReviewedPhotos(staged, review);
const art = JSON.parse(await readFile(artFile, 'utf8')) as StreetArtFile;
const { points, applied } = applyPhotosToPoints(art.points, photos);
const missing = photos.filter(p => !art.points.some(point => point.id === p.id)).map(p => p.id);
const alreadyIllustrated = photos.filter(p => art.points.some(point => point.id === p.id && point.i && point.i !== p.thumb)).map(p => p.id);

const count = (d: string) => review.entries.filter(e => e.decision === d).length;
process.stdout.write(`${staged.images.length} staged: ${count('accept')} accepted, ${count('replace')} replaced with a better file, ${count('reject')} rejected -> ${photos.length} published; ${applied.length} points gain a photo\n`);
if (missing.length) process.stdout.write(`not in street-art.json (kept in the sidecar for the next rebuild): ${missing.join(', ')}\n`);
if (alreadyIllustrated.length) process.stdout.write(`already illustrated by an article image (left alone): ${alreadyIllustrated.join(', ')}\n`);

if (!dryRun) {
  const source = art.source.includes('Wikimedia Commons photos') ? art.source
    : `${art.source}; Wikimedia Commons photos (see street-art-commons.json); Gemeente Amsterdam panoramas (CC BY 4.0)`;
  await writeFile(artFile, JSON.stringify({ ...art, source, points } satisfies StreetArtFile));
  await writeFile(sidecarFile, `${JSON.stringify({
    version: 1, reviewed: review.reviewed, review: path.relative(process.cwd(), reviewFile), published: photos.length,
    licence: 'each photo keeps its own licence (field licence); credit field author, link field page', images: photos,
  }, null, 1)}\n`);
  process.stdout.write(`wrote ${path.relative(process.cwd(), artFile)} and ${path.relative(process.cwd(), sidecarFile)}\n`);
}
