// Large-building tier: the generic facade for big buildings that used to draw
// as blank coloured boxes (user 2026-10-09: "are we still leaving big
// buildings with colors as untextured? … prime candidates to model").
//
// Who: unmodelled landmark buildings past the house-sized rule in
// `exceptLandmarks` (roofMesh.ts): built after 1945, undated, or taller than
// 26 m (the Anne Frank museum block on the Prinsengracht, the UvA PC
// Hoofthuis, Nyenrode on the Keizersgracht, hospitals, towers). They kept a
// bare extrusion because the house facade made Carré and the Oosterkerk read
// as nine-storey flats (2026-10-03). Churches and halls now have kits; the
// rest get this tier instead of a box.
//
// What: one facade *system* per building, from the same shared texture cells
// as every house (no new textures, no extra draw calls; the walls go into the
// tile's merged chunk):
//   - a period archetype from the BAG year (pre-1915 masonry with tall
//     windows, interwar brick, post-war punched/ribbon/curtain); a listed
//     landmark keeps its brick wall colour even when BAG dates a rebuild;
//   - civic storey heights (4.2 m old, 3.6 m post-war) so the storey count
//     follows the building's height instead of a house's 3 m rhythm;
//   - a ground floor of windows with one entrance per street run (no house
//     door every four bays, no random shopfront), a plain parapet band and
//     the period cornice under the flat roof's lid.
// These are display priors, not evidence; a building with a recipe or kit
// keeps that instead.

import { facadeKey, facadeStyleFor, footprintAreaM2, snapWallColour, type FacadeStyle } from './genericFacades.js';
import type { Archetype, ShopKind } from './bayTextures.js';

/**
 * Hand-tuned systems for the most visible large-tier buildings (audit ranking,
 * scripts/large-tier/audit.ts), read off Gemeente Amsterdam panoramas (CC BY 4.0,
 * `npm run pand-reference`) with BAG/3DBAG heights. Values are display choices
 * from a photo, not measurements; `source` names the panorama.
 */
export type LargeTierOverride = {
  name: string; source: string;
  archetype?: Archetype; wallHex?: string; style?: number;
  storeyM?: number; groundM?: number; parapetM?: number;
  /** A glazed or shop ground floor drawn with this shop cell. */
  groundShop?: ShopKind;
};
export const LARGE_TIER_OVERRIDES: Readonly<Record<string, LargeTierOverride>> = {
  // Prinsengracht 267 (Westermarkt): dark brown brick, three punched windows a floor over a glazed ground floor.
  'NL.IMBAG.Pand.0363100012169587': { name: 'Anne Frank House museum block', source: 'TMX7316010203-002045_pano_0001_002852 (2021-03-17)', archetype: 'modern', wallHex: '#4e3b34', style: 1, storeyM: 3.1, groundM: 4.4, parapetM: 0.6, groundShop: 'shopWindow' },
  // Spuistraat/Singel: pale grey concrete bands with ribbon glazing, seven storeys over a colonnade.
  'NL.IMBAG.Pand.0363100012165429': { name: 'UvA PC Hoofthuis', source: 'TMX7316010203-001054_pano_0000_001042 (2019-01-15)', archetype: 'modern', wallHex: '#a9a59b', style: 6, storeyM: 3.2, groundM: 4.2, parapetM: 0.8 },
  // Keizersgracht: brown brick, white-framed sashes, a stone plinth and a central entrance; an attic of dormers above.
  'NL.IMBAG.Pand.0363100012169023': { name: 'Nyenrode, Keizersgracht', source: 'TMX7316010203-001975_pano_0000_000186 (2021-01-22)', archetype: 'c19', wallHex: '#6e4a3e', style: 1, storeyM: 3.9, groundM: 4.3, parapetM: 1.6 },
  // Kalverstraat/Singel: beige stone grid of punched windows over shop arcades.
  'NL.IMBAG.Pand.0363100012165086': { name: 'Kalvertoren', source: 'TMX7316010203-001530_pano_0004_000014 (2019-12-20)', archetype: 'modern', wallHex: '#bfb3a0', style: 2, storeyM: 3.6, groundM: 5.0, parapetM: 1.0, groundShop: 'groundShop' },
  // Spui 25 / Voetboogstraat: red brick with stone dressings and big glazed ground-floor windows.
  'NL.IMBAG.Pand.0363100012167925': { name: 'UvA Spui 25', source: 'TMX7316010203-002538_pano_0000_001530 (2022-04-22)', archetype: 'c19', wallHex: '#8e4e3a', style: 7, storeyM: 4.0, groundM: 4.8, parapetM: 1.2, groundShop: 'shopWindow' },
  // Singel/Handboogstraat: ochre-brown old brick with an arched entrance.
  'NL.IMBAG.Pand.0363100012175031': { name: 'UvA, Singel / Handboogstraat', source: 'TMX7316060226-000019_pano_0000_003725 (2016-08-15)', archetype: 'c19', wallHex: '#8a6a4f', style: 9, storeyM: 4.2, groundM: 4.6, parapetM: 1.0 },
};

