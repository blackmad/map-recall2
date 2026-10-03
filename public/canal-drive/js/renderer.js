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
    const surface = window.CanalRecallUi.hudSurface;
    ctx.fillStyle = surface.cardSolid;
    roundRect(ctx, -43, 18, 86, 20, 5);
    ctx.fill();
    ctx.fillStyle = surface.ink;
    ctx.font = `700 10px ${surface.fontPlaque}`;
    ctx.textAlign = 'center';
    ctx.fillText('DESTINATION', 0, 32);
    ctx.fillStyle = surface.arrow;
    ctx.strokeStyle = surface.ink;
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
    // One line per corridor, not one per carriageway and cycle track. This
    // draws every frame, so the collapsed corridor is kept per seed.
    const cache = this._questionFeatureCache;
    let segments = cache && cache.track === track && cache.seed === seed ? cache.segments : null;
    if (!segments) {
      const connected = track.getConnectedNamedSegments ? track.getConnectedNamedSegments(segmentIndex) : [seed];
      const collapse = window.CanalRecallStreets && window.CanalRecallStreets.collapseParallelFragments;
      segments = collapse ? collapse(connected, seed).map(points => ({ points })) : connected;
      this._questionFeatureCache = { track, seed, segments };
    }
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
    // Match the 3D sloep: dark green hull, cream cockpit (see PlayerBoat3D).
    ctx.fillStyle = '#1A3D34';
    ctx.strokeStyle = '#F4EFE4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(car.length / 2, 0);
    ctx.quadraticCurveTo(car.length / 3, -car.width / 2, -car.length / 2, -car.width / 2.6);
    ctx.lineTo(-car.length / 2, car.width / 2.6);
    ctx.quadraticCurveTo(car.length / 3, car.width / 2, car.length / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E8DCC4';
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
      const ix = x + 12, iy = y + 12; // IMAGE_INSET in noticeCards.ts
      ctx.save();
      roundRect(ctx, ix, iy, card.imageWidth, card.imageHeight, 6);
      ctx.clip();
      const crop = window.CanalRecallCards.coverCrop(
        image.naturalWidth, image.naturalHeight, card.imageWidth, card.imageHeight);
      ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, ix, iy, card.imageWidth, card.imageHeight);
      ctx.restore();
    }

    // Ink on the paper plate. The kinds stay visually distinct — the category
    // and the kind of fact are different axes and must not read as one label —
    // but only the category gets copper; the rest are ink tints. "More" is not
    // a chip at all: it is the card's action, drawn as a copper text link at
    // the header's right end (a "+ MORE" pill beside STREET read as a second
    // tag, user report 2026-10-02).
    const badgeColors = {
      category: ['rgba(180,104,44,.14)', '#8a4a18'],
      lang: ['rgba(31,28,23,.07)', '#5f584d'],
      article: ['rgba(31,28,23,.07)', '#5f584d'],
      fact: ['rgba(31,28,23,.07)', '#5f584d'],
    };
    // Every vertical position comes from `measureLandmarkCard`, so the plate
    // height and what is drawn on it cannot drift apart.
    ctx.font = `700 11px ${surface.fontMono}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Centre the capitals, not the em box, in the pill: the labels are all
    // caps, and a fixed baseline sat them visibly off-centre (user report
    // 2026-09-28). Measured, because the mono webfont's cap height is not a
    // fixed fraction of 11 px across fallbacks.
    // Snapped to device pixels. The HUD canvas is scaled (1.125 on a 1440 px
    // window, more on others), so a baseline on a half device pixel, which
    // WebKit rounds down and Chrome does not, put the capitals visibly low in
    // Safari (user reports 2026-09-28, 2026-10-01). The pill and the baseline
    // are placed in device space, with the air split evenly.
    const transform = ctx.getTransform();
    const scaleY = transform.d || 1;
    const toDevice = v => Math.round(v * scaleY + transform.f);
    const fromDevice = v => (v - transform.f) / scaleY;
    const pillTopDevice = toDevice(y + card.headerTop);
    const pillBottomDevice = toDevice(y + card.headerTop + card.badgeHeight);
    const capDevice = Math.round((ctx.measureText('M').actualBoundingBoxAscent || 8) * scaleY);
    const pillTop = fromDevice(pillTopDevice), pillHeight = fromDevice(pillBottomDevice) - pillTop;
    const badgeBaseline = fromDevice(pillTopDevice + Math.round((pillBottomDevice - pillTopDevice + capDevice) / 2));
    for (const badge of card.badges) {
      if (badge.kind === 'more') {
        ctx.fillStyle = '#8a4a18';
        ctx.fillText(badge.label, x + badge.x, badgeBaseline);
        continue;
      }
      const [fill, ink] = badgeColors[badge.kind];
      ctx.fillStyle = fill;
      roundRect(ctx, x + badge.x, pillTop, badge.width, pillHeight, 3);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.fillText(badge.label, x + badge.x + 5, badgeBaseline);
    }

    ctx.fillStyle = surface.ink;
    ctx.font = `800 16px ${surface.fontPlaque}`;
    let nameBaseline = y + card.nameBaseline;
    if (card.headerInline) {
      // Beside the chips the name's capitals share the pill's centre line.
      const nameCapDevice = Math.round((ctx.measureText('M').actualBoundingBoxAscent || 12) * scaleY);
      nameBaseline = fromDevice(Math.round((pillTopDevice + pillBottomDevice + nameCapDevice) / 2));
    }
    ctx.fillText(card.displayName.toUpperCase(), x + card.nameX, nameBaseline);

    ctx.fillStyle = surface.inkMuted;
    ctx.font = `500 11px ${surface.fontUi}`;
    let textY = y + card.bodyBaseline;
    for (const line of card.lines) {
      ctx.fillText(line, x + card.textLeft, textY);
      textY += card.lineStep;
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
      const photoW = card.photoWidth;
      const crop = window.CanalRecallCards.coverCrop(
        image.naturalWidth, image.naturalHeight, photoW, card.height);
      ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, x, y, photoW, card.height);
      // Fade inside the photo into the cream card — never past the photo edge,
      // and never into a leftover band under the name.
      const fade = 48;
      const shade = ctx.createLinearGradient(x + photoW - fade, 0, x + photoW, 0);
      shade.addColorStop(0, 'rgba(251,248,242,0)');
      shade.addColorStop(1, window.CanalRecallUi.hudSurface.cardSolid);
      ctx.fillStyle = shade;
      ctx.fillRect(x + photoW - fade, y, fade, card.height);
    } else {
      ctx.fillStyle = window.CanalRecallUi.hudSurface.accent;
      ctx.fillRect(x, y, 5, card.height);
    }

    const surface = window.CanalRecallUi.hudSurface;
    const textX = x + card.textLeft;
    ctx.textAlign = 'left';
    ctx.fillStyle = surface.accent;
    ctx.font = `700 11px ${surface.fontPlaque}`;
    ctx.fillText(card.heading.toUpperCase(), textX, y + 27);
    ctx.fillStyle = surface.ink;
    ctx.font = `800 ${card.nameFontSize}px ${surface.fontPlaque}`;
    ctx.fillText(card.name.toUpperCase(), textX, y + 58);
    ctx.fillStyle = surface.inkMuted;
    ctx.font = `500 12px ${surface.fontUi}`;
    ctx.fillText(card.caption, textX, y + 80);
    ctx.restore();

    ctx.strokeStyle = surface.border;
    ctx.lineWidth = 1;
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

    if (!isPitched3d) {
      this._drawTopDownBike(ctx);
      ctx.restore();
      return;
    }

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
    ctx.restore();
  }

  /** Overhead silhouette, facing +X. Tires are seen edge-on; the rider's
   * shoulders and swept handlebars make the front readable at map scale. */
  _drawTopDownBike(ctx) {
    const ink = '#203638';
    const paper = '#FFFCF4';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(19,37,39,.18)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outline the actual silhouette rather than putting a badge over it.
    const stroke = (points, color, width) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    stroke([[-22, 0], [23, 0]], paper, 9);
    stroke([[-22, 0], [-12, 0]], ink, 5);
    stroke([[13, 0], [23, 0]], ink, 5);
    stroke([[-12, 0], [13, 0]], '#B85E45', 4);
    stroke([[-20, 0], [-13, 0]], '#829897', 1);
    stroke([[16, 0], [22, 0]], '#829897', 1);

    const bars = [[10, -10], [14, -8], [14, 8], [10, 10]];
    stroke(bars, paper, 6);
    stroke(bars, ink, 3);

    // Legs flank the frame, with a small rear saddle visible behind the coat.
    stroke([[-10, -3], [-3, -7], [2, -5]], paper, 6);
    stroke([[-10, 3], [-3, 7], [2, 5]], paper, 6);
    stroke([[-10, -3], [-3, -7], [2, -5]], ink, 3.5);
    stroke([[-10, 3], [-3, 7], [2, 5]], ink, 3.5);
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(-9, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Bent arms connect the broad shoulders to the grips.
    for (const side of [-1, 1]) {
      const arm = [[2, side * 5], [6, side * 9], [10, side * 9]];
      stroke(arm, paper, 6);
      stroke(arm, '#187D86', 3.5);
    }
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.quadraticCurveTo(-2, -7, 3, -6);
    ctx.quadraticCurveTo(6, 0, 3, 6);
    ctx.quadraticCurveTo(-2, 7, -8, 3);
    ctx.closePath();
    ctx.fillStyle = '#187D86';
    ctx.strokeStyle = paper;
    ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    stroke([[-5, -2], [0, -3]], '#63B8B8', 1.5);

    // An elongated cream helmet has a clear front, without a yellow dot.
    ctx.beginPath(); ctx.ellipse(7, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = paper; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    stroke([[5, 0], [9, 0]], '#829897', 1.2);
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
