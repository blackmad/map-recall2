/**
 * Street-name origins from Amsterdam's own register.
 *
 * Every public space in the municipal BAG API (`openbareruimtes`) carries
 * `beschrijvingNaam`: the city's explanation of its name. It covers who a
 * person was ("Verzetsstrijder (1906-1943) …"), what a word means ("De
 * munteenheid van Italië."), which place or event is meant ("Den Briel werd in
 * 1572 …") and when a canal was filled. Measured 2026-09-29: 5,349 of 5,671
 * streets, 247 of 251 waters, 890 of 924 bridges.
 *
 * These are the decisions of the import (which records count, how names are
 * matched to the OSM extract, how the Dutch is cleaned), kept apart from the
 * fetch and the translator so they are tested without either.
 */

/** A current public-space record as the BAG API returns it (the fields used). */
export interface BagOpenbareRuimte {
  identificatie: string;
  naam: string;
  typeOmschrijving: string;
  beschrijvingNaam?: string | null;
  eindGeldigheid?: string | null;
  ligtInWoonplaatsId?: string | null;
}

export type OriginKind = 'street' | 'water' | 'bridge' | 'area';

/** One explained name, as staged for review and translation. */
export interface NameOrigin {
  bagId: string;
  name: string;
  kind: OriginKind;
  woonplaatsId: string | null;
  /** The municipality's Dutch explanation, whitespace-normalised. */
  nl: string;
  /** English, once translated; absent until then. */
  en?: string;
  /** How `en` was made, e.g. 'trn-high'. */
  enSource?: string;
}

/** The woonplaats of Amsterdam proper. Weesp (merged 2022) and Driemond carry
 *  their own ids and can repeat a name the city also uses. */
export const AMSTERDAM_WOONPLAATS_ID = '3594';

const KINDS: Record<string, OriginKind> = {
  Weg: 'street',
  Water: 'water',
  Kunstwerk: 'bridge',
  'Landschappelijk gebied': 'area',
};

export function originKind(typeOmschrijving: string): OriginKind | null {
  return KINDS[typeOmschrijving] ?? null;
}

/** Collapse whitespace and trim; the register has double spaces and trailing blanks. */
export function cleanDescription(text: string | null | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * The key a BAG name and an OSM name are matched on. Case, curly apostrophes
 * ('s-Gravendijkdreef is written both ways), dashes and spacing differ between
 * the two; nothing else is forgiven, because a looser match would attach one
 * street's history to another.
 */
export function nameKey(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('nl');
}

/** Current, explained records of a known kind, one per BAG id. */
export function originsFromRecords(records: readonly BagOpenbareRuimte[]): NameOrigin[] {
  const byId = new Map<string, NameOrigin>();
  for (const record of records) {
    if (record.eindGeldigheid) continue;
    const kind = originKind(record.typeOmschrijving);
    const nl = cleanDescription(record.beschrijvingNaam);
    if (!kind || !nl || !record.naam) continue;
    byId.set(record.identificatie, {
      bagId: record.identificatie,
      name: record.naam.trim(),
      kind,
      woonplaatsId: record.ligtInWoonplaatsId ?? null,
      nl,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.bagId.localeCompare(b.bagId));
}

/** Which kinds may explain an extract feature of this kind, best first. A
 *  street named after a canal it replaced ("Rozengracht") is registered as a
 *  Weg; a bridge or lock the routing network carries as a named way ("Hein de
 *  Haanbrug", "Oranjesluizen") is registered as a Kunstwerk. */
const COMPATIBLE: Record<string, readonly OriginKind[]> = {
  street: ['street', 'area', 'bridge'],
  water: ['water', 'street', 'bridge'],
  bridge: ['bridge'],
};

/**
 * The origin for an extract feature, or null. Prefers the same kind, then
 * Amsterdam proper over Weesp, and refuses a name that two different
 * explanations still share after that: better no card than the wrong person.
 */
export function originFor(
  index: ReadonlyMap<string, readonly NameOrigin[]>,
  name: string,
  featureKind: 'street' | 'water' | 'bridge',
): NameOrigin | null {
  const candidates = (index.get(nameKey(name)) ?? []).filter(origin => COMPATIBLE[featureKind].includes(origin.kind));
  if (!candidates.length) return null;
  const ranked = [...candidates].sort((a, b) =>
    COMPATIBLE[featureKind].indexOf(a.kind) - COMPATIBLE[featureKind].indexOf(b.kind)
    || Number(b.woonplaatsId === AMSTERDAM_WOONPLAATS_ID) - Number(a.woonplaatsId === AMSTERDAM_WOONPLAATS_ID));
  const best = ranked[0];
  const rivals = ranked.filter(origin => origin.kind === best.kind && origin.woonplaatsId === best.woonplaatsId);
  if (new Set(rivals.map(origin => origin.nl)).size > 1) return null;
  return best;
}

export function indexOrigins(origins: readonly NameOrigin[]): Map<string, NameOrigin[]> {
  const index = new Map<string, NameOrigin[]>();
  for (const origin of origins) {
    const key = nameKey(origin.name);
    (index.get(key) ?? index.set(key, []).get(key)!).push(origin);
  }
  return index;
}
