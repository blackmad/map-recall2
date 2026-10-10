// Who draws in the shared frame, in what order, and in which pass.
//
// Two passes, one renderer, one scene graph, one light rig:
// - `main`    sits at the slot the facade layer used to occupy, under the
//             game's own labels; buildings, landmarks, trees, roofs, the zoo.
// - `overlay` is drawn last of everything in MapLibre's frame, so the x-ray of
//             the player's vehicle sees every building's depth (it used to be
//             four separate custom layers kept on top for that reason).
//
// `order` reproduces the old MapLibre layer order within a pass: three sorts
// opaque objects by group order first, so ties between coplanar surfaces of
// different layers still resolve the way they did when each was its own layer.

/** `ground` (opt-in, drop-MapLibre `?ownMap=1`) sits at the bottom of the
 *  style, right above the background, under every MapLibre line overlay. */
export type FramePass = 'ground' | 'main' | 'overlay';

export type RegistryEntry<P> = { id: string; order: number; pass: FramePass; participant: P; seq: number };

export class LayerRegistry<P> {
  private readonly entries = new Map<string, RegistryEntry<P>>();
  private sorted: RegistryEntry<P>[] | null = null;
  private seq = 0;

  add(id: string, participant: P, options: { order?: number; pass?: FramePass } = {}): RegistryEntry<P> {
    if (!id) throw new Error('Shared frame participant needs an id');
    if (this.entries.has(id)) throw new Error(`Shared frame participant "${id}" is already registered`);
    const entry: RegistryEntry<P> = { id, participant, order: options.order ?? 0, pass: options.pass ?? 'main', seq: this.seq++ };
    this.entries.set(id, entry);
    this.sorted = null;
    return entry;
  }

  remove(id: string): RegistryEntry<P> | undefined {
    const entry = this.entries.get(id);
    if (entry) { this.entries.delete(id); this.sorted = null; }
    return entry;
  }

  get(id: string): RegistryEntry<P> | undefined { return this.entries.get(id); }
  has(id: string): boolean { return this.entries.has(id); }
  get size(): number { return this.entries.size; }

  /** All entries in draw order (pass, then order, then registration). */
  all(): readonly RegistryEntry<P>[] {
    if (!this.sorted) {
      const rank = (pass: FramePass) => (pass === 'main' ? 0 : 1);
      this.sorted = [...this.entries.values()].sort((a, b) => rank(a.pass) - rank(b.pass) || a.order - b.order || a.seq - b.seq);
    }
    return this.sorted;
  }

  inPass(pass: FramePass): RegistryEntry<P>[] { return this.all().filter(entry => entry.pass === pass); }
}

/** Old MapLibre layer order of the participants (bottom → top), kept as group orders. */
export const PARTICIPANT_ORDER = {
  facades: 0,
  artis: 10,
  landmarks: 20,
  trees: 30,
  pyramidalRoofs: 40,
  bike: 100,
  ferry: 110,
  boat: 120,
  transit: 130,
} as const;
