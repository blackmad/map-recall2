// ============================================================
// LOADING SCREEN
// ============================================================
// Daylight paper, like the route setup it follows: the old black-and-gold
// arcade screen flashed between two light surfaces on every route start.
class LoadingScreen {
  draw(ctx, message, progress) {
    const surface = window.CanalRecallUi?.hudSurface;
    const ink = surface?.ink || '#1f1c17';
    const muted = surface?.inkMuted || '#5f584d';
    const plaque = surface?.fontPlaque || '"Barlow Condensed", sans-serif';
    const ui = surface?.fontUi || 'system-ui, sans-serif';
    ctx.fillStyle = '#f4efe5';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = ink;
    ctx.font = `800 30px ${plaque}`;
    ctx.textAlign = 'center';
    ctx.fillText((message || 'Loading…').toUpperCase(), CANVAS_W / 2, CANVAS_H / 2 - 32);

    const barW = Math.min(400, CANVAS_W - 64), barH = 6;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = CANVAS_H / 2;
    ctx.fillStyle = 'rgba(31,28,23,0.1)';
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();

    const pct = clamp(progress || 0, 0, 1);
    if (pct > 0) {
      ctx.fillStyle = '#b4682c';
      roundRect(ctx, barX, barY, Math.max(barW * pct, barH), barH, 3);
      ctx.fill();
    }

    ctx.fillStyle = muted;
    ctx.font = `13px ${ui}`;
    ctx.fillText('Map data © OpenStreetMap contributors', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }
}
