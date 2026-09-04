/**
 * A named material vocabulary for canal-house façades.
 *
 * Named, not numeric, and that is the point. A measured wall colour of
 * #8a5a44 tells a renderer one thing; `brick-red-brown` tells it that this is
 * fired clay laid in a bond, that it should be rough, that it takes a brick
 * texture at 210 × 50 mm, and that in a flat-shaded view it should fall back to
 * this colour. The measurement decides *which* material; the material decides
 * how it is drawn. That separation is what lets the same extract render as flat
 * colour today and as textured geometry later without the data changing.
 *
 * The palette is drawn from what the pilot is actually built of: Dutch fired
 * brick in its real range, the paints the canal ring uses, Bentheimer sandstone
 * dressings, and the roof coverings that survive on these houses.
 */

export type MaterialId =
  | 'brick-red' | 'brick-red-brown' | 'brick-purple-brown' | 'brick-yellow' | 'brick-grey'
  | 'painted-white' | 'painted-cream' | 'painted-grey' | 'painted-black' | 'painted-green'
  | 'sandstone' | 'stucco'
  | 'roof-pantile' | 'roof-slate' | 'roof-zinc' | 'roof-bitumen'
  | 'timber-white' | 'timber-green' | 'glass';

export type MaterialFamily = 'brick' | 'paint' | 'stone' | 'roof' | 'joinery' | 'glazing';

export interface Material {
  id: MaterialId;
  family: MaterialFamily;
  /** What a Dutch builder would call it, kept for the encyclopedia text. */
  name: string;
  /** Flat-shaded fallback, and the base colour a texture is tinted toward. */
  colour: string;
  /**
   * Texture slot. A renderer with no texture pack falls back to `colour`.
   *
   * Filled by `build-textures.ts` from the buildings themselves: one-metre wall
   * patches cropped from rectified orthographic façades between the measured
   * openings, medianed per material across buildings. Tiles live in
   * public/canal-drive/facade-textures/ with a manifest saying, per material,
   * whether the colour is measured and whether a bond was constructed.
   */
  texture: string;
  /** Real-world size of one texture tile, in metres. */
  tileM: [width: number, height: number];
  roughness: number;
  metalness: number;
}

export const MATERIALS: Record<MaterialId, Material> = {
  // Dutch brick, at real brick dimensions: a waalformaat brick is 210 × 50 mm
  // with its joint, so a tile of ten courses by four bricks is 0.84 × 0.50 m.
  'brick-red':          { id: 'brick-red',          family: 'brick',   name: 'Rode baksteen',            colour: '#9c4b39', texture: 'brick/red',          tileM: [0.84, 0.50], roughness: 0.92, metalness: 0 },
  'brick-red-brown':    { id: 'brick-red-brown',    family: 'brick',   name: 'Roodbruine baksteen',      colour: '#8a5a44', texture: 'brick/red-brown',    tileM: [0.84, 0.50], roughness: 0.92, metalness: 0 },
  'brick-purple-brown': { id: 'brick-purple-brown', family: 'brick',   name: 'Paarsbruine baksteen',     colour: '#6f4a45', texture: 'brick/purple-brown', tileM: [0.84, 0.50], roughness: 0.93, metalness: 0 },
  'brick-yellow':       { id: 'brick-yellow',       family: 'brick',   name: 'Gele ijsselsteen',         colour: '#b09a6f', texture: 'brick/yellow',       tileM: [0.84, 0.50], roughness: 0.90, metalness: 0 },
  'brick-grey':         { id: 'brick-grey',         family: 'brick',   name: 'Grijze baksteen',          colour: '#7d7873', texture: 'brick/grey',         tileM: [0.84, 0.50], roughness: 0.92, metalness: 0 },

  'painted-white':      { id: 'painted-white',      family: 'paint',   name: 'Wit geschilderd',          colour: '#e5e2d9', texture: 'paint/white',        tileM: [1.00, 1.00], roughness: 0.80, metalness: 0 },
  'painted-cream':      { id: 'painted-cream',      family: 'paint',   name: 'Crème geschilderd',        colour: '#d8cdb4', texture: 'paint/cream',        tileM: [1.00, 1.00], roughness: 0.80, metalness: 0 },
  'painted-grey':       { id: 'painted-grey',       family: 'paint',   name: 'Grijs geschilderd',        colour: '#9aa0a0', texture: 'paint/grey',         tileM: [1.00, 1.00], roughness: 0.80, metalness: 0 },
  'painted-black':      { id: 'painted-black',      family: 'paint',   name: 'Zwart geschilderd',        colour: '#2b2b2b', texture: 'paint/black',        tileM: [1.00, 1.00], roughness: 0.75, metalness: 0 },
  'painted-green':      { id: 'painted-green',      family: 'paint',   name: 'Amsterdams groen',         colour: '#26433a', texture: 'paint/green',        tileM: [1.00, 1.00], roughness: 0.75, metalness: 0 },

  'sandstone':          { id: 'sandstone',          family: 'stone',   name: 'Bentheimer zandsteen',     colour: '#cdc3ab', texture: 'stone/sandstone',    tileM: [1.20, 0.60], roughness: 0.85, metalness: 0 },
  'stucco':             { id: 'stucco',             family: 'stone',   name: 'Pleisterwerk',             colour: '#ded6c8', texture: 'stone/stucco',       tileM: [1.50, 1.50], roughness: 0.88, metalness: 0 },

  // Roof colours are MEASURED, and the difference matters. They were first
  // written from imagination — pantile as #8c4a32, a vivid dark terracotta —
  // and the result was that 1.6% of the canal ring snapped to pantile while the
  // orthophoto plainly shows whole terraces of it. A roof photographed from
  // directly above in flat winter light is far paler and far less saturated
  // than the same tile seen from the street: measured across 250 buildings, the
  // warm cluster sits at r−b +37 and luma 168, where the invented value implied
  // r−b +90 and luma 88. It could never win the snap.
  //
  // These are the median RGB of the three natural clusters in the sunlit slope
  // of 250 sampled roofs (PDOK Actueel_orthoHR, 12.5 cm/px), which is 16% warm,
  // 68% neutral and 16% dark. `nearestRoof` snaps against these; a renderer
  // wanting a street-level appearance should darken and saturate them, because
  // that is a rendering decision and not what the roof measured.
  'roof-pantile':       { id: 'roof-pantile',       family: 'roof',    name: 'Hollandse dakpan',         colour: '#bba196', texture: 'roof/pantile',       tileM: [0.30, 0.36], roughness: 0.85, metalness: 0 },
  'roof-slate':         { id: 'roof-slate',         family: 'roof',    name: 'Leisteen',                 colour: '#646972', texture: 'roof/slate',         tileM: [0.30, 0.20], roughness: 0.70, metalness: 0 },
  'roof-zinc':          { id: 'roof-zinc',          family: 'roof',    name: 'Zink',                     colour: '#999697', texture: 'roof/zinc',          tileM: [0.50, 2.00], roughness: 0.45, metalness: 0.65 },
  'roof-bitumen':       { id: 'roof-bitumen',       family: 'roof',    name: 'Bitumen',                  colour: '#4a4b49', texture: 'roof/bitumen',       tileM: [1.00, 1.00], roughness: 0.95, metalness: 0 },

  'timber-white':       { id: 'timber-white',       family: 'joinery', name: 'Wit schilderwerk',         colour: '#efece3', texture: 'joinery/white',      tileM: [0.20, 0.20], roughness: 0.60, metalness: 0 },
  'timber-green':       { id: 'timber-green',       family: 'joinery', name: 'Donkergroen schilderwerk', colour: '#1f3b31', texture: 'joinery/green',      tileM: [0.20, 0.20], roughness: 0.60, metalness: 0 },
  'glass':              { id: 'glass',              family: 'glazing', name: 'Vensterglas',              colour: '#2f3a40', texture: 'glazing/float',      tileM: [1.00, 1.00], roughness: 0.15, metalness: 0.10 },
};

