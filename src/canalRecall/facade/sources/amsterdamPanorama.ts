/**
 * Amsterdam's own street-level panoramas as the façade-observation source.
 *
 * *Kernregistratie Panoramabeelden*, published by the Gemeente Amsterdam under
 * CC BY 4.0. This matters for more than cost: the build prompt forbids shipping
 * third-party imagery as an asset, and an openly licensed municipal source is
 * the one street-level imagery that a derived measurement can cite openly and
 * that a rectified elevation can be published against.
 *
 * Properties that make it usable for façade measurement rather than just
 * illustration:
 *
 *   - full equirectangular captures, so a façade is visible regardless of which
 *     way the car was pointing when it passed;
 *   - a shot roughly every 5 m, so most quay-facing walls are seen many times
 *     and a blocked view is usually a solved problem rather than a lost façade;
 *   - missions from 2016 onward, which is what makes the brief's leaf-off
 *     requirement satisfiable — the same wall exists in winter and summer and
 *     the winter one can be chosen;
 *   - published camera position and orientation, so visibility is a geometry
 *     question answerable before any image is downloaded.
 */
import type { BboxLngLat, ImagerySource, LngLat, PanoramaView } from '../sources.ts';

const API = 'https://api.data.amsterdam.nl/panorama/panoramas/';
const PAGE_SIZE = 500;

/**
 * Amsterdam's panorama heights are ellipsoidal, while everything else in this
 * pipeline is NAP. The separation over Amsterdam is about 43.5 m; it is applied
 * here so a camera height can be compared with a 3DBAG ground level, and it is
 * checked against measured ground levels rather than trusted.
 */
/**
 * Where Gemeente Amsterdam puts the heading direction in an equirectangular
 * frame: at the **left edge**, so azimuth 0 maps to u = 0.
 *
 * Established by rendering the same wall from the same panorama under both
 * conventions for six buildings and looking at the results. Under the other
 * convention they are a bridge parapet, a street receding to a vanishing point
 * and a blank sky; under this one they are canal houses. Pinned by
 * `check-facade-yaw.ts`.
 *
 * It lives here rather than in the rectifier because it is a fact about this
 * publisher, not about rectification, and the previous arrangement — a default
 * in the rectifier that five scripts inherited without stating — is what let a
 * 180° error reach every measurement in the pilot.
 */
/**
 * Is this pose usable at all?
 *
 * Amsterdam publishes a missing value as a zero, in two different fields, and
 * neither is signalled any other way. Verified against the API itself rather
 * than inferred from our cache:
 *
 *     recording_2025-06-16_…  coordinates [lng, lat, 0.0]   heading 0 pitch 0 roll 0
 *     b_20241121_1354_…       coordinates [lng, lat, 0.0]   heading 3.14 pitch 1.68 roll -0.18
 *
 * So of 139,937 panoramas: **15,312 publish a zero height** — all of 2024 and
 * 2025 — and of those, the **7,317 `recording_*` frames from 2025 also publish
 * heading, pitch and roll as exactly zero**, which is absent orientation, not a
 * camera pointing due north perfectly level. The other 7,995, the 2024 `b_*`
 * batch, carry a real orientation and only lack height.
 *
 * The photographs are fine. What was wrong was this pipeline's handling: a zero
 * height went through `cameraHeight - GEOID_SEPARATION_M` and became a lens
 * 43.5 m *below* NAP, forty-six metres under the street. The rectifier then
 * faithfully computed the directions from there up to a wall and returned
 * roofline and sky — a well-formed picture of the wrong thing, which is this
 * project's signature failure. 249 of 2,180 measured façades were measured that
 * way, so any cross-view comparison including one was guaranteed to disagree.
 *
 * A missing value must never be arithmetic. Both forms are rejected here.
 *
 * The rest of the fleet confirms the geoid constant independently: median
 * published height 46.69 m is 3.19 m NAP after the separation, 2.56 m above
 * this boundary's typical ground of 0.63 m — right for a survey vehicle's lens.
 */
