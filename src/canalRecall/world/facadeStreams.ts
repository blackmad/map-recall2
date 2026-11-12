/**
 * The facade-record streams of a record shell file (F1 S2, #380; docs/plans/facade-f1-design-20261112.md §1.4, §4.1).
 *
 *   FREC  u8 record version  uvar records  then 64 byte planes, field-major (byte 0 of every record, byte 1 of every
 *         record, ...), so gzip sees the runs a street makes (one wall colour, one storey count).
 *   CROW  uvar crowns  then 24 byte planes, one 24-byte entry per crown (`CrownEntry`, layout `CROWN_BYTES`).
 *
 * Both live in the record shell file (`world-v1/facade/<cell>.bin`) beside the SHEL level 3 mesh; the legacy
 * `shells/` file is never touched, so the flag-off path reads exactly what it read before F1. Pure, no DOM.
 */
import { CROWN_CAPS, CROWN_CAP_SPANS, CROWN_SHOULDERS, GABLES } from '../buildingRecipe/intent.ts';
import { FACADE_RECORD_BYTES, FACADE_RECORD_VERSION } from '../look/facadeRecord.ts';
import { Reader, Writer } from './cellFormat.js';

/** A cell's records: `count` x 64 bytes, record `k` at `bytes[k * 64]`. */
export type FacadeRecordSet = { version: number; count: number; bytes: Uint8Array };

export function encodeFrec(set: FacadeRecordSet): Uint8Array {
  if (set.bytes.length !== set.count * FACADE_RECORD_BYTES) throw Error(`FREC: ${set.bytes.length} bytes for ${set.count} records`);
  const w = new Writer();
  w.byte(set.version); w.uvar(set.count);
  const plane = new Uint8Array(set.count);
  for (let b = 0; b < FACADE_RECORD_BYTES; b++) { for (let k = 0; k < set.count; k++) plane[k] = set.bytes[k * FACADE_RECORD_BYTES + b]; w.bytes(plane); }
  return w.done();
}

/** Decode FREC. A record version this build does not know decodes (the bytes are kept) but `version` says so: the caller falls back. */
export function decodeFrec(r: Reader): FacadeRecordSet {
  const version = r.byte(), count = r.count(1 << 16, 'facade records');
  const bytes = new Uint8Array(count * FACADE_RECORD_BYTES);
  for (let b = 0; b < FACADE_RECORD_BYTES; b++) { const plane = r.take(count); for (let k = 0; k < count; k++) bytes[k * FACADE_RECORD_BYTES + b] = plane[k]; }
  r.end();
  return { version, count, bytes };
}
export const frecCurrent = (set: FacadeRecordSet | undefined): boolean => !!set && set.version === FACADE_RECORD_VERSION;

// --- CROW ---------------------------------------------------------------------------------------------------------
/** Crown profiles the instance shader draws: the intent's gables plus the projecting cornice ledge (§4.2). */
export const CROWN_KINDS = [...GABLES, 'cornice-ledge'] as const;
export type CrownKind = (typeof CROWN_KINDS)[number];

/**
 * One crown instance: the front wall's top edge (x0, y0)-(x1, y1) in cell-origin metres seen from outside left to
 * right, the eaves `z` it stands on, its `rise`, the neck's share of the width, the cap's rise (m), the profile and its
 * vocabulary (FrontIntent crownCap/crownShoulder/crownSteps/crownFinial/crownHalf), the record it draws its face from,
 * and its colour. `depth`: a cornice ledge's projection (m); the gable's return for the others.
 */
export type CrownEntry = {
  x0: number; y0: number; x1: number; y1: number; z: number; rise: number; neck: number; capRise: number;
  kind: CrownKind; steps: number; shoulder: (typeof CROWN_SHOULDERS)[number] | null; cap: (typeof CROWN_CAPS)[number] | null;
  capSpan: (typeof CROWN_CAP_SPANS)[number] | null; half: 'left' | 'right' | null; finial: boolean; depth: number; rec: number; rgb: [number, number, number];
};

/**
 * 24 bytes an entry: x0 y0 x1 y1 i16 dm (8), z u16 cm (2), rise u16 cm (2), neck u8/255, capRise u8 cm, kind u8, steps u8,
 * shoulder:3 cap:3 finial:1 (1), capSpan:2 half:2 (1), depth u8 cm, reserved u8, rec u16 (2), rgb (3).
 */
export const CROWN_BYTES = 24;
const HALF = [null, 'left', 'right'] as const;

