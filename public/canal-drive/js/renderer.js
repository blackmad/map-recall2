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
    ctx.fillStyle = window.CanalRecallUi.hudSurface.cardSolid;
    roundRect(ctx, -43, 18, 86, 20, 5);
    ctx.fill();
    ctx.fillStyle = window.CanalRecallUi.paperTheme.ink;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DESTINATION', 0, 32);
    ctx.fillStyle = window.CanalRecallUi.paperTheme.terracotta;
    ctx.strokeStyle = window.CanalRecallUi.paperTheme.paperRaised;
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


  // The two bottom-band cards. Everything measurable about them — wrapping,
  // elision, the shrink-to-fit name, the card's own height — is decided by
  // src/canalRecall/noticeCards.ts and arrives here as `card`. This half only
  // puts it on the canvas, in order.
  // Paper, like every other card. This was the last dark-and-gold surface: a
  // navy panel with yellow rules sitting under a HUD made of cream cards.
  drawLandmarkCard(ctx, card, x, y, image) {
    const surface = window.CanalRecallUi.hudSurface;
    ctx.save();
    ctx.shadowColor = surface.shadow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = surface.cardSolid;
    roundRect(ctx, x, y, card.width, card.height, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = surface.border;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, card.width, card.height, 12);
    ctx.stroke();

    if (image) {
      const ix = x + 10, iy = y + 10;
      ctx.save();
      roundRect(ctx, ix, iy, card.imageWidth, card.imageHeight, 6);
      ctx.clip();
      const crop = window.CanalRecallCards.coverCrop(
        image.naturalWidth, image.naturalHeight, card.imageWidth, card.imageHeight);
      ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, ix, iy, card.imageWidth, card.imageHeight);
      ctx.restore();
    }

    // Ink on tinted paper. The kinds stay visually distinct — the category and
    // the kind of fact are different axes and must not read as one label.
    const badgeColors = {
      category: ['rgba(183,129,37,.18)', '#7a5514'],
      lang: ['rgba(104,116,110,.16)', '#54605a'],
      article: ['rgba(53,102,83,.15)', '#264b3d'],
      more: ['rgba(199,95,67,.15)', '#a24b33'],
      fact: ['rgba(94,74,124,.15)', '#5b4a7c'],
    };
    let textY = y + 22;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    for (const badge of card.badges) {
      const [fill, ink] = badgeColors[badge.kind];
      ctx.fillStyle = fill;
      roundRect(ctx, x + badge.x, textY - 9, badge.width, 14, 3);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.fillText(badge.label, x + badge.x + 5, textY);
    }
    if (card.badges.length) textY += 17;

    ctx.fillStyle = window.CanalRecallUi.paperTheme.ink;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(card.displayName, x + card.textLeft, textY);
    textY += 18;

    ctx.fillStyle = window.CanalRecallUi.paperTheme.inkMuted;
    ctx.font = '11px monospace';
    for (const line of card.lines) {
      ctx.fillText(line, x + card.textLeft, textY);
      textY += 14;
    }
  }

  drawPostcard(ctx, card, x, y, image) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, card.width, card.height, 8);
    ctx.clip();

    ctx.fillStyle = window.CanalRecallUi.hudSurface.cardSolid;
    ctx.fillRect(x, y, card.width, card.height);
    if (image) {
      const crop = window.CanalRecallCards.coverCrop(
        image.naturalWidth, image.naturalHeight, card.photoWidth, card.height);
      ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, x, y, card.photoWidth, card.height);
      // Fade the photo into the card rather than butting it against the text.
      const shade = ctx.createLinearGradient(x + 90, 0, x + 170, 0);
      shade.addColorStop(0, 'rgba(9,35,48,0)');
      shade.addColorStop(1, '#092330');
      ctx.fillStyle = shade;
      ctx.fillRect(x + 90, y, 80, card.height);
    } else {
      ctx.fillStyle = '#0E7490';
      ctx.fillRect(x, y, 9, card.height);
    }

    const textX = x + card.textLeft;
    ctx.textAlign = 'left';
    ctx.fillStyle = window.CanalRecallUi.paperTheme.moss;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(card.heading, textX, y + 27);
    ctx.fillStyle = window.CanalRecallUi.paperTheme.ink;
    ctx.font = `800 ${card.nameFontSize}px system-ui, sans-serif`;
    ctx.fillText(card.name, textX, y + 58);
    ctx.fillStyle = '#9CCFE1';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(card.caption, textX, y + 80);
    ctx.restore();

    ctx.strokeStyle = 'rgba(125,211,252,.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, card.width, card.height, 8);
    ctx.stroke();
  }

  drawPlayerCar(car, camera) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    // In pitched MapLibre views, a world-space heading is not the same angle
    // on the canvas. Project a point in front of the bike so the marker follows
    // the road's actual screen-space direction at its current position.
    const headingSample = 24;
    const front = camera.worldToScreen(
      car.x + Math.cos(car.angle) * headingSample,
      car.y + Math.sin(car.angle) * headingSample
    );
    const screenAngle = Math.atan2(front.y - s.y, front.x - s.x);
    const isPitched3d = camera.viewMode === 'chase' || camera.viewMode === 'cockpit';
    const z = isPitched3d
      ? clamp((camera.zoom || 1) * 2.1, 1.25, 1.85)
      : clamp((camera.zoom || 1) * 1.45, 0.9, 1.5);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    ctx.rotate(screenAngle);

    // A compact top-down omafiets and rider, with a deliberately distinct
    // front (handlebars, lamp and the rider's head). It stays screen-sized so
    // it remains navigation-readable among tall buildings.
    ctx.fillStyle = 'rgba(9,18,20,.28)';
    ctx.beginPath(); ctx.ellipse(2, isPitched3d ? 5 : 3, 23, isPitched3d ? 7 : 10, 0, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,.96)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.strokeStyle = '#172326'; ctx.lineWidth = 3;
    for (const x of [-16, 16]) {
      ctx.beginPath();
      if (isPitched3d) ctx.ellipse(x, 0, 7, 4.5, 0, 0, Math.PI * 2);
      else ctx.arc(x, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#DCE5E2'; ctx.beginPath(); ctx.arc(x, 0, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = '#C43D35'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(-4, -7); ctx.lineTo(3, 6); ctx.lineTo(-8, 5);
    ctx.closePath(); ctx.moveTo(-4, -7); ctx.lineTo(11, -5); ctx.lineTo(16, 0); ctx.stroke();
    // Rear carrier and unmistakable front handlebars.
    ctx.beginPath(); ctx.moveTo(-17, -5); ctx.lineTo(-9, -5); ctx.moveTo(10, -8); ctx.lineTo(14, -3); ctx.moveTo(10, -8); ctx.lineTo(15, -10); ctx.stroke();

    // In chase views the rider leans toward the front wheel; in plan views
    // the symmetric torso remains easier to parse from any map rotation.
    ctx.fillStyle = '#167DA0'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(isPitched3d ? 3 : 1, isPitched3d ? -1 : 0, isPitched3d ? 9 : 8, isPitched3d ? 5 : 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (isPitched3d) {
      ctx.strokeStyle = '#172326'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(-7, 7); ctx.moveTo(2, 1); ctx.lineTo(8, 7); ctx.stroke();
    }
    ctx.fillStyle = '#F2C7A5';
    ctx.beginPath(); ctx.arc(9, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F4C542'; ctx.strokeStyle = '#553E00'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(18, 0, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
