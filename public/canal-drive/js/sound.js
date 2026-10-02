// ============================================================
// SOUND MANAGER — permanently disabled
// ============================================================
// The product has no audio. This inert stub keeps call sites working but never
// touches Web Audio. Do not re-enable without an explicit product decision.
class SoundManager {
  constructor() { this.muted = true; }
  init() {}
  resume() {}
  update() {}
  playBeep() {}
  silence() {}
  toggle() { return false; }
  setEnabled() { this.muted = true; }
}
