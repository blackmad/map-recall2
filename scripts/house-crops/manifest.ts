/** Manifest types shared by crops.ts and report.ts (kept apart so report.ts never imports the CLI). */
import path from 'node:path';
import type { THRESHOLDS, CropFlags } from './flags.ts';

export type Entry = {
  status: 'ok' | 'no-wall' | 'no-pano' | 'error';
  method?: 'wall' | 'strip'; usable?: boolean; reasons?: string[]; flags?: CropFlags;
  archive?: string; panoIds?: string[]; date?: string; ppm?: number; widthM?: number; note?: string; attempts?: number; chosenYear?: number; yearsTried?: number;
};
export type Session = { startedAt: string; endedAt?: string; wallSeconds: number; requests: number; bytes: number; retries: number; status429: number; status5xx: number; failures: number; pands: number; rateMs: number };
/** Bump when the usable rules or the flags change: a manifest of another version cannot be resumed. 2 = H4b (ray check, size floor, content check, white-balanced foliage); 3 = best of up to N mission years. */
export const RULES_VERSION = 3;
export type Manifest = { version: 1; rulesVersion?: number; buurt: { code: string; cbsCode: string; name: string; gebied: string | null }; archive: string; thresholds: typeof THRESHOLDS; createdAt: string; sessions: Session[]; pands: Record<string, Entry> };

/** `HOUSE_CROPS_MANIFEST_DIR` redirects the manifest (experiments and baselines never touch the committed one). */
export const manifestPath = (code: string) => path.resolve(process.env.HOUSE_CROPS_MANIFEST_DIR ?? 'scripts/house-crops/manifests', `${code}.json`);
