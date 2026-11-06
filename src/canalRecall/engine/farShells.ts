/**
 * The far tier (lane R2-B, #229; `?farShells=0` off: nothing fetched or drawn). From the air the city used to end
 * where the resident building tiles end (12 z14 tiles desktop, 9 touch): beyond them the own ground's far ring drew
 * land, water and streets out to FAR_MAX_M, and no building. This layer draws the baked SHL1 prisms of every world
 * cell inside the far ring (`farRadiusM` from the own ground, the same FAR_STEP_M steps and FAR_KEEP_M hysteresis as
 * ownGround/farRing.ts), one mesh (one draw) per cell with the facade chunks' own material (one program: the city
 * tone, depth fade, fog and transition fade of the coarse shells, sampled at each layer's mean cell colour), and
 * hides a cell's z14-tile part (the per-vertex `hidden` attribute, as the coarse shells hide a building) while a
 * resident coarse shell draws that tile, so the two never stand in the same place.
 *
 * The world worker fetches, inflates, decodes and extrudes a cell (world/worldCells.ts `world-far`), so the main
 * thread only wraps transferred buffers. Cells arrive nearest first, at most FAR_SHELL_INFLIGHT at a time, and
 * dissolve in over FAR_SHELL_FADE_MS; the resident set is capped by cell count and triangles (farShellBudget).
 */
import { CELL_GRID, cellBounds, parseCellKey } from '../world/cellGrid.js';
import { shellOrigin } from '../world/shellMesh.js';

/** A cell's SW corner in chunk metres (the far meshes' position). */
export function farCellOrigin(key: string): [number, number] { const [i, j] = parseCellKey(key); return shellOrigin(i, j); }

/** `?farShells=0` (or `window.__canalRecallFarShells = false`) turns the far tier off. */
export function farShellsEnabled(search: string = typeof location !== 'undefined' ? location.search : '', w: any = typeof window !== 'undefined' ? window : {}): boolean {
  try { const v = new URLSearchParams(search).get('farShells'); if (v !== null) return !(v === '0' || v === 'off' || v === 'false'); } catch { /* no location */ }
  return w.__canalRecallFarShells !== false;
}

/** The resident budget: cells and triangles (desktop; a touch device holds fewer). Budget rows `farShellCellsMax`, `farShellMBMax`. */
export function farShellBudget(touch: boolean): { cells: number; triangles: number } {
  return touch ? { cells: 48, triangles: 600_000 } : { cells: 160, triangles: 3_000_000 };
}
export const FAR_SHELL_INFLIGHT = 4;
export const FAR_SHELL_FADE_MS = 600;
/** Hysteresis: a cell is dropped once its nearest edge is this much farther than the far radius (farRing.ts FAR_KEEP_M). */
export const FAR_SHELL_KEEP_M = 2000;

/** A decoded, extruded cell (world/worldCells.ts FarCell): positions in decimetres from the cell origin, `parts` each z14 tile's vertex range. */
export type FarCellData = { key: string; positions: Int16Array; layers: Uint8Array; tints: Uint8Array; indices: Uint16Array | Uint32Array; parts: readonly { tile: string; start: number; count: number }[]; gzBytes: number };

export interface FarShellHost {
  THREE: any;
  /** The facade scene (chunk metres), or null before it exists. */
  scene(): any | null;
  /** The chunk material, and a clone of it with its own `cityFade` (shares the program), or null. */
  material(): any | null;
  fadeMaterial(value: number): any | null;
  /** A resident coarse shell is installed and drawn (not still dissolving in) for this z14 tile. */
  coarseDrawn(tile: string): boolean;
  /** The cell's SW corner in chunk metres (world/shellMesh.ts shellOrigin). */
  origin(key: string): [number, number];
  fetchFar(key: string, signal: AbortSignal): Promise<FarCellData>;
  /** Cells that have far prisms (tiles.json `far`), with their gzip bytes. */
  available(): ReadonlyMap<string, number>;
  repaint(): void;
}

/** Distance from (lng, lat) to a cell's nearest edge, metres (the cell grid's metres per degree). */
export function cellDistanceM(key: string, lng: number, lat: number): number {
  const [i, j] = parseCellKey(key), [w, s, e, n] = cellBounds(i, j), [mx, my] = CELL_GRID.metresPerDegree;
  const dx = Math.max(w - lng, 0, lng - e) * mx, dy = Math.max(s - lat, 0, lat - n) * my;
  return Math.hypot(dx, dy);
}

/**
 * Which cells the far tier wants (nearest first, inside `radiusM`, within the budget by the cells' triangle estimate)
 * and which it keeps (inside `radiusM + keepM`). Pure: `available` is the cell → gzip bytes map, `triangles` a
 * cell's known or estimated triangles.
 */
