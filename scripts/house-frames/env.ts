/** Imported first by frames.ts: point the panorama cache at the shared one (pand-reference/core.ts reads it at import). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const shared = path.join(os.homedir(), 'Code/map-recall2/.cache/pand-reference');
if (!process.env.PAND_REFERENCE_CACHE && fs.existsSync(shared)) process.env.PAND_REFERENCE_CACHE = shared;
