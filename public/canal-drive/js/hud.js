// ============================================================
// HUD
// ============================================================
class HUD {
  constructor() {
    this._minimapCache = null;
    this._minimapTrack = null;
    this._time = 0; // game time in seconds, updated each frame
    // Placed by hudLayout once per frame; see setLayout. Every card reads its
    // rectangle from here rather than carrying constants written for 1280x720.
    this.layout = null;
  }

  setTime(t) { this._time = t; }

  /** The frame's HUD geometry, from the typed layout module. */
  setLayout(layout) { this.layout = layout; }

  _rect(name, fallback) { return this.layout?.[name] ?? fallback; }

  // One paper card, drawn the same way everywhere. The HUD used to hand-roll a
  // fill, a stroke and a radius per card, which is how it ended up with four
  // slightly different creams and three different corner radii.
  paperCard(ctx, rect, { solid = false, radius = 12 } = {}) {
    const theme = window.CanalRecallUi.hudSurface;
    ctx.save();
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = solid ? theme.cardSolid : theme.card;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
    ctx.stroke();
  }


  /** Speed and odometer. On a phone this is folded into the score row, where
   *  there is width going spare, rather than taking a card of its own. */
  tripText(speed, distancePx) {
    const kilometres = distancePx / PIXELS_PER_METER / 1000;
    const kmh = Math.round(Math.abs(speed) / PIXELS_PER_METER * 3.6);
    return `${kmh} km/h   ${kilometres < 10 ? kilometres.toFixed(2) : kilometres.toFixed(1)} km`;
  }

  drawTripReadout(ctx, speed, distancePx) {
    if (this.layout?.tripInRecall) return; // drawn inside the score row instead
    const theme = window.CanalRecallUi.paperTheme;
    const text = this.tripText(speed, distancePx);
    ctx.font = 'bold 12px monospace';
    const w = ctx.measureText(text).width + 22;
    const fallback = { x: CANVAS_W - w - 16, y: CANVAS_H - 98, width: w, height: 26 };
    const rect = { ...this._rect('trip', fallback), width: w };
    this.paperCard(ctx, rect, { radius: 9 });
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'left';
    ctx.fillText(text, rect.x + 11, rect.y + 17);
  }

  drawFinishDirection(ctx, playerX, playerY, finishX, finishY, camera) {
    const dx = finishX - playerX;
    const dy = finishY - playerY;
    const distWorld = Math.sqrt(dx * dx + dy * dy);
    if (distWorld < FINISH_RADIUS * 2) return; // close enough, hide arrow

    const angle = Math.atan2(dy, dx) - (camera.rotation || 0);

    // The arrow used to sit at a hardcoded (CANVAS_W/2 - 170, 10), which on a
    // phone put it straight on top of the recall card. It follows the layout
    // now: beside the destination on desktop, below the top stack on a phone.
    const boxW = 60;
    const boxH = 50;
    const destination = this.layout?.destination;
    const compact = this.layout?.mode === 'compact';
    const boxX = compact
      ? CANVAS_W - boxW - 12
      : (destination ? destination.x - boxW - 12 : CANVAS_W / 2 - 170);
    const boxY = compact
      ? (destination ? destination.y + destination.height + 10 : 10)
      : 10;
    this.paperCard(ctx, { x: boxX, y: boxY, width: boxW, height: boxH }, { radius: 10 });

    // Arrow in center of panel
    const acx = boxX + boxW / 2;
    const acy = boxY + 22;

    ctx.save();
    ctx.translate(acx, acy);
    ctx.rotate(angle);

    const arrowLen = 14;
    const arrowW = 7;

    // Pulsating glow (use raceTime passed via game loop)
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 3.33);
    const alpha = 0.6 + pulse * 0.4;

