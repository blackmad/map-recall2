/**
 * Screen <-> ground through the matrix MapLibre draws with (#129).
 *
 * maplibre-gl 5.24 `MercatorTransform._calcMatrices` builds `_pixelMatrix`, which `map.project` / `map.unproject` use,
 * before it lifts the camera by the centre elevation (`translate(0, 0, -elevation)`). The frame itself is drawn with
 * `_viewProjMatrix`, which includes the lift. While the rider is on a deck (`elevation` != 0), `map.project` misses
 * the drawn ground by about 6 px per metre at z18. Canvas pins and taps go through the drawn matrix instead.
 *
 * Picking with `queryRenderedFeatures` is a different case: MapLibre matches its query pixel through `_pixelMatrix`.
 * So a tap is first unprojected through the drawn matrix, then re-projected with `map.project` (`queryPixel`).
 */
type Mat4 = ArrayLike<number>;

export const mercatorXOf = (lng: number): number => (lng + 180) / 360;
export const mercatorYOf = (lat: number): number => (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
export const lngOf = (x: number): number => x * 360 - 180;
export const latOf = (y: number): number => (360 / Math.PI) * Math.atan(Math.exp(((180 - y * 360) * Math.PI) / 180)) - 90;

/** CSS pixel of the ground point (z = 0) at lng/lat, or null behind the camera. `vp` is column-major. */
export function projectGround(vp: Mat4, worldSize: number, lng: number, lat: number, width: number, height: number): { x: number; y: number } | null {
  const X = mercatorXOf(lng) * worldSize, Y = mercatorYOf(lat) * worldSize;
  const cx = vp[0] * X + vp[4] * Y + vp[12], cy = vp[1] * X + vp[5] * Y + vp[13], cw = vp[3] * X + vp[7] * Y + vp[15];
  if (!(cw > 0)) return null;
  return { x: ((cx / cw + 1) / 2) * width, y: ((1 - cy / cw) / 2) * height };
}

/** Column-major 4x4 inverse, or null when singular. */
export function invert4(m: Mat4): number[] | null {
  const a = Array.from(m) as number[];
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

/** The ground point (z = 0) drawn at a CSS pixel, as lng/lat; null above the horizon. */
export function unprojectGround(vp: Mat4, worldSize: number, px: number, py: number, width: number, height: number, inverse = invert4(vp)): { lng: number; lat: number } | null {
  if (!inverse) return null;
  const nx = (px / width) * 2 - 1, ny = 1 - (py / height) * 2;
  const at = (nz: number) => {
    const i = inverse;
    const x = i[0] * nx + i[4] * ny + i[8] * nz + i[12], y = i[1] * nx + i[5] * ny + i[9] * nz + i[13];
    const z = i[2] * nx + i[6] * ny + i[10] * nz + i[14], w = i[3] * nx + i[7] * ny + i[11] * nz + i[15];
    return [x / w, y / w, z / w];
  };
  const [x0, y0, z0] = at(0), [x1, y1, z1] = at(1);
  if (z0 === z1) return null;
  const t = z0 / (z0 - z1);
  if (!(t >= 0)) return null;
  const X = x0 + (x1 - x0) * t, Y = y0 + (y1 - y0) * t;
  return { lng: lngOf(X / worldSize), lat: latOf(Y / worldSize) };
}

interface MapLike {
  transform?: any;
  project(lngLat: any): { x: number; y: number };
  unproject(px: any): { lng: number; lat: number };
  getCanvas(): { clientWidth: number; clientHeight: number };
}

const lngLatOf = (v: any): [number, number] => Array.isArray(v) ? [v[0], v[1]] : [v.lng ?? v.lon, v.lat];
const pixelOf = (v: any): [number, number] => Array.isArray(v) ? [v[0], v[1]] : [v.x, v.y];

/**
 * `project` / `unproject` for a MapLibre map that agree with what it draws. They return MapLibre's own Point / LngLat
 * objects. With the camera at elevation 0 the two matrices agree, so these return `map.project` / `map.unproject`
 * unchanged.
 */
export function drawnProjector(map: MapLike) {
  let cachedVp: Mat4 | null = null, cachedInverse: number[] | null = null;
  const lifted = () => {
    const t = map.transform;
    const vp: Mat4 | undefined = t?._viewProjMatrix ?? t?.currentTransform?._viewProjMatrix;
    const elevation = Number(t?.elevation ?? t?.currentTransform?.elevation ?? 0);
    const worldSize = Number(t?.worldSize ?? t?.currentTransform?.worldSize);
    return vp && Math.abs(elevation) > 1e-9 && Number.isFinite(worldSize) ? { vp, worldSize } : null;
  };
  const project = (lngLat: any) => {
    const p = map.project(lngLat);
    const m = lifted();
    if (!m) return p;
    const c = map.getCanvas(), [lng, lat] = lngLatOf(lngLat);
    const q = projectGround(m.vp, m.worldSize, lng, lat, c.clientWidth, c.clientHeight);
    if (q) { p.x = q.x; p.y = q.y; }
    return p;
  };
  const unproject = (px: any) => {
    const ll = map.unproject(px);
    const m = lifted();
    if (!m) return ll;
    if (m.vp !== cachedVp) { cachedVp = m.vp; cachedInverse = invert4(m.vp); }
    const c = map.getCanvas(), [x, y] = pixelOf(px);
    const q = unprojectGround(m.vp, m.worldSize, x, y, c.clientWidth, c.clientHeight, cachedInverse);
    if (q) { ll.lng = q.lng; ll.lat = q.lat; }
    return ll;
  };
  /** The pixel to hand `queryRenderedFeatures` for a tap at `px`, so it finds what was drawn under the finger. */
  const queryPixel = (px: any) => {
    if (!lifted()) return px;
    const ll = unproject(px);
    const p = map.project([ll.lng, ll.lat]);
    return Array.isArray(px) ? [p.x, p.y] : p;
  };
  return { project, unproject, queryPixel };
}
