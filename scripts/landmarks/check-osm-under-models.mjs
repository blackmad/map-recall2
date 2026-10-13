// Thin shim so `npm run check:osm-under-models` keeps working: the check is TypeScript now (scripts/check-osm-under-models.ts, geometry in src/canalRecall/landmarks/osmUnderModels.ts).
import {spawnSync} from 'node:child_process';
const result = spawnSync('node', ['--import', 'tsx', 'scripts/check-osm-under-models.ts', ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(result.status ?? 1);
