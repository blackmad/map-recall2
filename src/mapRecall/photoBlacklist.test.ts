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
  ['Tramway Citadis 302 Mulhousien Utrecht'],
  ['Qbuzz U-OV Mercedes-Benz Citaro 4043 04-01-2022'],
  ['Amsterdam bicycles - panoramio'],
  ['Horse with foal Utrecht Hont'],
  ['Koe drinkt uit de sloot'],
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
assert.equal(unsuitableAreaPhotoReason({ title: 'Tramway Citadis 302 Mulhousien Utrecht' }), 'vehicle as the subject');
assert.equal(unsuitableAreaPhotoReason({ title: 'Bullebak bridge01' }), null);

// Categories count only for the source and toilet rules; a street named "Toilet" is not a toilet photo.
assert.equal(isUnsuitableAreaPhoto({ title: 'Gracht 12', categories: 'Photographs by Anefo' }), true);
assert.equal(isUnsuitableAreaPhoto({ title: 'Gracht 12', categories: 'Canals in Amsterdam' }), false);

console.log('Photo blacklist: unsuitable and suitable titles checked.');
