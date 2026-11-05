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
  'magere-brug': {
    green: {slot: 'paint', why: 'white-painted timber leaves, portals and balance beams (Magere brug amsterdam.jpg, Magerebrug.jpg); palette name only, the override colour is the measured white'},
    copper: {slot: 'paint', why: 'dark-painted iron rods, struts, railings and lantern posts'},
    bronze: {slot: 'paint', why: 'tarred timber bascule piers, fender piles and the counterweight box'},
  },
  'da-costakade-146': {
    ochre: {slot: 'brick', why: 'ochre brick of the 1902 Tetterode factory front (monument register 524828 "okerkleurige bakstenen"; w01-248, Commons Bilderdijkstraat 163.jpg)'},
    pink: {slot: 'brick', why: 'brown brick of the 1898 dairy front (register 524830 "bruine steen"; w01-248, Commons Bilderdijkstraat 159.jpg)'},
    sandstone: {slot: 'brick', why: 'cream brick of the Da Costakade 136-140 housing block (w05-67, w07-68, w11-67); also the cream-painted dormers and cornice consoles of the 1909 range (w02-67)'},
    gold: {slot: 'door', why: 'brown varnished wooden doors of the factory side parts (w01-248: the double door at n 39 and the door at n 62.6)'},
    copper: {slot: 'roofTile', why: 'red-brown pantiles on the dairy gable and its short roof (register 524830 "zadeldak met pannen", "dakschild met pannen")'},
  },
};

/** The declared slot for a palette name in a model, if any. */
export const slotTagFor = (id: string, materialName: string): SlotTag | undefined => MATERIAL_SLOT_TAGS[id]?.[materialName];
