// ============================================================
// HUD
// ============================================================
class HUD {
  constructor() {
    this._minimapCache = null;
    this._minimapTrack = null;
    this._time = 0; // game time in seconds, updated each frame
  }

  setTime(t) { this._time = t; }

  drawSpeedometer(ctx, speed, maxSpeed) {
    const cx = CANVAS_W - 100, cy = CANVAS_H - 90, r = 55;
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // arc
    const startA = Math.PI * 0.8, endA = Math.PI * 2.2;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, startA, endA);
    ctx.stroke();

    // colored arc
    const speedRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.6, '#FFC107');
    grad.addColorStop(1, '#F44336');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, startA, startA + (endA - startA) * speedRatio);
    ctx.stroke();

    // needle
    const needleAngle = startA + (endA - startA) * speedRatio;
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 12), cy + Math.sin(needleAngle) * (r - 12));
    ctx.stroke();

    // center dot
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI*2);
    ctx.fill();

    // Convert game pixels/s back through the geographic world scale.
    const kph = Math.round(Math.abs(speed) / PIXELS_PER_METER * 3.6);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(kph + '', cx, cy + 22);
    ctx.font = '10px monospace';
    ctx.fillText('km/h', cx, cy + 34);

    // tick marks
    for (let i = 0; i <= 6; i++) {
      const a = startA + (endA - startA) * (i / 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
      ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.stroke();
    }
  }

  drawOdometer(ctx, distancePx) {
    // Convert pixels → metres → kilometres
    const meters = distancePx / PIXELS_PER_METER;
    const kilometres = meters / 1000;
    const label = kilometres >= 10 ? kilometres.toFixed(1) : kilometres.toFixed(2);
    const cx = CANVAS_W - 100, y = CANVAS_H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, cx - 45, y - 10, 90, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#CCC';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label + ' km', cx, y + 2);
  }

  drawFinishDirection(ctx, playerX, playerY, finishX, finishY, camera) {
    const dx = finishX - playerX;
    const dy = finishY - playerY;
    const distWorld = Math.sqrt(dx * dx + dy * dy);
    if (distWorld < FINISH_RADIUS * 2) return; // close enough, hide arrow

    const angle = Math.atan2(dy, dx) - (camera.rotation || 0);

    // Position: to the left of the timer (timer is at CANVAS_W/2, y=10..60)
    const boxX = CANVAS_W / 2 - 170;
    const boxY = 10;
    const boxW = 60;
    const boxH = 50;

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fill();

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
    ctx.fillStyle = `rgba(255,215,0,${alpha * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen + 3, 0);
    ctx.lineTo(-arrowLen / 2 - 1, -arrowW - 3);
    ctx.lineTo(-arrowLen / 4 - 1, 0);
    ctx.lineTo(-arrowLen / 2 - 1, arrowW + 3);
    ctx.closePath();
    ctx.fill();

    // Main arrow
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen, 0);
    ctx.lineTo(-arrowLen / 2, -arrowW);
    ctx.lineTo(-arrowLen / 4, 0);
    ctx.lineTo(-arrowLen / 2, arrowW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
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
    ctx.fillStyle = '#FFD700';
    ctx.fillText(distLabel, acx, boxY + 43);
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

  drawDestination(ctx, name, distancePx) {
    const meters = Math.max(0, distancePx / PIXELS_PER_METER);
    const distance = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
    ctx.fillStyle = 'rgba(3,18,28,0.82)';
    roundRect(ctx, CANVAS_W - 350, 15, 335, 42, 8);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`DESTINATION: ${name}`, CANVAS_W - 28, 34);
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(distance, CANVAS_W - 28, 49);
  }

  drawPoliceWarning(ctx, policeCars, playerX, playerY) {
    // Find nearest chasing police
    let nearestDist = Infinity;
    let anyChasing = false;
    for (const cop of policeCars) {
      if (!cop.isChasing) continue;
      anyChasing = true;
      const dx = cop.x - playerX, dy = cop.y - playerY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) nearestDist = d;
    }
    if (!anyChasing) return;

    // Warning level based on distance
    const dangerDist = 300;
    if (nearestDist > 1200) return; // too far, no warning

    const danger = clamp(1 - nearestDist / dangerDist, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 6.67);

    // Screen edge flash when close
    if (danger > 0.3) {
      const flash = Math.floor(this._time * 5) % 2;
      const edgeAlpha = danger * 0.2 * pulse;
      ctx.fillStyle = flash === 0
        ? `rgba(33,150,243,${edgeAlpha})`
        : `rgba(244,67,54,${edgeAlpha})`;
      // Top edge strip
      ctx.fillRect(0, 0, CANVAS_W, 4);
      ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
      ctx.fillRect(0, 0, 4, CANVAS_H);
      ctx.fillRect(CANVAS_W - 4, 0, 4, CANVAS_H);
    }

    // Warning text
    const warnX = CANVAS_W / 2;
    const warnY = 75;
    const alpha = 0.5 + pulse * 0.5;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    if (nearestDist < 150) {
      ctx.fillStyle = `rgba(244,67,54,${alpha})`;
      ctx.fillText('⚠ POLICE ON YOUR TAIL! ⚠', warnX, warnY);
    } else if (nearestDist < 500) {
      ctx.fillStyle = `rgba(255,193,7,${alpha})`;
      ctx.fillText('⚠ POLICE APPROACHING', warnX, warnY);
    } else {
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.fillText('POLICE ALERT', warnX, warnY);
    }
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

  drawCanalScore(ctx, correct, attempts, points, feedback, streak = 0) {
    const hasStreak = streak >= 2;
    ctx.fillStyle = 'rgba(3,18,28,0.82)';
    roundRect(ctx, 15, 15, 310, feedback ? 58 : 38, 8);
    ctx.fill();
    ctx.fillStyle = '#7DD3FC';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`CANAL RECALL   ${correct} / ${attempts}   ${points} pts`, 28, 40);
    if (hasStreak) {
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      const mult = (1 + 0.1 * Math.min(streak - 1, 9)).toFixed(1);
      ctx.fillText(`${streak} STREAK  ${mult}×`, 318, 40);
      ctx.textAlign = 'left';
    }
    if (feedback) {
      ctx.fillStyle = '#E0F2FE';
      ctx.font = '12px monospace';
      ctx.fillText(feedback, 28, 61);
    }
  }

  drawCurrentLocation(ctx, routeName, neighborhood, travelMode, answerHidden = false) {
    const routeLabel = travelMode === 'car' ? 'STREET' : 'WATERWAY';
    ctx.fillStyle = 'rgba(3,18,28,0.82)';
    roundRect(ctx, 15, 82, 310, neighborhood ? 51 : 33, 7);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(`${routeLabel}: ${answerHidden ? '???' : (routeName || '—')}`, 28, 103);
    if (neighborhood) {
      ctx.fillStyle = '#E0F2FE';
      ctx.fillText(`NEIGHBORHOOD: ${neighborhood}`, 28, 122);
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

  drawTimer(ctx, raceTime, bestLap, isOpenTrack) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W/2 - 100, 10, 200, 50, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', CANVAS_W/2, 28);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(this.formatTime(raceTime), CANVAS_W/2, 48);
    if (!isOpenTrack && bestLap < Infinity) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('BEST ' + this.formatTime(bestLap), CANVAS_W/2, 58);
    }
  }

  formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }

  drawMiniMap(ctx, track, cars, playerIdx) {
    const mapW = 180, mapH = 140;
    const mx = 15, my = CANVAS_H - mapH - 15;
    const player = cars[playerIdx];
    if (!player) return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, mx, my, mapW, mapH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Local navigation view: about 450 m across at the current 3 px/m world
    // scale, centered on the player instead of fitting all of Amsterdam.
    const scale = 0.13;
    const ox = mx + mapW / 2 - player.x * scale;
    const oy = my + mapH / 2 - player.y * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx + 5, my + 5, mapW - 10, mapH - 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    for (const segment of track.segments || []) {
      if (!segment.points || segment.points.length < 2) continue;
      const b = segment.bounds;
      const rangeX = mapW / (2 * scale), rangeY = mapH / (2 * scale);
      if (b && (b.maxX < player.x - rangeX || b.minX > player.x + rangeX || b.maxY < player.y - rangeY || b.minY > player.y + rangeY)) continue;
      ctx.beginPath();
      ctx.moveTo(segment.points[0].x * scale + ox, segment.points[0].y * scale + oy);
      for (let i = 1; i < segment.points.length; i++) ctx.lineTo(segment.points[i].x * scale + ox, segment.points[i].y * scale + oy);
      ctx.stroke();
    }
    const finish = track.finishPoint;
    const finishX = finish.x * scale + ox, finishY = finish.y * scale + oy;
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(finishX, finishY, 5, 0, Math.PI * 2);
    ctx.fill();

    // car dots (dynamic — drawn every frame)
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const sx = car.x * scale + ox, sy = car.y * scale + oy;

      if (car instanceof PoliceCar) {
        // Police: flashing blue/red dot
        const flash = Math.floor(this._time * 3.33) % 2;
        ctx.fillStyle = flash === 0 ? '#2196F3' : '#F44336';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Radar range on minimap
        const radarMini = car.radarRadius * scale;
        ctx.beginPath();
        ctx.arc(sx, sy, radarMini, 0, Math.PI * 2);
        ctx.strokeStyle = flash === 0 ? 'rgba(33,150,243,0.4)' : 'rgba(244,67,54,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (car instanceof TrafficCar) {
        // Traffic: small grey dot
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.arc(sx, sy, i === playerIdx ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (i === playerIdx) {
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
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

  drawWarningCounter(ctx, warnings, maxWarnings) {
    const x = CANVAS_W - 160, y = 62, w = 145, h = 35;
    const danger = warnings >= maxWarnings - 1 && warnings < maxWarnings;

    // Pulsing red glow when one away from busted
    if (danger) {
      const pulse = 0.5 + 0.5 * Math.sin(this._time * 6);
      ctx.fillStyle = `rgba(200,30,30,${0.3 + pulse * 0.3})`;
      roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 8);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Label
    ctx.fillStyle = danger ? '#F44336' : '#AAA';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('WARNINGS', x + 8, y + h / 2 + 3);

    // Strike circles
    const startX = x + 80;
    const iconY = y + h / 2;
    for (let i = 0; i < maxWarnings; i++) {
      const ix = startX + i * 22;
      if (i < warnings) {
        // Filled red circle with X — warning issued
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(ix, iconY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ix - 4, iconY - 4);
        ctx.lineTo(ix + 4, iconY + 4);
        ctx.moveTo(ix + 4, iconY - 4);
        ctx.lineTo(ix - 4, iconY + 4);
        ctx.stroke();
      } else {
        // Empty outline — no warning yet
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iconY, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawWarningPopup(ctx, timer, maxDuration) {
    const alpha = clamp(timer / (maxDuration * 0.5), 0, 1);
    const flash = Math.floor(this._time * 5) % 2;
    const scale = 1 + (1 - alpha) * 0.1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 50);
    ctx.scale(scale, scale);

    // Flashing red/blue background panel
    ctx.fillStyle = flash === 0
      ? 'rgba(33,80,200,0.6)'
      : 'rgba(200,30,30,0.6)';
    roundRect(ctx, -180, -35, 360, 70, 12);
    ctx.fill();

    // "WARNING!" text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WARNING!', 0, 0);

    ctx.restore();

    // Red vignette — screen-edge flash when a new warning fires
    const vigAlpha = clamp(timer / maxDuration, 0, 1) * 0.4;
    const vigGrad = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
    );
    vigGrad.addColorStop(0, 'rgba(200,30,30,0)');
    vigGrad.addColorStop(1, `rgba(200,30,30,${vigAlpha})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.globalAlpha = 1;
  }

  drawTouchHint(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25;

    // Left half — steer zone
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(0, 0, CANVAS_W / 2, CANVAS_H);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STEER', CANVAS_W / 4, CANVAS_H / 2);
    ctx.font = '11px monospace';
    ctx.fillText('< left | right >', CANVAS_W / 4, CANVAS_H / 2 + 20);

    // Right half top — brake zone
    ctx.fillStyle = '#F44336';
    ctx.fillRect(CANVAS_W / 2, 0, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('BRAKE', CANVAS_W * 3 / 4, CANVAS_H / 4);

    // Right half bottom — gas zone
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('GAS', CANVAS_W * 3 / 4, CANVAS_H * 3 / 4);
    ctx.font = '11px monospace';
    ctx.fillText('double-tap: drift', CANVAS_W * 3 / 4, CANVAS_H * 3 / 4 + 20);

    ctx.restore();
  }
}