const i16 = (v: number, unit: number) => { const n = Math.round(v / unit); if (n < -32768 || n > 32767) throw Error(`crown coordinate ${v} m out of range`); return n & 0xffff; };
const u = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));

export function packCrown(c: CrownEntry, out: Uint8Array, at: number): void {
  const dv = new DataView(out.buffer, out.byteOffset + at, CROWN_BYTES);
  dv.setUint16(0, i16(c.x0, 0.1), true); dv.setUint16(2, i16(c.y0, 0.1), true); dv.setUint16(4, i16(c.x1, 0.1), true); dv.setUint16(6, i16(c.y1, 0.1), true);
  dv.setUint16(8, u(c.z * 100, 65535), true); dv.setUint16(10, u(c.rise * 100, 65535), true);
  dv.setUint8(12, u(c.neck * 255, 255)); dv.setUint8(13, u(c.capRise * 100, 255));
  dv.setUint8(14, Math.max(0, CROWN_KINDS.indexOf(c.kind))); dv.setUint8(15, u(c.steps, 255));
  const sh = c.shoulder ? CROWN_SHOULDERS.indexOf(c.shoulder) + 1 : 0, cap = c.cap ? CROWN_CAPS.indexOf(c.cap) + 1 : 0;
  dv.setUint8(16, sh | (cap << 3) | (c.finial ? 64 : 0));
  dv.setUint8(17, (c.capSpan ? CROWN_CAP_SPANS.indexOf(c.capSpan) + 1 : 0) | (HALF.indexOf(c.half) << 2));
  dv.setUint8(18, u(c.depth * 100, 255)); dv.setUint8(19, 0);
  dv.setUint16(20, u(c.rec, 65535), true);
  out[at + 21] = c.rgb[0]; out[at + 22] = c.rgb[1]; out[at + 23] = c.rgb[2];
}

export function unpackCrown(bytes: Uint8Array, at: number): CrownEntry {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + at, CROWN_BYTES);
  const s16 = (o: number) => dv.getInt16(o, true) * 0.1;
  const b16 = dv.getUint8(16), b17 = dv.getUint8(17);
  return {
    x0: s16(0), y0: s16(2), x1: s16(4), y1: s16(6), z: dv.getUint16(8, true) / 100, rise: dv.getUint16(10, true) / 100,
    neck: dv.getUint8(12) / 255, capRise: dv.getUint8(13) / 100, kind: CROWN_KINDS[dv.getUint8(14)] ?? 'flat', steps: dv.getUint8(15),
    shoulder: CROWN_SHOULDERS[(b16 & 7) - 1] ?? null, cap: CROWN_CAPS[((b16 >> 3) & 7) - 1] ?? null, finial: !!(b16 & 64),
    capSpan: CROWN_CAP_SPANS[(b17 & 3) - 1] ?? null, half: HALF[(b17 >> 2) & 3] ?? null, depth: dv.getUint8(18) / 100,
    rec: dv.getUint16(20, true), rgb: [bytes[at + 21], bytes[at + 22], bytes[at + 23]],
  };
}

/** Quantise a crown as the codec will (`decodeCrow(encodeCrow([c]))[0]` equals `quantiseCrown(c)`). */
export const quantiseCrown = (c: CrownEntry): CrownEntry => { const b = new Uint8Array(CROWN_BYTES); packCrown(c, b, 0); return unpackCrown(b, 0); };

export function encodeCrow(crowns: readonly CrownEntry[]): Uint8Array {
  const raw = new Uint8Array(crowns.length * CROWN_BYTES);
  crowns.forEach((c, k) => packCrown(c, raw, k * CROWN_BYTES));
  const w = new Writer(); w.uvar(crowns.length);
  const plane = new Uint8Array(crowns.length);
  for (let b = 0; b < CROWN_BYTES; b++) { for (let k = 0; k < crowns.length; k++) plane[k] = raw[k * CROWN_BYTES + b]; w.bytes(plane); }
  return w.done();
}

export function decodeCrow(r: Reader): CrownEntry[] {
  const n = r.count(1 << 20, 'crowns'), raw = new Uint8Array(n * CROWN_BYTES);
  for (let b = 0; b < CROWN_BYTES; b++) { const plane = r.take(n); for (let k = 0; k < n; k++) raw[k * CROWN_BYTES + b] = plane[k]; }
  r.end();
  return Array.from({ length: n }, (_, k) => unpackCrown(raw, k * CROWN_BYTES));
}
