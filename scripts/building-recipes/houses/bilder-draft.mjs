// Drafting table for Bilderdijkstraat (from the rectified reference crops, 2026-10-09).
// Writes houses/bilder-<id>/intent.json. Twins use sameAs with no overrides so identical designs share one mesh.
//   node scripts/building-recipes/houses/bilder-draft.mjs
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const src = (id, alt, date) => [{id: `pano-${date}`, kind: 'street-panorama', capturedAt: date, image: `staging/pand-reference/0363100012${id}/${alt ? 'front-alt' : 'front'}.jpg`, license: 'Gemeente Amsterdam panorama, CC BY 4.0'}];
const front = (o) => ({id: 'front0', street: 'Bilderdijkstraat', hoist: false, windows: 'sash', basement: 'none', cornice: 'simple', ...o});
const house = (id, note, date, alt, f, palette, roof = 'slate', notes = []) => ({
  schemaVersion: 1, kind: 'canal-house', id: `bilder-${id}`, pandId: `0363100012${id}`, address: `Bilderdijkstraat (${note})`,
  sources: src(id, alt, date), fronts: [front(f)], roof: {material: roof}, palette, notes,
});
const twin = (id, of, date, alt, overrides = {}) => ({sameAs: `bilder-${of}`, id: `bilder-${id}`, pandId: `0363100012${id}`, address: `Bilderdijkstraat (twin of ${of})`, sources: src(id, alt, date), overrides});

