// Strip spots for the lane: the user's three poses plus measured new-build pands. For a pand, the camera looks square
// at its longest street-side edge: target = edge middle, bearing = inward normal; the panorama is sought 18 m out.
//   node scripts/newbuild/make-spots.mjs > scripts/newbuild/spots.json
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const PANDS = { 'houthaven-2021-orange': '0363100012252867', 'houthaven-2018-dark': '0363100012247676', 'ijburg-2021': '0363100012253701', 'ijburg-2009': '0363100012154305', 'sluisbuurt-2025': '0363100012570345', 'zeeburgereiland-2016': '0363100012244416' };
const USER = [
  { slug: 'user-narva-houthaven', name: 'Narva-eiland (feedback 1c694c0d)', lng: 4.881412, lat: 52.39353, bearing: 50, distM: 60, eyeM: 14 },
  { slug: 'user-westpoort-slab', name: 'Danzigerkade Ydek canopy (feedback 2c486751)', lng: 4.87207, lat: 52.39879, bearing: 60, distM: 70, eyeM: 14 },
  { slug: 'user-houthavenkade-26', name: 'Houthavenkade 26 / 4e Gymnasium (feedback 75242f30)', lng: 4.876389, lat: 52.394353, bearing: 200, distM: 110, eyeM: 18 },
];
const root = 'public/data/extracts/amsterdam/bag-tiles/14', want = new Set(Object.values(PANDS)), found = {};
for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f)))).features) {
  const id = String(ft.properties.id).replace('NL.IMBAG.Pand.', ''); if (want.has(id) && ft.geometry.type === 'Polygon') found[id] = ft;
}
const KX = 111320 * Math.cos(52.37 * Math.PI / 180), KY = 110540;
const out = [...USER];
for (const [slug, id] of Object.entries(PANDS)) {
  const ft = found[id]; if (!ft) { console.error('missing', slug); continue; }
  const r = ft.geometry.coordinates[0], c = r.slice(0, -1).reduce((s, p, _, a) => [s[0] + p[0] / a.length, s[1] + p[1] / a.length], [0, 0]);
  let best = null;
  for (let i = 0; i + 1 < r.length; i++) { const dx = (r[i + 1][0] - r[i][0]) * KX, dy = (r[i + 1][1] - r[i][1]) * KY, len = Math.hypot(dx, dy); if (!best || len > best.len) best = { i, len, dx, dy }; }
  const a = r[best.i], b = r[best.i + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let n = [best.dy / best.len, -best.dx / best.len]; // outward candidate
  if ((m[0] - c[0]) * KX * n[0] + (m[1] - c[1]) * KY * n[1] < 0) n = [-n[0], -n[1]];
  const bearing = (Math.atan2(-n[0], -n[1]) * 180 / Math.PI + 360) % 360; // looking inward
  out.push({ slug, name: `${slug} (pand ${id}, ${ft.properties.year})`, pand: id, lng: +m[0].toFixed(6), lat: +m[1].toFixed(6), bearing: Math.round(bearing), distM: 55, eyeM: 10, targetM: Math.min(12, ft.properties.height / 2) });
}
console.log(JSON.stringify(out, null, 1));
