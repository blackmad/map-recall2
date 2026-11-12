// Lane G1 item B: how much of the roads-v1 survey (bgt* sources) the OSM street ribbons (band, junctionFill, laneRibbon)
// overlap in plan, per cell, on a 0.25 m raster of the traced triangles (sourceTrace.ts). Also the roads-v1 triangles
// whose plane leaves the land surface by more than their class's drape tolerance (the drapeAdaptive min-area gate's
// defect), with and without `roadStrips`. node --import tsx scripts/own-ground/probe-road-overlap.ts [cells]
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { join } from 'node:path';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { setSourceTracing, sourceOfCode } from '../../src/canalRecall/ownGround/sourceTrace.ts';
const read = async (p: string) => { const b = readFileSync(join('public/data/extracts/amsterdam', p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const RES = 0.25, ROAD_LAYERS = ['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'square', 'parking'];
const BAND = new Set(['band', 'junctionFill', 'laneRibbon']);
async function main() {
  const keys = (process.argv[2] ?? '-4_-3,-5_-3').split(',');
  setSourceTracing(true);
  for (const opts of [{ roadStrips: false }, {}]) {
    const s = new GroundStore(read, { parks: true, roads: true, rails: true, ...opts } as never); await s.init();
    for (const key of keys) {
      const input = await s.cellInput(key, 0), cell = buildCell(input), [x0, y0, x1, y1] = cell.rect;
      const W = Math.ceil((x1 - x0) / RES), H = Math.ceil((y1 - y0) / RES);
      const bgt = new Uint8Array(W * H), band = new Uint8Array(W * H);
      let tris = 0, gateBad = 0;
      for (const layer of ROAD_LAYERS) {
        const m = cell.layers[layer as never] as { positions: Float32Array; indices: Uint32Array } | undefined, src = cell.sources?.[layer as never] as Uint8Array | undefined;
        if (!m || !src) continue;
        const p = m.positions, ix = m.indices;
        for (let t = 0; t < ix.length / 3; t++) {
          const name = sourceOfCode(src[t]) ?? 'other', isBand = BAND.has(name), isBgt = name.startsWith('bgt') || name === 'fietsstraat';
          if (!isBand && !isBgt) continue;
          const a = ix[t * 3] * 3, b = ix[t * 3 + 1] * 3, c = ix[t * 3 + 2] * 3;
          if (isBgt) { tris++; const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3; if (Math.abs(cz - s.surface.relief(cx, cy)) > 0.1) gateBad += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a])) / 2; }
          const buf = isBand ? band : bgt, det = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
          if (Math.abs(det) < 1e-9) continue;
          const i0 = Math.max(0, Math.floor((Math.min(p[a], p[b], p[c]) - x0) / RES)), i1 = Math.min(W - 1, Math.floor((Math.max(p[a], p[b], p[c]) - x0) / RES));
          const j0 = Math.max(0, Math.floor((Math.min(p[a + 1], p[b + 1], p[c + 1]) - y0) / RES)), j1 = Math.min(H - 1, Math.floor((Math.max(p[a + 1], p[b + 1], p[c + 1]) - y0) / RES));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const px = x0 + (i + 0.5) * RES, py = y0 + (j + 0.5) * RES;
            const l1 = ((p[b + 1] - p[c + 1]) * (px - p[c]) + (p[c] - p[b]) * (py - p[c + 1])) / det, l2 = ((p[c + 1] - p[a + 1]) * (px - p[c]) + (p[a] - p[c]) * (py - p[c + 1])) / det;
            if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) buf[j * W + i] = 1;
          }
        }
      }
      let nb = 0, nr = 0, both = 0;
      for (let k = 0; k < W * H; k++) { if (bgt[k]) nb++; if (band[k]) nr++; if (bgt[k] && band[k]) both++; }
      console.log(JSON.stringify({ key, opts, bgtM2: Math.round(nb * RES * RES), bandM2: Math.round(nr * RES * RES), overlapM2: Math.round(both * RES * RES), bgtTriangles: tris, centroidOff10cmM2: Math.round(gateBad) }));
      s.forgetCells(new Set(GroundStore.neighbours(key)));
    }
  }
}
void main();
