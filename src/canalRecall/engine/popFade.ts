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
 * `?kitFade=1`: the street-kit chunk cross-fades its rebuilds too (only under popFade). Default off: the lane's two
 * aerial runs with it ended at 763 and 1,189 MB of JS heap against 613 MB before, unexplained (integrator 2026-11-10).
 */
export const KIT_FADE_DEFAULT = false;
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