/** Why the decoration chain left a decorated feature without a facade (audit). */
export function largeTierReason(p: Record<string, unknown>, geometry?: unknown): string {
  if (typeof p.facade === 'string' && p.facadeStyle) return p.largeTier ? 'large-tier' : 'faced';
  if (p.kitWall) return 'kit-wall';
  const heightM = Number(p.height);
  if (!Number.isFinite(heightM)) return 'no-height';
  const year = Number.isFinite(Number(p.constructionYear)) && p.constructionYear != null ? Number(p.constructionYear) : null;
  if (geometry !== undefined && !facadeStyleFor({ year, heightM, minHeightM: Number(p.minHeight) || 0, footprintM2: footprintAreaM2(geometry) })) return 'too-small';
  if (p.groundAppearanceStyleSource !== undefined && p.groundAppearanceStyleSource !== 'wall-inherited-not-independently-measured') return 'measured-ground';
  return 'no-colour-source';
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The period a large building's facade is drawn in. */
export function largeTierArchetype(year: number | null, listed: boolean, heightM: number): Archetype {
  if (year === null) return listed && heightM < 30 ? 'c19' : 'modern';
  if (year < 1915) return 'c19';
  if (year < 1945) return 'school';
  return 'modern';
}

export const LARGE_TIER_LAYOUT: Record<Archetype, FacadeStyle> = { canal: 'canal', c19: 'c19', school: 'school', modern: 'modern' };

/**
 * Decorate a big unmodelled landmark with the large tier. `wall` is the wall
 * colour the caller settled on (period brick/concrete for a guessed colour);
 * a mapped OSM colour on the feature wins over it.
 */
export function largeTierProperties(p: Record<string, unknown>, wall: string, listed: boolean): Record<string, unknown> {
  const heightM = Number(p.height);
  if (!Number.isFinite(heightM) || heightM - (Number(p.minHeight) || 0) < 2.6) return p;
  const year = p.constructionYear != null && Number.isFinite(Number(p.constructionYear)) ? Number(p.constructionYear) : null;
  const tuned = LARGE_TIER_OVERRIDES[String(p.id ?? '')];
  const archetype = tuned?.archetype ?? largeTierArchetype(year, listed, heightM);
  const mapped = [p.sideColour, p.colour, p.color].find(v => typeof v === 'string' && HEX.test(v.trim())) as string | undefined;
  const wallHex = tuned?.wallHex ?? (mapped && p.appearanceStyleSource !== 'citywide-identity-palette-v3-not-measured' ? mapped.trim() : wall);
  const style = heightM >= 30 && archetype === 'modern' ? 'tower' : LARGE_TIER_LAYOUT[archetype];
  // A guessed flat-cap colour (terracotta, ochre) reads as a tiled roof on a 60 m slab: big flat
  // roofs are bitumen, gravel or zinc grey unless a source says otherwise.
  const roofGuessed = typeof p.roofAppearanceStyleSource === 'string' && p.roofAppearanceStyleSource.includes('not-measured');
  const roof = roofGuessed || typeof p.roofColour !== 'string' ? LARGE_ROOF_GREYS[Math.floor(hash01(`${p.id}:roof`) * LARGE_ROOF_GREYS.length)] : p.roofColour;
  return {
    ...p, largeTier: archetype, largeTierWall: wallHex, sideColour: wallHex, groundColour: wallHex, roofColour: roof,
    facade: facadeKey(style, snapWallColour(wallHex) ?? 'priorBrickBrown'), facadeStyle: style,
  };
}

const LARGE_ROOF_GREYS = ['#6f7378', '#7d7a74', '#62676c', '#86827a'];

/** The plinth: the ground floor a shade darker and greyer than the wall, like a stone or rendered base. */
export function plinthHex(wallHex: string): string {
  if (!HEX.test(wallHex)) return wallHex;
  const n = parseInt(wallHex.slice(1), 16), grey = [0x6a, 0x66, 0x61];
  return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map((c, i) => Math.round(c * 0.55 + grey[i] * 0.45 * 0.9).toString(16).padStart(2, '0')).join('');
}

const hash01 = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };

/** Per-building facade system for the bay looks (bayLook.ts BAY_STYLES indices). */
export type LargeTierSystem = {
  archetype: Archetype;
  /** Index into BAY_STYLES[archetype]. */
  style: number;
  layout: FacadeStyle;
  /** Target storey and ground-floor heights (metres); the layout stretches them to whole storeys. */
  storeyM: number; groundM: number; bayM: number;
  /** Plain band between the top window row and the roof. */
  parapetM: number;
  groundShop?: ShopKind;
  /** Hand-tuned from a photo: its ground floor wins over the shopfronts extract. */
  tuned?: boolean;
};

/**
 * The facade system: brick walls take a masonry or brick-punched style; a pale
 * post-war wall takes punched windows, and a tall one ribbon or curtain glazing.
 */
export function largeTierSystem(id: string, archetype: Archetype, wallHex: string, heightM: number): LargeTierSystem {
  const base = genericSystem(id, archetype, wallHex, heightM), tuned = LARGE_TIER_OVERRIDES[id];
  if (!tuned) return base;
  return { ...base, style: tuned.style ?? base.style, storeyM: tuned.storeyM ?? base.storeyM, groundM: tuned.groundM ?? base.groundM, parapetM: tuned.parapetM ?? base.parapetM, groundShop: tuned.groundShop, tuned: true };
}

function genericSystem(id: string, archetype: Archetype, wallHex: string, heightM: number): LargeTierSystem {
  const h = hash01(`${id}:large`);
  if (archetype === 'c19') return { archetype, style: [7, 9, 1][Math.floor(h * 3)], layout: 'c19', storeyM: 4.2, groundM: 4.8, bayM: 4.8, parapetM: 1.0 };
  if (archetype === 'school') return { archetype, style: Math.floor(h * 2), layout: 'school', storeyM: 3.8, groundM: 4.4, bayM: 4.8, parapetM: 0.9 };
  const brick = luminance(HEX.test(wallHex) ? wallHex : '#b9ad9a') < 0.42;
  const style = brick ? Math.floor(h * 2) : heightM >= 30 ? (h < 0.5 ? 6 : 7) : [2, 3, 4, 5][Math.floor(h * 4)];
  return { archetype: 'modern', style, layout: 'modern', storeyM: 3.6, groundM: 4.5, bayM: style === 7 ? 3.6 : 4.2, parapetM: 0.8 };
}
