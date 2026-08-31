// Canal Recall's index.html loads its scripts relatively (`js/game.js`) and its
// extracts one level up (`../data/extracts/...`). Serving it from a domain root
// therefore needs the canal-drive tree hoisted to that root with `data/`
// alongside it — a Hosting rewrite cannot do this, because a rewrite maps to a
// single file and would answer `/js/game.js` with HTML.
import { cp, rm, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const source = path.join(projectRoot, 'dist');
const destination = path.join(projectRoot, 'dist-canalrecall');

const require = async (relativePath) => {
  const absolute = path.join(source, relativePath);
  try {
    await stat(absolute);
  } catch {
    throw new Error(`Missing ${relativePath} in dist/. Run \`npm run build\` first.`);
  }
  return absolute;
};

const canalDrive = await require('canal-drive');
const data = await require('data');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(canalDrive, destination, { recursive: true });
await cp(data, path.join(destination, 'data'), { recursive: true });

console.log(`Assembled Canal Recall site at ${path.relative(projectRoot, destination)}/`);
