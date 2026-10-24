/** The period-walls strip's places and cameras (period-walls-strip.spec.ts, scripts/look/period-walls-panos.ts). */
/** centre on the street; axis = the street bearing the chase camera looks along. */
export type Place = { name: string; centre: [number, number]; axis: number; row?: { target: [number, number]; from: number } };
export const WALL_PLACES: Place[] = [
  { name: 'nassaukade', centre: [4.87595, 52.36847], axis: 333, row: { target: [4.87590, 52.36800], from: 70 } },
  { name: 'bloemgracht', centre: [4.88111, 52.37488], axis: 62 },
  { name: 'pijp-govert-flinck', centre: [4.89055, 52.35457], axis: 67 },
  { name: 'zuid-verhulst', centre: [4.87744, 52.35586], axis: 247 },
  { name: 'nieuwwest-deyssel', centre: [4.81514, 52.37731], axis: 99 },
];
export const move = ([lng, lat]: readonly number[], bearingDeg: number, metres: number): [number, number] => {
  const r = (bearingDeg * Math.PI) / 180;
  return [lng + (Math.sin(r) * metres) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (Math.cos(r) * metres) / 110540];
};
export const CAMERAS = (p: Place) => ({
  chase: { eye: move(p.centre, p.axis + 180, 35), altM: 3, target: move(p.centre, p.axis, 35), targetAltM: 5 },
  aerial: { eye: move(p.centre, p.axis + 135, 150), altM: 75, target: p.centre, targetAltM: 6 },
  // The row under question seen across the street from first-floor height (where the chase misses it).
  ...(p.row ? { row: { eye: move(p.row.target, p.row.from, 75), altM: 18, target: p.row.target, targetAltM: 9 } } : {}),
});
