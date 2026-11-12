// The authored crossing register (lane G3): every record with its piers, walls, binds and evidence, for the scripts
// (compose, review sheets, check-ground-cells) and the tests. Never imported by the game: the runtime reads the compact
// extract `data/crossings/runtime.json` (crossings.ts `runtimeOf`, written by `scripts/crossings/compose.ts --runtime`).
import type { CrossingFile, CrossingRecord } from './crossings.js';
import NAMED from '../../../data/crossings/named.json';
import RING_RAIL from '../../../data/crossings/ring-rail.json';
import A10 from '../../../data/crossings/a10.json';
import TUNNELS from '../../../data/crossings/tunnels.json';

/** The authored files, in runtime order. Add a new area here and to compose's runtime list. */
// JSON imports widen tuples to number[]; validateFile (crossings.test.ts) checks the shape.
export const CROSSING_FILES: readonly CrossingFile[] = [NAMED, RING_RAIL, A10, TUNNELS] as unknown as CrossingFile[];
export const AUTHORED: readonly CrossingRecord[] = CROSSING_FILES.flatMap(f => f.records);
/** Areas in runtime order (compose --runtime reads data/crossings/<area>.json in this order). */
export const RUNTIME_AREAS = ['named', 'ring-rail', 'a10', 'tunnels'] as const;
