// ============================================================
// RENDERER
// ============================================================
class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.trackCanvas = null;
    this.trackBounds = null;
  }

  preRenderTrack(track) {
    if (!track) return;
    // RoadNetwork handles its own pre-rendering
    if (track.isOpenTrack) {
      this.trackCanvas = null;
      this.trackBounds = track.getBounds();
      this.renderScale = 1;
      return;
    }
    this.renderScale = 1;

    const bounds = track.getBounds();
    this.trackBounds = bounds;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Cap canvas size to avoid memory issues (same safeguard as road-network)
    let scale = 1;
    if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
      scale = MAX_CANVAS_DIM / Math.max(w, h);
    }
    this.renderScale = scale;

    this.trackCanvas = document.createElement('canvas');
    this.trackCanvas.width = Math.ceil(w * scale);
    this.trackCanvas.height = Math.ceil(h * scale);
    const tc = this.trackCanvas.getContext('2d');
    tc.scale(scale, scale);
    tc.translate(-bounds.minX, -bounds.minY);

    // grass pattern
    tc.fillStyle = COLORS.grass;
    tc.fillRect(bounds.minX, bounds.minY, w, h);
    tc.fillStyle = COLORS.grassDark;
    for (let y = bounds.minY; y < bounds.maxY; y += GRASS_STRIPE_HEIGHT) {
      tc.fillRect(bounds.minX, y, w, GRASS_STRIPE_HEIGHT / 2);
    }

    // road surface
    tc.beginPath();
    const lb = track.leftBoundary, rb = track.rightBoundary;
    tc.moveTo(lb[0].x, lb[0].y);
    for (let i = 1; i < TRACK_SAMPLES; i++) tc.lineTo(lb[i].x, lb[i].y);
    for (let i = TRACK_SAMPLES - 1; i >= 0; i--) tc.lineTo(rb[i].x, rb[i].y);
    tc.closePath();
    tc.fillStyle = COLORS.road;
    tc.fill();

    // road detail - lighter center
    tc.beginPath();
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const p = track.points[i], n = track.normals[i], w2 = track.widths[i] * 0.7;
      const lx = p.x + n.x * w2, ly = p.y + n.y * w2;
      if (i === 0) tc.moveTo(lx, ly); else tc.lineTo(lx, ly);
    }
    for (let i = TRACK_SAMPLES - 1; i >= 0; i--) {
      const p = track.points[i], n = track.normals[i], w2 = track.widths[i] * 0.7;
      tc.lineTo(p.x - n.x * w2, p.y - n.y * w2);
    }
    tc.closePath();
    tc.fillStyle = COLORS.roadLight;
    tc.fill();

    // curbs (outer edge)
    for (let side = 0; side < 2; side++) {
      const boundary = side === 0 ? track.leftBoundary : track.rightBoundary;
      for (let i = 0; i < TRACK_SAMPLES; i += CURB_SEGMENT_STEP) {
        const i2 = Math.min(i + CURB_SEGMENT_STEP, TRACK_SAMPLES - 1);
        const color = (Math.floor(i / CURB_SEGMENT_STEP) % 2 === 0) ? COLORS.curb1 : COLORS.curb2;
        tc.beginPath();
        const p1 = boundary[i], p2 = boundary[i2];
        const n1 = track.normals[i], n2 = track.normals[i2];
        const sign = side === 0 ? -1 : 1;
        const cw = CURB_VISUAL_WIDTH;
        tc.moveTo(p1.x, p1.y);
        tc.lineTo(p2.x, p2.y);
        tc.lineTo(p2.x + n2.x * sign * cw, p2.y + n2.y * sign * cw);
        tc.lineTo(p1.x + n1.x * sign * cw, p1.y + n1.y * sign * cw);
        tc.closePath();
        tc.fillStyle = color;
        tc.fill();
      }
    }

    // center dashed line
    tc.strokeStyle = 'rgba(255,255,255,0.3)';
    tc.lineWidth = 2;
    tc.setLineDash([20, 20]);
    tc.beginPath();
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const p = track.points[i];
      if (i === 0) tc.moveTo(p.x, p.y); else tc.lineTo(p.x, p.y);
    }
    tc.closePath();
    tc.stroke();
    tc.setLineDash([]);

    // edge lines
    tc.strokeStyle = 'rgba(255,255,255,0.5)';
    tc.lineWidth = 2;
    for (let side = 0; side < 2; side++) {
      const boundary = side === 0 ? track.leftBoundary : track.rightBoundary;
      tc.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const p = boundary[i];
        if (i === 0) tc.moveTo(p.x, p.y); else tc.lineTo(p.x, p.y);
      }
      tc.closePath();
      tc.stroke();
    }

    // start/finish line
    const sfP = track.points[0], sfN = track.normals[0], sfW = track.widths[0];
    tc.save();
    tc.translate(sfP.x, sfP.y);
    tc.rotate(Math.atan2(sfN.y, sfN.x));
    const sfSize = 8;
    for (let row = -Math.floor(sfW / sfSize); row <= Math.floor(sfW / sfSize); row++) {
      for (let col = -1; col <= 1; col++) {
        tc.fillStyle = (row + col) % 2 === 0 ? '#FFF' : '#222';
        tc.fillRect(col * sfSize, row * sfSize, sfSize, sfSize);
      }
    }
    tc.restore();
  }

  drawTrack(camera, track) {
    if (!track) return;
    if (track.isOpenTrack && track.segments) {
      // The vector basemap already draws the actual water geometry. Painting
      // wide OSM centerlines here duplicated it and could never match banks.
      this._drawDestination(camera, track);
      return;
    }
    if (!this.trackCanvas || !this.trackBounds) return;
    const ctx = this.ctx;
    const b = this.trackBounds;
    const z = camera.zoom || 1;
    const sx = (b.minX - camera.x) * z + CANVAS_W/2;
    const sy = (b.minY - camera.y) * z + CANVAS_H/2;
    const dw = (b.maxX - b.minX) * z;
    const dh = (b.maxY - b.minY) * z;
    ctx.drawImage(this.trackCanvas, sx, sy, dw, dh);

    // Names stay hidden during recall play. The spatial lookup still supplies
    // the prompt when the player enters a differently named waterway.
  }

  _drawDestination(camera, track) {
    const ctx = this.ctx;
    const destination = camera.worldToScreen(track.finishPoint.x, track.finishPoint.y);
    ctx.save();
    ctx.translate(destination.x, destination.y);
    ctx.fillStyle = 'rgba(3,18,28,.82)';
    roundRect(ctx, -43, 18, 86, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTINATION', 0, 32);
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.bezierCurveTo(-4, 9, -12, 1, -12, -7);
    ctx.arc(0, -7, 12, Math.PI, 0);
    ctx.bezierCurveTo(12, 1, 4, 9, 0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#071E2B';
    ctx.beginPath();
    ctx.arc(0, -7, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawQuestionFeature(camera, track, featureName, segmentIndex, pointIndex, time) {
    if (!featureName || !track || !track.segments) return;
    const seed = track.segments[segmentIndex];
    if (!seed || seed.name !== featureName || !seed.points || seed.points.length < 2) return;
    const segments = track.getConnectedNamedSegments ? track.getConnectedNamedSegments(segmentIndex) : [seed];
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    // Highlight the full connected feature, including OSM fragments split at
    // bridges, without pulling in disconnected same-name waterways elsewhere.
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const segment of segments) {
      const points = segment.points;
      if (!points || points.length < 2) continue;
      const first = camera.worldToScreen(points[0].x, points[0].y);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < points.length; i++) {
        const point = camera.worldToScreen(points[i].x, points[i].y);
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = `rgba(250,204,21,${0.72 + pulse * 0.25})`;
      ctx.lineWidth = 22 + pulse * 6;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 + pulse * 0.1})`;
      ctx.lineWidth = 11 + pulse * 2;
      ctx.stroke();
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSkidMarks(particles, camera) {
    const ctx = this.ctx;
    const z = camera.zoom || 1;
    const sz = 2 * z;
    for (const sm of particles.skidMarks) {
      if (sm.alpha <= 0) continue; // Skip fully faded marks (circular buffer keeps them)
      const s = camera.worldToScreen(sm.x, sm.y);
      ctx.fillStyle = `rgba(30,30,30,${clamp(sm.alpha, 0, 0.6)})`;
      ctx.fillRect(s.x - sz, s.y - sz, sz * 2, sz * 2);
    }
  }

  // Shared car body rendering: shadow, body shape, windshield, headlights, taillights
  _drawCarBody(ctx, car, s, z, bodyGradStops, strokeColor, cameraRotation = 0) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    ctx.rotate(car.angle - cameraRotation);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 3, car.length / 2 + 2, car.width / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(-car.length / 2, -car.width / 2, -car.length / 2, car.width / 2);
    for (const [stop, color] of bodyGradStops) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 4);
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Windshield
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath();
    ctx.moveTo(car.length / 2 - 12, -car.width / 2 + 3);
    ctx.lineTo(car.length / 2 - 5, -car.width / 2 + 5);
    ctx.lineTo(car.length / 2 - 5, car.width / 2 - 5);
    ctx.lineTo(car.length / 2 - 12, car.width / 2 - 3);
    ctx.closePath();
    ctx.fill();

    // Headlights
    ctx.fillStyle = '#FFE082';
    ctx.fillRect(car.length / 2 - 3, -car.width / 2 + 2, 3, 4);
    ctx.fillRect(car.length / 2 - 3, car.width / 2 - 6, 3, 4);

    // Taillights
    ctx.fillStyle = '#C62828';
    ctx.fillRect(-car.length / 2, -car.width / 2 + 2, 3, 4);
    ctx.fillRect(-car.length / 2, car.width / 2 - 6, 3, 4);

    return ctx; // still in save/translate/rotate state
  }

  drawCar(car, camera) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = camera.zoom || 1;

    ctx.save();
    ctx.translate(s.x, s.y);
    const boatVisualScale = 1.35;
    ctx.scale(z * boatVisualScale, z * boatVisualScale);
    ctx.rotate(car.angle - camera.rotation);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(3, 3, car.length / 2 + 2, car.width / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#0C4A6E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(car.length / 2, 0);
    ctx.quadraticCurveTo(car.length / 3, -car.width / 2, -car.length / 2, -car.width / 2.6);
    ctx.lineTo(-car.length / 2, car.width / 2.6);
    ctx.quadraticCurveTo(car.length / 3, car.width / 2, car.length / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    roundRect(ctx, -5, -6, 15, 12, 3);
    ctx.fill();
    ctx.restore();
  }


  drawPlayerCar(car, camera) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = (camera.zoom || 1) * 1.15;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    ctx.rotate(car.angle - camera.rotation);

    // A readable top-down omafiets silhouette: two wheels, diamond frame,
    // upright bars and a warm jacket so the player remains easy to track.
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, 3); ctx.lineTo(11, 3); ctx.stroke();
    ctx.strokeStyle = '#17212B'; ctx.lineWidth = 3;
    for (const x of [-11, 11]) { ctx.beginPath(); ctx.arc(x, 0, 6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#0F766E'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(-1, 0); ctx.lineTo(5, -7); ctx.lineTo(11, 0);
    ctx.lineTo(-1, 0); ctx.lineTo(2, 7); ctx.lineTo(-11, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(8, -10); ctx.lineTo(11, -9); ctx.stroke();
    ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(1, 3, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FDE68A'; ctx.beginPath(); ctx.arc(5, 1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }


  drawPlayerPulse(car, camera, time) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = camera.zoom || 1;
    // Pulsate between 70-110 world-pixels radius
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    const radius = (70 + pulse * 40) * z;
    const alpha = 0.25 + pulse * 0.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${alpha})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * z);
    ctx.stroke();
    // Inner glow
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.4})`;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();
  }

  drawParticles(particles, camera) {
    const ctx = this.ctx;
    const z = camera.zoom || 1;
    for (const p of particles.particles) {
      const s = camera.worldToScreen(p.x, p.y);
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(200,200,200,${alpha * 0.5})`;
      } else if (p.type === 'exhaust') {
        ctx.fillStyle = `rgba(80,80,80,${alpha * 0.4})`;
      } else {
        ctx.fillStyle = `rgba(139,90,43,${alpha * 0.6})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size * z, 0, Math.PI*2);
      ctx.fill();
    }
  }
}
