// Dutch display names for landmarks whose catalogue name is English (#283).
// The catalogue (public/data/extracts/amsterdam/landmarks.json) keeps one
// `name`, often the English Wikipedia/Wikidata label, and links the Dutch
// article in `wikipedia` ("nl:Anne Frank Huis"). This table is that Dutch
// title, reviewed by hand: disambiguators dropped ("Munttoren (Amsterdam)"),
// and only where the English name is a translation, not a different name
// (Internationaal Theater Amsterdam is not "Stadsschouwburg"). The answer is
// checked against what the player was shown, so English and Dutch never mix
// inside one question. landmarkNamesNl.test.ts pins every row to the extract.
//
// Every surface that prints a landmark or destination name in the ride (the
// destination pill, the arrival title and route line, the stamp line, the
// drive-by card, the landmark panel, the run card and its story line) goes
// through `placeName`, so one ride never says "Munttoren" in the question and
// "MINT TOWER" on the card after it (R2-3, #303). The share picture stays
// English until needs-david #296 says otherwise.

import { language } from '../../i18n/index.ts';
import { BY_NAME as EXTRACT_RENAMES } from './placeNames.ts';

export const LANDMARK_NAMES_NL: Readonly<Record<string, string>> = Object.freeze({
  'Anne Frank House': 'Anne Frank Huis',
  'Auschwitz Memorial': 'Auschwitzmonument',
  "Berlage's Stock Market": 'Beurs van Berlage',
  'Buchenwald Memorial': 'Buchenwaldmonument',
  'Dutch Resistance Museum': 'Verzetsmuseum',
  'English Reformed Church': 'Engelse Hervormde Kerk',
  'Equestrian statue of Queen Wilhelmina': 'Ruiterstandbeeld koningin Wilhelmina',
  'Gerard Dou Synagogue': 'Synagoge Gerard Doustraat',
  'International Institute of Social History': 'Internationaal Instituut voor Sociale Geschiedenis',
  'Jewish Museum': 'Joods Museum',
  'Marseille House': 'Huis Marseille',
  'Mint Tower': 'Munttoren',
  'Museum of the Canals': 'Grachtenmuseum',
  'National Holocaust Museum': 'Nationaal Holocaustmuseum',
  'New Church': 'Nieuwe Kerk',
  'NIOD Institute for War, Holocaust, and Genocide Studies': 'NIOD Instituut voor Oorlogs-, Holocaust- en Genocidestudies',
  'Old Church': 'Oude Kerk',
  'Our Lord in the Attic': "Ons' Lieve Heer op Solder",
  'Red Light District': 'De Wallen',
  'Rembrandt House': 'Rembrandthuis',
  'Royal Palace': 'Paleis op de Dam',
  'The National Maritime Museum': 'Het Scheepvaartmuseum',
  'The Shipping House': 'Scheepvaarthuis',
  'University of Amsterdam': 'Universiteit van Amsterdam',
  'Vondelpark Open Air Theater': 'Vondelpark Openluchttheater',
  'Walloon Church': 'Waalse Kerk',
  "Weepers' Tower": 'Schreierstoren',
  'West India House': 'West-Indisch Huis',
  'West Indian Warehouse': 'West-Indisch Pakhuis',
  'Zuiderkerk Tower': 'Zuiderkerkstoren',
  // R2-3 (#303): the landmarks' own nl Wikipedia titles (landmarks.json
  // `wikipedia`), disambiguators dropped; where Wikidata's nl label is the
  // shorter usual form it is used instead (cited per row).
  'Central Station': 'Amsterdam Centraal', // nl:Station Amsterdam Centraal; Wikidata Q50719 nl label
  'Canal Ring Area of Amsterdam': 'Grachtengordel', // nl:Grachtengordel (Amsterdam)
  'Pathé Tuschinski Cinema': 'Koninklijk Theater Tuschinski', // nl:Koninklijk Theater Tuschinski
  'Royal Theater Carré': 'Koninklijk Theater Carré', // nl:Koninklijk Theater Carré
  'Dutch National Opera & Ballet': 'Nationale Opera & Ballet', // nl:Nationale Opera en Ballet; Wikidata Q1325514 nl label
  'National Monument': 'Nationaal Monument op de Dam', // nl:Nationaal Monument op de Dam
  'Cat Cabinet': 'KattenKabinet', // nl:KattenKabinet
  'Dutch East Indian Company': 'Oost-Indisch Huis', // nl:Oost-Indisch Huis (Amsterdam)
  "Wine buyers' guildhall": 'Wijnkopersgildehuis', // nl:Wijnkopersgildehuis
  'Funerary museum': 'Museum Tot Zover', // nl:Museum Tot Zover (sitelink of Q2383603)
  'Ravensbrück memorial': 'Vrouwen van Ravensbrück', // nl:Vrouwen van Ravensbrück 1940-1945; Wikidata Q42171765 nl label
  'Amsterdam Memorial to the Canadian Liberators': 'Amsterdam dankt zijn Canadezen', // nl:Amsterdam dankt zijn Canadezen
  'Shadow quay': 'De Schaduwkade', // nl:De Schaduwkade
  'Jewish WW2 resistance memorial': 'Joods Verzetsmonument', // nl:Joods Verzetsmonument
  'Royal Tropical Institute': 'KIT-gebouw', // nl:KIT-gebouw
});

/**
 * Landmarks whose catalogue row links no Dutch article: the Dutch name is the
 * Wikidata item's nl label (https://www.wikidata.org/wiki/<id>, read
 * 2026-11-09). The test pins each id to the landmark's own `wikidata`.
 */
export const LANDMARK_NAMES_NL_WIKIDATA: Readonly<Record<string, { nl: string; wikidata: string }>> = Object.freeze({
  'Houseboat Museum': { nl: 'Woonbootmuseum', wikidata: 'Q14544962' },
  'Museum of Bags and Purses': { nl: 'Tassenmuseum Hendrikje', wikidata: 'Q2077489' },
  'Diamond Museum Amsterdam': { nl: 'Diamantmuseum', wikidata: 'Q1208561' },
  'Olympic Stadium': { nl: 'Olympisch Stadion', wikidata: 'Q503319' },
  'Walen Gate': { nl: 'Walenpoortje', wikidata: 'Q17288856' },
  'Spinhuis Gate': { nl: 'Spinhuispoort', wikidata: 'Q17306709' },
});

/** The game's one spelling (placeNames.ts) back to the extract's, which the
 *  tables above are keyed by ("National Maritime Museum" was never found). */
const EXTRACT_NAME_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(EXTRACT_RENAMES).map(([extract, shown]) => [shown, extract]));

function dutchName(name: string): string | undefined {
  return LANDMARK_NAMES_NL[name] ?? LANDMARK_NAMES_NL_WIKIDATA[name]?.nl;
}

/** The name a player sees in `language`: the Dutch title where the table has one. */
export function landmarkDisplayName(name: string, language: string): string {
  if (language !== 'nl' || !name) return name;
  const extract = EXTRACT_NAME_OF.get(name);
  return dutchName(name) ?? (extract ? dutchName(extract) : undefined) ?? name;
}

/** `landmarkDisplayName` in the interface's current language: what every
 *  ride surface prints for a landmark or destination. Names it does not know
 *  (streets, buurten, tours) pass through unchanged. */
export function placeName(name: string): string {
  return landmarkDisplayName(name, language());
}
