// Palette themes as material parameters (vector-map.js applyTheme). MapLibre
// recoloured its style layers by id pattern; the own engine has four flat
// materials (land, parks, water, streets), so a theme is a colour per material.
// The colours are vector-map.js's `palettes` table, verbatim. 'clean' (or an
// unknown theme) restores the own map's PALETTE.

export interface ThemePalette { ground: string; land: string; water: string; road: string; outline: string; building: string; accent: string }

export const THEME_PALETTES: Readonly<Record<string, ThemePalette>> = {
  '8bit': { ground: '#E8D878', land: '#88B058', water: '#2898D0', road: '#F8F0C8', outline: '#385078', building: '#B8A060', accent: '#F8D830' },
  '16bit': { ground: '#C9B8D9', land: '#74B57A', water: '#4878C8', road: '#EFE7D0', outline: '#463C70', building: '#A98A9E', accent: '#FFD35A' },
  psx: { ground: '#928C79', land: '#6D765B', water: '#526E83', road: '#B8AA91', outline: '#34333C', building: '#777169', accent: '#D5A84B' },
  cyberpunk: { ground: '#100A24', land: '#17143A', water: '#071B3E', road: '#452160', outline: '#00E5FF', building: '#281147', accent: '#FF2DAA' },
};

/** The overview's material colours under a theme: null keeps the own map's palette. */
export interface OverviewColours { land: string; park: string; water: string; streetFill: string; streetCasing: string }

export function overviewColours(theme: string): OverviewColours | null {
  const p = THEME_PALETTES[theme];
  if (!p) return null;
  // MapLibre's mapping: background → ground, landcover/park fills → land, water → water,
  // road lines → road, other lines (casings) → outline.
  return { land: p.ground, park: p.land, water: p.water, streetFill: p.road, streetCasing: p.outline };
}