export function planFarCells(lng: number, lat: number, radiusM: number, available: ReadonlyMap<string, number>, budget: { cells: number; triangles: number }, triangles: (key: string) => number, keepM = FAR_SHELL_KEEP_M): { want: string[]; keep: Set<string> } {
  if (radiusM <= 0) return { want: [], keep: new Set() };
  const near: { key: string; d: number }[] = [];
  for (const key of available.keys()) { const d = cellDistanceM(key, lng, lat); if (d <= radiusM + keepM) near.push({ key, d }); }
  near.sort((a, b) => a.d - b.d || (a.key < b.key ? -1 : 1));
  const want: string[] = [], keep = new Set<string>();
  let tris = 0;
  for (const { key, d } of near) {
    if (want.length >= budget.cells) break;
    const t = triangles(key);
    if (tris + t > budget.triangles && want.length) break;
    tris += t; keep.add(key);
    if (d <= radiusM) want.push(key);
  }
  return { want, keep };
}

type Resident = { key: string; mesh: any; parts: { tile: string; start: number; count: number; hidden: boolean }[]; triangles: number; bytes: number; gzBytes: number; fade?: { start: number; clone: any; source: any } };

export class FarShells {
  private readonly residents = new Map<string, Resident>();
  private readonly inflight = new Map<string, AbortController>();
  private readonly failed = new Set<string>();
  /** Triangles per cell once seen (the plan's budget estimate before: gzip bytes × TRIS_PER_GZ_BYTE). */
  private readonly knownTriangles = new Map<string, number>();
  private radiusM = 0;
  private at: [number, number] | null = null;
  private planned = '';
  private fetchedBytes = 0;
  private enabled = true;
  private readonly budget: { cells: number; triangles: number };
  constructor(private readonly host: FarShellHost, options: { touch?: boolean; budget?: { cells: number; triangles: number } } = {}) {
    this.budget = options.budget ?? farShellBudget(!!options.touch);
  }

  /** ~1.1 far triangles per gzip byte of SHL1 (604 staged cells: 5.8 M triangles over 5.5 MB). */
  static readonly TRIS_PER_GZ_BYTE = 1.1;

  setEnabled(on: boolean): void { if (on === this.enabled) return; this.enabled = on; if (!on) this.clear(); }

  /** The rider (or camera anchor) and the own ground's far radius (0: the far ring is off at this view). */
  update(lng: number, lat: number, farRadiusM: number): void {
    if (!this.enabled) return;
    const moved = !this.at || Math.hypot((lng - this.at[0]) * CELL_GRID.metresPerDegree[0], (lat - this.at[1]) * CELL_GRID.metresPerDegree[1]) >= 200;
    if (!moved && farRadiusM === this.radiusM) return;
    this.radiusM = farRadiusM; this.at = [lng, lat];
    const available = this.host.available();
    const { want, keep } = planFarCells(lng, lat, farRadiusM, available, this.budget, key => this.knownTriangles.get(key) ?? (available.get(key) ?? 0) * FarShells.TRIS_PER_GZ_BYTE);
    for (const key of [...this.residents.keys()]) if (!keep.has(key)) this.drop(key);
    for (const [key, c] of [...this.inflight]) if (!keep.has(key)) { c.abort(); this.inflight.delete(key); }
    this.planned = want.join(',');
    this.pump(want);
  }

  private queue: string[] = [];
  private pump(want?: string[]): void {
    if (want) this.queue = want.filter(k => !this.residents.has(k) && !this.failed.has(k));
    while (this.inflight.size < FAR_SHELL_INFLIGHT && this.queue.length) {
      const key = this.queue.shift()!;
      if (this.residents.has(key) || this.inflight.has(key)) continue;
      const controller = new AbortController();
      this.inflight.set(key, controller);
      this.host.fetchFar(key, controller.signal).then(data => {
        if (this.inflight.get(key) !== controller) return;
        this.inflight.delete(key);
        this.install(data);
        this.pump();
      }, error => {
        if (this.inflight.get(key) !== controller) return;
        this.inflight.delete(key);
        // An abort (ours, or a worker that died) is retried on the next plan; anything else is not asked again.
        if (!controller.signal.aborted && (error as { name?: string })?.name !== 'AbortError') { this.failed.add(key); console.warn(`far shells ${key}:`, error); }
        if (!controller.signal.aborted) this.at = null;
        this.pump();
      });
    }
  }

  private shared: { size: number; accent: any; uv: any } | null = null;
  /** The white-accent and zero-UV attributes every far mesh shares; a bigger cell grows them and re-binds the residents. */
  private sharedAttributes(n: number): { accent: any; uv: any } {
    if (this.shared && this.shared.size >= n) return this.shared;
    const THREE = this.host.THREE, size = Math.max(n, (this.shared?.size ?? 0) * 2, 65536);
    this.shared = { size, accent: new THREE.BufferAttribute(new Uint8Array(size * 4).fill(255), 4, true), uv: new THREE.BufferAttribute(new Uint8Array(size * 2), 2, true) };
    for (const r of this.residents.values()) { r.mesh.geometry.setAttribute('accent', this.shared.accent); r.mesh.geometry.setAttribute('uv', this.shared.uv); }
    return this.shared;
  }

