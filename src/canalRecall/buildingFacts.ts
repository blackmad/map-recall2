// What a clicked building can say for itself.
//
// Clicking a building that is no landmark opened a dead end: "No building
// details — This building has no name in the map data." Almost every building
// in the city has a construction year in OSM (`start_date`, from the BAG
// register: 1,057,404 of 1,082,604 building ways), some a type worth saying
// (a warehouse, a church) and a few a heritage listing. That is real data
// about the city's growth, so the card says it instead of nothing.

/** Building values worth naming; anything else (`yes`, `house`, `apartments`)
 *  says nothing a rider cannot see. */
export const BUILDING_TYPES = [
  'warehouse', 'church', 'chapel', 'cathedral', 'mosque', 'synagogue', 'temple', 'school', 'university',
  'hospital', 'train_station', 'industrial', 'office', 'retail', 'commercial', 'hotel', 'windmill',
  'houseboat', 'civic', 'government', 'public', 'kindergarten', 'college', 'museum', 'theatre',
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

const TYPE_LABELS: Record<BuildingType, string> = {
  warehouse: 'warehouse', church: 'church', chapel: 'chapel', cathedral: 'cathedral', mosque: 'mosque',
  synagogue: 'synagogue', temple: 'temple', school: 'school', university: 'university building',
  hospital: 'hospital', train_station: 'station building', industrial: 'industrial building', office: 'office building',
  retail: 'shop building', commercial: 'commercial building', hotel: 'hotel', windmill: 'windmill',
  houseboat: 'houseboat', civic: 'civic building', government: 'government building', public: 'public building',
  kindergarten: 'nursery school', college: 'college', museum: 'museum building', theatre: 'theatre',
};

/** Heritage level as OSM tags it: 1 world heritage, 2 national monument
 *  (rijksmonument), 3 municipal monument. 0 when untagged. */
export type HeritageLevel = 0 | 1 | 2 | 3;

/** One building's facts as a tile file stores them: [year, type index or -1, heritage]. */
export type BuildingFactRow = [number, number, HeritageLevel];

export interface BuildingFactTile {
  version: 1;
  /** Keyed by building-tile id, with `NL.IMBAG.Pand.` shortened to `P`. */
  buildings: Record<string, BuildingFactRow>;
}

export const BUILDING_FACT_ZOOM = 14;
export const shortBuildingId = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, 'P');

/** A year the register means, not a placeholder (BAG uses 1005 for unknown). */
export function plausibleYear(year: number, now = new Date().getFullYear()): boolean {
  return Number.isInteger(year) && year >= 1200 && year <= now + 2;
}

/** The first four-digit year in an OSM `start_date` ("1665", "1924-05", "C17" is not one). */
export function yearFromStartDate(value: string | undefined): number | null {
  const match = /^(?:~|before |after |c\.? ?)?(\d{4})/.exec((value || '').trim());
  const year = match ? Number(match[1]) : NaN;
  return plausibleYear(year) ? year : null;
}

export function heritageLevel(tags: Readonly<Record<string, string>>): HeritageLevel {
  const level = Number(tags.heritage);
  if (level === 1 || level === 2 || level === 3) return level;
  return tags['ref:rce'] ? 2 : 0;
}

/**
 * The period a year falls in. Plain date ranges, not claims about style or
 * about which expansion a building belongs to: true in the canal ring, in
 * Weesp and in Durgerdam alike.
 */
export function periodOf(year: number): string {
  if (year < 1588) return 'before the Dutch Golden Age';
  if (year <= 1672) return 'in the Dutch Golden Age';
  if (year < 1700) return 'in the late seventeenth century';
  if (year < 1800) return 'in the eighteenth century';
  if (year < 1860) return 'in the early nineteenth century';
  if (year < 1900) return 'in the late nineteenth century';
  if (year < 1940) return 'in the early twentieth century';
  if (year < 1946) return 'during the Second World War';
  if (year < 1975) return 'in the post-war decades';
  if (year < 2000) return 'in the late twentieth century';
  return 'this century';
}

