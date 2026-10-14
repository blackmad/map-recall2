// Fills scripts/landmarks/roeterseiland-rec-a-inventory.json from the brief's crops (each crop was looked at; see `note`s). Re-runnable: starts from the skeleton's walls.
import fs from 'node:fs';
const file = 'scripts/landmarks/roeterseiland-rec-a-inventory.json';
const inv = JSON.parse(fs.readFileSync(file, 'utf8'));
const P = {
  w01: 'TMX7316010203-001681_pano_0000_003275', w02: 'TMX7316010203-000354_pano_0002_000218', w04: 'TMX7316010203-001975_pano_0000_000894', w06: 'TMX7316010203-001975_pano_0000_000886',
  w07: 'TMX7316010203-000354_pano_0002_000110', w08: 'b_20241210_1246_Track30_Sphere_00077', w09: 'TMX7316010203-001908_pano_0000_004246', w10: 'TMX7316010203-001975_pano_0000_000892',
  w15: 'TMX7316010203-002047_pano_0000_001463', w19: 'TMX7316010203-002047_pano_0000_001461', w30: 'TMX7316010203-001975_pano_0000_000887', w39: 'TMX7316010203-000354_pano_0002_000214',
};
const item = (id, kind, where, size, plan, how, seenIn, extra = {}) => ({id, kind, where, approxSizeM: size, plan, ...(how ? {how} : {}), seenIn, ...extra});
const items = {
  'w01-280': [
    item('west-steel-window-grid', 'window-shape', 'four storeys of large steel-framed multi-light windows on Roetersstraat, 3.6 m bays', [64, 15], 'modelled', 'flush window sheets with two mullions and a transom per bay (roeterseiland-builder flush style west-beige), 4 storeys of 3.8 m', P.w01),
    item('west-ground-shopfronts', 'window-shape', 'ground storey: shop-front glazing, entrances and a bike row along the pavement', [64, 4], 'simplified', 'ground storey carries the same window sheets as the upper storeys; no shop fascias or entrances drawn', P.w01),
    item('west-curved-eave', 'other', 'rounded corner and shallow overhanging eave line at the top of the block', [64, 1], 'simplified', 'flat 3DBAG roof edge, no eave overhang', P.w01),
  ],
  'w02-253': [
    item('bridge-passage-soffit', 'other', 'the 38 m wide, 15.2 m high canal passage under the bridge block with its dark mirrored soffit and glazed channel walls', [38, 15.2], 'modelled', 'roeterseiland-void.ts: shell clipped to the soffit, soffit quad, two glazed channel walls with 1.2 m mullion boxes', P.w02, {sheetBox: [0.01, 0.4, 0.69, 0.66]}),
    item('city-room-glazing', 'window-shape', 'two storeys of glass curtain wall with a transom over the passage', [38, 7.5], 'modelled', 'glass sheet per 1.83 m bay with closed-box mullion/transom grid on the kit sheet layers (drawCurtainGrid)', P.w02, {sheetBox: [0.0, 0.15, 0.7, 0.4]}),
    item('bridge-upper-window-grid', 'window-shape', 'seven storeys of tall narrow windows in dark metal-brick above the city room', [38, 22], 'modelled', 'flush frame+glass sheets at 1.83 m pitch, storey 3.76 m (flush style bridge)', P.w02, {sheetBox: [0.0, 0.0, 1.0, 0.14]}),
  ],
  'w04-343': [
    item('law-school-tower', 'tower', 'the dark banded tower block over the podium: seven ribbon storeys, set back on the west and north', [35, 31], 'modelled', 'roeterseiland-builder tower hook: 3.45 m ribbon windows with two mullions and a clerestory strip per 4.45 m storey', P.w04, {sheetBox: [0.17, 0.0, 0.68, 0.55]}),
    item('podium-curtain-wall', 'window-shape', 'three storeys of glass curtain wall with 1.8 m glass fins round the tower base', [51, 12.2], 'modelled', 'layered-kit curtain-wall group: glass skin with mullion/transom boxes on the sheet layers', P.w04, {sheetBox: [0.0, 0.55, 1.0, 0.95]}),
    item('law-school-entrance-canopy', 'canopy', 'staff entrance with a flat canopy right of centre of the north front', [6, 3.5], 'modelled', 'kit recessed entrance and canopy on the podium panel (group entrance)', P.w04, {sheetBox: [0.57, 0.8, 0.72, 0.92]}),
    item('law-school-lettering', 'lettering', 'AMSTERDAM LAW SCHOOL in serif capitals on the top row of the glass, right end of the podium', [9, 0.5], 'modelled', 'stroke-font lettering on the podium glass (drawLettering), sans form of the serif original', P.w04, {sheetBox: [0.8, 0.54, 1.0, 0.6]}),
    item('podium-diamond-panels', 'other', 'perforated diamond-pattern opaque panels beside the entrance at ground level', [4, 2], 'simplified', 'plain glazing; the panels are 2 % of the front', P.w04),
  ],
  'w06-73': [
    item('passage-east-front', 'other', 'east front of the passage: soffit 15 m over the water, glazed channel walls either side, stone steps and a steel footbridge in front', [38, 15.2], 'modelled', 'same passage geometry as the west front; the footbridge is a separate BGT object and not part of this pand', P.w06),
    item('city-room-glazing-east', 'window-shape', 'city room glazing with two rows of panes over the passage', [38, 7.5], 'modelled', 'as on the west front', P.w06),
  ],
  'w07-343': [
    item('north-grey-windows', 'window-shape', 'four storeys of paired windows with teal frames in grey cladding', [46, 14], 'modelled', 'flush window sheets with a mullion, teal frame colour (flush style north-grey)', P.w07),
  ],
  'w08-253': [
    item('podium-west-curve', 'window-shape', 'curved glass front with alternating glass and perforated opaque fins, 1.8 m pitch', [32.5, 12], 'modelled', 'curtain-wall group on the faceted 3DBAG curve', P.w08),
    item('uva-talen-lettering', 'lettering', 'UvA Talen in orange on the ground-storey glazing at the right end', [5.2, 0.8], 'modelled', 'stroke-font lettering on panel 465 (addSignatureItems)', P.w08),
    item('de-roeter-logos', 'sign', 'round De Roeter cafe logos on the ground glazing', [1.2, 1.2], 'skipped', null, P.w08, {skip: {reason: 'temporary', note: 'tenant branding that changes with the lease'}}),
  ],
  'w09-73': [
    item('se-wing-raked-windows', 'window-shape', 'narrow windows with raked (slanted) brick reveals in a long-format dark red-brown brick wall', [32, 8.4], 'simplified', 'recessed narrow windows with square reveals at 3.1 m pitch; the raked soldier courses are not drawn', P.w09),
  ],
  'w10-167': [
    item('west-drum-ribbons', 'window-shape', 'rounded beige corner drum with two ribbon-window strips and small square windows', [27.6, 15], 'simplified', 'window sheets on the faceted drum, four equal storeys instead of the two ribbons', P.w10),
  ],
  'w15-343': [
    item('entrance-columns', 'colonnade', 'two slender round white columns, 11.5 m apart, under the cantilever of the bridge block in front of the glass entrance hall', [11.5, 9.1], 'modelled', 'two 0.4 m cylinders 9.1 m tall (addSignatureItems)', P.w15),
    item('entrance-hall-glazing', 'window-shape', 'tall glass entrance hall with transom bars and door pairs', [20, 9], 'simplified', 'plain 3DBAG wall at the hall back; the hall glazing is not cut', P.w15),
    item('uva-etched-lettering', 'lettering', 'Universiteit van Amsterdam in thin letters on the hall glass', [6, 0.4], 'skipped', null, P.w15, {skip: {reason: 'too-small', note: '0.4 m etched letters seen through glass'}}),
  ],
  'w19-73': [
    item('uva-fascia-lettering', 'lettering', 'UNIVERSITEIT VAN AMSTERDAM in raised letters along the east fascia of the cantilever', [16, 0.9], 'modelled', 'stroke-font lettering on panel 274 at 10.6 m', P.w19),
    item('abc-entrance-sign', 'sign', 'ABC in three coloured squares (burgundy, blue, orange) at the corner under the overhang', [2.7, 1.3], 'modelled', 'three wall boxes on panel 49, colours from the crop', P.w19),
    item('cantilever-soffit', 'other', 'the cantilevered end of the bridge block over the plaza, light grey soffit', [20, 20], 'modelled', 'the 3DBAG wall bases at 9.1 m', P.w19),
  ],
  'w30-343': [
    item('se-wing-round-windows', 'window-shape', 'a row of round-ended dark windows in the low black-clad north face of the south-east wing', [14, 3], 'simplified', 'narrow rectangular recessed windows', P.w30),
  ],
  'w39-167': [
    item('west-diamond-glazing', 'window-shape', 'rhombus-lattice glazing and a curved overhanging roof on the west end of the beige block', [8.7, 6], 'simplified', 'plain window sheets; no lattice and no curved roof', P.w39),
  ],
};
const notes = {
  'w03-163': 'wall of the neighbouring 1932 brick wing (pand 0363100012253754, large recipe installed), inside the brief ring but outside the 3DBAG shell of this pand',
  'w05-30': 'wall of the neighbouring 1932 brick wing (pand 0363100012253754)',
  'w14-343': 'wall of the neighbouring 1932 brick wing (pand 0363100012253754)',
  'w31-163': 'glazed pedestrian link between the bridge-block tower and the 1932 wing; at the edge of the shell, not modelled as a separate part (3DBAG has the link inside the wall panels)',
  'w16-73': 'north end wall of the south-east brick wing, 8.6 m, same brick as w09',
  'w18-253': 'west podium glazing, same curtain wall as w08',
  'w26-253': 'west podium glazing, same curtain wall as w08',
  'w22-162': 'underside of the steel footbridge and stone steps at the passage (the bridge is a BGT object)',
  'w27-253': 'passage west end, steps and the dark glass end of the bridge block',
  'w34-253': 'north-west grey-clad wing, same cladding as w07',
  'w36-73': 'wall of the 1932 wing / north wings, not part of the shell',
  'w38-252': 'grey cladding with teal windows, same as w07',
};
for (const w of inv.walls) {
  const k = w.tag;
  w.items = items[k] ?? [];
  w.checked = true;
  if (notes[k]) w.note = notes[k];
  else if (w.evidence === 'inferred') w.note = 'inferred from 3DBAG; no panorama of this wall, so no ornament inventoried';
}
inv.signature = ['bridge-passage-soffit', 'law-school-tower', 'city-room-glazing', 'podium-curtain-wall'];
inv.sources = [
  {name: 'Gemeente Amsterdam panoramas', url: 'https://api.data.amsterdam.nl/panorama/', licence: 'CC BY 4.0'},
  {name: '3DBAG LoD2.2', url: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012185420', licence: 'CC BY 4.0'},
  {name: 'BAG pand 0363100012185420', url: 'https://api.data.amsterdam.nl/v1/bag/panden/0363100012185420/', licence: 'CC0'},
];
fs.writeFileSync(file, JSON.stringify(inv, null, 2) + '\n');
console.log('items', inv.walls.reduce((s, w) => s + w.items.length, 0), 'walls', inv.walls.length);
