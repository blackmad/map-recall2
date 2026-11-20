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

/**
 * `measured`: the surface colour was measured from open imagery (an orthophoto for a roof). The tag then writes
 * `tint: measured` and `tintSource: 'measured'`, so the city look draws that colour as is instead of mapping the palette
 * colour into its range: a light flat roof otherwise takes the warm-gravel tone whatever its colour (cityRoofTint has
 * gravel and bitumen for flat roofs, never the pale membrane; the Ziggo Dome's white membrane read tan, lane #226).
 */
export type SlotTag = {readonly slot: MaterialSlot; readonly why: string; readonly measured?: string};

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
  'handelsbank-singel-250': {
    sandstone: {slot: 'stone', measured: '#a99c86', why: 'warm grey-beige Bentheimer sandstone of the bank fronts, lit (Gemeente Amsterdam panoramas w01-10, w02-104; blind review read #a99c86 lit, #8c8170 in shade); the city look drew it cream'},
    stone: {slot: 'stone', measured: '#7f7b74', why: 'grey granite plinth, the rustication joints and the festoon panels (w01-10, w03-103)'},
  },
  'holland-casino-amsterdam': {
    ochre: {slot: 'stone', measured: '#8a5a3a', why: 'mid-brown timber of the deck, pergola rafters and lattice screens (w03-257, w07-252; blind review #8a5a3a); the look drew it pale orange'},
    concrete: {slot: 'stone', measured: '#d6d6d4', why: 'cool light-grey tiles of the set-back storey and the drum, and the white banners (w03-257, w04-245)'},
    bronze: {slot: 'accent', measured: '#b08a4a', why: 'bronze-gold HOLLAND CASINO letters on the roof edge (w03-257)'},
  },
  'mauritskade-61': {
    red: {slot: 'roofTile', why: 'red-brown tiled roofs over the wings and middle range (w01-59, w08-329); palette red, not brick'},
    concrete: {slot: 'stone', why: 'cream-painted timber eave and brackets (w01-59)'},
    brick: {slot: 'brick', measured: '#5a4038', why: 'dull dark purple-brown brick (w01-59 rectified, w08-329 2025: #5e4038-#6a4a40; blind reviews 2026-11-15: the palette brick read oxblood, #6e5044 still drew orange-red lit)'},
    sandstone: {slot: 'stone', measured: '#a8a596', why: 'light grey stone lintels, sills, string courses and reveals (w08-329 2025; blind review 2026-11-15: #c9bea4 drew cream-yellow)'},
    dark: {slot: 'frame', measured: '#2a302a', why: 'green-black window frames, repainted for the hotel (mk61-front 2022, mk61-nw 2024)'},
    glass: {slot: 'glass', measured: '#2e3438', why: 'dark glazing in deep reveals (mk61-nw 2024; the palette glass read pale blue)'},
  },
  'houthavenkade-26': {
    ochre: {slot: 'brick', why: 'palette name only: the orange brick of the east Haparandaweg block (w01-2, 2025_09_29_07_54_42_00183)'},
    stone: {slot: 'brick', why: 'palette name only: the dark grey-brown brick of the Houthavenkade townhouses (w02-182)'},
    concrete: {slot: 'stucco', why: 'pale grey render and concrete of the gate building and the flat roofs (w06-320)'},
    sandstone: {slot: 'stucco', why: 'white floor slabs of the gate building and the white bands of the west range (w06-320, w03-272)'},
  },
  'politiebureau-raampoort': {
    concrete: {slot: 'brick', measured: '#5e6670', why: 'palette name only: the blue-grey brick water plinth on the Singelgracht (TMX7316010203-000205_pano_0000_000212/213)'},
  },
  'roode-leeuw-damrak': {
    ochre: {slot: 'brick', why: 'palette name only: the darker brick of the relieving arches over the second-floor windows (w02-134)'},
    slate: {slot: 'roofTile', measured: '#5e4a42', why: 'red-brown tiles of the schilddak (w02-134)'},
    sandstone: {slot: 'stucco', why: 'white-painted clerestory and fascia of the 1935 terrace (w02-134)'},
    bronze: {slot: 'paint', why: 'black-painted ironwork: balcony railings, terrace mullions and rail, letter frame, flag poles'},
    canopyGlass: {slot: 'glass', why: 'leaded coloured upper lights of the first-floor windows (w02-134)'},
  },
  'port-van-cleve': {
    brick: {slot: 'brick', measured: '#5e342b', why: 'deep red-brown brick of the hotel front in shade (nzv-0, TMX7316010203-001900_pano_0006_000054; blind review 2026-11-15 read #5a3830-#6b4236; #7e4a3e and #6e3e34 still drew orange-red in the lit game frame)'},
    sandstone: {slot: 'stone', measured: '#776b5e', why: 'weathered buff-grey sandstone bands, pediments, surrounds and pinnacles: nzv-0 reads #5a5654-#64615e overcast, a blind review #8f8170 (2026-11-15: #958a78 and #7a705f drew cream lit, the neutral #6b6560 read cool mauve-grey)'},
    glass: {slot: 'glass', measured: '#2a2a2e', why: 'dark glazing of the hotel front (nzv-0; blind review 2026-11-15: the unmeasured glass cell drew pale periwinkle)'},
    frame: {slot: 'frame', measured: '#4a3028', why: 'dark brown timber window frames of the hotel front (nzv-0)'},
    ochre: {slot: 'brick', measured: '#4e3a34', why: 'palette name only: the dark purple-brown brick of the later Spuistraat hotel block (w02-290; blind re-read 2026-11-15 read #4a3a34)'},
    stone: {slot: 'stone', measured: '#8c8a84', why: 'grey stone ground-floor arcade and plinth (nzv-0)'},
    pink: {slot: 'accent', why: 'red neon letters of the roof sign die PORT van CLEVE (TMX7316010203-001900_pano_0006_000054)'},
    concrete: {slot: 'stone', why: 'white stone frieze panels, sign lettering and the stepped-gable house\'s white ground floor and step caps (w02-290)'},
    greyBrick: {slot: 'slate', why: 'lead dome over the annex erker (w04-117)'},
    bronze: {slot: 'frame', why: 'dark letters of the frieze and the steel frame of the roof sign'},
    blue: {slot: 'paint', why: 'dark blue entrance canopy and the De Blauwe Parade sign panel'},
  },
  'room-mate-aitana': {
    glass: {slot: 'paint', why: 'curtain wall: pale reflective glazing that mirrors the sky (w01-183 #687d9c, the 2018 IJdok frame pale green-white); the glass slot drew it opaque dark slate, unrecognisable in the blind review, so it is a pale panel'},
    dark: {slot: 'glass', why: 'darker opening lights in the window strips'},
    frame: {slot: 'frame', why: 'dark grey aluminium transoms and mullions (w01-183 #3c4447-#545b61)'},
    stone: {slot: 'paint', why: 'grey metal plinth panels (w01-183 #74726e at gain 1.04)'},
  },
  'oba-staatsliedenbuurt': {
    brick: {slot: 'brick', measured: '#5e504b', why: 'dark purple-brown brick of the block: w02-121 (2017) #4c413d at gain 1.26 on its white frames; w01-210 (2024) #68625d at gain 0.85, green cast removed'},
    stone: {slot: 'brick', measured: '#b3ada0', why: 'cream brick bands and the bay towers: w01-210 #d7e9dd at gain 0.85 (cast removed), w02-121 #87867c at 1.26; the 2025 Van Hallstraat frame read it yellower than the photo at #c8c2b2, so the overcast w02 value leads'},
    greyBrick: {slot: 'brick', why: 'dark blue-grey glazed brick of the corner tower and the passage piers (w04-211, w06-211)'},
    ochre: {slot: 'paint', why: 'pale rendered walls of the set-back top storeys (w01-210, w02-121), not ochre brick'},
    blue: {slot: 'brick', why: 'the corner tower walls of the 3DBAG shell: dark blue-grey glazed brick (w04-211, w06-211)'},
    pink: {slot: 'paint', why: 'the shaded back wall of the balcony bays and the passage'},
    frame: {slot: 'frame', why: 'grey steel truss over the passage (w04-211)'},
  },
  wilhelminatoren: {
    brick: {slot: 'brick', measured: '#9e8576', why: 'salmon-brown brick of the tower: w01-67T (2022) #998072-#a48f83 at gain 1.13 on its white frames, w03-338T (2021) #9f8579 at gain 0.95'},
    greyBrick: {slot: 'brick', measured: '#6a5454', why: 'palette name only: the dark purple-brick panels between windows, w01-67T #604c4c at gain 1.13'},
    canopyGlass: {slot: 'paint', why: 'pale see-through glazing of the escape stair (w01-67T #90989e; the 2021 WG-plein frame): the glass slot draws it near-black, so it is tagged as a pale panel'},
    bronze: {slot: 'frame', why: 'blue-grey steel of the escape stair and the loggia rails'},
  },
  'schiller-rembrandtplein': {
    brick: {slot: 'brick', measured: '#846b66', why: 'muted mauve-brown brick of the hotel front: w01-348 (TMX7316010203-001900_pano_0005_000734, 2020-08-31) brick piers of the upper floors #816a67-#85726e (trimmed median), white frames #d4d4d7 as the 215 light-trim reference (measureFacade convention, gain 1.01). Was #5a3530, a blind read that drew saturated red (gain experiment 2026-11-16: photo #79635d, drawn #4e2c29)'},
    sandstone: {slot: 'stone', measured: '#b3a58e', why: 'pale beige-grey stone of the oriels, the corner tower and the window dressings (w01-348)'},
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
  'ziggo-dome': {
    slate: {slot: 'bitumen', measured: '#e8e7e3', why: 'flat roof of white membrane: PDOK luchtfoto Actueel_orthoHR over the roof, four 100 x 70 px samples #e6e6e2-#eae9e5 (median #e8e7e3); the roof-facts sidecar reads the same pand white-membrane #e6e6de at confidence 0.8. Not slate, and not the gravel the look gave it'},
  },
  'da-costakade-146': {
    ochre: {slot: 'brick', why: 'ochre brick of the 1902 Tetterode factory front (monument register 524828 "okerkleurige bakstenen"; w01-248, Commons Bilderdijkstraat 163.jpg)'},
    pink: {slot: 'brick', why: 'brown brick of the 1898 dairy front (register 524830 "bruine steen"; w01-248, Commons Bilderdijkstraat 159.jpg)'},
    sandstone: {slot: 'brick', why: 'cream brick of the Da Costakade 136-140 housing block (w05-67, w07-68, w11-67); also the cream-painted dormers and cornice consoles of the 1909 range (w02-67)'},
    gold: {slot: 'door', why: 'brown varnished wooden doors of the factory side parts (w01-248: the double door at n 39 and the door at n 62.6)'},
    copper: {slot: 'roofTile', why: 'red-brown pantiles on the dairy gable and its short roof (register 524830 "zadeldak met pannen", "dakschild met pannen")'},
  },
  'andreas-ensemble': {
    sandstone: {slot: 'brick', why: 'the WestCord Fashion Hotel tower: buff brick that reads ochre-yellow in sun (w12-90 sunlit brick #e4c9a0, Lab h 82; w06-90 upper storeys), drawn apart from the warm red-brown Lelylaan bar and west wing brick'},
  },
};

