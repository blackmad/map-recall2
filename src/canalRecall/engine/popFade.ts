// Pop fade (lane P2, #325): far tiers arrive and leave with a dissolve, and landmark residency has hysteresis.
// `?popFade=0` (or `window.__canalRecallPopFade = false`) restores the instant drops and the hysteresis-free residency.
export const POP_FADE_DEFAULT = true;
/** The dissolve of far-tier arrivals and departures (the detail dissolve's length class). */
export const POP_FADE_MS = 600;

export function popFadeFlag(): boolean {
  const g = globalThis as { __canalRecallPopFade?: boolean | string; location?: { search?: string } };
  const m = /[?&]popFade=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallPopFade ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return POP_FADE_DEFAULT;
}

/**
 * `?kitFade` (default on since lane P3 #328): the street-kit chunk cross-fades its rebuilds too (only under popFade).
 * P2's heap jump was GC timing: after a forced GC the aerial desktop heap is 533–548 MB in every arm, n=3 each.
 */
export const KIT_FADE_DEFAULT = true;
export function kitFadeFlag(): boolean {
  if (!popFadeFlag()) return false;
  const g = globalThis as { __canalRecallKitFade?: boolean | string; location?: { search?: string } };
  const m = /[?&]kitFade=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallKitFade ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return KIT_FADE_DEFAULT;
}

type FadeClone = { uniforms: { cityFade: { value: number } }; dispose?(): void };
type LeavingMesh = { material: unknown; parent?: { remove(o: unknown): void } | null; visible?: boolean };

/**
 * Meshes a tier has dropped, dissolving out over POP_FADE_MS on a fade clone of their material (the screen-door
 * `cityFade`, one program) before they leave the scene: a far cell or baked cell no longer vanishes in one frame. The
 * owner calls `leave` instead of removing the mesh, `step` per frame, and `flush` on clear / context loss.
 */
export class LeavingFades {
  private readonly leaving: { mesh: LeavingMesh; clone: FadeClone; start: number; done: () => void }[] = [];
  constructor(private readonly ms = POP_FADE_MS) {}
  /** Start a mesh's dissolve out; false (the caller removes it now) when no clone could be made. */
  leave(mesh: LeavingMesh, clone: FadeClone | null, done: () => void, now = performance.now()): boolean {
    if (!clone || !mesh.parent) return false;
    mesh.material = clone;
    this.leaving.push({ mesh, clone, start: now, done });
    return true;
  }
  /** Advance; `global` is the tier's own fade (the overview transition). True while anything is still dissolving. */
  step(now = performance.now(), global = 1): boolean {
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i], t = (now - l.start) / this.ms;
      if (t < 1) { l.clone.uniforms.cityFade.value = (1 - t) * global; continue; }
      this.leaving.splice(i, 1);
      l.mesh.parent?.remove(l.mesh);
      l.clone.dispose?.();
      l.done();
    }
    return this.leaving.length > 0;
  }
  /** Drop every dissolving mesh now. */
  flush(): void { this.step(Infinity); }
  get size(): number { return this.leaving.length; }
}

/**
 * `?farHandFade` (lane P4 #330, under popFade): the far tier's per-tile hand-over to the coarse / baked / detail tiers
 * (a part's `hidden` toggled in one frame) dissolves instead. The toggled part draws once more through a ghost mesh
 * that shares the cell's buffers (its own `hidden` byte per vertex: the part alone) on a fade clone of the chunk
 * material (`cityFade`, the same program), fading out as the part hands over, or in as it comes back.
 */
export const FAR_HAND_FADE_DEFAULT = true;
export function farHandFadeFlag(): boolean {
  if (!popFadeFlag()) return false;
  const g = globalThis as { __canalRecallFarHandFade?: boolean | string; location?: { search?: string } };
  const m = /[?&]farHandFade=([^&]*)/.exec(g.location?.search ?? '');
  const asked = g.__canalRecallFarHandFade ?? (m ? m[1] : null);
  if (asked === true || asked === '1' || asked === 'true' || asked === 'on') return true;
  if (asked === false || asked === '0' || asked === 'false' || asked === 'off') return false;
  return FAR_HAND_FADE_DEFAULT;
}
