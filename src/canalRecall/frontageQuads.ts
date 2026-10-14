/** Shared frame of the streamed frontage layouts (compound, regular canal, repeated terrace): a point in a wall's local frame. */
export type FrontageLocalPoint = [along: number, outward: number, z: number];
/** Material role of a frontage quad. */
export type FrontageMaterialRole = 'frame' | 'wall' | 'glass' | 'cap';
