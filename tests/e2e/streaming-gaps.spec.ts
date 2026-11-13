import { test, expect, type Page } from '@playwright/test';
import { setHiddenSelect, settleWorld, useEngine } from './helpers';
import { OWN } from './worldCam';

// Lane F7 (2026-11-13 feedback round, theme 9): the streaming / loading notes, pinned at their poses in the players'
// world (compiled cells, `?engine=own`, storybook look as the notes were sent). Poses are the notes' player x/y/angle
// and camera zoom; the user's chase tilt (+30, pitch 75) shows the horizon as in the note frames.
//   #46 faa46795 "why is nothing loaded here?": Nieuwezijds Voorburgwal by Martelaarsgracht, 52.37574, 4.89298.
//   #29 4d7706de "trash bins were here when I first rode here, now they disappeared": Kwakersstraat bridge.
//   ENGINE=own PW_PORT=<port> npx playwright test streaming-gaps --project=desktop --workers=1
const N46 = { x: -1329.506814141659, y: -6638.2093006694895, angle: -0.6843116961549923, zoom: 1.5, tilt: 30 };
const N29 = { x: -6139.245394095417, y: -4228.446345686049, angle: 9.141955539400312, zoom: 1.5, tilt: 30 };
type Pose = typeof N46;

async function park(page: Page, p: Pose) {
  await page.evaluate(p => {
    const g = (window as any).canalRecallGame;
    g.vectorMap.setCameraTilt?.(p.tilt); g.vectorMap._cameraTilt = p.tilt;
    g.player.x = p.x; g.player.y = p.y; g.player.angle = p.angle; Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
    if (g.camera.zoom != null) g.camera.zoom = p.zoom; if (g.camera.targetZoom != null) g.camera.targetZoom = p.zoom;
  }, p);
}

/** Tier owning the ground on a grid ahead of the rider (0-450 m ahead, 40/80 m either side): 'f'acade, 'c'oarse, 'n'one. */
async function tierGrid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame, tb = g.vectorMap._threeBuildings, l = g.osmLoader, ppm = 3, p = g.player;
    const ll = (x: number, y: number) => [l._lastCenterLng + (x - l._lastOffsetX) / ppm / (111320 * Math.cos(l._lastCenterLat * Math.PI / 180)), l._lastCenterLat - (y - l._lastOffsetY) / ppm / 111320];
    const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    let out = '';
    for (const ahead of [0, 50, 100, 200, 300, 450]) for (const side of [-80, -40, 40, 80]) {
      const q = ll(p.x + (fx * ahead - fy * side) * ppm, p.y + (fy * ahead + fx * side) * ppm);
      out += (tb?.tierAt?.(q[0], q[1])?.owner ?? 'none')[0];
    }
    return out;
  });
}

async function groundCovers(page: Page): Promise<boolean> {
  return page.evaluate(() => { const s = (window as any).canalRecallGame.vectorMap._ownGround?.status?.(); return !!s?.ready && !!s.basemapHidden && Object.keys(s.cells ?? {}).length > 0; });
}

test.describe('streaming gaps (F7)', () => {
  test.skip(!OWN, 'own engine only: the notes were sent from it (street furniture draws only there)');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop poses');
    test.setTimeout(300_000);
    await page.route(/ingest\.(us\.)?sentry\.io/, r => r.fulfill({ status: 200, body: '{}' }));
    await useEngine(page);
    await page.goto('/canal-drive/?buildings3d=storybook');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
    await expect(page.locator('#route-card')).toBeVisible();
    await setHiddenSelect(page, 'travel-mode', 'car');
    await setHiddenSelect(page, 'view-mode', 'chase');
    await page.locator('[data-choice="route:free"]').click();
    await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && (window as any).canalRecallGame.player?.x, null, { timeout: 180_000 });
  });

  test('#46 Nieuwezijds Voorburgwal: every block ahead is drawn, and comes back after a context loss', async ({ page }) => {
    await park(page, N46);
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(1000); await park(page, N46); }
    await settleWorld(page, '#46');
    expect(await tierGrid(page), 'no building tier missing 0-450 m ahead').not.toContain('n');
    expect(await groundCovers(page), 'own ground covers the rider').toBe(true);
    // The only state that reproduced the note's frame (beige paper, no blocks, trees and roads drawn): a lost and
    // restored WebGL context, a second or two in. Recovery must finish: every tier back within 20 s.
    const lost = await page.evaluate(async () => {
      const gl = (window as any).canalRecallGame.vectorMap.host?.renderer?.getContext?.();
      const ext = gl?.getExtension('WEBGL_lose_context'); if (!ext) return false;
      ext.loseContext(); await new Promise(r => setTimeout(r, 1000)); ext.restoreContext(); return true;
    });
    test.skip(!lost, 'no WEBGL_lose_context');
    await expect.poll(async () => { await park(page, N46); return (await tierGrid(page)).includes('n') ? 'gap' : (await groundCovers(page)) ? 'ok' : 'no ground'; }, { timeout: 20_000, intervals: [500] }).toBe('ok');
    const events = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.host.contextEvents);
    expect(events).toEqual({ lost: 1, restored: 1 });
  });

  test('#29 Kwakersstraat bridge: the quay containers beside the rider are drawn on the pavement', async ({ page }) => {
    await park(page, N29);
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(1000); await park(page, N29); }
    await settleWorld(page, '#29');
    const bins = await page.evaluate(() => {
      const g = (window as any).canalRecallGame, f = (window as any).__canalStreetFurniture, gr = g.vectorMap._ownGround;
      const placed: number[][] = [];
      for (const c of f.culls) { const m = c.matrices as Float32Array; for (let i = 0; i < m.length; i += 16) placed.push([m[i + 12], m[i + 13], m[i + 14]]); }
      // afval-111577/111581/111585: the rest-waste columns on the quay west of the bridge, 22-27 m from the rider.
      return ['afval-111577', 'afval-111581', 'afval-111585'].map(id => {
        let rec: any = null; for (const list of f.tiles.values()) for (const v of list) if (v.id === id) rec = v;
        if (!rec) return { id, found: false };
        const q = f.maplibregl.MercatorCoordinate.fromLngLat([rec.lng, rec.lat], 0), x = (q.x - f.origin.x) / f.scale, y = -(q.y - f.origin.y) / f.scale;
        const hit = placed.find(t => Math.abs(t[0] - x) < 0.02 && Math.abs(t[1] - y) < 0.02);
        return { id, found: true, drawnZ: hit ? hit[2] : null, ground: gr?.surfaceBase?.([rec.lng, rec.lat]) ?? null };
      });
    });
    for (const b of bins) {
      expect(b.found, `${b.id} streamed`).toBe(true);
      expect(b.drawnZ, `${b.id} drawn`).not.toBeNull();
      // On the pavement: the riding surface plus the sidewalk lift (RIDE_BASE_LIFT_M 0.15), not buried, not floating.
      expect(Math.abs((b.drawnZ as number) - ((b.ground as number) + 0.15)), `${b.id} on the surface`).toBeLessThan(0.05);
    }
  });
});
