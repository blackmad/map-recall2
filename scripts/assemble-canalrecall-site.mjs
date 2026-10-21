// Canal Recall's index.html loads its scripts relatively (`js/game.js`) and its
// extracts one level up (`../data/extracts/...`). Serving it from a domain root
// therefore needs the canal-drive tree hoisted to that root with `data/`
// alongside it — a Hosting rewrite cannot do this, because a rewrite maps to a
// single file and would answer `/js/game.js` with HTML.
//
// The public site is one origin for all three surfaces (2026-10-17):
//   /            landing page   (canal-drive/landing.html)
//   /ride        the ride       (canal-drive/index.html, served as ride.html
//                                through a Hosting rewrite; same directory, so
//                                every relative path still resolves)
//   /quiz/       Map Quest      (`vite build --mode quiz`, dist-quiz/)
//   /progress    My progress    (a Map Quest view: a Hosting rewrite onto
//                                /quiz/index.html, whose assets are absolute
//                                /quiz/ paths; src/progress/route.ts)
// The landing page forwards any URL with a query or hash, and any returning
// player, to /ride, so deep links to the old root keep working.
//
// It also writes dist-edumap/: the edumap host is now a redirect to /quiz/ and
// needs nothing but a placeholder, instead of a second copy of every extract.
import { cp, rm, mkdir, stat, rename, writeFile, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const source = path.join(projectRoot, 'dist');
const quizSource = path.join(projectRoot, 'dist-quiz');
const destination = path.join(projectRoot, 'dist-canalrecall');
const edumap = path.join(projectRoot, 'dist-edumap');

// Copy-on-write clones where the filesystem has them (APFS, Btrfs): the site is
// ~600 MB of extracts and models that dist/ already holds.
const clone = { recursive: true, mode: constants.COPYFILE_FICLONE };

const require = async (root, relativePath, hint) => {
  const absolute = path.join(root, relativePath);
  try {
    await stat(absolute);
  } catch {
    throw new Error(`Missing ${path.relative(projectRoot, absolute)}. Run \`${hint}\` first.`);
  }
  return absolute;
};

const canalDrive = await require(source, 'canal-drive', 'npm run build');
const data = await require(source, 'data', 'npm run build');
await require(source, 'canal-drive/landing.html', 'npm run build');
await require(quizSource, 'index.html', 'npm run build:quiz');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(canalDrive, destination, clone);
await cp(data, path.join(destination, 'data'), clone);

// The ride moves aside for the landing page.
await rename(path.join(destination, 'index.html'), path.join(destination, 'ride.html'));
await rename(path.join(destination, 'landing.html'), path.join(destination, 'index.html'));

// Map Quest at /quiz/, with the icons and manifest its index.html links relatively.
const quiz = path.join(destination, 'quiz');
await cp(quizSource, quiz, clone);
for (const file of ['app-icon.svg', 'apple-touch-icon.png', 'manifest.webmanifest']) {
  await copyFile(path.join(source, file), path.join(quiz, file));
}
// /progress serves quiz/index.html from the root, so its relative icon links resolve there.
for (const file of ['app-icon.svg', 'apple-touch-icon.png']) {
  await copyFile(path.join(source, file), path.join(destination, file));
}

await rm(edumap, { recursive: true, force: true });
await mkdir(edumap, { recursive: true });
await writeFile(path.join(edumap, 'index.html'), `<!doctype html>
<meta charset="utf-8">
<title>Map Quest has moved</title>
<meta http-equiv="refresh" content="0; url=https://rideamsterdam.nl/quiz/">
<p>Map Quest now lives at <a href="https://rideamsterdam.nl/quiz/">rideamsterdam.nl/quiz/</a>.</p>
`);

console.log(`Assembled Canal Recall site at ${path.relative(projectRoot, destination)}/ (landing /, ride /ride, quiz /quiz/) and the edumap redirect at ${path.relative(projectRoot, edumap)}/`);
