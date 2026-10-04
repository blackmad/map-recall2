// Physical mouse proof for a mapped food venue in an ordinary city mesh,
// rather than a registered landmark or an arbitrary nearby point. The
// De Roode Leeuw entrance is outside the installed plan; a genuinely
// contained food venue in that same context supplies the positive fixture.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const row = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/click-poi-info.json')).points.find(r => r[0] === 'n34044093');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.CANAL_REVIEW_URL || 'http://127.0.0.1:5196/canal-drive/');
  await page.waitForFunction(() => window.canalRecallGame?.routePois?.length > 0, null, { timeout: 60000 });
  await page.getByRole('radiogroup', { name: 'Travel', exact: true }).getByRole('button', { name: /Bike/ }).click();
  await page.getByRole('radiogroup', { name: 'View', exact: true }).getByRole('button', { name: /Chase/ }).click();
  await page.locator('#route-card').evaluate(f => f.requestSubmit());
  await page.waitForFunction(() => canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0 && canalRecallGame._clickPoiInfo, null, { timeout: 90000 });
  await page.evaluate(row => {
    const g = canalRecallGame, v = g.vectorMap;
    v.sync = () => {};
    v.map.jumpTo({ center: [row[2], row[3]], zoom: 19, pitch: 60, bearing: 60 });
    v._completeCity.setSuspended(false); v._completeCity.followCamera();
  }, row);
  await page.waitForTimeout(8500);
  await page.waitForFunction(() => { const b = canalRecallGame.vectorMap._threeBuildings; return b?.ready && b.chunks.size && !b.pending.length && !b.inflight.size; }, null, { timeout: 90000 });
  const proof = await page.evaluate(row => {
    const g = canalRecallGame, v = g.vectorMap, b = v._threeBuildings, T = CanalRecallThree.THREE, canvas = v.map.getCanvas(), rect = g.canvas.getBoundingClientRect();
    const owners = b.lastFeatures.filter(f => !b.hidden.has(String(f.properties.id)) && g._clickPoiInfo.contained(f.geometry).some(p => p[4] === 'food' && p[7] && Math.abs(p[2]-row[2])<.001 && Math.abs(p[3]-row[3])<.001));
    for (const f of owners) {
      const place=g._clickPoiInfo.contained(f.geometry).find(p=>p[4]==='food'&&p[7]);
      const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
      for (const ll of [[place[2], place[3]], ...ring]) for (const portion of [.85, .5, .2]) {
        const lng = ll[0] * .85 + place[2] * .15, lat = ll[1] * .85 + place[3] * .15;
        const p = new T.Vector3((lng - 4.9) * 111320 * Math.cos(52.37 * Math.PI / 180), (lat - 52.37) * 110540, (Number(f.properties.height) || 12) * portion).applyMatrix4(b.camera.projectionMatrix);
        const x = (p.x + 1) / 2 * canvas.clientWidth, y = (1 - p.y) / 2 * canvas.clientHeight;
        if (x < 80 || y < 100 || x > canvas.clientWidth - 80 || y > canvas.clientHeight - 180) continue;
        const hit = v.inspectBuilding(x, y, { width: canvas.clientWidth, height: canvas.clientHeight });
        if (!hit?.footprint || hit.landmarkId || String(hit.id) !== String(f.properties.id)) continue;
        const card = g._cardForClickedBuilding(hit);
        if (!card?.id.startsWith('clicked-poi-') || !card.longDetail.includes(place[1])) continue;
        return { id: hit.id, card, clientX: rect.left + x / canvas.clientWidth * rect.width, clientY: rect.top + y / canvas.clientHeight * rect.height, drawable: [...b.chunks.values()].some(c => c.mesh && c.ranges.has(String(hit.id))), routeAdded: g.routePois.some(p => p.id === place[0]), originalPoi: place[0], place };
      }
    }
    return { error: 'No real ordinary drawable restaurant surface found', owners: owners.map(f => ({id:f.properties.id,places:g._clickPoiInfo.contained(f.geometry).map(r=>r[1]),researched:g.landmarks.filter(l=>l.buildingIds?.includes(String(f.properties.id))).map(l=>l.name)})) };
  }, row);
  console.log('SURFACE PROOF',JSON.stringify(proof));assert.equal(proof.error, undefined); assert(proof.drawable); assert.equal(proof.routeAdded, false);
  await page.mouse.click(proof.clientX, proof.clientY); await page.waitForTimeout(200);
  const selected = await page.evaluate(() => { const g = canalRecallGame, b = g.vectorMap._threeBuildings; return { notice: g._landmarkNotice, alpha: g._landmarkNoticeAlpha, bounds: g._landmarkCardBounds, highlighted: [...b.highlighted] }; });
  assert.equal(selected.notice.id, proof.card.id); assert(selected.notice.longDetail.includes(proof.place[1]));
  assert(selected.notice.longDetail.includes(proof.place[6])); assert(selected.notice.factTexts.join('\n').includes(proof.place[7]));
  assert(selected.bounds); assert(selected.alpha >= .9); assert(selected.highlighted.includes(String(proof.id)));
  await page.screenshot({ path: '/tmp/contained-poi-restaurant.png' });
  const open = await page.evaluate(() => {
    const g=canalRecallGame, r=g.canvas.getBoundingClientRect(), b=g._landmarkCardBounds;
    return {x:r.left+(b.x+b.w/2)/CANVAS_W*r.width,y:r.top+(b.y+b.h/2)/CANVAS_H*r.height};
  });
  await page.mouse.click(open.x,open.y);
  await page.waitForFunction(() => document.getElementById('landmark-panel-body')?.textContent.includes('Map source:'));
  assert((await page.locator('#landmark-panel-body').innerText()).includes(proof.place[7]));
  assert.equal(await page.locator('#landmark-panel-link').getAttribute('href'),selected.notice.sourceUrl);
  await page.screenshot({path:'/tmp/contained-poi-restaurant-expanded.png'});
  assert.deepEqual(errors, []); console.log('CONTAINED POI PHYSICAL PROOF', JSON.stringify({ id: proof.id, source: selected.notice.sourceUrl, highlighted: selected.highlighted, routePoolUnchanged: !proof.routeAdded, errors }));
} finally { await browser.close(); console.log('CHROMIUM CLOSED'); }
