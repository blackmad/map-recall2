/**
 * Generic kit footprints whose OSM classification draws the wrong building form (kit review round 3, 2026-10-24,
 * GitHub #37). The generic worship and public lists (worshipBuildingData.ts, publicBuildingData.ts) come from OSM
 * tags: building=church|mosque|..., amenity=school|theatre|cinema. A tag says what the building is *used* for; the
 * kit draws what it *looks like*. A mosque or temple in a converted house, school or workshop, a church hall in the
 * ground floor of a housing block, and a school site tag on a block of flats all took a worship or school kit.
 *
 * Each entry was flagged by the round 3 review (the sheet row, beside the pand's own panorama crops) and checked
 * against the BAG: the pand's live verblijfsobjecten (use and floor area, PDOK BAG OGC API, cached by
 * scripts/landmarks/fetch-kit-pand-uses.ts) and bouwjaar. A BAG use rule alone was tried and rejected: churches
 * converted to flats (Augustinuskerk 1888, 93% living area) keep a church's form, so the list is by hand.
 *
 * Dropped footprints fall back to the city's generic rules (the house generator over the 3DBAG mass), which is what
 * the photos show. Both generators (scripts/build-worship-buildings.ts, scripts/build-public-buildings.ts) read these
 * lists, so a regenerated data file keeps them out; worshipBuildings.ts and publicBuildings.ts apply them to the
 * shipped data files until then.
 */
import type { PublicEntry } from './publicBuildingData.js';
import type { SchoolFacts } from './publicBuildings.js';

const OVR = 'NL.IMBAG.Pand.';

/** OSM worship buildings whose building is not a worship building's form: no worship kit. */
export const NOT_WORSHIP_FORM: Readonly<Record<string, string>> = {
  [`${OVR}0363100012237810`]: 'Blauwe Moskee: the pand is the housing block round it (27 live VBOs, 68% living area); review row 51 photo a 4-5 storey brick block with balconies',
  [`${OVR}0363100012148521`]: '1927 block, 11 VBOs, 59% living area; review row 87 photo a 5-storey dark brick front with white-framed window rows',
  [`${OVR}0363100012083695`]: '1927 Betondorp house, office and living use; review row 113 photo dark brick and grey render with white-framed rectangular windows',
  [`${OVR}0363100012130941`]: 'Kuba Camii Moskee in a 1955 building registered for education; review row 165 photo a house-type front with dormers',
  [`${OVR}0363100012108972`]: 'Moskee an-Nour in a 1921 flat-roofed building; review row 172 photo yellow-grey brick with white rectangular windows',
  [`${OVR}0363100012233557`]: 'Vincentiuskerk in a 1990 housing block (69 live VBOs, 94% living area); review row 175 photo a 6-storey residential block',
  [`${OVR}0363100012246231`]: 'Gerardus Majellakerk OSM tag on a building registered as offices; review row 234 photo a 3-storey house-type front with an arcaded base',
  [`${OVR}0363100012142532`]: '1896 canal house (149 m2) holding a mosque; review row 293 photo a 4-storey house front with sash windows',
  [`${OVR}0363100012237290`]: 'Masjid Al-Karam in a 1904 building registered for industry; review row 307 photo a residential block front with sash windows',
};

/** OSM school/cinema/theatre footprints whose building is not that form: no public kit. */
export const NOT_PUBLIC_FORM: Readonly<Record<string, string>> = {
  [`${OVR}0363100012090063`]: 'SOB school tag on a 1976 housing block (39 live VBOs, 63% living area); review row 284 photo a housing/shop front with balconies',
  // Kit review round 4 (GitHub #43, row 316): planPublic's height escape took a 20 m2 part of the Bijlmerbios complex as a
  // film house; publicBuildings.ts CINEMA_MIN_PART_AREA_M2 now refuses it, and this drops it until publicBuildingData.ts
  // is regenerated (the generator's other output has drifted, so it is not regenerated here).
  w1488019256: 'Bijlmerbios cinema tag on a 20 m2, 30 m OSM building part (a core or pylon of pand 0363100012079990, 0 kit triangles); drawn as a free-standing windowless pillar in review row 316',
};

/** A footprint the OSM use tag files under the wrong kind: the entry and facts it is drawn with instead. */
export const PUBLIC_RETYPE: Readonly<Record<string, { entry: PublicEntry; facts: SchoolFacts; why: string }>> = {
  // planPublic({kind: 's', heightM: 11.2, year: 1932, ...}) -> flat plan, era e; the 3DBAG roof (type 3, eaves 4.1,
  // ridge 15.9) gives the pre-1940 school hip (schoolHipRoof: eaves 6, rise 9.9), which hipAround fits on its footprint.
  [`${OVR}0363100012092742`]: {
    entry: [`${OVR}0363100012092742`, 's', 'f', 11.2, 0, 'e'],
    facts: { year: 1932, roof: 3, eavesM: 4.1, ridgeM: 15.9, wallHex: null, roofFits: true },
    why: 'Zonnehuis (Noord): a 1932 school-type building under a tall hipped roof, tagged amenity=theatre for its current use; review asked for a school with a hipped roof, not a windowless theatre box',
  },
};
