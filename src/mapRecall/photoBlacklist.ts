/**
 * Commons photographs that are not views of the place they are filed under. The area postcard and
 * the area cards show these photographs as "what this neighbourhood looks like", so a toilet, a
 * plate of food or a press portrait there misleads. Used where candidates are admitted
 * (scripts/fetch-area-photos.ts), where the provider assembles them (featureProvider.ts), and to
 * prune the committed extracts (scripts/prune-area-photos.ts).
 *
 * Kept on purpose: streets, canals, buildings, bridges, parks, squares, markets, statues (including
 * statues of animals), aerials, and street scenes with people or bicycles in them. Only a vehicle
 * that is the whole subject goes ("Tramway Citadis 302 Mulhousien Utrecht"), not a street with trams.
 */

export interface AreaPhotoCandidate {
  /** The display title (no "File:" prefix, no extension, spaces for underscores). */
  title: string;
  /** Free text about the file: the attribution line or the artist. */
  description?: string;
  /** Commons categories, as one string. Only the source and toilet rules read them. */
  categories?: string;
}

const TOILET = /\b(toilets?|toilette|wc|urinals?|pissoirs?)\b/i;
const FOOD = /\b(food|dish|dishes|menus?|meals?|pizza|burgers?|pancakes?|pannenkoeken?|sandwich|cakes?|taart|soup|soep|gerecht|gerechten|eten|maaltijd|maaltijden)\b/i;
const PORTRAIT = /\b(selfies?|self-portraits?|zelfportret|portraits?|portret|portretten|headshots?)\b/i;
const SCREENSHOT = /\b(screenshots?|screen shots?|schermafbeelding)\b/i;
const MAP_OR_MARK = /\b(maps?|kaarten?|plattegronden?|plattegrond|plans?|diagrams?|logos?|flags?|vlaggen?|vlag|wapens?|coat of arms|escutcheon|emblems?|crests?)\b|wapen/i;
const DOCUMENT = /\b(documents?|documenten|scans?|scanned|brief|letters?|krant|newspapers?|archief|archives?|manuscripts?|handwritten|postzegels?|stamps?)\b/i;
const INTERIOR = /\b(interieur|interiors?|binnenkant|display room|showroom)\b/i;
const ADVERTISING = /advertentie|advertisement|reclame/i;
/** Press photographs and dashcam frames: "Anefo" (Nationaal Archief press archive), "Mapillary". */
const SOURCE = /\b(mapillary|anefo)\b/i;
/** Anefo file titles start with the date and a catalogue number: "03-22-1947 01334 Frits Sieger". */
const ANEFO_TITLE = /^(?:File:)?\d\d-\d\d-\d{4} \d+/;
const VEHICLE = /\b(trams?|sneltram|tramway|citadis|buses|bus|setra|qbuzz|ebusco|cars?|autos?|auto|mercedes|bmw|volkswagen|taxis?|trains?|trein|nightjet|locomotive|metro|trucks?|vrachtwagen|scooters?|motorcycles?|motorbikes?|bromfiets|tractor|bicycles?|bikes?|fiets|fietsen|waterbus|veerboot|ferry)\b/i;
/** A place or landmark word: with one, a vehicle in the title is part of a street view, not the subject. */
const PLACE = /\b(bridges?|brug|bruggen|canals?|kanaal|gracht|grachten|streets?|straat|squares?|plein|quays?|kade|parks?|church|kerk|stations?|halte|stops?|sluis|locks?|buildings?|gebouw|markets?|markt|harbou?rs?|haven|wharf|werf|docks?|dok|singel|laan|avenue|weg|roads?|dijk|wijk|buurt|hof|hofje|tunnel|viaduct|terminal|depot|remise)\b/i;
const CITY = /\b(amsterdam|utrecht|rotterdam|den haag|the hague|netherlands|nederland)\b/i;
/** Animals as the subject. A statue, mural or relief of an animal is a view of the place. */
const ANIMAL = /\b(dogs?|hond|honden|cats?|kat|katten|horses?|paard|paarden|ponies|pony|cows?|koe|koeien|goats?|geit|geiten|sheep|schapen|schaap|pigs?|varken|varkens|ducks?|eend|eenden|pigeons?|duiven?|seagulls?|meeuwen?|gulls?|birds?|swans?|squirrels?|eekhoorn|eekhoorns|parrots?|papegaai|pets?|huisdier|huisdieren)\b/i;
const ARTWORK = /\b(statues?|beeld|beelden|sculptures?|sculptuur|monument|standbeeld|relief|reliefs|mural|muurschildering|graffiti)\b/i;
/**
 * A person's name as the whole title ("Michèle Russel-Capriles", "Ab Kools (4373446047)",
 * "Esther jacobs-1664737609") or a cyclist caption ("Mark Cavendish - Tour de France 2015 (…)").
 * Street names are excluded by their ending ("Lange Viestraat"), and a few English object or
 * place words ("Golden Beach", "Sun Mill") by a short list.
 */
