/** Row definitions shared by row-sheet.ts and check-rows.ts: members in street order with widths, cut photos, staged specs. */
import fs from 'node:fs';
import path from 'node:path';

export interface RowMemberDef { pandId: string; label: string; widthM: number; x0M?: number; px?: [number, number]; eavesM?: number }
export interface RowDef { id: string; title: string; face?: string; members: RowMemberDef[]; cutsDir: string; cutsLocal?: string; answersDir: string; stagedDir: string; pixelsPerMetre?: number; note?: string }

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const REPO = path.resolve(HERE, '../../..');

export function loadRowDefs(): Record<string, RowDef> {
  const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'rows.json'), 'utf8'));
  const root = process.env.ROW_D1_ROOT ?? raw.d1Root;
  const out: Record<string, RowDef> = {};
  for (const [id, r] of Object.entries<any>(raw.rows)) {
    let members: RowMemberDef[] = r.members ?? [];
    let ppm: number | undefined;
    if (r.face) {
      const strip = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/block-face/faces', r.face, 'strip.json'), 'utf8'));
      const survey = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/street-surveys/streets', `${r.street}.json`), 'utf8'));
      const label = new Map<string, string>(survey.pands.map((p: any) => [p.pandId, String(p.label).replace(/^.*?\s(\d[\d–-]*)$/, '$1')]));
      ppm = strip.pixelsPerMetre;
      members = strip.spans.map((s: any) => ({ pandId: s.pandId.replace(/^NL\.IMBAG\.Pand\./, ''), label: label.get(s.pandId) ?? s.pandId.slice(-6), widthM: +(s.x1M - s.x0M).toFixed(2), x0M: s.x0M, px: s.px }));
    }
    out[id] = { id, title: r.title, face: r.face, members, cutsDir: path.join(root, r.cuts), cutsLocal: r.cutsLocal ? path.join(REPO, r.cutsLocal) : undefined, answersDir: path.join(root, r.answers), stagedDir: path.join(root, r.staged), pixelsPerMetre: ppm, note: r.note };
  }
  return out;
}

/** A re-read (scripts/house-specs/rows/rereads.json): a held first read re-cut from another capture year and read again. */
export interface Reread {
  answer: string; cut: string; panoId: string; captured: string; obliquityDeg?: number; distM?: number; why?: string;
  /** `left` / `right`: the read of a multi-front capture describes that module only. */
  describes?: 'left' | 'right';
  firstRead: { ref: string; panoId?: string; captured?: string; held: string };
}
export function loadRereads(): Record<string, Reread> {
  const f = path.join(HERE, 'rereads.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).pands ?? {}) : {};
}
/** The reader's cut for a pand: a re-read's capture first (the sheet shows what the read saw), then the canonical D1 dir,
 *  then the regenerated local copy. */
export const cutPath = (def: RowDef, pandId: string): string | null => [loadRereads()[pandId] ? path.dirname(path.join(REPO, loadRereads()[pandId].cut)) : undefined, def.cutsDir, def.cutsLocal].filter(Boolean).map(d => path.join(d!, `${pandId}.jpg`)).find(f => fs.existsSync(f)) ?? null;
