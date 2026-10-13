/** Reviewed decisions on footprint-only covers links (`scripts/covers-review.json`), keyed `"<model> <short pand id>"`. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './placedFootprints';
import { shortPandId } from '../../src/canalRecall/bagTiles';

export type CoversDecision = { decision: 'hide' | 'keep'; reason: string };
export type CoversReview = Record<string, CoversDecision>;

export const COVERS_REVIEW_FILE = path.join(ROOT, 'scripts/covers-review.json');

export function loadCoversReview(file = COVERS_REVIEW_FILE): CoversReview {
  if (!fs.existsSync(file)) return {};
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { decisions?: CoversReview };
  return parsed.decisions ?? {};
}

export const reviewKey = (model: string, pand: string): string => `${model} ${shortPandId(pand)}`;
