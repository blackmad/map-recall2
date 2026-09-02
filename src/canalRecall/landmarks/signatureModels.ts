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
 * Expected height of the Royal Palace, in metres, to the tip of the
 * weathervane. This is an assertion, not an input: the model is scaled to its
 * surveyed footprint width and this is what the check script requires the
 * result to land near.
 *
 * Dutch Wikipedia and Wikidata (Q1056152) both state 90 m, and both are wrong
 * in the same way — almost certainly the facade's 80 m width mis-entered as a
 * height and then copied between them. Scaling the mesh to the 80.98 m
 * surveyed footprint puts the cupola at 53.6 m, neighbouring Dam buildings
 * carry surveyed OSM heights of 27–32 m, and the Palace's cornice reads as a
 * little above those with the tower rising well past. Roughly 51 m is the
 * figure those agree on; the tolerance below is wide enough to cover the
 * difference between the ridge, the cupola and the vane on top of it.
 */
const ROYAL_PALACE_HEIGHT_METRES = 51;
const ROYAL_PALACE_HEIGHT_TOLERANCE_METRES = 4;

export const SIGNATURE_MODELS: readonly SignatureModelSpec[] = [
  {
    id: 'royal-palace',
    name: 'Royal Palace of Amsterdam',
    landmarkId: 'extract_landmarks_342809743',
    modelUrl: './models/royal-palace.glb',
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
      title: 'Amsterdam Monument Het Paleis op de Dam 4k A.I.',
      author: 'Jungle Jim (sketchfab.com/jungle_jim)',
      sourceUrl:
        'https://sketchfab.com/3d-models/amsterdam-monument-het-paleis-op-de-dam-4k-ai-d6553e1a6e6f4859a6da4debb5d5a485',
      licence: 'CC BY 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
      modifications:
        'Reduced for the web, not changed artistically: two spare UV sets and tangents removed, '
        + 'vertices welded and decimated from 499,667 to 59,989 triangles, textures resized to '
        + '1024 px and re-encoded as WebP, geometry quantized and meshopt-compressed, 30.99 MB to '
        + '1.08 MB. Placed, scaled and rotated to its surveyed OpenStreetMap footprint.',
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
