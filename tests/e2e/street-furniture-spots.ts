// The likeness spots of lane #170 (and #212's Pijp container cluster) (street-furniture-shots.spec.ts, scripts/street-furniture/likeness-sheet.ts).
/** `stand`: on the street where the panorama was taken; `bearing` toward the object. */
export const SPOTS = [
  // Prinsengracht at the Noordermarkt: the four-container cluster (rest, rest, papier, glas), afval-* clusterId 121040|488285.
  { name: 'prinsengracht-containers', stand: { lng: 4.887311, lat: 52.379667, bearing: 248 }, object: [4.8872094, 52.3796423], pano: 'recording_2025-06-16_03-46-32_01850' },
  // De Pijp (#212): a rest/papier/glas cluster of the classic Amsterdam Standaard column (clusterId 121618.639|485569.861).
  { name: 'pijp-containers', stand: { lng: 4.897287, lat: 52.356994, bearing: 280 }, object: [4.89719, 52.357005], pano: 'recording_2025-09-29_09-14-27_01854' },
  // De Pijp: a street of hooked poles and a container pair.
  { name: 'pijp-lamps', stand: { lng: 4.895686, lat: 52.354935, bearing: 22 }, object: [4.8956506, 52.3549939], pano: 'recording_2025-07-15_09-44-59_01996' },
  // Nassaukade tram stop: the abri measured for the model.
  { name: 'nassaukade-abri', stand: { lng: 4.871059, lat: 52.381369, bearing: 88 }, object: [4.8711731, 52.3813721], pano: '2025_10_02_06_52_49_00943' },
  // Nassaukade at the Da Costakade end (user photo 2026-11-07): two above-ground BG boxes, afval-189468 and afval-203765.
  { name: 'nassaukade-bg-boxes', stand: { lng: 4.874144, lat: 52.372973, bearing: 68 }, object: [4.874238, 52.372997], pano: 'b_20241211_0838_Track65_Sphere_00006' },
  // Amstelveld on the Prinsengracht (2026-11-12): the krul measured for the urinal model (toilet-30, maps.amsterdam.nl openbare toiletten).
  { name: 'amstelveld-krul', stand: { lng: 4.896238, lat: 52.362003, bearing: 336 }, object: [4.8961937, 52.3620631], pano: 'recording_2025-06-19_03-28-47_02005' },
  // Singel across from the Bloemenmarkt (toilet-1): the krul with a dakje, measured for the heights.
  { name: 'singel-krul', stand: { lng: 4.890186, lat: 52.367299, bearing: 251 }, object: [4.8900955, 52.3672802], pano: 'recording_2025-06-19_03-28-47_01544' },
] as const;
