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
    this.rotation = 0;
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
  update(target, dt) {
    const speedRatio = clamp(target.speed / target.maxSpeed, 0, 1);
    // Ease the lookahead instead of binding it straight to speed, so the view
    // no longer surges forward and back with the throttle.
    const wantedLookahead = this.reducedMotion ? 0 : CAMERA_LOOKAHEAD * speedRatio;
    this._lookahead += (wantedLookahead - this._lookahead) * CAMERA_LOOKAHEAD_SMOOTHING;
    const lookahead = (this.viewMode === 'cockpit' ? 115 : 0) + this._lookahead;
    const tx = this.detached ? this.anchorX : target.x + Math.cos(target.angle) * lookahead;
    const ty = this.detached ? this.anchorY : target.y + Math.sin(target.angle) * lookahead;
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;
    // Reported for the re-centre affordance and the debug panel: how far the
    // view has drifted from the vehicle, which keeps growing while detached.
    this.panX = this.detached ? this.x - target.x : 0;
    this.panY = this.detached ? this.y - target.y : 0;
    // A panned map holds still: rotating it under the vehicle's heading while
    // the player is looking somewhere else is disorienting.
    const wantedRotation = this.detached ? this.rotation : (this.northUp ? 0 : target.angle + Math.PI / 2);
    const delta = Math.atan2(Math.sin(wantedRotation - this.rotation), Math.cos(wantedRotation - this.rotation));
    const rotationRate = this.reducedMotion ? CAMERA_REDUCED_ROTATION_SMOOTHING : CAMERA_ROTATION_SMOOTHING;
    this.rotation += delta * Math.min(1, this.smoothing * rotationRate);
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
