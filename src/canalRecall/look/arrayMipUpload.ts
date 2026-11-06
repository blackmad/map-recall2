// Custom mip levels for a three.js DataArrayTexture (lane R3-B #231). three@0.185 uploads only level 0 of a
// DataArrayTexture (WebGLTextures.js uploadTexture, the isDataArrayTexture branch); with `generateMipmaps` it allocates
// the full chain with `texStorage3D` (getMipLevels) and fills it with `generateMipmap`. The custom levels then go into
// that same immutable storage by hand, `texSubImage3D` per level on the bound array (through three's state cache, so
// its bindings stay coherent), whenever they are ready. Anything missing (no WebGL2 context, no `__webglTexture`, a
// short level, a GL error) falls back to `generateMipmap`, i.e. exactly GL's mips.

export type ArrayMipUploadResult = { mode: 'custom' | 'gl-fallback'; levels: number; ms: number; reason?: string };

/**
 * Upload `levels` (level 1..N, each all layers RGBA8) into `texture`'s storage. Call any time after three has uploaded
 * the texture (its `__webglTexture` exists). Returns what happened; never throws.
 */
export function uploadArrayMips(renderer: any, texture: any, levels: readonly Uint8Array[], size: number, depth: number): ArrayMipUploadResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const done = (mode: ArrayMipUploadResult['mode'], reason?: string): ArrayMipUploadResult => ({ mode, levels: levels.length, ms: +((typeof performance !== 'undefined' ? performance.now() : 0) - t0).toFixed(2), ...(reason ? { reason } : {}) });
  const gl = renderer?.getContext?.();
  const handle = renderer?.properties?.get?.(texture)?.__webglTexture;
  if (!gl || typeof gl.texSubImage3D !== 'function' || !handle) return fallback(renderer, gl, handle, done, !gl ? 'no context' : !handle ? 'no __webglTexture' : 'no texSubImage3D');
  try {
    while (gl.getError() !== gl.NO_ERROR) { /* clear stale errors so ours are ours */ }
    const state = renderer.state;
    if (state?.bindTexture) state.bindTexture(gl.TEXTURE_2D_ARRAY, handle); else gl.bindTexture(gl.TEXTURE_2D_ARRAY, handle);
    // Three leaves the unpack state of its last upload; a typed-array 3D upload needs no flip, no premultiply, no row tricks.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (gl.UNPACK_FLIP_Y_WEBGL !== undefined) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
    for (const p of ['UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES']) if (gl[p] !== undefined) gl.pixelStorei(gl[p], 0);
    for (let l = 0; l < levels.length; l++) {
      const s = Math.max(1, size >> (l + 1));
      if (levels[l].length !== s * s * 4 * depth) return fallback(renderer, gl, handle, done, `level ${l + 1} has ${levels[l].length} bytes`);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, l + 1, 0, 0, 0, s, s, depth, gl.RGBA, gl.UNSIGNED_BYTE, levels[l]);
    }
    const err = gl.getError();
    if (err !== gl.NO_ERROR) return fallback(renderer, gl, handle, done, `GL error ${err}`);
    return done('custom');
  } catch (e) {
    return fallback(renderer, gl, handle, done, String((e as Error)?.message ?? e).slice(0, 120));
  }
}

function fallback(renderer: any, gl: any, handle: any, done: (mode: ArrayMipUploadResult['mode'], reason?: string) => ArrayMipUploadResult, reason: string): ArrayMipUploadResult {
  try {
    if (gl && handle) {
      if (renderer?.state?.bindTexture) renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, handle); else gl.bindTexture(gl.TEXTURE_2D_ARRAY, handle);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    }
  } catch { /* nothing more to do: level 0 still draws */ }
  return done('gl-fallback', reason);
}
