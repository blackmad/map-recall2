export type CanalTheme = 'clean' | '8bit' | '16bit' | 'psx' | 'cyberpunk';

type MapLibreExpression = unknown[];

const THEME_DEFAULTS: Record<CanalTheme, string> = {
  clean: '#D8D3CA', '8bit': '#B8C68E', '16bit': '#A99BC8', psx: '#9B958E', cyberpunk: '#25114D',
};

const THEME_FALLBACK_RAMPS: Record<Exclude<CanalTheme, 'cyberpunk'>, readonly [string, string, string, string]> = {
  clean: ['#DED9D0', '#D2C9BC', '#C2B5A5', '#AAA095'],
  '8bit': ['#C8BE78', '#B8A060', '#A68A50', '#8E7444'],
  '16bit': ['#B9A8C5', '#A98A9E', '#97798E', '#806A80'],
  psx: ['#9B9588', '#888174', '#777169', '#666159'],
};

const MATERIAL_COLORS: Record<string, string> = {
  cement_block: '#6a7880', brick: '#bd8161', plaster: '#dadbdb', wood: '#d48741',
  concrete: '#d3c2b0', metal: '#b7b1a6', steel: '#b7b1a6', stone: '#b4a995',
  mud: '#9d8b75', glass: '#5a81a0', masonry: '#bd8161', traditional: '#bd8161',
};

export function buildingColorExpression(theme: CanalTheme | string): MapLibreExpression | string {
  const selectedTheme = theme in THEME_DEFAULTS ? theme as CanalTheme : 'clean';
  if (selectedTheme === 'cyberpunk') return THEME_DEFAULTS.cyberpunk;

  const ramp = THEME_FALLBACK_RAMPS[selectedTheme];
  const heightFallback: unknown[] = [
    'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
    0, ramp[0], 8, ramp[1], 20, ramp[2], 60, ramp[3],
  ];
  const materialMatch: unknown[] = ['match', ['downcase', ['coalesce', ['get', 'material'], '']]];
  for (const [material, color] of Object.entries(MATERIAL_COLORS)) materialMatch.push(material, color);
  materialMatch.push(heightFallback);
  // OSM `colour` is free text: plenty of buildings carry values like "brick"
  // or "light sandstone" that are not CSS colors. Feeding those straight to
  // fill-extrusion-color makes MapLibre reject the whole expression with
  // "Expected color but found null", which drops every building back to the
  // style default. `to-color` with a fallback keeps the good values and
  // quietly ignores the rest.
  return [
    'case',
    ['has', 'colour'], ['to-color', ['get', 'colour'], THEME_DEFAULTS[selectedTheme]],
    ['has', 'color'], ['to-color', ['get', 'color'], THEME_DEFAULTS[selectedTheme]],
    materialMatch,
  ];
}

export function buildingOpacity(theme: CanalTheme | string): number {
  // Fully opaque. Translucent fill-extrusions are not depth-sorted against
  // each other, so overlapping footprints tore into visible streaks where
  // one building showed through another.
  return theme === 'cyberpunk' ? 0.98 : 1;
}