const shop = (colour, fascia = true) => ({colour, fascia});
const H = {
  // 1894 yellow-brick, arched windows, dormer above bracketed cornice
  '079721': house('079721', '1894 yellow brick, scaffolded', '2025-07-31', true,
    {gable: 'cornice', storeys: 5, bays: 3, dormers: 1, doorBay: null, cornice: 'bracketed', windows: 'arched', shopfront: shop('dark-brown'), bands: 'lintel'},
    {brick: 'yellow-brick', frame: 'white', door: 'dark-brown', stone: 'cream'}),
  // 1939 bay-window block, bay on the left
  '080336': house('080336', '1939 bay-window block, bay left', '2023-01-12', false,
    {gable: 'cornice', storeys: 5, bays: 2, doorBay: 1, cornice: 'simple', windows: 'cross', shopfront: shop('dark-brown', false), bayWindows: {bay: 0, storeys: [1, 2, 3]}},
    {brick: 'red-brown', frame: 'cream-painted', door: 'dark-red', stone: 'sandstone'}),
  // 1909 raised cornice with arched attic lights, balconies
  '081118': house('081118', '1909, arched top storey, balconies', '2024-11-29', false,
    {gable: 'cornice', storeys: 5, bays: [3, 3, 3, 3, 2], doorBay: null, cornice: 'bracketed', windows: 'sash', shopfront: shop('black'), balconies: {storeys: [2, 3], bays: [1]}, bands: 'storey'},
    {brick: 'red-brown', frame: 'white', door: 'black', stone: 'sandstone'}),
  '087959': house('087959', '1909 dark brick, balconies, arched top', '2022-04-29', true,
    {gable: 'cornice', storeys: 5, bays: [4, 4, 4, 4, 3], doorBay: 3, cornice: 'bracketed', windows: 'sash', shopfront: shop('black'), balconies: {storeys: [2, 3], bays: [1]}, bands: 'storey'},
    {brick: '#5e4033', frame: 'cream-painted', door: 'natural-wood', stone: 'sandstone'}),
  // 1939 bay-window block, bay on the right (mirror of 080336)
  '090492': house('090492', '1939 bay-window block, bay right', '2022-04-29', true,
    {gable: 'cornice', storeys: 5, bays: 2, doorBay: 0, cornice: 'simple', windows: 'cross', shopfront: shop('dark-brown', false), bayWindows: {bay: 1, storeys: [1, 2, 3]}},
    {brick: 'red-brown', frame: 'cream-painted', door: 'dark-red', stone: 'sandstone'}),
  '092394': house('092394', '1939 plain block', '2024-11-29', false,
    {gable: 'cornice', storeys: 5, bays: 3, doorBay: 0, cornice: 'simple', windows: 'sash-small-panes', shopfront: shop('dark-brown', false), bands: 'storey'},
    {brick: 'red-brown', frame: 'white', door: 'dark-brown', stone: 'sandstone'}),
  // 1881 dark brick, white frames, big pedimented dormer
  '152363': house('152363', '1881 dark brick, pedimented dormer', '2025-07-31', false,
    {gable: 'cornice', storeys: 4, bays: 3, dormers: 1, doorBay: 0, cornice: 'simple', windows: 'sash', shopfront: shop('dark-blue'), basement: 'none'},
    {brick: '#5a3b30', frame: 'white', door: 'black', stone: 'cream-painted'}, 'red-tile'),
  '152669': house('152669', '1894 arched windows, pedimented dormer', '2022-04-29', false,
    {gable: 'cornice', storeys: 5, bays: 3, dormers: 1, doorBay: 2, cornice: 'bracketed', windows: 'arched', shopfront: shop('black'), bands: 'lintel'},
    {brick: 'red-brown', frame: 'cream-painted', door: 'dark-brown', stone: 'cream'}),
  '153622': house('153622', '1887 orange brick, white bosses', '2024-11-29', false,
    {gable: 'cornice', storeys: 5, bays: 3, dormers: 1, doorBay: null, cornice: 'bracketed', windows: 'sash', shopfront: shop('dark-blue'), bands: 'lintel', balconies: {storeys: [1, 2], bays: [1, 2]}},
    {brick: 'orange-brick', frame: 'white', door: 'dark-green', stone: 'cream'}),
  '153782': house('153782', '1891 red brick, white bosses', '2024-11-29', false,
    {gable: 'cornice', storeys: 5, bays: 3, dormers: 1, doorBay: 0, cornice: 'bracketed', windows: 'sash', shopfront: shop('black'), bands: 'lintel'},
    {brick: 'red-brown', frame: 'white', door: 'black', stone: 'cream'}),
  '154127': house('154127', '1889 dark brick, shop window', '2023-01-12', false,
    {gable: 'cornice', storeys: 4, bays: 3, dormers: 1, doorBay: null, cornice: 'bracketed', windows: 'sash', shopfront: shop('black')},
    {brick: '#5a3b30', frame: 'cream-painted', door: 'black', stone: 'sandstone'}),
  '155417': house('155417', '1902 arched windows, balconies, mansard dormer', '2024-11-29', false,
    {gable: 'cornice', storeys: 5, bays: 3, dormers: 1, doorBay: 0, cornice: 'simple', windows: 'arched', shopfront: shop('black', false), balconies: {storeys: [1, 2, 3], bays: [1]}, bands: 'lintel'},
    {brick: 'orange-brick', frame: 'dark-green', door: 'dark-green', stone: 'sandstone'}, 'red-tile'),
  '155418': house('155418', '1903 behind a tree, gabled', '2025-07-31', true,
    {gable: 'step', storeys: 5, bays: 3, atticWindows: 1, doorBay: 0, cornice: 'simple', windows: 'sash', shopfront: shop('dark-blue'), bands: 'lintel'},
    {brick: 'orange-brick', frame: 'cream-painted', door: 'dark-green', stone: 'cream'}),
  '156286': house('156286', '1903 yellow brick, stepped gable, balconies', '2019-04-29', false,
    {gable: 'step', storeys: 5, bays: 3, atticWindows: 1, doorBay: 0, cornice: 'simple', windows: 'arched', shopfront: shop('dark-red'), balconies: {storeys: [1, 2, 3], bays: [1], projecting: true}, bands: 'both'},
    {brick: 'yellow-brick', frame: 'white', door: 'dark-red', stone: 'cream'}),
  '156287': house('156287', '1903 orange brick, stepped gable, balconies', '2024-11-29', true,
    {gable: 'step', storeys: 5, bays: 3, atticWindows: 2, doorBay: 2, cornice: 'simple', windows: 'sash', shopfront: shop('dark-red'), balconies: {storeys: [1, 2, 3], bays: [1]}, bands: 'both'},
    {brick: 'orange-brick', frame: 'dark-green', door: 'dark-green', stone: 'sandstone'}),
  '156732': house('156732', '1881 painted plum, heavy cornice', '2022-09-02', false,
    {gable: 'cornice', storeys: 4, bays: 2, doorBay: null, cornice: 'heavy', windows: 'sash', shopfront: shop('black')},
    {brick: '#6a3038', frame: 'white', door: 'black', stone: 'cream-painted'}),
  '157154': house('157154', '1902 dark brick, raised neck, balconies', '2019-01-07', true,
    {gable: 'neck', storeys: 5, bays: 3, atticWindows: 1, doorBay: 0, cornice: 'simple', windows: 'sash', shopfront: shop('dark-brown', false), balconies: {storeys: [2, 3], bays: [1]}},
    {brick: '#6a4a3c', frame: 'white', door: 'dark-brown', stone: 'sandstone'}),
  '157650': house('157650', '1908 dark red brick, big cross windows', '2022-04-29', false,
    {gable: 'cornice', storeys: 5, bays: 2, doorBay: 0, cornice: 'heavy', windows: 'cross', shopfront: shop('dark-green', false), bands: 'storey'},
    {brick: '#7a3a30', frame: 'dark-green', door: 'dark-green', stone: 'sandstone'}),
};
H['092395'] = twin('092395', '092394', '2019-12-09', false);
for (const [id, intent] of Object.entries(H)) {
  const dir = `${here}bilder-${id}`;
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(`${dir}/intent.json`, JSON.stringify(intent, null, 1) + '\n');
}
console.log(Object.keys(H).length, 'intents');