  private install(data: FarCellData): void {
    const scene = this.host.scene(), material = this.host.material(), THREE = this.host.THREE;
    if (!scene || !material || !data.indices.length) { this.knownTriangles.set(data.key, 0); return; }
    const [ox, oy] = this.host.origin(data.key), n = data.layers.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3, false));
    g.setAttribute('layer', new THREE.BufferAttribute(data.layers, 1, false));
    g.setAttribute('tint', new THREE.BufferAttribute(data.tints, 4, true));
    // The chunk shader's other inputs: white accents, UV 0 (far cells sample each layer's mean: depth fade), drawn.
    // Constant per vertex: one shared pair for every far mesh (uploaded once, grown for a bigger cell).
    const shared = this.sharedAttributes(n);
    g.setAttribute('accent', shared.accent);
    g.setAttribute('uv', shared.uv);
    const hidden = new Uint8Array(n);
    g.setAttribute('hidden', new THREE.BufferAttribute(hidden, 1, false));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    g.computeBoundingSphere();
    const clone = this.host.fadeMaterial(0);
    const mesh = new THREE.Mesh(g, clone ?? material);
    mesh.name = `far-shells/${data.key}`;
    mesh.position.set(ox, oy, 0);
    mesh.scale.set(0.1, 0.1, 0.1); // decimetres
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.userData.farShell = true;
    const r: Resident = { key: data.key, mesh, parts: data.parts.map(p => ({ ...p, hidden: false })), triangles: data.indices.length / 3, bytes: data.positions.byteLength + data.layers.byteLength + data.tints.byteLength + data.indices.byteLength + n, gzBytes: data.gzBytes, ...(clone ? { fade: { start: performance.now(), clone, source: material } } : {}) };
    this.applyHidden(r, true);
    scene.add(mesh);
    this.knownTriangles.set(data.key, r.triangles);
    this.fetchedBytes += data.gzBytes;
    this.residents.set(data.key, r);
    this.host.repaint();
  }

  /** Hide the parts whose tile a resident coarse shell draws; true when something changed. */
  private applyHidden(r: Resident, force = false): boolean {
    const attribute = r.mesh.geometry.getAttribute('hidden');
    let changed = false, shown = 0;
    for (const p of r.parts) {
      const h = this.host.coarseDrawn(p.tile);
      if (!h) shown++;
      if (h === p.hidden && !force) continue;
      p.hidden = h; changed = true;
      attribute.array.fill(h ? 1 : 0, p.start, p.start + p.count);
    }
    r.mesh.visible = shown > 0;
    if (changed) attribute.needsUpdate = true;
    return changed;
  }

  /** Per frame: the dissolve and the per-tile hand-over to the resident coarse shells. */
  frame(now = performance.now()): void {
    let repaint = false;
    const material = this.host.material();
    for (const r of this.residents.values()) {
      if (r.fade) {
        const t = (now - r.fade.start) / FAR_SHELL_FADE_MS;
        if (t < 1 && material && r.fade.source === material) { r.fade.clone.uniforms.cityFade.value = t * (material.uniforms?.cityFade?.value ?? 1); repaint = true; }
        else { if (material) r.mesh.material = material; r.fade.clone.dispose?.(); delete r.fade; }
      } else if (material && r.mesh.material !== material) r.mesh.material = material; // a new look's material
      if (this.applyHidden(r)) repaint = true;
    }
    if (repaint) this.host.repaint();
  }

  private drop(key: string): void {
    const r = this.residents.get(key);
    if (!r) return;
    this.residents.delete(key);
    r.mesh.parent?.remove(r.mesh);
    // Detach the shared pair first: three frees the GL buffers of the attributes a disposed geometry holds.
    r.mesh.geometry.deleteAttribute?.('accent'); r.mesh.geometry.deleteAttribute?.('uv');
    r.mesh.geometry.dispose();
    r.fade?.clone.dispose?.();
  }

  clear(): void {
    for (const key of [...this.residents.keys()]) this.drop(key);
    for (const c of this.inflight.values()) c.abort();
    this.inflight.clear(); this.queue = [];
    this.at = null; this.radiusM = 0;
  }

  /** A new renderer after a context loss: the meshes re-upload on their own; nothing to rebuild. */
  stats(): { radiusM: number; cells: number; parts: number; partsShown: number; triangles: number; gpuMB: number; fetchedMB: number; pending: number; failed: number; planned: number } {
    let parts = 0, shown = 0, triangles = 0, bytes = 0;
    for (const r of this.residents.values()) { parts += r.parts.length; shown += r.parts.filter(p => !p.hidden).length; triangles += r.triangles; bytes += r.bytes; }
    bytes += (this.shared?.size ?? 0) * 6;
    return { radiusM: this.radiusM, cells: this.residents.size, parts, partsShown: shown, triangles, gpuMB: +(bytes / 1048576).toFixed(1), fetchedMB: +(this.fetchedBytes / 1048576).toFixed(2), pending: this.inflight.size + this.queue.length, failed: this.failed.size, planned: this.planned ? this.planned.split(',').length : 0 };
  }

  dispose(): void { this.clear(); }
}
