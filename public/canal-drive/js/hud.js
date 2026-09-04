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


  /** Speed and odometer as one string. Lives on the plaque's second line on
   *  every viewport; the desktop used to spend a fifth card on it. */
  tripText(speed, distancePx) {
    const kilometres = distancePx / PIXELS_PER_METER / 1000;
    const kmh = Math.round(Math.abs(speed) / PIXELS_PER_METER * 3.6);
    return `${kmh} km/h · ${kilometres < 10 ? kilometres.toFixed(2) : kilometres.toFixed(1)} km`;
  }

  /** Screen-space heading to the finish, or null when close enough that an
   *  arrow would only point at the player's own feet. The destination card
   *  draws it; there is no separate arrow box any more. */
  finishDirection(playerX, playerY, finishX, finishY, camera) {
    const dx = finishX - playerX;
    const dy = finishY - playerY;
    if (Math.hypot(dx, dy) < FINISH_RADIUS * 2) return null;
    return Math.atan2(dy, dx) - (camera.rotation || 0);
  }

  _font(weight, size, family) {
    return `${weight} ${size}px ${family}`;
  }

  /** Fit `text` into `maxWidth`, trimming with an ellipsis. Clipping cut names
   *  mid-glyph; a trimmed name still reads as a name. */
  _fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  }

  /** Always-on north rose. The north half is the one gold accent on the HUD;
   *  the south half is dim so the needle has a front. */
  drawCompass(ctx, camera) {
    const ui = window.CanalRecallUi;
    const surface = ui.hudSurface;
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
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(angle);
    ctx.fillStyle = surface.accent;
    ctx.beginPath();
    ctx.moveTo(radius + 1, 0);
    ctx.lineTo(-radius * 0.45, -radius * 0.42);
    ctx.lineTo(-radius * 0.18, 0);
    ctx.lineTo(-radius * 0.45, radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.18, 0);
    ctx.lineTo(-radius * 0.45, -radius * 0.42);
    ctx.lineTo(-radius - 1, 0);
    ctx.lineTo(-radius * 0.45, radius * 0.42);
    ctx.closePath();
    ctx.fill();
    // "N" sits on the needle, inside the chip so a round card does not clip it.
    ctx.fillStyle = '#071430';
    ctx.font = this._font(800, Math.max(9, Math.round(size * 0.24)), surface.fontPlaque);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', radius * 0.5, 0);
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

  /** Where you are going: arrow, name, distance, one row. The arrow used to
   *  have a card of its own beside this one, showing the same distance twice. */
  drawDestination(ctx, name, distancePx, expectedNovelty = null, arrowAngle = null) {
    const surface = window.CanalRecallUi.hudSurface;
    const meters = Math.max(0, distancePx / PIXELS_PER_METER);
    const distance = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
    const rect = this._rect('destination', { x: CANVAS_W - 350, y: 15, width: 335, height: 48 });
    this.paperCard(ctx, rect);
    const compact = rect.height < 44;
    const midY = rect.y + rect.height / 2;
    const hasArrow = Number.isFinite(arrowAngle);
    let left = rect.x + 13;
    const right = rect.x + rect.width - 13;

    if (hasArrow) {
      const r = compact ? 10 : 12;
      const acx = left + r;
      ctx.save();
      ctx.translate(acx, midY);
      ctx.rotate(arrowAngle);
      const len = r * 0.95, wid = r * 0.55;
      ctx.fillStyle = surface.arrow;
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(-len * 0.55, -wid);
      ctx.lineTo(-len * 0.25, 0);
      ctx.lineTo(-len * 0.55, wid);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      left = acx + r + 10;
    }

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.font = this._font(700, compact ? 12 : 13, surface.fontMono);
    ctx.fillStyle = surface.accent;
    ctx.fillText(distance, right, midY + 1);
    let distanceLeft = right - ctx.measureText(distance).width;
    if (Number.isFinite(expectedNovelty)) {
      const novelty = `${Math.round(expectedNovelty * 100)}% new  `;
      ctx.font = this._font(500, compact ? 10 : 11, surface.fontUi);
      ctx.fillStyle = surface.inkMuted;
      ctx.fillText(novelty, distanceLeft, midY + 1);
      distanceLeft -= ctx.measureText(novelty).width;
    }
    ctx.textAlign = 'left';
    ctx.font = this._font(700, compact ? 16 : 18, surface.fontPlaque);
    ctx.fillStyle = surface.ink;
    ctx.fillText(this._fit(ctx, (name || '').toUpperCase(), distanceLeft - left - 12), left, midY + 1);
    ctx.restore();
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

  /** The one plaque on the left: where you are, then how you are doing.
   *
   *  This replaces two cards ("RECALL" score + "STREET" name) that sat in a
   *  stack with a kicker label each. The street is the thing you are trying to
   *  learn, so it is the headline; the neighbourhood, speed and odometer are
   *  one quiet line under it; the score is a third. The card is sized to its
   *  text and anchored at the layout's recall slot, so it is never taller than
   *  the recall + location slots the layout reserves for it. */
  drawPlaque(ctx, {
    routeName = '', neighborhood = '', answerHidden = false,
    correct = 0, attempts = 0, points = 0, streak = 0, gamey = true,
    trip = '', feedback = '',
  } = {}) {
    const surface = window.CanalRecallUi.hudSurface;
    const anchor = this._rect('recall', { x: 15, y: 15, width: 310, height: 43 });
    const slot = this._rect('location', null);
    const compact = this.layout?.mode === 'compact';
    const pad = 12;
    const nameSize = compact ? 19 : 21;
    const lineH = compact ? 15 : 16;
    const wanted = pad + nameSize + 4 + lineH + lineH + (feedback ? lineH : 0) + pad - 2;
    const available = slot ? (slot.y + slot.height - anchor.y) : wanted;
    const rect = { x: anchor.x, y: anchor.y, width: anchor.width, height: Math.min(wanted, available) };
    this.paperCard(ctx, rect);

    const left = rect.x + pad + 1;
    const right = rect.x + rect.width - pad - 1;
    const inner = right - left;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // The name is withheld while it is the question; the HUD must never answer
    // it. Ellipsised, so a long street cannot run off a phone screen.
    let y = rect.y + pad + nameSize - 4;
    ctx.font = this._font(800, nameSize, surface.fontPlaque);
    ctx.fillStyle = surface.ink;
    const headline = answerHidden ? '? ? ?' : (routeName || '—');
    ctx.fillText(this._fit(ctx, headline.toUpperCase(), inner), left, y);

    // Where and how fast, on one line. The neighbourhood yields to the trip
    // readout rather than the other way round: the numbers never move.
    y += lineH + 3;
    ctx.font = this._font(600, 11, surface.fontMono);
    ctx.fillStyle = surface.inkMuted;
    let tripWidth = 0;
    if (trip) {
      ctx.textAlign = 'right';
      ctx.fillText(trip, right, y);
      tripWidth = ctx.measureText(trip).width + 12;
      ctx.textAlign = 'left';
    }
    if (neighborhood) {
      ctx.font = this._font(500, 12, surface.fontUi);
      ctx.fillText(this._fit(ctx, neighborhood, inner - tripWidth), left, y);
    }

    // Score line. A streak, when there is one, takes the right-hand slot in
    // gold; it is the only number on the plaque that is allowed to shout.
    y += lineH;
    ctx.font = this._font(700, 12, surface.fontMono);
    ctx.fillStyle = surface.ink;
    const tally = gamey ? `${correct} / ${attempts}  ·  ${points} pts` : `${correct} / ${attempts}`;
    ctx.fillText(tally, left, y);
    if (gamey && streak >= 2) {
      const mult = (1 + 0.1 * Math.min(streak - 1, 9)).toFixed(1);
      ctx.textAlign = 'right';
      ctx.fillStyle = surface.accent;
      ctx.font = this._font(700, 11, surface.fontMono);
      ctx.fillText(`${streak} streak · ${mult}×`, right, y);
      ctx.textAlign = 'left';
    }

    if (feedback) {
      y += lineH;
      ctx.font = this._font(500, 12, surface.fontUi);
      ctx.fillStyle = surface.inkMuted;
      ctx.fillText(this._fit(ctx, feedback, inner), left, y);
    }
    ctx.restore();
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
    const theme = window.CanalRecallUi.hudSurface;
    const pad = layout.dpad;
    const text = 'steer with the pad — it drives itself';
    ctx.save();
    ctx.font = `500 12px ${theme.fontUi}`;
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
