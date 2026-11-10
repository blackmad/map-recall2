/** Manifest types shared by crops.ts and report.ts (kept apart so report.ts never imports the CLI). */
import path from 'node:path';
import type { THRESHOLDS, CropFlags } from './flags.ts';

export type Entry = {
  status: 'ok' | 'no-wall' | 'no-pano' | 'error';
  method?: 'wall' | 'strip'; usable?: boolean; reasons?: string[]; flags?: CropFlags;
  archive?: string; panoIds?: string[]; date?: string; ppm?: number; widthM?: number; note?: string; attempts?: number;
};
export type Session = { startedAt: string; endedAt?: string; wallSeconds: number; requests: number; bytes: number; retries: number; status429: number; status5xx: number; failures: number; pands: number; rateMs: number };
export type Manifest = { version: 1; buurt: { code: string; cbsCode: string; name: string; gebied: string | null }; archive: string; thresholds: typeof THRESHOLDS; createdAt: string; sessions: Session[]; pands: Record<string, Entry> };

export const manifestPath = (code: string) => path.resolve('scripts/house-crops/manifests', `${code}.json`);
