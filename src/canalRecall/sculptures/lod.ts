// Near/far switch for a sculpture: the reconstruction (splat or impostor)
// within `nearM` of the eye, the hand-built model beyond. A band of
// `hysteresisM` stops it flickering when the rider hovers at the boundary.

export type SculptureLevel = 'near' | 'far';

export type LodOptions = { nearM?: number; hysteresisM?: number };

export const DEFAULT_NEAR_M = 50;
export const DEFAULT_HYSTERESIS_M = 5;

export class SculptureLod {
  level: SculptureLevel = 'far';
  readonly nearM: number;
  readonly hysteresisM: number;
  switches = 0;

  constructor(options: LodOptions = {}) {
    this.nearM = options.nearM ?? DEFAULT_NEAR_M;
    this.hysteresisM = options.hysteresisM ?? DEFAULT_HYSTERESIS_M;
  }

  /** Update with the eye–anchor distance (metres, 3D); returns the level to draw. */
  update(distanceM: number): SculptureLevel {
    if (!Number.isFinite(distanceM)) return this.level;
    const next: SculptureLevel = this.level === 'near'
      ? (distanceM > this.nearM + this.hysteresisM ? 'far' : 'near')
      : (distanceM < this.nearM ? 'near' : 'far');
    if (next !== this.level) { this.level = next; this.switches++; }
    return this.level;
  }
}
