import assert from 'node:assert/strict';
import { isUnsuitableAreaPhoto, unsuitableAreaPhotoReason } from './photoBlacklist.ts';

// Photographs that are not views of the place: each must be dropped.
const unsuitable: Array<[string, string?]> = [
  ['Toilet (8801976568)'], // Helmersbuurt's postcard, 2026-10 review
  ['Toilet (11292285735)'],
  ['Zonnebloemstraat Dixi toilet, Kleiwegkwartier, Rotterdam (2023) 03'],
  ['Urinal Oudezijds Achterburgwal'],
  ['WC-deur Centraal Station'],
  ['Pizza Ham & Cheese (4254288665)'],
  ['Dutch cheese & egg with mustardmayo sandwich - KEEK lunchroom 2024-11-28'],
  ['Menu Café De Jaren'],
  ['Michèle Russel-Capriles'],
  ['Ab Kools (4373446047)'],
  ['Remco de Ridder'],
  ['Mark Cavendish - Tour de France 2015 (19260740958)'],
  ['Portret van burgemeester Van Hall'],
  ['Screenshot Google Street View Jordaan'],
  ['Plattegrond Jordaan 1900'],
  ['Stadswapen Utrecht'],
  ['Brief van de burgemeester 1945'],
  ['Scan van krantenartikel Nieuwmarkt'],
  ['Interieur winkel De Bijenkorf'],
  ['Qbuzz U-OV Mercedes-Benz Citaro 4043 04-01-2022'],
  ['Bicycle rack - Cor Kieboomplein - IJsselmonde - Rotterdam'],
  ['The Night Watch bicycle bags, Oosterflank, Rotterdam (2023) 04'],
  ["2010.12 - 'Photo of a Dutch winter still-life in snow outdoors, a bicycle wheel in the snow, Amsterdam city'"],
  ['Noordsingel - Agniesebuurt - Rotterdam - Dredged up bicycle'],
  ['Koe drinkt uit de sloot'],
  ['Twee koeien'],
  ['Horse with foal Utrecht Hont'],
  ['Qbuzz U-OV Mercedes-Benz Citaro 4043 04-01-2022'],
  ['Qbuzz U-OV 4041 36-BDG-7'],
  ['Pouw Vervoer Qbuzz U-OV Setra S 415 LE Business 2653 (1653) 20-04-2025 (2)'],
  ['Mercedes car of National Police Corps at HDCC 2026 (Side View)'],
  ['Views from a Dutch train, August 2023 08'],
  ['Birds - panoramio - Michal Huniewicz (1)'],
  ['Makelaarsland advertisement on small car'],
  ['03-22-1947 01334 Frits Sieger'],
  ['KrugerUtrecht', 'Harry Pot for Anefo ]], CC0'],
  ['Gracht frame 2019', 'Mapillary, CC BY-SA 4.0'],
];

// Views of places: each must be kept.
const suitable: string[] = [
  'Looeirsgracht twilight Amsterdam',
  'Bullebak bridge01',
  'Kattenslootbrug',
  'Amsterdam bicycles - panoramio',
  'Bicycles near café in Amsterdam',
  'Snow on bicycles - panoramio',
  'A couple cycling in Amsterdam on a single bicycle 04',
  'Rotterdam bike garage',
  'Kleurijke fietsen',
  'Trams at Nesserdijk',
  'Een Sprinter trein op Muiderspoorbrug (8584599035)',
  'Sneltram Utrecht CS Jaarbeursplein',
  'Sneltram Utrecht Westplein',
  'Tramway Citadis 302 Mulhousien Utrecht',
  "2005.04 - 'Close-up of an upcoming ferry' Amsterdam photos, direction Distelweg",
  "Aqualiner waterbus 'Aqua Cat' - Nieuwe Maas - Krimpen aan den IJssel (29277113566)",
  'Good morning at Wijkergouw Schellingwoude with sheep in the morning fog - panoramio',
  'Flat Abtshove met reclamebord Van Leeuwen buizen aan Abtsweg, Rotterdam vanaf Kleinpolderplein',
  'Via de Gageldijk en St Anthoniedijk kom je met de auto bij het Gagelbos',
  'Cars in the city- electric, Amsterdam (33330608512)',
  'Arriving to Amsterdam by train 05',
  'Ophaalpaal OV-chipkaart Sneltram Utrecht',
  'Club Werck (Prinsengracht 277 - Amsterdam)',
  'Nieuwe Kerk Amsterdam',
  'Oude Kerk Utrecht',
  'Vondelpark bridge at dusk',
  'Statue of Rembrandt Rembrandtplein',
  'Beeld de Vlucht Einsteindreef',
  'Moeder en kind met bok Frank Letterie Elandplein Utrecht',
  'Nijlpaard Ellie Hahn Koekoeksplein Utrecht',
  'Squirrel bridges Amstelveenseweg Amsterdam',
  'Erasmuspark-Mercatorstraat-brug',
  'Lange Viestraat',
  'Den Overtoom',
  'Ledig Erf Tramhokje',
  'Oud tramhaltebord in Amsterdam (9956711473)',
  'Luchtfoto veemarkthallen Utrecht 25-06-1999',
  'Ulu mosque at night 02',
  'Johannes de Doperkerk, Utrecht',
  'Golden Beach (44926197992)',
  'Mercatorplein (4511165849)',
  'Lapjesmarkt Breedstraat Utrecht',
];

for (const [title, description] of unsuitable) {
  assert.equal(isUnsuitableAreaPhoto({ title, description }), true, `should drop: ${title}`);
}
for (const title of suitable) {
  assert.equal(isUnsuitableAreaPhoto({ title, description: 'Wikimedia Commons: file.jpg (photographer, CC BY-SA 4.0)' }), false, `should keep: ${title}`);
}

// The reason names the rule, which the prune report prints.
assert.equal(unsuitableAreaPhotoReason({ title: 'Toilet (8801976568)' }), 'toilet');
assert.equal(unsuitableAreaPhotoReason({ title: 'Tramway Citadis 302 Mulhousien Utrecht' }), null);
assert.equal(unsuitableAreaPhotoReason({ title: 'Koe drinkt uit de sloot' }), 'animal');
assert.equal(unsuitableAreaPhotoReason({ title: 'Bicycle rack - Cor Kieboomplein - Rotterdam' }), 'bicycle close-up or object');
assert.equal(unsuitableAreaPhotoReason({ title: 'Bullebak bridge01' }), null);

// Categories count only for the source and toilet rules; a street named "Toilet" is not a toilet photo.
assert.equal(isUnsuitableAreaPhoto({ title: 'Gracht 12', categories: 'Photographs by Anefo' }), true);
assert.equal(isUnsuitableAreaPhoto({ title: 'Gracht 12', categories: 'Canals in Amsterdam' }), false);

console.log('Photo blacklist: unsuitable and suitable titles checked.');