const PARTICLES = new Set(["van", "de", "der", "den", "ter", "ten", "het", "von", "la", "le", "du"]);
const NOT_A_NAME = /^(beach|mill|pot|tulip|bottle|jug|chair|sofa|tree|fruits?|results?|passage|roses?|bay|lines|super|dark|golden|sun|yellow|weird|infrared|ink|stoneware|dutch|saudi|cupping|spaghetti|platanus|overtoom|familiewapen|er|alpha|along|the|kik|werk|huis|nederlands|hogeschool|ijburg|klein|architecture|node|vishandel)$/i;
const PLACE_ENDING = /(straat|laan|weg|gracht|kade|plein|brug|park|kerk|dijk|singel|plantage|hof|buurt|wijk|dreef|sluis|haven|poort|markt|pad|steeg|kwartier|bocht|eiland|polder|dorp|meer|bos|schans|wetering|vaart|gebouw|station|tunnel|toren|molen|gemaal|school|kazerne|lyceum|moskee|werf|dok|kanaal|bibliotheek|museum|ringpark|boulevard)$/i;
const NAME = /^\p{Lu}[\p{L}'’-]*$/u;
const WORD = /^\p{L}[\p{L}'’-]*$/u;

function isPersonName(title: string): boolean {
  const caption = /^(.+?) - .*\(\d{6,}\)$/.exec(title);
  if (caption) return /tour de france/i.test(title) && /^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u.test(caption[1]);
  // Flickr-style ids are 10 or more digits. Without one, only a name with a particle ("Remco de Ridder") or an accent ("Michèle Russel-Capriles") is taken.
  const hasIdSuffix = /-\d{10,}$|\s\(\d{10,}\)$/.test(title);
  const hasParticle = /\s(van|de|der|den|ter|ten|het|von|la|le|du)\s/i.test(title);
  const tokens = title.replace(/\s*\(\d{6,}\)$/, "").replace(/-\d{6,}$/, "").trim().split(" ");
  if (tokens.length < 2 || tokens.length > 3 || !tokens.every(t => WORD.test(t))) return false;
  const [first, last] = [tokens[0], tokens[tokens.length - 1]];
  if (!NAME.test(first) || PARTICLES.has(first.toLowerCase()) || NOT_A_NAME.test(first)) return false;
  if (tokens.some(t => PLACE.test(t) || PLACE_ENDING.test(t) || CITY.test(t) || NOT_A_NAME.test(t))) return false;
  // Surnames are capitalised, except a hyphenated Flickr-style name ("Esther jacobs-1664737609").
  const hasAccent = /[\u00C0-\u024F]/.test(title);
  if (!hasIdSuffix && !hasParticle && !hasAccent) return false;
  return tokens.slice(1).every(t => NAME.test(t) || PARTICLES.has(t.toLowerCase()) || (hasIdSuffix && t === last));
}

/** The reason a photograph is not a view of its place, or null when it may be shown. */
export function unsuitableAreaPhotoReason(photo: AreaPhotoCandidate): string | null {
  const title = photo.title.replace(/^File:/, '').replace(/\.jpe?g$/i, '').replace(/_/g, ' ').trim();
  const description = photo.description ?? '';
  const categories = photo.categories ?? '';
  const text = `${title} ${description}`;
  if (SOURCE.test(text) || SOURCE.test(categories)) return 'press or dashcam source';
  if (ANEFO_TITLE.test(title)) return 'press archive (Anefo) title';
  if (TOILET.test(text) || TOILET.test(categories)) return 'toilet';
  if (FOOD.test(title)) return 'food';
  if (PORTRAIT.test(text)) return 'portrait or selfie';
  if (SCREENSHOT.test(text)) return 'screenshot';
  if (MAP_OR_MARK.test(title)) return 'map, diagram, logo or flag';
  if (DOCUMENT.test(title)) return 'document or scan';
  if (INTERIOR.test(title)) return 'interior';
  if (ADVERTISING.test(title)) return 'advertisement';
  if (VEHICLE.test(title) && !PLACE.test(title)) return 'vehicle as the subject';
  if (ANIMAL.test(title) && !ARTWORK.test(title) && !PLACE.test(title)) return 'animal';
  if (isPersonName(title)) return 'a person as the subject';
  return null;
}

/** True for a photograph that must not be shown as a view of its place. */
export function isUnsuitableAreaPhoto(photo: AreaPhotoCandidate): boolean {
  return unsuitableAreaPhotoReason(photo) !== null;
}
