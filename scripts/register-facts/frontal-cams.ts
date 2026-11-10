// Frontal review spots, second pass (lane register-extras, 2026-11-10). The first strips (frontal-spots.ts) stood the
// camera at the straightest panorama 8-10 m off the wall, which in narrow streets meant a steep oblique and, where the
// picked wall faced a courtyard, a view into the yard. This picker takes the pand's street front (the wall facing the
// nearest road, or the bearing given per pand), lists the land panoramas (no boat missions) 15-25 m from that wall's
// middle, in front of it, and keeps the straightest one. Panorama and render then share the eye; frontal-photos.ts cuts
// the photo and writes the cams.
//   npx tsx scripts/register-facts/frontal-cams.ts <targets.json> <spots-out.json>
// targets: [{ slug, id (pand id or ids, comma separated: the first is the aimed pand), bearing?: the street front's
//            outward bearing (deg) when the nearest-road rule picks the wrong side, minD?, maxD? }]
import { readFileSync, writeFileSync } from 'node:fs';
import { findPands, lngLatToRd, neighbourhood, rdToLngLat, normId } from '../pand-reference/core.ts';
import { listPanos, options, pickWall, rankPanos } from '../pand-reference/select.ts';

/** A six-digit suffix stands for an Amsterdam pand (0363100012…), as the strip slugs write them. */
const pandId = (s: string) => normId(/^\d{6}$/.test(s.trim()) ? `0363100012${s.trim()}` : s.trim());
type Target = { slug: string; id: string; bearing?: number; minD?: number; maxD?: number };
const [targetsFile, outFile] = process.argv.slice(2);
const targets = JSON.parse(readFileSync(targetsFile, 'utf8')) as Target[];
const ids = targets.map(t => pandId(t.id.split(',')[0]));
const found = await findPands(ids);
const out: unknown[] = [];
for (const t of targets) {
  const id = pandId(t.id.split(',')[0]), fp = found.get(id);
  if (!fp) { console.log(t.slug, 'not in building tiles'); continue; }
  const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
  options.preferBearingDeg = t.bearing;
  const { wall, note } = await pickWall(fp, await neighbourhood(centre));
  options.preferBearingDeg = undefined;
  if (!wall) { console.log(t.slug, note); continue; }
  // 15-25 m is the brief's frame; across a canal the nearest land panorama stands 30-40 m off, which still beats a
  // 60 deg oblique from the same quay. Score: obliquity, plus 1.5 deg per metre outside 15-25 m.
  const minD = t.minD ?? 12, maxD = t.maxD ?? 40;
  const land = (await listPanos(wall.mid, maxD + 5)).filter(p => !String(p.surface_type ?? '').toLowerCase().includes('w') && !(p.tags ?? []).some((g: string) => /water/.test(g)));
  const cost = (c: { distM: number; obliquityDeg: number }) => c.obliquityDeg + 1.5 * (Math.max(0, 15 - c.distM) + Math.max(0, c.distM - 25));
  const ranked = rankPanos(wall, land, { minD, maxD, strict: [minD, maxD], maxObliquityDeg: 65 }).sort((a, b) => cost(a) - cost(b) || b.missionYear - a.missionYear);
  const p = ranked[0];
  if (!p) { console.log(t.slug, `no land panorama ${minD}-${maxD} m in front of the wall (${note})`); continue; }
  const [mlng, mlat] = rdToLngLat(wall.mid);
  const bearing = Math.round((Math.atan2(wall.nx, wall.ny) * 180 / Math.PI + 360) % 360);
  // A second view from the other side of the wall's normal (more than one side, as the review asks), when one stands
  // within 60 deg: its own slug `<slug>-b`.
  const side = (c: typeof p) => { const [lng, lat] = c.record.geometry.coordinates, r = lngLatToRd([lng, lat]); return Math.sign((r.x - wall.mid.x) * -wall.ny + (r.y - wall.mid.y) * wall.nx); };
  const other = ranked.find(c => side(c) !== side(p) && side(c) !== 0 && c.obliquityDeg >= 15 && c.obliquityDeg <= 60);
  for (const [slug, c] of [[t.slug, p], ...(other ? [[`${t.slug}-b`, other] as const] : [])] as const) {
    const [plng, plat] = c.record.geometry.coordinates;
    out.push({ slug, id: t.id.split(',').map(pandId).join(','), wall: { mid: [mlng, mlat], len: Math.round(wall.len * 10) / 10, normalBearing: bearing, note },
      pano: { id: c.panoId, lng: plng, lat: plat, date: String(c.timestamp).slice(0, 10), distM: Math.round(c.distM * 10) / 10, obliquityDeg: Math.round(c.obliquityDeg), surface: c.surface } });
    console.log(slug, `wall ${wall.len.toFixed(1)} m facing ${bearing}, pano ${c.distM.toFixed(1)} m obl ${c.obliquityDeg.toFixed(0)} (${ranked.length} candidates; ${note})`);
  }
}
writeFileSync(outFile, JSON.stringify(out, null, 1));
