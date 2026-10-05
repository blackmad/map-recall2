// ============================================================
// CAMERA
// ============================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.smoothing = CAMERA_SMOOTHING;
    this.zoom = CAMERA_ZOOM_INITIAL;
    this.minZoom = CAMERA_ZOOM_MIN;
    this.maxZoom = CAMERA_ZOOM_MAX;
    this.northUp = true;
    // Absolute steering points in screen directions. A camera that turned
    // with the heading would move "right" every time the vehicle turned
    // right — a feedback spin — so absolute mode holds the map still.
    this.holdHeading = false;
    this.heldRotation = 0;
    this.rotation = 0;
    this.bearingOffset = 0;
    this.viewMode = 'north';
    this.projector = null;
    this.panX = 0;
    this.panY = 0;
    // Dragging the map detaches the view from the vehicle and pins it to the
    // world, so the boat drives across the map the way it does on any other
    // map you have panned away from. `R` or the re-centre button reattaches it.
    this.detached = false;
    this.anchorX = 0;
    this.anchorY = 0;
    this.reducedMotion = false;
    this._lookahead = 0;
  }
  followPosition(target) {
    const cockpitLead = typeof COCKPIT_LOOKAHEAD === 'number' ? COCKPIT_LOOKAHEAD : 160;
    const chaseLead = typeof CHASE_LOOKAHEAD === 'number' ? CHASE_LOOKAHEAD : 0;
    const lead = this.viewMode === 'cockpit' ? cockpitLead : this.viewMode === 'chase' ? chaseLead : 0;
    const lookahead = lead + this._lookahead;
    return { x: target.x + Math.cos(target.angle) * lookahead,
      y: target.y + Math.sin(target.angle) * lookahead };
  }
  followRotation(target) {
    const is3d = this.viewMode === 'chase' || this.viewMode === 'cockpit';
    const heading = this.northUp ? 0 : this.holdHeading
      ? (is3d ? this.heldRotation : 0) : target.angle + Math.PI / 2;
    return heading + (is3d ? this.bearingOffset : 0);
  }
  resetForRide(target) {
    // Start behind the new vehicle, never at the previous ride's orbit or
    // cached follow position. Absolute steering holds this initial bearing.
    this.bearingOffset = 0;
    this.heldRotation = target.angle + Math.PI / 2;
    this._lookahead = 0;
    this.detached = false;
    this.panX = this.panY = 0;
    this.targetX = target.x;
    this.targetY = target.y;
    const position = this.followPosition(target);
    this.x = this._followX = position.x;
    this.y = this._followY = position.y;
    this.rotation = this.followRotation(target);
  }
  resetRotation(target) {
    this.bearingOffset = 0;
    this.northUp = this.viewMode === 'north';
    this.heldRotation = target.angle + Math.PI / 2;
    this.rotation = this.followRotation(target);
  }
  update(target, dt) {
    // Keep the same easing at 60 fps, but follow at the same pace when city
    // rendering slows down. Simulation time is capped separately by the game.
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 1) : 1 / 60;
    const ease = rate => 1 - Math.pow(1 - clamp(rate, 0, 1), seconds * 60);
    // The vehicle itself, for the clearance guard's sightline (the view centre
    // leads it in chase and cockpit).
    this.targetX = target.x;
    this.targetY = target.y;
    const speedRatio = clamp(target.speed / target.maxSpeed, 0, 1);
    // Ease the lookahead instead of binding it straight to speed, so the view
    // no longer surges forward and back with the throttle.
    const wantedLookahead = this.reducedMotion ? 0 : CAMERA_LOOKAHEAD * speedRatio;
    this._lookahead += (wantedLookahead - this._lookahead) * ease(CAMERA_LOOKAHEAD_SMOOTHING);
    const position = this.followPosition(target);
    this._followX = position.x;
    this._followY = position.y;
    const tx = this.detached ? this.anchorX : this._followX;
    const ty = this.detached ? this.anchorY : this._followY;
    this.x += (tx - this.x) * ease(this.smoothing);
    this.y += (ty - this.y) * ease(this.smoothing);
    // Reported for the re-centre affordance and the debug panel: how far the
    // view has drifted from the vehicle, which keeps growing while detached.
    this.panX = this.detached ? this.x - target.x : 0;
    this.panY = this.detached ? this.y - target.y : 0;
    // A panned map holds still: rotating it under the vehicle's heading while
    // the player is looking somewhere else is disorienting.
    const wantedRotation = this.detached
      ? this.rotation
      : this.followRotation(target);
    const delta = Math.atan2(Math.sin(wantedRotation - this.rotation), Math.cos(wantedRotation - this.rotation));
    const rotationRate = this.reducedMotion ? CAMERA_REDUCED_ROTATION_SMOOTHING : CAMERA_ROTATION_SMOOTHING;
    this.rotation += delta * ease(this.smoothing * rotationRate);
  }
  zoomIn() {
    this.zoom = clamp(this.zoom + CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  zoomOut() {
    this.zoom = clamp(this.zoom - CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  pan(dx, dy) {
    const cos = Math.cos(this.rotation), sin = Math.sin(this.rotation);
    if (!this.detached) {
      this.detached = true;
      this.anchorX = this.x;
      this.anchorY = this.y;
    }
    this.anchorX += (dx * cos - dy * sin) / this.zoom;
    this.anchorY += (dx * sin + dy * cos) / this.zoom;
  }
  resetPan() {
    this.detached = false;
    this.panX = 0;
    this.panY = 0;
    // Recenter is an explicit request, so restore the latest live follow
    // position immediately rather than leaving the bike offscreen while easing.
    if (Number.isFinite(this._followX) && Number.isFinite(this._followY)) {
      this.x = this._followX;
      this.y = this._followY;
    }
  }
  worldToScreen(wx, wy) {
    if (this.projector) return this.projector(wx, wy);
    const dx = wx - this.x;
    const dy = wy - this.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return {
      x: (dx * cos + dy * sin) * this.zoom + CANVAS_W/2,
      y: (-dx * sin + dy * cos) * this.zoom + CANVAS_H/2
    };
  }
}
