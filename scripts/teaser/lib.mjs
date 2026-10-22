// Shared helpers for the teaser capture: launch Chrome, boot a ride from a
// share link, drive it with scripted input through the game's own physics,
// answer questions with real key presses, and record the page with a CDP
// screencast (JPEG frames + timestamps, assembled to constant-rate video).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const PORT = process.env.PW_PORT || '4472';
export const BASE = process.env.TEASER_BASE || `http://127.0.0.1:${PORT}`;
const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch({ headless = process.env.TEASER_HEADED !== '1' } = {}) {
  return chromium.launch({
    headless,
    executablePath: existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--hide-scrollbars'],
  });
}

export async function newPage(browser, { width = 1920, height = 1080, mobile = false, dpr = 3 } = {}) {
  const context = await browser.newContext(mobile
    ? { viewport: { width, height }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
    : { viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  return page;
}

/**
 * Boot a ride from a share link (`#race=centre,start,finish`), which skips the
 * menu, and wait until the player rides. `intro` forces the overview flight.
 */
export async function bootRide(page, { start, finish, travel = 'car', view = 'chase', intro = false, waitIntro = true, query = '' }) {
  const centre = [(start[0] + finish[0]) / 2, (start[1] + finish[1]) / 2];
  await page.addInitScript(({ intro, view }) => {
    if (intro) window.__canalRecallForceIntro = true;
    try {
      // First-run onboarding and what's-new would cover the ride.
      localStorage.setItem('canalRecall.onboarding.v1', 'done');
    } catch {}
    window.__teaserView = view;
  }, { intro, view });
  const hash = [...centre, ...start, ...finish].map(n => n.toFixed(5)).join(',');
  const q = new URLSearchParams(query);
  if (travel !== 'car') q.set('travel', travel);
  const qs = q.toString() ? `?${q}` : '';
  await page.goto(`${BASE}/canal-drive/${qs}#race=${hash}`);
  await page.waitForFunction(() => window.canalRecallGame?.player?.x, null, { timeout: 180_000 });
  if (view) {
    await page.evaluate((view) => {
      const sel = document.getElementById('view-mode');
      if (sel && sel.value !== view) { sel.value = view; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, view);
  }
  if (intro && waitIntro) {
    await page.waitForFunction(() => !!window.canalRecallGame._intro, null, { timeout: 60_000, polling: 'raf' }).catch(() => {});
  }
}

export async function waitRacing(page, timeout = 120_000) {
  await page.waitForFunction(() => { const g = window.canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout, polling: 100 });
}

/** Wait until the map has no pending tiles (or the timeout passes). */
export async function settle(page, ms = 4000) {
  await page.waitForFunction(() => {
    const m = window.canalRecallGame?.vectorMap?.map;
    return !m || (m.loaded?.() && m.areTilesLoaded?.());
  }, null, { timeout: 20_000, polling: 250 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * Scripted rider: replaces the keyboard read with a pure-pursuit controller on
 * the game's own planned route (`game.routePath`, which the game re-plans if
 * the rider strays). Throttle and steering go through the normal physics.
 * Questions pause it like a rider who reads the card; `stopAtQuestion: false`
 * keeps rolling.
 */
export async function startAutopilot(page, { cruise = 150, lookahead = 110, gain = 2.2, path = null } = {}) {
  await page.evaluate(({ cruise, lookahead, gain, path }) => {
    const g = window.canalRecallGame;
    const p = g.player;
    const ap = window.__teaserAutopilot = { cruise, lookahead, gain, on: true, index: 0, path };
    if (!p.__origHandleInput) p.__origHandleInput = p.handleInput.bind(p);
    p.handleInput = function () {
      if (!ap.on) return p.__origHandleInput(g.input);
      const route = ap.path || g.routePath;
      if (!route || route.length < 2) { p.throttle = 0; p.steerInput = 0; return; }
      let best = Infinity, nearest = 0, along = 0;
      const from = Math.max(0, ap.index - 2), to = Math.min(route.length - 1, ap.index + 40);
      for (let i = from; i < to; i++) {
        const a = route[i], b = route[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const u = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)));
        const d = Math.hypot(a.x + (b.x - a.x) * u - p.x, a.y + (b.y - a.y) * u - p.y);
        if (d < best) { best = d; nearest = i; along = u * len; }
      }
      if (best > 400) { // route was re-planned: search all of it
        for (let i = 0; i < route.length - 1; i++) {
          const a = route[i]; const d = Math.hypot(a.x - p.x, a.y - p.y);
          if (d < best) { best = d; nearest = i; along = 0; }
        }
      }
      ap.index = nearest;
      let aim = route[route.length - 1];
      for (let i = nearest, left = ap.lookahead + along; i < route.length - 1; i++) {
        const a = route[i], b = route[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (left <= len) { aim = { x: a.x + (b.x - a.x) * left / (len || 1), y: a.y + (b.y - a.y) * left / (len || 1) }; break; }
        left -= len;
      }
      let err = Math.atan2(aim.y - p.y, aim.x - p.x) - p.angle;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      const target = Math.abs(err) > 0.6 ? ap.cruise * 0.45 : ap.cruise;
      p.throttle = p.speed < target ? 1 : 0;
      p.brake = p.speed > target * 1.25 ? 0.4 : 0;
      p.steerInput = Math.max(-1, Math.min(1, err * ap.gain));
      p.handbrake = false;
    };
  }, { cruise, lookahead, gain, path });
}

export async function setAutopilot(page, patch) {
  await page.evaluate(patch => Object.assign(window.__teaserAutopilot || {}, patch), patch);
}

/** Current question state. */
export async function questionState(page) {
  return page.evaluate(() => {
    const g = window.canalRecallGame;
    const prompt = document.getElementById('canal-prompt');
    const visible = !!prompt && getComputedStyle(prompt).display !== 'none';
    const input = document.getElementById('canal-answer');
    return { name: g.quizPromptName || '', visible, choices: g._choiceOrder || [], typing: !!input && getComputedStyle(input).display !== 'none' };
  });
}

/** Wait for a visible question; then, after `readMs`, answer it right with a key press. */
export async function answerNextQuestion(page, { timeout = 60_000, readMs = 1800, wrong = false } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await questionState(page);
    if (s.name && s.visible) {
      await page.waitForTimeout(readMs);
      if (s.typing) {
        await page.locator('#canal-answer').focus();
        await page.keyboard.type(wrong ? 'Kalverstraat' : s.name, { delay: 70 });
        await page.keyboard.press('Enter');
      } else {
        const idx = wrong ? s.choices.findIndex(c => c !== s.name) : s.choices.indexOf(s.name);
        if (idx >= 0) await page.keyboard.press(`Digit${idx + 1}`);
      }
      return s.name;
    }
    await page.waitForTimeout(100);
  }
  return null;
}

/** CDP screencast recorder: frames to `dir`, then `finish()` encodes an MP4. */
export async function startRecording(page, dir, { quality = 92, maxWidth, maxHeight, scale = 1 } = {}) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const vp = page.viewportSize();
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  // Screencast frames come at CSS-pixel size; a phone at devicePixelRatio > 1
  // is grabbed with scaled screenshots instead (slower, but sharp).
  let shooting = false, shotLoop = null;
  if (scale > 1) {
    shooting = true;
    shotLoop = (async () => {
      while (shooting) {
        const t = Date.now() / 1000;
        const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true, clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale } }).catch(() => null);
        if (!r) continue;
        const file = join(resolve(dir), `f${String(n++).padStart(6, '0')}.jpg`);
        writeFileSync(file, Buffer.from(r.data, 'base64'));
        frames.push({ file, t });
      }
    })();
  } else {
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      const file = join(resolve(dir), `f${String(n++).padStart(6, '0')}.jpg`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      frames.push({ file, t: metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: maxWidth || vp.width, maxHeight: maxHeight || vp.height, everyNthFrame: 1 });
  }
  const marks = [];
  const started = Date.now();
  return {
    frames,
    mark(label) { const t = scale > 1 ? Date.now() / 1000 : (frames.length ? frames[frames.length - 1].t : 0); marks.push({ label, t, wall: (Date.now() - started) / 1000 }); console.log(`[mark] ${label} @${((Date.now() - started) / 1000).toFixed(1)}s`); },
    async stop(outFile, { fps = 30 } = {}) {
      shooting = false; if (shotLoop) await shotLoop;
      await cdp.send('Page.stopScreencast').catch(() => {});
      await new Promise(r => setTimeout(r, 300));
      if (frames.length < 2) throw new Error('no frames recorded');
      const t0 = frames[0].t;
      const lines = [];
      for (let i = 0; i < frames.length; i++) {
        const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / fps;
        lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
      }
      lines.push(`file '${frames[frames.length - 1].file}'`);
      const list = join(dir, 'list.txt');
      writeFileSync(list, lines.join('\n'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
        '-vf', `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', outFile]);
      const total = frames[frames.length - 1].t - t0;
      const info = { frames: frames.length, seconds: total, fps: frames.length / total, marks: marks.map(m => ({ ...m, t: m.t ? m.t - t0 : 0 })) };
      writeFileSync(outFile.replace(/\.mp4$/, '.json'), JSON.stringify(info, null, 2));
      console.log(`[rec] ${outFile}: ${info.frames} frames, ${total.toFixed(1)} s, ${info.fps.toFixed(1)} fps`);
      return info;
    },
  };
}

/** Lat/lng to game world pixels. */
export async function toWorld(page, lat, lng) {
  return page.evaluate(([lat, lng]) => {
    const l = window.canalRecallGame.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    return { x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm };
  }, [lat, lng]);
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
