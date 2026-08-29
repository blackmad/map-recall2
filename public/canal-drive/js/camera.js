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
  }
  update(target, dt) {
    const speedRatio = clamp(target.speed / target.maxSpeed, 0, 1);
    const tx = target.x + Math.cos(target.angle) * CAMERA_LOOKAHEAD * speedRatio;
    const ty = target.y + Math.sin(target.angle) * CAMERA_LOOKAHEAD * speedRatio;
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;
    const wantedRotation = this.northUp ? 0 : target.angle + Math.PI / 2;
    const delta = Math.atan2(Math.sin(wantedRotation - this.rotation), Math.cos(wantedRotation - this.rotation));
    this.rotation += delta * Math.min(1, this.smoothing * 1.5);
  }
  zoomIn() {
    this.zoom = clamp(this.zoom + CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  zoomOut() {
    this.zoom = clamp(this.zoom - CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  worldToScreen(wx, wy) {
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
