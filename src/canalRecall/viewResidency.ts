// Hysteresis for view-driven rebuilds.
//
// The game moves the camera with `jumpTo` every frame, and MapLibre fires
// `moveend` for each of those calls, so anything keyed on `moveend` runs per
// frame while riding. Layers that rebuild geometry for "what is in view" should
// build for a padded area once and rebuild only after the view leaves it.

export interface LngLatBox {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

const METRES_PER_DEGREE_LAT = 111_320;

/** Grows a box by a fraction of its own span plus a fixed margin in metres. */
export function padBox(box: LngLatBox, fraction: number, metres = 0): LngLatBox {
  const lat = (box.north + box.south) / 2;
  const dyMetres = metres / METRES_PER_DEGREE_LAT;
  const dxMetres = dyMetres / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const dx = (box.east - box.west) * fraction + dxMetres;
  const dy = (box.north - box.south) * fraction + dyMetres;
  return { west: box.west - dx, south: box.south - dy, east: box.east + dx, north: box.north + dy };
}

export function containsBox(outer: LngLatBox, inner: LngLatBox): boolean {
  return inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;
}

/**
 * Remembers the area a layer last built for. `needsRebuild` is true when the
 * view has left that area or the layer's own inputs (`key`) changed; `built`
 * returns the padded area to build for and records it.
 */
export class ViewResidency {
  private area: LngLatBox | null = null;
  private key: string | null = null;

  constructor(private readonly fraction = 0.25, private readonly metres = 60) {}

  needsRebuild(view: LngLatBox, key: string): boolean {
    return !this.area || key !== this.key || !containsBox(this.area, view);
  }

  built(view: LngLatBox, key: string): LngLatBox {
    this.area = padBox(view, this.fraction, this.metres);
    this.key = key;
    return this.area;
  }

  invalidate(): void {
    this.area = null;
    this.key = null;
  }
}
