/**
 * The reviewed publish step for street-art photos (feedback deb3fc). `street-art-commons-images.ts` stages Commons /
 * panorama photos for points without an article image; a reviewer looks at each and records accept, reject or
 * replace (a better file of the same work, with its own page, author and licence) in
 * `scripts/data/street-art-photo-review.json`. `publishReviewedPhotos` turns the staged list and that review into the
 * published sidecar `street-art-commons.json`; `applyPhotosToPoints` gives each point without an `i` its photo, so
 * the published `street-art.json` changes only by the accepted entries.
 */
import type { StreetArtPoint } from './streetArt.ts';

export interface StreetArtPhoto {
  id: string;
  name: string;
  file: string;
  page: string;
  thumb: string;
  licence: string;
  author: string;
  by: string;
  distM?: number;
  note?: string;
}

export interface StagedStreetArtPhotos { images: StreetArtPhoto[] }

export type PhotoDecision = 'accept' | 'reject' | 'replace';

export interface PhotoReviewEntry {
  id: string;
  name: string;
  decision: PhotoDecision;
  reason: string;
  /** For `replace`: the reviewed file that stands in for the staged one. */
  replacement?: Pick<StreetArtPhoto, 'file' | 'page' | 'thumb' | 'licence' | 'author'>;
}

export interface PhotoReview { reviewed: string; entries: PhotoReviewEntry[] }

/** Open licences only: CC0, public domain, CC BY, CC BY-SA (no NC/ND). */
export const openLicence = (licence: string): boolean => /^(CC0|CC BY(-SA)? \d|Public domain|PD)/i.test(licence.trim()) && !/\b(NC|ND)\b/.test(licence);

/** Problems that keep a photo off a card: closed licence or missing credit. */
export function photoProblems(photo: Pick<StreetArtPhoto, 'page' | 'thumb' | 'licence' | 'author'>): string[] {
  const problems: string[] = [];
  if (!openLicence(photo.licence)) problems.push(`licence "${photo.licence}" is not open`);
  if (!photo.author.trim()) problems.push('no author');
  if (!/^https:\/\//.test(photo.page)) problems.push('no source page');
  if (!/^https:\/\//.test(photo.thumb)) problems.push('no image URL');
  return problems;
}

/**
 * The published photo list: every staged entry must be reviewed exactly once (and nothing reviewed that was not
 * staged); rejected ones drop, replaced ones take the reviewed file and keep the staged id and name. Throws on any
 * gap so a half-reviewed staging file cannot publish.
 */
export function publishReviewedPhotos(staged: StagedStreetArtPhotos, review: PhotoReview): StreetArtPhoto[] {
  const byId = new Map<string, PhotoReviewEntry>();
  for (const entry of review.entries) {
    if (byId.has(entry.id)) throw new Error(`${entry.id} reviewed twice`);
    if (!entry.reason?.trim()) throw new Error(`${entry.id}: review has no reason`);
    if (entry.decision === 'replace' && !entry.replacement) throw new Error(`${entry.id}: replace without a replacement file`);
    byId.set(entry.id, entry);
  }
  const stagedIds = new Set(staged.images.map(image => image.id));
  for (const id of byId.keys()) if (!stagedIds.has(id)) throw new Error(`${id} reviewed but not staged`);
  const published: StreetArtPhoto[] = [];
  for (const image of staged.images) {
    const entry = byId.get(image.id);
    if (!entry) throw new Error(`${image.id} (${image.name}) is staged but not reviewed`);
    if (entry.decision === 'reject') continue;
    const photo: StreetArtPhoto = entry.decision === 'replace'
      ? { id: image.id, name: image.name, ...entry.replacement!, by: 'reviewed-replacement' }
      : { ...image };
    const problems = photoProblems(photo);
    if (problems.length) throw new Error(`${image.id} (${image.name}): ${problems.join(', ')}`);
    published.push(photo);
  }
  return published;
}

/** Points without an image take their reviewed photo; every other point is returned untouched (same object). */
export function applyPhotosToPoints(points: StreetArtPoint[], photos: StreetArtPhoto[]): { points: StreetArtPoint[]; applied: string[] } {
  const thumbs = new Map(photos.map(photo => [photo.id, photo.thumb]));
  const applied: string[] = [];
  const out = points.map(point => {
    const thumb = thumbs.get(point.id);
    if (point.i || !thumb) return point;
    applied.push(point.id);
    return { ...point, i: thumb };
  });
  return { points: out, applied };
}
