/**
 * Minimal triangle accumulator for the block kit: positions per material slot
 * plus a part id per triangle. Part 0 is the host shell (3DBAG walls + roofs);
 * every other part must attach to the host (directly or through other parts).
 */
import type { P3 } from './types.ts';

export type V3 = P3;
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface SlotMesh { positions: number[]; parts: number[] }

export class MeshBuilder {
  slots = new Map<string, SlotMesh>();
  private nextPart = 1;
  /** debug label recorded for every new part */
  label = '';
  partLabels: string[] = ['host'];
  newPart() { this.partLabels.push(this.label); return this.nextPart++; }
  get partCount() { return this.nextPart - 1; }
  get triangles() { let n = 0; for (const s of this.slots.values()) n += s.parts.length; return n; }
  private slot(name: string) { let s = this.slots.get(name); if (!s) this.slots.set(name, s = { positions: [], parts: [] }); return s; }

  /** One triangle; when `facing` is given the winding is flipped so the normal points that way. */
  tri(slot: string, a: V3, b: V3, c: V3, part: number, facing?: V3) {
    const n = cross(sub(b, a), sub(c, a));
    if (len(n) < 1e-9) return;
    const s = this.slot(slot);
    const flip = facing && dot(n, facing) < 0;
    const [p, q, r] = flip ? [a, c, b] : [a, b, c];
    s.positions.push(...p, ...q, ...r);
    s.parts.push(part);
  }
  quad(slot: string, a: V3, b: V3, c: V3, d: V3, part: number, facing?: V3) {
    const f = facing ?? cross(sub(b, a), sub(c, a));
    this.tri(slot, a, b, c, part, f);
    this.tri(slot, a, c, d, part, f);
  }
}
