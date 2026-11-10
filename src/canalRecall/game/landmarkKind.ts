// What a landmark is, for the "Which building is this?" question (R2-7, #305).
//
// The extract has no kind field beyond `type` (landmark / museum / library /
// university / cinema / music venue) and Wikidata `instance of` ids. The
// question is about buildings, so statues, sculptures and memorials are told
// apart here: they keep their drive-by card but are neither asked about nor
// used as distractors (a memorial among three buildings gives the answer away
// by elimination, and "Which building is this?" is false of a bust).

export type LandmarkKind = 'building' | 'memorial';

/** Wikidata classes that make a landmark a statue, sculpture, memorial or monument. */
const MEMORIAL_CLASSES = new Set([
  'Q179700',   // statue
  'Q860861',   // sculpture
  'Q575759',   // memorial / war memorial
  'Q5003624',  // memorial
  'Q4989906',  // monument
  'Q20011797', // memorial (names)
]);

/** Classes of things you can walk into: a building outranks a memorial class
 *  on the same record (Anne Frank House and the Hollandsche Schouwburg are
 *  both tagged memorial and are buildings). */
const BUILDING_CLASSES = new Set([
  'Q33506', 'Q207694', 'Q2087181', 'Q16970', 'Q108325', 'Q34627', 'Q24354', 'Q41253', 'Q3947', 'Q41176',
  'Q12518', 'Q82117', 'Q31855', 'Q28564', 'Q811979', 'Q1060829', 'Q2772772', 'Q1329623',
]);

const MEMORIAL_NAME = /\b(monument|memorial|statue|standbeeld|bust|beeld)\b|monument\b/i;

export function landmarkKind(landmark: { name: string; type?: string; wikidataInstanceOf?: readonly string[] }): LandmarkKind {
  const classes = landmark.wikidataInstanceOf ?? [];
  if (classes.some(id => BUILDING_CLASSES.has(id))) return 'building';
  if (classes.some(id => MEMORIAL_CLASSES.has(id))) return 'memorial';
  // Museums, libraries, universities and cinemas are buildings whatever their name.
  if (landmark.type && landmark.type !== 'landmark') return 'building';
  return MEMORIAL_NAME.test(landmark.name) ? 'memorial' : 'building';
}

export const isBuildingLandmark = (landmark: { name: string; type?: string; wikidataInstanceOf?: readonly string[] }): boolean =>
  landmarkKind(landmark) === 'building';
