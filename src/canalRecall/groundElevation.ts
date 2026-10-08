/** Render heights are metres NAP. Relative building heights stay relative. */
export type LngLat = readonly [number, number];
export type GroundSample = { heightM: number; quality: 'measured' | 'bridge' | 'interpolated' | 'water' | 'unknown'; ready: boolean };
export const UNKNOWN_GROUND: GroundSample = { heightM: 0, quality: 'unknown', ready: false };
export function elevationTile(lng: number, lat: number, zoom = 16) {
  const n = 2 ** zoom;
  const x = (lng + 180) / 360 * n;
  const y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  return { x: Math.floor(x), y: Math.floor(y), u: (x - Math.floor(x)) * 256, v: (y - Math.floor(y)) * 256 };
}
export function decodeTerrainRGB(r: number, g: number, b: number): number { return -10000 + (r * 65536 + g * 256 + b) * .1; }
export type ElevationPixels = { rgb: Uint8ClampedArray; quality: Uint8ClampedArray };
export function sampleElevationPixels(tile: ElevationPixels, u: number, v: number): GroundSample {
  const x = Math.max(0, Math.min(255, u - .5)), y = Math.max(0, Math.min(255, v - .5));
  const i = (Math.round(y) * 256 + Math.round(x)) * 4;
  const q = tile.quality[i];
  if (q === 0) return { ...UNKNOWN_GROUND, ready: true };
  if (q === 254) return { heightM: 0, quality: 'water', ready: true };
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  let h = 0, weight = 0;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const at = (Math.min(255,y0+dy)*256+Math.min(255,x0+dx))*4;
    // Do not blend across a shoreline or into unknown ground.
    if (tile.quality[at] === 0 || tile.quality[at] === 254) continue;
    const w = (dx ? tx : 1-tx)*(dy ? ty : 1-ty);
    h += decodeTerrainRGB(tile.rgb[at],tile.rgb[at+1],tile.rgb[at+2])*w;weight += w;
  }
  return { heightM: weight ? h/weight : 0, quality: q === 253 ? 'bridge' : q === 255 ? 'measured' : 'interpolated', ready: true };
}
export function footprintGround(geometry: any, sample: (p: LngLat) => GroundSample): number {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  const heights: number[] = [];
  for (const polygon of polygons) {
    const ring = polygon[0] || [];
    const step = Math.max(1, Math.ceil((ring.length-1)/8));
    for (let i=0;i<ring.length-1;i+=step) {
      for (const point of [ring[i],[(ring[i][0]+ring[i+1][0])/2,(ring[i][1]+ring[i+1][1])/2]]) {
        const value = sample(point as LngLat);
        if (value.ready && value.quality !== 'unknown' && value.quality !== 'water') heights.push(value.heightM);
      }
    }
  }
  heights.sort((a,b)=>a-b);
  return heights.length ? heights[Math.floor(heights.length/2)] : 0;
}
export function groundVehiclePose(sample: (p: LngLat) => number, at: LngLat, angle: number, contacts: readonly [number,number] = [-.8,.8]) {
  const [rear,front] = contacts;
  if (front-rear<.1) return {heightM:sample(at),pitch:0};
  const height=(d:number,pitch:number)=>sample([at[0]+Math.cos(angle)*d*Math.cos(pitch)/(111320*Math.cos(at[1]*Math.PI/180)),at[1]-Math.sin(angle)*d*Math.cos(pitch)/111320]);
  let pitch=0, heightM=sample(at);
  for(let i=0;i<3;i++) {const a=height(rear,pitch),b=height(front,pitch);pitch=Math.asin(Math.max(-.5,Math.min(.5,(b-a)/(front-rear))));heightM=a-rear*Math.sin(pitch);}
  return {heightM,pitch};
}