const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/**
 * Snap a measured colour to the nearest material of a given family.
 *
 * Distance is weighted toward hue over brightness, because a brick wall in
 * shadow is still that brick. Returns the distance too, so a colour that lands
 * far from everything in the palette can be reported as a poor fit rather than
 * quietly assigned.
 */
export function nearestMaterial(
  rgb: [number, number, number],
  family: MaterialFamily,
): { material: Material; distance: number } {
  const candidates = Object.values(MATERIALS).filter(m => m.family === family);
  let best: { material: Material; distance: number } | null = null;
  for (const material of candidates) {
    const [r, g, b] = hexToRgb(material.colour);
    // Compare chroma differences at full weight and overall lightness at a
    // third, so illumination moves a colour along the ramp rather than off it.
    const dLight = ((r + g + b) - (rgb[0] + rgb[1] + rgb[2])) / 3;
    const dRg = (r - g) - (rgb[0] - rgb[1]);
    const dGb = (g - b) - (rgb[1] - rgb[2]);
    const distance = Math.sqrt(dRg * dRg + dGb * dGb + (dLight * dLight) / 9);
    if (!best || distance < best.distance) best = { material, distance };
  }
  return best!;
}

/**
 * Whether a wall reads as bare brick or as paint.
 *
 * Painted walls are low in chroma and high in lightness, or near-black; brick
 * keeps a red-to-yellow cast even when weathered. Deciding family before
 * snapping keeps a pale brick from becoming cream paint.
 */
export function wallFamily(rgb: [number, number, number]): 'brick' | 'paint' | 'stone' {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const chroma = max - min;
  const light = (r + g + b) / 3;
  if (light < 52) return 'paint';                 // near-black is always paint here
  if (chroma < 16 && light > 155) return 'paint'; // pale and neutral
  if (chroma < 24 && light > 180) return 'stone'; // stucco and sandstone
  // Any warm cast at all is brick. Fired clay keeps a red-to-yellow bias even
  // weathered and in shade, and the threshold has to be low because a shaded
  // sample has little chroma left to show it.
  if (r > b + 6) return 'brick';
  return chroma < 14 ? 'paint' : 'brick';
}

/** Roof family from measured colour, using the same snap. */
export const nearestRoof = (rgb: [number, number, number]) => nearestMaterial(rgb, 'roof');