/**
 * The glTF extras a declared tag writes over the inferred ones (`base`: inferredSlotExtras of the palette name and colour).
 * Without `measured` this is exactly the pre-#226 tag: slot and tag mark over the inferred extras.
 */
export function tagExtras<B extends {tint: string}>(base: B, tag: SlotTag): B & {materialSlot: MaterialSlot; materialSlotTag: string; tintSource?: 'measured'} {
  if (tag.measured !== undefined && !/^#[0-9a-f]{6}$/.test(tag.measured)) throw Error(`measured tint must be #rrggbb lower case: ${tag.measured}`);
  return {...base, materialSlot: tag.slot, materialSlotTag: MATERIAL_SLOT_TAG, ...(tag.measured ? {tint: tag.measured, tintSource: 'measured' as const} : {})};
}

/** The declared slot for a palette name in a model, if any. */
export const slotTagFor = (id: string, materialName: string): SlotTag | undefined => MATERIAL_SLOT_TAGS[id]?.[materialName];

/**
 * A spec-stated wall colour (`materialOverrides` of the landmark's spec) drawn as stated. Unmeasured, the city look maps a
 * brick/accent tint into the city range and paints it on a period brick cell (palette.ts `cityTint` -> `cityWallTint`), so
 * Victoriabad's stated #5f4b41 drew orange; `tintSource: 'measured'` takes the measured path instead (`cityMeasuredWallTint`:
 * the canal brick cell, divided by its mean). Only brick/accent slots, only when the material's colour is the stated one, and
 * never over a tag's own measured tint. Without an override the extras come back unchanged (same object).
 */
export function statedOverrideExtras<B extends {materialSlot: MaterialSlot; tint: string; tintSource?: 'measured'}>(base: B, override: string | undefined, hex: string): B | (B & {tintSource: 'measured'}) {
  if (override === undefined || override.toLowerCase() !== hex.toLowerCase() || base.tintSource !== undefined) return base;
  return base.materialSlot === 'brick' || base.materialSlot === 'accent' ? {...base, tintSource: 'measured' as const} : base;
}
