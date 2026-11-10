import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { readExtract } from './probe-rails.ts';
const [lng, lat, rad] = process.argv.slice(2).map(Number);
const store = new GroundStore(readExtract, { roads: true }); await store.init();
const [x, y] = toLocal(lng, lat);
const input = await store.cellInput(store.cellAt(x, y), 0);
for (const w of input.rails ?? []) {
  let best = 1e9; for (const p of w.points) best = Math.min(best, Math.hypot(p[0]-x, p[1]-y));
  if (best > rad) continue;
  const a = fromLocal(...w.points[0]), b = fromLocal(...w.points[w.points.length-1]);
  console.log(w.kind, w.bridge?'BRIDGE':'', w.service?'svc':'', w.points.length, 'd='+best.toFixed(0), a.map(v=>v.toFixed(5)).join(','), '->', b.map(v=>v.toFixed(5)).join(','));
}
