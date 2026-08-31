const namedColors: Record<string, string> = {
  beige: '#f5f5dc', black: '#222222', blue: '#5a81a0', brown: '#8b5a3c', gray: '#888888', grey: '#888888',
  green: '#4f7f52', orange: '#d48741', red: '#bd5b52', silver: '#b7b1a6', white: '#eeeeea', yellow: '#d8bd64',
};

export const materialColors: Record<string, string> = {
  brick: '#bd8161', glass: '#5a81a0', wood: '#d48741', concrete: '#d3c2b0', stone: '#b4a995',
  metal: '#b7b1a6', steel: '#b7b1a6', plaster: '#dadbdb', masonry: '#bd8161',
};

export const normalizeBuildingColor = (value?: string): string | undefined => {
  if (!value) return undefined;
  const clean = value.split(';')[0].trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(clean)) return `#${[...clean.slice(1)].map(channel => channel + channel).join('')}`;
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  if (/^[0-9a-f]{3}$/i.test(clean)) return `#${[...clean].map(channel => channel + channel).join('')}`;
  if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean}`;
  return namedColors[clean];
};

const firstNormalizedColor = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    const normalized = normalizeBuildingColor(value);
    if (normalized) return normalized;
  }
  return undefined;
};

export function extractSurfaceColors(tags: Record<string, string | undefined>) {
  const material = (tags['building:material'] || '').trim().toLowerCase();
  const roofMaterial = (tags['roof:material'] || '').trim().toLowerCase();
  const taggedSideColour = firstNormalizedColor(
    tags['building:facade:colour'], tags['building:facade:color'],
    tags['facade:colour'], tags['facade:color'],
    tags['building:colour'], tags['building:color'],
  );
  const taggedRoofColour = firstNormalizedColor(tags['roof:colour'], tags['roof:color']);
  const sideColour = taggedSideColour || materialColors[material];
  const roofColour = taggedRoofColour || materialColors[roofMaterial];
  return { material, roofMaterial, taggedSideColour, taggedRoofColour, sideColour, roofColour };
}
