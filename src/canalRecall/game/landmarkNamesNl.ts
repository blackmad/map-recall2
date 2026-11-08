// Dutch display names for landmarks whose catalogue name is English (#283).
// The catalogue (public/data/extracts/amsterdam/landmarks.json) keeps one
// `name`, often the English Wikipedia/Wikidata label, and links the Dutch
// article in `wikipedia` ("nl:Anne Frank Huis"). This table is that Dutch
// title, reviewed by hand: disambiguators dropped ("Munttoren (Amsterdam)"),
// and only where the English name is a translation, not a different name
// (Internationaal Theater Amsterdam is not "Stadsschouwburg"). The answer is
// checked against what the player was shown, so English and Dutch never mix
// inside one question. landmarkNamesNl.test.ts pins every row to the extract.

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
});

/** The name a player sees in `language`: the Dutch title where the table has one. */
export function landmarkDisplayName(name: string, language: string): string {
  return language === 'nl' ? LANDMARK_NAMES_NL[name] ?? name : name;
}
