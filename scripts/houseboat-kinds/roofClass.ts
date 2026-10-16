// Roof colour classes read off the orthophoto. The 8 cm photo is a low-sun winter
// flight, so raw medians are dark and grey; a boat gets the class's drawn colour, which
// keeps white roofs white and sedum green without importing the photo's gloom.
export type RoofClass = 'white' | 'zinc' | 'grey' | 'bitumen' | 'sedum' | 'moss' | 'red' | 'timber' | 'blue' | 'solar';
export const ROOF_CLASS_HEX: Readonly<Record<RoofClass, string>> = {
  white: '#efece4', zinc: '#b3b7b8', grey: '#8a8e91', bitumen: '#55595d', sedum: '#7c9a5e', moss: '#5f7a4a',
  red: '#a35d45', timber: '#b08a5c', blue: '#6f8fae', solar: '#3b4a5e',
};
const lum = ([r, g, b]: readonly number[]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Class of a median roof colour (sRGB 0–255) from the PDOK orthophoto. */
export function roofClass(rgb: readonly [number, number, number]): RoofClass {
  // The flight has a blue haze over dark surfaces (open water ~[45, 60, 80], grey roofs
  // ~[95, 105, 118]) that fades out by ~140 luminance; take it off before reading the hue.
  const haze = Math.max(0, Math.min(1, (140 - lum(rgb)) / 80));
  const r = rgb[0] + 8 * haze, g = rgb[1], b = rgb[2] - 14 * haze;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min, l = lum([r, g, b]);
  if (l >= 165) return 'white';
  if (chroma < 16 || chroma / Math.max(1, max) < 0.13) return l >= 115 ? 'zinc' : l >= 78 ? 'grey' : 'bitumen';
  let hue = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue >= 65 && hue < 170) return l >= 90 ? 'sedum' : 'moss';
  if (hue >= 170 && hue < 265) return chroma >= 30 && l >= 95 ? 'blue' : l >= 115 ? 'zinc' : l >= 70 ? 'grey' : 'solar';
  if (hue >= 25 && hue < 65) return l >= 100 ? 'timber' : 'grey';
  return 'red';
}
