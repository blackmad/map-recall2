// Usage: node scripts/landmarks/facade-pano.mjs <footprints.json> <x> <z> <normalBearingDeg> <out.jpg> [standoff=25] [fov=70] [index=0] [pitch=0]
// Native east/south metres (x,z) of a facade point -> picks the municipal panorama nearest to the point `standoff` m out along the
// facade's outward bearing and aims at the facade point. Prints candidates (id, year, distance) so alternatives can be chosen by index.
import fs from 'node:fs';
const [fpFile, xs, zs, nb, out, so = '25', fov = '70', index = '0', pitch = '0'] = process.argv.slice(2);
const fp = JSON.parse(fs.readFileSync(fpFile, 'utf8')), [alng, alat] = fp.anchor;
const toLL = (x, z) => [alng + x / (111320 * Math.cos(alat * Math.PI / 180)), alat - z / 111320];
const x = +xs, z = +zs, br = +nb * Math.PI / 180, s = +so;
const [tlng, tlat] = toLL(x, z), [clng, clat] = toLL(x + Math.sin(br) * s, z - Math.cos(br) * s);
const list = await (await fetch(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${clng},${clat}&srid=4326&radius=45&page_size=30&newest_in_range=true`)).json();
const items = (list._embedded?.panoramas ?? []).map(p => {
  const [plng, plat] = p.geometry.coordinates;
  const dx = (tlng - plng) * 111320 * Math.cos(tlat * Math.PI / 180), dy = (tlat - plat) * 111320;
  return {id: p.pano_id, d: Math.hypot(dx, dy), toTarget: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, year: p.mission_year, ts: p.timestamp};
}).map(p => ({...p, cd: Math.hypot((p.d * Math.sin(p.toTarget * Math.PI / 180) - 0) , 0)})).sort((a, b) => a.d - b.d);
// prefer stations roughly in front of the facade: their direction to the target should oppose the facade normal
const ok = items.map(p => ({...p, off: Math.abs(((p.toTarget - (+nb + 180)) % 360 + 540) % 360 - 180)}));
const ranked = ok.filter(p => p.off < 50 && p.d > 8).sort((a, b) => a.off * 0.4 + a.d * 0.3 - (b.off * 0.4 + b.d * 0.3));
console.log(JSON.stringify(ranked.slice(0, 6).map(p => [p.id, p.year, +p.d.toFixed(0), +p.off.toFixed(0)])));
const pick = ranked[+index]; if (!pick) throw Error('no pano in front of facade');
const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${pick.id}/?width=1600&fov=${fov}&heading=${pick.toTarget.toFixed(0)}&pitch=${pitch}`;
const r = await fetch(url); if (!r.ok) throw Error(r.status + ' ' + url);
fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
console.log('wrote', out, pick.id, pick.ts, 'heading', pick.toTarget.toFixed(0), 'dist', pick.d.toFixed(1), url);