const HERITAGE_LABELS: Record<HeritageLevel, string> = {
  0: '', 1: 'Part of a World Heritage site.', 2: 'A national monument (rijksmonument).', 3: 'A municipal monument.',
};

/** Storeys a height suggests, at a canal house's ~3.2 m a floor. */
export function storeysFor(heightMetres: number | null | undefined): number | null {
  if (!heightMetres || !(heightMetres > 2.5)) return null;
  return Math.max(1, Math.round(heightMetres / 3.2));
}

/** The card for a clicked building that is no landmark. */
export function describeBuilding(
  row: BuildingFactRow | null | undefined,
  heightMetres: number | null | undefined,
  name = '',
): { name: string; detail: string } {
  const storeys = storeysFor(heightMetres);
  const type = row && row[1] >= 0 ? TYPE_LABELS[BUILDING_TYPES[row[1]]] : '';
  const year = row && plausibleYear(row[0]) ? row[0] : null;
  const title = name || (year ? `Built ${year}` : type ? capitalise(type) : 'No building details');
  const parts: string[] = [];
  if (year) {
    const what = type ? `A ${type}` : 'Built';
    parts.push(type ? `${what}, built in ${year}, ${periodOf(year)}.` : `${what} in ${year}, ${periodOf(year)}.`);
  } else if (type && name) {
    parts.push(`A ${type}.`);
  }
  if (row && row[2]) parts.push(HERITAGE_LABELS[row[2]]);
  if (storeys) parts.push(`About ${Math.round(heightMetres!)} m tall, some ${storeys} ${storeys === 1 ? 'storey' : 'storeys'}.`);
  return { name: title, detail: parts.join(' ') || 'This building has no name or date in the map data.' };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** z14 tile of a point, as the building tiles are cut. */
export function factTileOf(lng: number, lat: number): { x: number; y: number } {
  const n = 2 ** BUILDING_FACT_ZOOM;
  return {
    x: Math.floor((lng + 180) / 360 * n),
    y: Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n),
  };
}

/**
 * Browser side: the fact tiles around the rider, loaded as they move so a
 * click can answer at once. Nine small gzipped tiles at a time; a tile that
 * is missing (outside the extract) is remembered, not refetched.
 */
export class BuildingFactStore {
  private readonly rows = new Map<string, BuildingFactRow>();
  private readonly requested = new Set<string>();
  private lastCentre = '';
  constructor(private base: string, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  setBase(base: string): void {
    if (base === this.base) return;
    this.base = base;
    this.rows.clear();
    this.requested.clear();
    this.lastCentre = '';
  }

  /** Load the tile under a point and its eight neighbours. Cheap when unchanged. */
  prefetchAround(lng: number, lat: number): void {
    const { x, y } = factTileOf(lng, lat);
    const centre = `${x}/${y}`;
    if (centre === this.lastCentre) return;
    this.lastCentre = centre;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) void this.load(x + dx, y + dy);
  }

  lookup(id: string | number | null | undefined): BuildingFactRow | null {
    return id == null ? null : this.rows.get(shortBuildingId(String(id))) ?? null;
  }

  private async load(x: number, y: number): Promise<void> {
    const key = `${x}/${y}`;
    if (this.requested.has(key)) return;
    this.requested.add(key);
    try {
      const response = await this.fetchImpl(`${this.base.replace(/\/$/, '')}/building-facts/${BUILDING_FACT_ZOOM}/${key}.json.gz`);
      if (!response.ok) return;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const gzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      const text = gzipped && typeof DecompressionStream !== 'undefined'
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes);
      const tile = JSON.parse(text) as BuildingFactTile;
      for (const [id, row] of Object.entries(tile.buildings || {})) this.rows.set(id, row);
    } catch {
      // A history fallback answering index.html, or no network: no facts here.
    }
  }
}
