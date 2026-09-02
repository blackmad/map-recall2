// The curated list. One entry per building worth recognising on sight.
//
// This is deliberately a hand-written file and not a generated one. Every field
// below is either a licence obligation or a judgement about a specific building
// that no automated pass can make: which way the facade faces, how tall the
// thing actually is when its own encyclopedia entry is wrong, and which OSM
// footprints the model stands in for. Generated numbers — mesh bounds, byte
// counts, triangle counts — live in `signature-landmarks.json` beside the GLB.
//
// The footprint values are pinned rather than computed at runtime so that a
// change to the Amsterdam extract cannot silently move a building. The check
// script re-derives them from the extract and fails if they drift.

import type { SignatureModelSpec } from './signaturePlacement';

/**
 * Height of the Royal Palace, in metres, to the tip of the weathervane.
 *
 * This is now measured rather than argued. The City of Amsterdam's own survey
 * model names its parts: `PD-natsteen`, the main stone mass, tops out at
 * 51.9 m, and `PD-haantje` — the rooster on the vane — reaches 60.9 m. So the
 * building is a little under 52 m and the thing on top of it adds nine more.
 *
 * Dutch Wikipedia and Wikidata (Q1056152) both say 90 m, and both are wrong in
 * the same way: almost certainly the 80 m facade width mis-entered as a height
 * and then copied between them. The tolerance below is tight because the
 * number no longer rests on inference.
 */
const ROYAL_PALACE_HEIGHT_METRES = 60.9;
const ROYAL_PALACE_HEIGHT_TOLERANCE_METRES = 1.5;

export const SIGNATURE_MODELS: readonly SignatureModelSpec[] = [
  {
    id: 'royal-palace',
    name: 'Royal Palace of Amsterdam',
    landmarkId: 'extract_landmarks_342809743',
    modelUrl: './models/royal-palace.glb',
    // Published by the city with the model, and independently within 15 m of
    // the rectangle fitted to the OSM ring — two sources that never consulted
    // each other agreeing on where the Palace is.
    surveyed: {
      anchor: [4.891409500306835, 52.373196352182916],
      northOffsetDegrees: 0,
      source: '3D Warehouse entity d1ad512d8df5fc6745407e0587dff10e, geo attribute',
    },
    // The Palace is OSM relation 3580875, a multipolygon; its outer ring is
    // way 342809743, which is the id the Amsterdam extract carries and the id
    // the vector tiles expose. Both are listed so that suppression works
    // whichever the basemap happens to hand us.
    suppressOsmIds: [342809743, 3580875],
    footprint: {
      centre: [4.891336694593322, 52.37314491172975],
      headingDegrees: 1.4350192765089105,
      lengthMetres: 80.97600419214265,
      widthMetres: 65.49286921449004,
    },
    heightMetres: ROYAL_PALACE_HEIGHT_METRES,
    heightToleranceMetres: ROYAL_PALACE_HEIGHT_TOLERANCE_METRES,
    // Dam square is reclaimed ground a little above NAP; the surrounding
    // basemap sits at zero and the model is drawn against it, so the anchor
    // altitude is zero rather than a true ellipsoidal height.
    groundAltitudeMetres: 0,
    // The fitted rectangle's long axis runs almost due north (1.4°). The
    // Palace's front — pediment, balcony, the entrance onto the Dam — faces
    // east across the square, so the facade is a quarter turn clockwise of the
    // long axis. Use −90 instead if a model turns out to be back-to-front.
    facingOffsetDegrees: 90,
    attribution: {
      title: 'Palace on the Dam',
      author: 'City of Amsterdam, Geo- en Vastgoedinformatie',
      sourceUrl: 'https://3dwarehouse.sketchup.com/model/d1ad512d8df5fc6745407e0587dff10e',
      licence: '3D Warehouse General Model License',
      licenceUrl: 'https://3dwarehouse.sketchup.com/tos/',
      modifications:
        'Cleaned up for the web, not changed artistically: SketchUp construction edges removed, '
        + 'faces made double-sided so inward-facing normals stop rendering black, spare UV sets '
        + 'and tangents dropped, textures re-encoded as WebP, geometry quantized and '
        + 'meshopt-compressed. Placed at the city\'s own published coordinate at its surveyed '
        + 'size, unscaled and unrotated.',
    },
  },
];

/** Looks up a spec by id. */
export function signatureModel(id: string): SignatureModelSpec | undefined {
  return SIGNATURE_MODELS.find(model => model.id === id);
}

/** Every OSM footprint that a signature model stands in for. */
export function suppressedOsmIds(): number[] {
  return SIGNATURE_MODELS.flatMap(model => [...model.suppressOsmIds]);
}