export const hasUsablePose = (view: {
  cameraHeight: number; headingDeg: number; pitchDeg: number; rollDeg: number;
}) =>
  Number.isFinite(view.cameraHeight) && view.cameraHeight > 0
  && Number.isFinite(view.headingDeg)
  // All three exactly zero is the other way this feed says "no orientation".
  && !(view.headingDeg === 0 && view.pitchDeg === 0 && view.rollDeg === 0);

export const AMSTERDAM_YAW_CONVENTION = 'edge' as const;

export const GEOID_SEPARATION_M = 43.5;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const amsterdamPanoramas: ImagerySource = {
  id: 'amsterdam-panorama',
  name: 'Kernregistratie Panoramabeelden, Gemeente Amsterdam',
  license: 'CC BY 4.0',
  attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',

  async fetchViews(bbox: BboxLngLat, options: { capturedAfter?: string } = {}): Promise<PanoramaView[]> {
    const [west, south, east, north] = bbox;
    // The API takes a centre and a radius, not a bbox, so cover the area with
    // overlapping discs. 150 m spacing with a 130 m radius leaves no gap.
    const midLat = (south + north) / 2;
    const metresPerDegLat = 111_320;
    const metresPerDegLon = metresPerDegLat * Math.cos((midLat * Math.PI) / 180);
    const stepLat = 150 / metresPerDegLat, stepLon = 150 / metresPerDegLon;

    const views = new Map<string, PanoramaView>();
    const centres: LngLat[] = [];
    for (let lat = south; lat <= north + stepLat; lat += stepLat)
      for (let lng = west; lng <= east + stepLon; lng += stepLon) centres.push([lng, lat]);

    let done = 0;
    for (const [lng, lat] of centres) {
      let url: string | null = `${API}?near=${lng.toFixed(6)},${lat.toFixed(6)}&radius=130&srid=4326&page_size=${PAGE_SIZE}`
        + (options.capturedAfter ? `&timestamp_after=${options.capturedAfter}` : '');
      while (url) {
        let payload: any;
        for (let attempt = 0; ; attempt++) {
          try {
            const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(45_000) });
            if (response.ok) { payload = await response.json(); break; }
            if (response.status < 500 && response.status !== 429) throw new Error(`panorama API: HTTP ${response.status}`);
          } catch (error) {
            if (attempt >= 4) throw error;
          }
          await wait(700 * 2 ** attempt);
        }
        for (const item of payload._embedded?.panoramas ?? []) {
          if (views.has(item.pano_id)) continue;
          const [x, y, z] = item.geometry.coordinates;
          if (x < west || x > east || y < south || y > north) continue;
          views.set(item.pano_id, {
            panoramaId: item.pano_id,
            lngLat: [x, y],
            cameraHeight: z,
            headingDeg: item.heading,
            pitchDeg: item.pitch,
            rollDeg: item.roll,
            capturedAt: item.timestamp,
            imageUrl: item._links?.equirectangular_full?.href ?? '',
            previewUrl: item._links?.equirectangular_small?.href ?? null,
            missionYear: item.mission_year ?? null,
          });
        }
        url = payload._links?.next?.href ?? null;
      }
      done++;
      if (done % 10 === 0) process.stdout.write(`\r  ${done}/${centres.length} discs — ${views.size} panoramas`);
    }
    process.stdout.write(`\r  ${done}/${centres.length} discs — ${views.size} panoramas\n`);
    return [...views.values()];
  },
};

/**
 * Leaf-off months, which the brief requires "wherever the choice exists".
 *
 * Amsterdam's canal elms occlude precisely the façades this project exists to
 * reconstruct, so a summer capture of a quay-facing wall is often a picture of
 * a tree. November to March inclusive.
 */
export const isLeafOff = (capturedAt: string): boolean => {
  const month = new Date(capturedAt).getUTCMonth() + 1;
  return month >= 11 || month <= 3;
};
