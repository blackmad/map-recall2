export type CanalTheme = 'clean' | '8bit' | '16bit' | 'psx' | 'cyberpunk';

type MapLibreExpression = unknown[];

const THEME_DEFAULTS: Record<CanalTheme, string> = {
  clean: '#D8D3CA', '8bit': '#B8C68E', '16bit': '#A99BC8', psx: '#9B958E', cyberpunk: '#25114D',
};

const MATERIAL_COLORS: Record<string, string> = {
  cement_block: '#6a7880', brick: '#bd8161', plaster: '#dadbdb', wood: '#d48741',
  concrete: '#d3c2b0', metal: '#b7b1a6', steel: '#b7b1a6', stone: '#b4a995',
  mud: '#9d8b75', glass: '#5a81a0', masonry: '#bd8161', traditional: '#bd8161',
};

// Evidence-backed fallbacks used only when a vector tile omitted OSM colour.
const LANDMARK_COLORS: Record<string, string> = { NEMO: '#43888b', 'NEMO Science Museum': '#43888b' };

export function buildingColorExpression(theme: CanalTheme | string): MapLibreExpression | string {
  const selectedTheme = theme in THEME_DEFAULTS ? theme as CanalTheme : 'clean';
  if (selectedTheme === 'cyberpunk') return THEME_DEFAULTS.cyberpunk;

  const landmarkMatch: unknown[] = ['match', ['coalesce', ['get', 'name'], '']];
  for (const [name, color] of Object.entries(LANDMARK_COLORS)) landmarkMatch.push(name, color);
  landmarkMatch.push(null);
  const materialMatch: unknown[] = ['match', ['downcase', ['coalesce', ['get', 'material'], '']]];
  for (const [material, color] of Object.entries(MATERIAL_COLORS)) materialMatch.push(material, color);
  materialMatch.push(null);

  return ['coalesce', ['get', 'colour'], ['get', 'color'], landmarkMatch, materialMatch, THEME_DEFAULTS[selectedTheme]];
}

export function buildingOpacity(theme: CanalTheme | string): number {
  return theme === 'cyberpunk' ? 0.98 : 0.9;
}
