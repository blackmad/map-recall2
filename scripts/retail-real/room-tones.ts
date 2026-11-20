/**
 * Measures each goods cell's and pane filler's mean colour (the painters at 512 px, @napi-rs/canvas) for
 * src/canalRecall/retailRoomTone.ts. `--write` rewrites the table between its markers; without it, prints the table and
 * exits 1 when the committed one differs (retailRoomTone.test.ts runs the same check).
 *
 *   node --import tsx scripts/retail-real/room-tones.ts [--write]
 */
import fs from 'node:fs';
import { measureRoomTones, ROOM_TONE_FILE, renderRoomToneTable } from './roomToneMeasure.ts';

const tones = await measureRoomTones();
const src = fs.readFileSync(ROOM_TONE_FILE, 'utf8'), table = renderRoomToneTable(tones);
const next = src.replace(/(\/\/ <room-tones>\n)[\s\S]*?(\/\/ <\/room-tones>)/, `$1${table}$2`);
if (process.argv.includes('--write')) { fs.writeFileSync(ROOM_TONE_FILE, next); console.log(`wrote ${Object.keys(tones.goods).length} goods and ${Object.keys(tones.fillers).length} filler tones`); }
else { process.stdout.write(table); if (next !== src) { console.error('retailRoomTone.ts is stale: run with --write'); process.exit(1); } }
