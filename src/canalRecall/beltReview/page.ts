/**
 * Belt review page entry (public/canal-drive/belt-review.html). `?face=<faceId>` reviews one block face,
 * `?round=<roundId>` judges a compare round, no parameter lists both. Served only by the local server (server.ts mounts
 * /api/belt-review, which also bundles this file on request).
 */
import { getJson } from './api.ts';
import { mountRound } from './compareView.ts';
import { h, replace } from './dom.ts';
import { mountFace } from './faceView.ts';
import { STAGE_TITLES, type FaceSummary, type RoundsConfig } from './types.ts';

async function mountIndex(root: HTMLElement) {
  const [faces, rounds] = await Promise.all([getJson<{ faces: FaceSummary[] }>('/faces'), getJson<RoundsConfig>('/rounds')]);
  replace(root,
    h('header', { class: 'bar' }, h('span', { class: 'home' }, 'Belt review'), h('div', { class: 'title' }, 'Canal belt, block by block')),
    h('main', { class: 'index' },
      h('section', {}, h('h2', {}, 'Block faces'),
        faces.faces.length ? h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Face'), h('th', {}, 'Houses'), h('th', {}, 'Stage'), h('th', {}, 'Status'), h('th', {}, 'Inputs'), h('th', {}, 'Updated'))),
          h('tbody', {}, ...faces.faces.map(f => h('tr', {},
            h('td', {}, h('a', { href: `?face=${encodeURIComponent(f.faceId)}` }, `${f.street} ${f.side}`), h('small', { class: 'muted' }, ` ${f.faceId}`), f.fixture ? h('span', { class: 'tag warn' }, 'fixture') : null),
            h('td', {}, String(f.pands)),
            h('td', {}, `${f.stage} · ${STAGE_TITLES[f.stage]}`),
            h('td', {}, h('span', { class: `pill ${f.status}` }, f.status)),
            h('td', {}, f.candidates ? 'photos' : h('span', { class: 'muted' }, 'no photos'), ' · ', f.description ? 'description' : h('span', { class: 'muted' }, 'no description')),
            h('td', { class: 'muted' }, f.updatedAt ? f.updatedAt.slice(0, 16).replace('T', ' ') : '–'))))) : h('p', { class: 'muted' }, 'No faces under review-data/belt-review/ yet.')),
      h('section', {}, h('h2', {}, 'Compare rounds'),
        rounds.rounds.length ? h('ul', {}, ...rounds.rounds.map(r => h('li', {}, h('a', { href: `?round=${encodeURIComponent(r.id)}` }, r.title), h('small', { class: 'muted' }, ` ${r.root}`)))) : h('p', { class: 'muted' }, 'No rounds in review-data/belt-review/rounds.json.')),
      h('section', {}, h('h2', {}, 'Keys'), h('p', { class: 'muted' }, 'Photo pick: 1–6 pick, 0 none usable, J/K next/previous house, Z zoom, Enter confirm stage, Shift+R reload. Compare: Q/W/E/R layers, B blink, hold Space for the previous layer, 1/2/3 better/same/worse, N note, J/K next/previous block.'))));
}

async function main() {
  const root = document.getElementById('app')!;
  const q = new URLSearchParams(location.search);
  try {
    if (q.get('face')) await mountFace(root, q.get('face')!);
    else if (q.get('round')) await mountRound(root, q.get('round')!);
    else await mountIndex(root);
  } catch (e) {
    replace(root, h('main', { class: 'index' }, h('h2', {}, 'Could not load'), h('p', {}, String((e as Error).message)), h('p', { class: 'muted' }, 'This page needs the local server: PORT=4330 npm run dev, then /canal-drive/belt-review.html.')));
  }
}
void main();
