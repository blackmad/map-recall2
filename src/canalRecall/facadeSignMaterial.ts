/** A small source-bound sign material helper for the repair preview.
 * The caller supplies its Three namespace so this stays compatible with the
 * single browser Three bundle. It deliberately does not infer tenant text.
 */
export type FacadeSignMaterialOptions = {
  text?: string;
  background?: string;
  colour?: string;
  font?: string;
  width?: number;
  height?: number;
  /** Physical width / height from the compiled sign face. */
  aspectRatio?: number;
};

export function createFacadeSignMaterial(THREE: any, options: FacadeSignMaterialOptions = {}) {
  if (!options.text?.trim()) throw new Error('Source sign text is required');
  if (typeof document === 'undefined') throw new Error('Facade sign material requires a browser canvas');
  const width = Math.min(options.width ?? 512, 512);
  const ratio = Number.isFinite(options.aspectRatio) && (options.aspectRatio ?? 0) > 0 ? options.aspectRatio! : null;
  const height = ratio ? Math.max(8, Math.min(128, Math.round(width / ratio))) : Math.min(options.height ?? 128, 128);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create sign canvas');
  context.fillStyle = options.background ?? '#242628';
  context.fillRect(0, 0, width, height);
  context.fillStyle = options.colour ?? '#f3eee4';
  const requested = options.font ?? `italic 700 ${Math.round(height * .45)}px Georgia, serif`;
  const match = requested.match(/(\d+(?:\.\d+)?)px/);
  let size = Math.min(match ? Number(match[1]) : height * .45, height * .8);
  const fontAt = (pixels: number) => match ? requested.replace(/\d+(?:\.\d+)?px/, `${Math.max(1, Math.round(pixels))}px`) : `italic 700 ${Math.max(1, Math.round(pixels))}px Georgia, serif`;
  context.font = fontAt(size);
  while (size > 1 && context.measureText(options.text.trim()).width > width * .9) { size *= .9; context.font = fontAt(size); }
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(options.text.trim(), width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace ?? texture.colorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  return { material, texture, canvas };
}

/** Assigns a conventional left-to-right sign UV rectangle to a quad. */
export function signQuadUv(THREE: any) {
  return [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1)];
}
