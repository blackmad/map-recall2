/**
 * Shared bits of the commercial-street survey scripts: the index file name for a street and the BAG-year style
 * groups per district (`--style=`). Oud-West is the Kinkerstraat rule; De Baarsjes the Jan Evertsenstraat one.
 */
import path from 'node:path';

/** "Jan Evertsenstraat" -> "jan-evertsenstraat" (single-word streets are unchanged: "kinkerstraat"). */
export const streetSlug = (street: string) => street.toLowerCase().trim().replace(/\s+/g, '-');
export const streetFile = (street: string) => path.join('scripts/street-surveys/streets', `${streetSlug(street)}.json`);

export type StyleRules = {rule: string; infill: string; group: (year: number | null) => string};

export const STYLE_RULES: Record<string, StyleRules> = {
  'oud-west': {
    rule: 'BAG bouwjaar: 1880-1909 revolutiebouw, 1910-1919, 1980-1989 urban-renewal infill, else other',
    infill: '1980s-infill',
    group: y => y === null ? 'unknown' : y >= 1880 && y <= 1909 ? 'revolutiebouw-1880-1909' : y >= 1910 && y <= 1919 ? '1910s' : y >= 1980 && y <= 1989 ? '1980s-infill' : 'other',
  },
  'de-baarsjes': {
    rule: 'BAG bouwjaar: 1920-1929 Amsterdam School, 1910-1919, 1945 and later post-war, else other (1930s, pre-1910)',
    infill: 'post-war',
    group: y => y === null ? 'unknown' : y >= 1920 && y <= 1929 ? 'amsterdam-school-1920s' : y >= 1910 && y <= 1919 ? '1910s' : y >= 1945 ? 'post-war' : 'other',
  },
};

export function styleRules(name: string | undefined): StyleRules {
  const r = STYLE_RULES[name ?? 'oud-west'];
  if (!r) throw new Error(`unknown --style=${name}; one of ${Object.keys(STYLE_RULES).join(', ')}`);
  return r;
}
