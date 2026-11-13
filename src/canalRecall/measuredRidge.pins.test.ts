// Named regression locations for feedback round 2026-11-13 (notes ba7fc535 and 10bd9a08, "gables are not on the street
// side"). Real pands from the building tiles, with the ridge direction 3DBAG measured (scripts/roofs/bag3d-ridge-axes.mts,
// degrees ccw from east). The city tier drew each ridge across the street where 3DBAG has it along (or the reverse).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { gameDecorator, loadGameData, loadTile, tileKeyAt } from './galleryPipeline.ts';
import { ORIGIN, meshBuildingFor } from './threeBuildingFeatures.ts';
import { roofPiecesForOutline } from './roofMesh.ts';
import { axisGapDeg } from './roofs/ridgeAxis.ts';

const BASE = 'public/data/extracts/amsterdam';
const fetchImpl: typeof fetch = (async (url: string) => {
  const path = String(url).replace(/^.*?amsterdam\//, `${BASE}/`).replace(/^\.\.\/data\/extracts\/amsterdam/, BASE);
  return existsSync(path) ? new Response(readFileSync(path)) : new Response(null, { status: 404 });
}) as typeof fetch;
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const PINS: Array<{ name: string; id: string; at: [number, number]; bagDeg: number }> = [
  { name: 'Jan Hanzenstraat 1913 row (note 10bd9a08)', id: '0363100012114483', at: [4.86332, 52.36729], bagDeg: 22.1 },
  { name: 'Jan Hanzenstraat 1913 row, neighbour', id: '0363100012133356', at: [4.86325, 52.36727], bagDeg: 22.6 },
  { name: 'Jan Hanzenstraat 1938 school row', id: '0363100012136309', at: [4.8628, 52.36676], bagDeg: 21.6 },
  { name: 'Jan Hanzenstraat 1938, crowned gable over a ridge along the street', id: '0363100012064390', at: [4.86301, 52.36682], bagDeg: 21.6 },
  { name: 'Bilderdijkstraat 1905 gable, ridge across the street (note ba7fc535 area)', id: '0363100012102399', at: [4.87236, 52.36849], bagDeg: 111.9 },
];
const data = await loadGameData(BASE, fetchImpl);
const decorate = gameDecorator({ gables: data.gables, landmarkIds: data.landmarkIds, listed: data.listed });

for (const pin of PINS) {
  test(`ridge follows 3DBAG: ${pin.name}`, async () => {
    const raw = (await loadTile(tileKeyAt(...pin.at), BASE, fetchImpl)).find(f => String(f.properties.id) === `NL.IMBAG.Pand.${pin.id}`);
    assert.ok(raw, 'pand in the tile');
    const axis = (extra: Record<string, unknown>) => {
      const d = decorate({ ...raw, properties: { ...raw.properties, ...extra } }), b = meshBuildingFor(d, 'photo');
      const piece = roofPiecesForOutline(b!.polygons[0][0], ORIGIN, b!.roof!.plan, kx)[0];
      return ((Math.atan2(piece.rect.uy, piece.rect.ux) * 180 / Math.PI) % 180 + 180) % 180;
    };
    assert.ok(axisGapDeg(axis({}), pin.bagDeg) > 45, 'the unmeasured guess is the reported failure');
    assert.ok(axisGapDeg(axis({ roofRidgeDeg: Math.round(pin.bagDeg) % 180 }), pin.bagDeg) < 10, 'the measured ridge is drawn');
  });
}
