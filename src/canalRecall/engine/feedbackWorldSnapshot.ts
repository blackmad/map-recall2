// What a "nothing loaded here" note needs to be diagnosed (feedback faa46795, 2026-11-13): the engine, the camera
// pitch and tilt (the note's camera x/y/zoom alone did not give the user's view), which streaming tiers had landed,
// whether the WebGL context was ever lost, and how many building chunks / ground cells were resident. Every read is
// guarded: a snapshot never throws and never blocks the note. Pure over the `game` object it is handed.

export interface WorldSnapshot {
  engine: string | null;
  pitch: number | null;
  tilt: number | null;
  zoom: number | null;
  settled?: Record<string, unknown>;
  context?: { lost: number; restored: number };
  buildings?: { chunks: number | null; buildings: number | null; loading: number | null };
  ground?: { ready: boolean | null; resident: number | null; pending: number | null };
  furniture?: { instances: number | null; tiles: number | null };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const tryRead = <T>(f: () => T): T | undefined => { try { return f(); } catch { return undefined; } };

export function worldSnapshot(game: any, win: any = globalThis): WorldSnapshot | null {
  const vm = game?.vectorMap;
  if (!vm) return null;
  const cam = tryRead(() => vm.cameraMap?.api) ?? tryRead(() => vm.camera);
  const out: WorldSnapshot = {
    engine: typeof vm.engine === 'string' ? vm.engine : null,
    pitch: num(tryRead(() => cam?.pitch?.())),
    tilt: num(vm._cameraTilt),
    zoom: num(tryRead(() => cam?.zoom?.())),
  };
  const settled = tryRead(() => vm.worldSettled?.());
  if (settled && typeof settled === 'object') {
    const { detail: _detail, ...flags } = settled as Record<string, unknown>;
    out.settled = flags;
  }
  const events = tryRead(() => vm.host?.contextEvents);
  if (events && typeof events === 'object') out.context = { lost: Number(events.lost) || 0, restored: Number(events.restored) || 0 };
  const tb = vm._threeBuildings;
  if (tb) {
    const s = tryRead(() => tb.stats?.());
    out.buildings = { chunks: num(s?.chunks), buildings: num(s?.buildings), loading: num(tryRead(() => tb.loadingCount)) };
  }
  const gr = vm._ownGround;
  if (gr) {
    const s = tryRead(() => gr.status?.());
    const resident = s?.cells && typeof s.cells === 'object' ? Object.keys(s.cells).length : null;
    out.ground = { ready: typeof s?.ready === 'boolean' ? s.ready : null, resident, pending: s?.pending && typeof s.pending === 'object' ? Object.keys(s.pending).length : null };
  }
  const f = tryRead(() => win.__canalStreetFurniture?.debug);
  if (f) out.furniture = { instances: num(f.instances), tiles: num(f.tiles) };
  return out;
}
