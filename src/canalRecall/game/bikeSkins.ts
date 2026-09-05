/**
 * Chase-mode bicycle skins. Each GLB exposes `Lenker` / `RadVorn` / `RadHinten`
 * (or is body-only for look reference). Paths are relative to `public/canal-drive/`.
 */

export const BIKE_SKIN_IDS = ['omafiets', 'pink', 'mama', 'swapfiets'] as const;
export type BikeSkinId = (typeof BIKE_SKIN_IDS)[number];

export const DEFAULT_BIKE_SKIN: BikeSkinId = 'omafiets';

export interface BikeSkin {
  id: BikeSkinId;
  label: string;
  /** File under public/canal-drive/ */
  file: string;
  /** Lateral fattening for chase altitude (1 = native). */
  widthScale: number;
  /** Whether Lenker/Rad* pivots actually move geometry. */
  motion: boolean;
  /** Skin ships a named `BabySeat` node that prefs can show/hide. */
  babySeat: boolean;
  credit: string;
}

export const BIKE_SKINS: Record<BikeSkinId, BikeSkin> = {
  omafiets: {
    id: 'omafiets',
    label: 'Omafiets',
    file: 'omafiets-runtime.glb',
    widthScale: 1.35,
    motion: true,
    babySeat: true,
    credit: 'Authored for Canal Recall',
  },
  pink: {
    id: 'pink',
    label: 'City bike',
    file: 'pink-city-bicycle-runtime.glb',
    widthScale: 1.2,
    motion: true,
    babySeat: false,
    credit: 'Kin Chen / BlenderKit (CC0)',
  },
  mama: {
    id: 'mama',
    label: 'Mama-chari',
    file: 'mama-chari-runtime.glb',
    widthScale: 1.65,
    motion: true,
    babySeat: true,
    credit: 'pokoponmaru / Sketchfab (CC BY 4.0)',
  },
  swapfiets: {
    id: 'swapfiets',
    label: 'Swapfiets',
    file: 'swapfiets-sketchfab-preview.glb',
    widthScale: 1,
    motion: false,
    babySeat: false,
    credit: 'PatrickGoud / Sketchfab (CC BY 4.0) — look only',
  },
};

export function parseBikeSkin(raw: unknown, fallback: BikeSkinId = DEFAULT_BIKE_SKIN): BikeSkinId {
  if (typeof raw === 'string' && (BIKE_SKIN_IDS as readonly string[]).includes(raw)) {
    return raw as BikeSkinId;
  }
  return fallback;
}

export function bikeSkinById(id: BikeSkinId): BikeSkin {
  return BIKE_SKINS[id] ?? BIKE_SKINS[DEFAULT_BIKE_SKIN];
}
