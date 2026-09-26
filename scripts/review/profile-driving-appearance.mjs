/** Reproducible driving-scale layer ablation. Desktop phone-width is not phone hardware.
 * Start the game server, then run with APPEARANCE_PROFILE_URL (default :4187).
 * Reports frame intervals, not isolated GPU costs; negative deltas are noise.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const baseURL = process.env.APPEARANCE_PROFILE_URL || 'http://127.0.0.1:4187';
const output = process.env.APPEARANCE_PROFILE_OUTPUT || '.cache/appearance-programme/profile';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ ...(existsSync(chrome) ? { executablePath: chrome } : {}) });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(`${baseURL}/canal-drive/`);
    await page.locator('[data-choice="route:study"]').click();
    await page.locator('#route-card').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => window.canalRecallGame?.vectorMap?._completeCity?.status().styledFeatures > 0, null, { timeout: 90000 });
    await page.evaluate(() => { window.canalRecallGame.vectorMap.sync = () => undefined; });
    for (const zoom of [17.1, 17.5, 18]) {
      await page.evaluate(zoom => {
        const vm = window.canalRecallGame.vectorMap;
        vm.map.jumpTo({ center: [4.874284, 52.371787], zoom, pitch: 65, bearing: -18.12 });
        vm.map.triggerRepaint();
      }, zoom);
      await page.waitForTimeout(3000);
      const data = await page.evaluate(async () => {
        const vm = window.canalRecallGame.vectorMap, map = vm.map;
        // getStyle() omits custom layers in MapLibre; inspect runtime layers too.
        const layers = map.style._order.map(id => map.getLayer(id)).filter(Boolean);
        const groups = {
          buildings: layers.filter(l => l.id === 'osm-colored-buildings').map(l => l.id),
          facades: layers.filter(l => l.id.startsWith('city-appearance-contextual-facades')).map(l => l.id),
          roofs: layers.filter(l => l.id.startsWith('city-appearance-study-roofs') || l.id.startsWith('city-appearance-source-roofs')).map(l => l.id),
          pyramidal: layers.filter(l => /pyramid/i.test(l.id)).map(l => l.id),
        };
        // Layer IDs are runtime facts: record all of them for auditability.
        const sample = async () => {
          const frames = []; let previous, count = 0;
          await new Promise(resolve => {
            const tick = now => {
              if (previous !== undefined && count >= 30) frames.push(now - previous);
              previous = now; count++; map.triggerRepaint();
              if (frames.length >= 120) resolve(); else requestAnimationFrame(tick);
            }; requestAnimationFrame(tick);
          });
          frames.sort((a, b) => a - b);
          return { p50: frames[59], p95: frames[113], frames: frames.length };
        };
        const baseline = await sample(), ablations = {};
        for (const [name, ids] of Object.entries(groups)) {
          if (!ids.length) { ablations[name] = { unavailable: true }; continue; }
          const old = ids.map(id => map.getLayoutProperty(id, 'visibility') || 'visible');
          try {
            ids.forEach(id => map.setLayoutProperty(id, 'visibility', 'none'));
            const disabled = await sample();
            ablations[name] = { ids, disabled, marginalP50: baseline.p50 - disabled.p50, marginalP95: baseline.p95 - disabled.p95 };
          } finally { ids.forEach((id, i) => map.setLayoutProperty(id, 'visibility', old[i])); }
        }
        return { baseline, ablations, layerIds: layers.map(l => l.id), status: vm.appearanceRenderStatus(), actualZoom: map.getZoom() };
      });
      const row = { viewport, deviceScaleFactor: 1, zoom, camera: { center: [4.874284, 52.371787], pitch: 65, bearing: -18.12 }, ...data };
      results.push(row);
      await page.screenshot({ path: `${output}/${viewport.width}-z${zoom}.png` });
      writeFileSync(`${output}/results.json`, JSON.stringify({ browser: await browser.version(), hardwareNote: 'Desktop browser, including phone-width viewport; no physical-phone claim', warmupFrames: 30, sampleFrames: 120, results }, null, 2));
      console.log(JSON.stringify({ width: viewport.width, zoom, baseline: data.baseline, ablations: data.ablations }));
    }
    await page.close();
  }
} finally { await browser.close(); }