    // Outer glow
    ctx.fillStyle = `rgba(199,95,67,${alpha * 0.28})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen + 3, 0);
    ctx.lineTo(-arrowLen / 2 - 1, -arrowW - 3);
    ctx.lineTo(-arrowLen / 4 - 1, 0);
    ctx.lineTo(-arrowLen / 2 - 1, arrowW + 3);
    ctx.closePath();
    ctx.fill();

    // Main arrow
    ctx.fillStyle = `rgba(199,95,67,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen, 0);
    ctx.lineTo(-arrowLen / 2, -arrowW);
    ctx.lineTo(-arrowLen / 4, 0);
    ctx.lineTo(-arrowLen / 2, arrowW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,253,248,${alpha * 0.8})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Distance label below arrow
    const meters = distWorld / PIXELS_PER_METER;
    let distLabel;
    if (meters >= 1609.344) {
      distLabel = (meters / 1609.344).toFixed(1) + ' mi';
    } else {
      distLabel = Math.round(meters) + ' m';
    }
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = window.CanalRecallUi.paperTheme.ink;
    ctx.fillText(distLabel, acx, boxY + 43);
  }

  /** Always-on north rose. Quiet moss needle — not the terracotta finish arrow. */
  drawCompass(ctx, camera) {
    const ui = window.CanalRecallUi;
    const size = this.layout?.mode === 'compact'
      ? (ui.COMPASS_SIZE_COMPACT || 40)
      : (ui.COMPASS_SIZE_DESKTOP || 44);
    const fallback = { x: 15, y: CANVAS_H - 215 - 8 - size, width: size, height: size };
    const rect = this._rect('compass', fallback);
    this.paperCard(ctx, rect, { radius: Math.round(size / 2) });

    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const radius = rect.width * 0.32;
    const angle = typeof ui.northScreenAngle === 'function'
      ? ui.northScreenAngle(camera.rotation || 0)
      : (-Math.PI / 2 - (camera.rotation || 0));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(97,89,74,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(angle);
    ctx.fillStyle = ui.paperTheme.moss;
    ctx.beginPath();
    ctx.moveTo(radius + 1, 0);
    ctx.lineTo(-radius * 0.45, -radius * 0.42);
    ctx.lineTo(-radius * 0.18, 0);
    ctx.lineTo(-radius * 0.45, radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(104,116,110,0.55)';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.18, 0);
    ctx.lineTo(-radius * 0.45, -radius * 0.42);
    ctx.lineTo(-radius - 1, 0);
    ctx.lineTo(-radius * 0.45, radius * 0.42);
    ctx.closePath();
    ctx.fill();
    // "N" sits on the needle, inside the chip so a round card does not clip it.
    ctx.fillStyle = ui.paperTheme.mossDark;
    ctx.font = `bold ${Math.max(9, Math.round(size * 0.26))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', radius * 0.55, 0);
    ctx.restore();
  }

  drawRouteLine(ctx, player, finish, camera, routePath) {
    const start = camera.worldToScreen(player.x, player.y);
    const end = camera.worldToScreen(finish.x, finish.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(56,189,248,0.82)';
    ctx.lineWidth = 7;
    ctx.setLineDash([18, 12]);
    ctx.beginPath();
    if (routePath && routePath.length > 1) {
      const first = camera.worldToScreen(routePath[0].x, routePath[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < routePath.length; i++) {
        const point = camera.worldToScreen(routePath[i].x, routePath[i].y);
        ctx.lineTo(point.x, point.y);
      }
    } else {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDestination(ctx, name, distancePx, expectedNovelty = null) {
    const theme = window.CanalRecallUi.paperTheme;
    const meters = Math.max(0, distancePx / PIXELS_PER_METER);
    const distance = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
    const rect = this._rect('destination', { x: CANVAS_W - 350, y: 15, width: 335, height: 48 });
    this.paperCard(ctx, rect);
    const left = rect.x + 13;
    const right = rect.x + rect.width - 13;
    const compact = rect.height < 44;
    const novelty = Number.isFinite(expectedNovelty)
      ? ` · ${Math.round(expectedNovelty * 100)}% NEW` : '';
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
    ctx.clip();
    if (compact) {
      // Phone: one row — label, name, distance — instead of a stacked card.
      ctx.textAlign = 'left';
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = theme.moss;
      ctx.fillText(`TO${novelty}`, left, rect.y + 14);
      ctx.fillStyle = theme.ink;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(name, left, rect.y + 29);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.terracotta;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(distance, right, rect.y + 29);
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.moss;
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`DESTINATION${novelty}`, right, rect.y + 15);
      ctx.fillStyle = theme.ink;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(name, right - 54, rect.y + 34);
      ctx.fillStyle = theme.terracotta;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(distance, right, rect.y + 34);
    }
    ctx.restore();
    ctx.textAlign = 'left';
  }

  drawStreetName(ctx, name) {
    if (!name) return;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(name).width;
    const pw = tw + 20, ph = 24;
    const x = CANVAS_W / 2, y = CANVAS_H - 55;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - pw / 2, y - ph / 2, pw, ph, 5);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillText(name, x, y + 1);
  }

  drawCanalScore(ctx, correct, attempts, points, feedback, streak = 0, gamey = true, trip = '') {
    const theme = window.CanalRecallUi.paperTheme;
    const hasStreak = gamey && streak >= 2;
    const rect = this._rect('recall', { x: 15, y: 15, width: 310, height: feedback ? 62 : 43 });
    this.paperCard(ctx, rect);
    const left = rect.x + 13;
    const right = rect.x + rect.width - 13;
    ctx.fillStyle = theme.terracotta;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RECALL', left, rect.y + 16);
    ctx.fillStyle = theme.ink;
    ctx.font = 'bold 14px monospace';
    const tally = gamey ? `${correct} / ${attempts}   ${points} pts` : `${correct} / ${attempts}`;
    ctx.fillText(tally, left, rect.y + 34);
    ctx.textAlign = 'right';
    // The phone folds speed and distance in here; a streak, when there is one,
    // is the more interesting number and takes the slot.
    if (hasStreak) {
      ctx.fillStyle = theme.terracotta;
      ctx.font = 'bold 13px monospace';
      const mult = (1 + 0.1 * Math.min(streak - 1, 9)).toFixed(1);
      ctx.fillText(`${streak} STREAK  ${mult}x`, right, rect.y + 33);
    } else if (trip) {
      ctx.fillStyle = theme.inkMuted;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(trip, right, rect.y + 33);
    }
    ctx.textAlign = 'left';
    if (feedback) {
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '12px monospace';
      ctx.fillText(feedback, left, rect.y + rect.height - 8);
    }
  }

  drawCurrentLocation(ctx, routeName, neighborhood, travelMode, answerHidden = false) {
    const theme = window.CanalRecallUi.paperTheme;
    const routeLabel = travelMode === 'car' ? 'STREET' : 'WATERWAY';
    const rect = this._rect('location', { x: 15, y: 84, width: 310, height: neighborhood ? 55 : 38 });
    this.paperCard(ctx, rect);
    const left = rect.x + 13;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = theme.moss;
    ctx.fillText(routeLabel, left, rect.y + 16);
    ctx.fillStyle = theme.ink;
    ctx.font = 'bold 13px monospace';
    // The name is withheld while it is the question; the HUD must never answer
    // it. Clipped to the card so a long street cannot run off a phone screen.
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
    ctx.clip();
    ctx.fillText(answerHidden ? '???' : (routeName || '-'), left, rect.y + 33);
    ctx.restore();
    if (neighborhood) {
      ctx.fillStyle = theme.inkMuted;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(neighborhood.toUpperCase(), rect.x + rect.width - 13, rect.y + 16);
      ctx.textAlign = 'left';
    }
  }

  drawLapCounter(ctx, currentLap, totalLaps) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 15, 145, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`LAP  ${Math.min(currentLap + 1, totalLaps)} / ${totalLaps}`, CANVAS_W - 25, 42);
  }

  // Progress bar for point-to-point mode
  drawProgressBar(ctx, raceProgress) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 15, 145, 40, 6);
    ctx.fill();

    // Bar background
    const barX = CANVAS_W - 150, barY = 25, barW = 125, barH = 8;
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    // Bar fill
    const pct = clamp(raceProgress, 0, 1);
    if (pct > 0) {
      ctx.fillStyle = '#FFD700';
      roundRect(ctx, barX, barY, Math.max(barW * pct, 8), barH, 4);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(pct * 100)}% COMPLETE`, CANVAS_W - 25, 50);
  }

  drawPosition(ctx, position, total) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 62, 145, 40, 6);
    ctx.fill();
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
    const colors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
    ctx.fillStyle = colors[position] || '#FFF';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${position}${suffix}`, CANVAS_W - 60, 90);
    ctx.fillStyle = '#AAA';
    ctx.font = '14px monospace';
    ctx.fillText(`/ ${total}`, CANVAS_W - 25, 90);
  }


  formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }

  // A city-scale overview, not a 450 m scrap. The old minimap drew about 450 m
  // of network centred on the vehicle, with canals and streets as the same thin
  // white line; at that scale every part of Amsterdam looks like every other
  // part. The framing here is fixed to the city, so the same place sits in the
  // same spot on every trip and the map becomes something you learn rather than
  // something you re-read. Static layers are cached per route and blitted.
  //
  // It draws no names: the street or canal under question must never be
  // revealed by the map before it has been answered.
  drawCityOverview(ctx, game) {
    const overview = window.CanalRecallOverview;
    if (!overview || !game.track) return;
    const rect = this._rect('minimap', { x: MINIMAP_X, y: CANVAS_H - MINIMAP_H - 15, width: MINIMAP_W, height: MINIMAP_H });

    // The cache is keyed on the rectangle as well as the track: rotating a
    // phone changes the overview from 260x200 to 124x96, and a cache keyed on
    // the track alone would blit the old size into the new box.
    const cacheKey = `${rect.width}x${rect.height}`;
    if (this._overviewTrack !== game.track || this._overviewKey !== cacheKey || !this._overviewCache) {
      const built = overview.buildOverview({
        areaRings: (game.neighborhoods || []).flatMap(hood => hood.rings || []),
        networkSegments: (game.track.segments || []).map(segment => segment.points || []),
        route: game.routePath || [],
        start: game.track.startPoint || null,
        finish: game.track.finishPoint || null,
      }, { x: 0, y: 0, width: rect.width, height: rect.height });
      if (!built) return;
      const cache = document.createElement('canvas');
      cache.width = rect.width;
      cache.height = rect.height;
      overview.drawOverviewStatic(cache.getContext('2d'), built.layers, built.projection);
      this._overviewCache = cache;
      this._overviewBuilt = built;
      this._overviewTrack = game.track;
      this._overviewKey = cacheKey;
    }

    const built = this._overviewBuilt;
    ctx.save();
    ctx.fillStyle = overview.OVERVIEW_COLORS.background;
    roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 8);
    ctx.fill();
    ctx.strokeStyle = overview.OVERVIEW_COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(this._overviewCache, rect.x, rect.y);
    ctx.translate(rect.x, rect.y);
    overview.drawOverviewDynamic(ctx, built.layers, game.player, built.projection);
    ctx.restore();
  }

  _buildMinimapCache(track, mapW, mapH, scale, ox, oy, mx, my) {
    const cache = document.createElement('canvas');
    cache.width = mapW;
    cache.height = mapH;
    const c = cache.getContext('2d');
    // Offset so world coords map to cache-local coords
    const localOx = ox - mx;
    const localOy = oy - my;

    if (track.isOpenTrack && track.segments) {
      // Road network: draw all road segments
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.5;
      for (const seg of track.segments) {
        if (seg.points.length < 2) continue;
        c.beginPath();
        c.moveTo(seg.points[0].x * scale + localOx, seg.points[0].y * scale + localOy);
        for (let i = 1; i < seg.points.length; i++) {
          c.lineTo(seg.points[i].x * scale + localOx, seg.points[i].y * scale + localOy);
        }
        c.stroke();
      }

      // Start marker (green with "S" label)
      const sp = track.startPoint;
      const spx = sp.x * scale + localOx;
      const spy = sp.y * scale + localOy;
      c.fillStyle = '#4CAF50';
      c.beginPath();
      c.arc(spx, spy, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#FFF';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#FFF';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('S', spx, spy);

      // Finish marker (gold flag with "F" label)
      const fp = track.finishPoint;
      const fpx = fp.x * scale + localOx;
      const fpy = fp.y * scale + localOy;
      // Outer glow
      c.fillStyle = 'rgba(255,215,0,0.3)';
      c.beginPath();
      c.arc(fpx, fpy, 9, 0, Math.PI * 2);
      c.fill();
      // Main circle
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.arc(fpx, fpy, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#FFF';
      c.lineWidth = 1.5;
      c.stroke();
      // "F" label
      c.fillStyle = '#000';
      c.font = 'bold 8px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('F', fpx, fpy);
      // Flag pole + pennant
      c.strokeStyle = '#FFD700';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(fpx, fpy - 6);
      c.lineTo(fpx, fpy - 16);
      c.stroke();
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.moveTo(fpx, fpy - 16);
      c.lineTo(fpx + 7, fpy - 13);
      c.lineTo(fpx, fpy - 10);
      c.closePath();
      c.fill();
    } else {
      // Circuit: draw track outline
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i += 5) {
        const p = track.points[i];
        const sx = p.x * scale + localOx, sy = p.y * scale + localOy;
        if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
      }
      c.closePath();
      c.stroke();
    }

    return cache;
  }


  // The hint used to paint the whole screen in three translucent slabs
  // labelled STEER / BRAKE / GAS, because the controls were invisible and had
  // to be explained. The pad is visible now, so this is one line that fades.
  drawTouchHint(ctx) {
    const layout = this.layout;
    if (!layout?.dpad) return;
    const theme = window.CanalRecallUi.paperTheme;
    const pad = layout.dpad;
    const text = 'steer with the pad — it drives itself';
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const width = Math.min(ctx.measureText(text).width + 22, CANVAS_W - 16);
    // Clamped on screen: in landscape the pad sits at the left edge, and a hint
    // centred on it started at x = -62.
    const x = Math.max(8, Math.min(pad.cx - width / 2, CANVAS_W - width - 8));
    const rect = { x, y: pad.bounds.y - 30, width, height: 22 };
    this.paperCard(ctx, rect, { radius: 9 });
    ctx.fillStyle = theme.inkMuted;
    ctx.fillText(text, x + width / 2, rect.y + 15);
    ctx.restore();
  }

  // The d-pad. Drawn as one ring with four arrows so it reads as a control
  // rather than four loose buttons, and kept translucent so the corridor it
  // sits over stays visible.
  drawDpad(ctx, pressed) {
    const layout = this.layout;
    if (!layout?.dpad) return;
    const surface = window.CanalRecallUi.hudSurface;
    const pad = layout.dpad;
    const { cx, cy, cell } = pad;
    const radius = pad.bounds.width / 2;

    ctx.save();
    ctx.shadowColor = surface.shadow;
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = surface.control;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = surface.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    const arrows = [
      { key: 'ArrowUp', dx: 0, dy: -1, rotation: -Math.PI / 2 },
      { key: 'ArrowDown', dx: 0, dy: 1, rotation: Math.PI / 2 },
      { key: 'ArrowLeft', dx: -1, dy: 0, rotation: Math.PI },
      { key: 'ArrowRight', dx: 1, dy: 0, rotation: 0 },
    ];
    for (const arrow of arrows) {
      const active = !!pressed?.[arrow.key];
      const ax = cx + arrow.dx * cell;
      const ay = cy + arrow.dy * cell;
      if (active) {
        ctx.fillStyle = surface.controlPressed;
        ctx.beginPath();
        ctx.arc(ax, ay, cell * 0.46, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(arrow.rotation);
      ctx.fillStyle = active ? '#fffdf8' : surface.controlInk;
      const size = cell * 0.26;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.72, -size * 0.86);
      ctx.lineTo(-size * 0.72, size * 0.86);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // A hub, so the dead centre reads as deliberately dead.
    ctx.fillStyle = surface.border;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}
