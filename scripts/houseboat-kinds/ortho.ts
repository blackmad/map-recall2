// PDOK 8 cm orthophoto (Actueel_orthoHR, open data) around one houseboat, cached per id,
// and the boat's outline and frame in that image's pixels.
import fs from 'node:fs';
import proj4 from 'proj4';
import { houseboatFrame, type Houseboat } from '../../src/canalRecall/houseboats.ts';

export const RD = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
export const OUT = 'artifacts/houseboat-kinds';
export const PX = 0.08, PAD = 5;

export type OrthoCrop = {
  file: string; size: number; bbox: [number, number, number, number];
  /** Outline in image pixels (x right, y down). */
  ring: [number, number][];
  /** Frame in image pixels: centre, unit length axis (u) and across axis (v), metres. */
  cx: number; cy: number; ux: number; uy: number; vx: number; vy: number; length: number; width: number;
};

export async function orthoCrop(boat: Houseboat): Promise<OrthoCrop> {
  const rd = boat.ring.map(([lng, lat]) => proj4('EPSG:4326', RD, [lng, lat]) as [number, number]);
  const cxr = rd.reduce((a, p) => a + p[0], 0) / rd.length, cyr = rd.reduce((a, p) => a + p[1], 0) / rd.length;
  const fr = houseboatFrame(boat)!;
  const half = Math.hypot(fr.length, fr.width) / 2 + PAD;
  const bbox: [number, number, number, number] = [cxr - half, cyr - half, cxr + half, cyr + half];
  const size = Math.round(2 * half / PX);
  fs.mkdirSync(`${OUT}/crops`, { recursive: true });
  const file = `${OUT}/crops/${boat.id}.jpg`;
  if (!fs.existsSync(file)) {
    const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({ service: 'WMS', version: '1.3.0', request: 'GetMap', layers: 'Actueel_orthoHR', styles: '', crs: 'EPSG:28992', bbox: bbox.join(','), width: String(size), height: String(size), format: 'image/jpeg' }).toString();
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url).catch(e => e as Error);
      if (!(res instanceof Error) && res.ok) { fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); break; }
      if (attempt >= 4) throw Error(`${boat.id}: ${res instanceof Error ? res.message : res.status}`);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  const toPx = ([x, y]: [number, number]): [number, number] => [(x - bbox[0]) / PX, (bbox[3] - y) / PX];
  // Frame centre: metres east/north of the first vertex, in RD (axes agree to < 1 degree here).
  const [c] = [toPx([rd[0][0] + fr.cx, rd[0][1] + fr.cy])];
  return { file, size, bbox, ring: rd.map(toPx), cx: c[0], cy: c[1], ux: fr.ux, uy: -fr.uy, vx: fr.vx, vy: -fr.vy, length: fr.length, width: fr.width };
}
