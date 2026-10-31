/**
 * Explicit material slots for bespoke landmark builders (lane #138, re-tag of inferred slots).
 *
 * The landmark builders paint by palette name (`slate`, `red`, `ochre`, …) and the city look (`?cityLook=1`) reads a
 * slot from that name and colour (src/canalRecall/look/materialSlotInference.ts). Where the name says one material and
 * the building is another (a tiled roof drawn in `slate`, a painted steel container drawn in `red`, buff brick walls
 * drawn in `sandstone`), the builder declares the slot here, per model and per palette name, judged against the photo.
 *
 * `build-manual-landmarks.ts` writes the tag on export; `apply-material-slot-tags.ts` writes it into the shipped GLB and
 * its lod1 without touching geometry (JSON chunk only). The tag keeps `materialSlotSource: 'inferred'` so the default
 * look stays byte-for-byte as it is: signature-landmarks-source.js `_dress` treats any non-inferred slot as an opt-in to
 * the recipe look with the flag off. `materialSlotTag: 'builder'` marks it as declared, not guessed.
 */
import type {MaterialSlot} from '../../src/canalRecall/look/palette';

export type SlotTag = {readonly slot: MaterialSlot; readonly why: string};

export const MATERIAL_SLOT_TAG = 'builder';

export const MATERIAL_SLOT_TAGS: Readonly<Record<string, Readonly<Record<string, SlotTag>>>> = {
  'american-hotel': {
    slate: {slot: 'roofTile', why: 'red-orange clay tiles on the Leidseplein roofs (ref-se-sun.jpg), not slate'},
    sandstone: {slot: 'brick', why: 'the buff Jugendstil walls are yellow-buff brick with stone dressings (ref-se-sun.jpg); the shell walls are most of this material'},
    ochre: {slot: 'paint', why: 'striped awning canvas and lettering, painted, not brick'},
  },
  'uilenburger-synagoge': {
    slate: {slot: 'roofTile', why: 'mansard with a tiled roof (uilenburger-synagoge-research.json, historic photo)'},
  },
  'straat-museum': {
    ochre: {slot: 'paint', why: 'painted mural patch on the NDSM hall front'},
    pink: {slot: 'paint', why: 'painted mural panel, not render'},
  },
  pllek: {
    red: {slot: 'paint', why: 'Pllek is stacked shipping containers: painted corrugated steel, not brick'},
    ochre: {slot: 'paint', why: 'painted shipping container'},
  },
  'rem-eiland': {
    red: {slot: 'paint', why: 'REM-eiland: red-painted steel platform and legs, not brick'},
  },
  'faralda-crane-hotel': {
    red: {slot: 'paint', why: 'painted steel crane cab, legs and stair, not brick'},
  },
  'sea-palace': {
    red: {slot: 'paint', why: 'red-lacquered pontoon hull and columns of the floating restaurant, not brick'},
  },
  'joods-verzetsmonument': {
    dark: {slot: 'stone', why: 'a stele of polished black stone (builder header, Gemeente Amsterdam panoramas), not painted joinery'},
  },
  kalvertoren: {
    white: {slot: 'accent', why: 'white stone bands, keystones, portals and gable dressings on the red-brick Singel range (w01-192L)'},
    red: {slot: 'roofTile', why: 'red pantile saddle roofs behind the two Singel gables (tower-singel-even-e), not brick'},
    pink: {slot: 'paint', why: 'painted red shield of the Amsterdam arms over the west portal (w01-192)'},
    sandstone: {slot: 'stone', why: 'grey stone plinth of the Singel range'},
    concrete: {slot: 'stone', why: 'the roof colonnade columns and beam read as cast stone in w01-192L'},
    bronze: {slot: 'slate', why: 'dark metal caps of the stone-block attic and the tower (w03-190, crown-singel-265) and the curtain spandrels'},
    canopyGlass: {slot: 'glass', why: 'glass balustrades, the lattice canopies and the cafe storey'},
    dark: {slot: 'frame', why: 'dark window frames, rails, mullions and door leaves'},
  },
};

/** The declared slot for a palette name in a model, if any. */
export const slotTagFor = (id: string, materialName: string): SlotTag | undefined => MATERIAL_SLOT_TAGS[id]?.[materialName];
