// Shadow depth ignores instance colour (2026-11-27, own-engine default, GL program budget).
// three keys a program on `instancingColor` whenever an InstancedMesh has `instanceColor`, the shadow depth pass
// included, though MeshDepthMaterial never reads colour. The instanced layers with colours (trees, market stalls,
// terraces, yard fill, furniture) therefore compiled an extra depth program per shadow side. The shadow pass now
// hides `instanceColor` from the program parameters for the depth draw (onBeforeShadow) and puts it back after
// (onAfterShadow); the colour pass is unchanged. A mesh with its own onBeforeShadow/onAfterShadow keeps it.
// `?depthInstanceColor=1` (or `window.__canalRecallDepthInstanceColor = true`) restores three's own keying.

export function depthInstanceColorKept(asked: unknown): boolean {
  return asked === true || asked === 1 || asked === '1' || asked === 'true' || asked === 'on';
}

type Instanced = { instanceColor: unknown; __shadowInstanceColor?: unknown };

/** Before the depth draw: no instance colour, so the depth program is the plain instanced one. */
export function hideInstanceColor(this: Instanced): void {
  if (this.instanceColor) { this.__shadowInstanceColor = this.instanceColor; this.instanceColor = null; }
}
/** After the depth draw: the colour back for the colour pass. */
export function restoreInstanceColor(this: Instanced): void {
  if (this.__shadowInstanceColor) { this.instanceColor = this.__shadowInstanceColor; this.__shadowInstanceColor = undefined; }
}

/** Install on THREE.InstancedMesh's prototype once. False when asked off or already installed. */
export function installDepthIgnoresInstanceColor(THREE: any, asked?: unknown): boolean {
  const proto = THREE?.InstancedMesh?.prototype;
  if (!proto || depthInstanceColorKept(asked) || proto.__depthIgnoresInstanceColor) return false;
  proto.__depthIgnoresInstanceColor = true;
  proto.onBeforeShadow = hideInstanceColor;
  proto.onAfterShadow = restoreInstanceColor;
  return true;
}
