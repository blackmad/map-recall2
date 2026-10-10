/**
 * street-surveys.html: the street-survey catalogue (street → block face → houses).
 * Data: street-surveys-data/surveys.json (scripts/street-surveys/build.ts).
 * Bundle: npm run build:street-surveys → js/street-surveys.bundle.js.
 * Test contract: window.streetSurveys = {ready, errors, faces, houses}.
 */
import { LIVE_LABEL, STATUS_LABEL, type StreetSurvey, type StreetSurveyData, type SurveyFace, type SurveyHouse, type SurveyRecipeHouse, type Thumb } from './types';

type El = HTMLElement;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) if (k !== null && k !== undefined && k !== false) n.append(k);
  return n;
};
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shortId = (pandId: string) => `…${pandId.slice(-6)}`;

function figure(thumb: Thumb | undefined, missing: string, alt: string): El {
  if (!thumb) return h('figure', { class: 'shot missing' }, h('div', { class: 'ph' }, missing));
  const img = h('img', { src: thumb.src, width: String(thumb.width), height: String(thumb.height), loading: 'lazy', decoding: 'async', alt });
  const fig = h('figure', { class: 'shot' }, img, h('figcaption', {}, thumb.caption));
  img.addEventListener('error', () => { fig.className = 'shot missing'; fig.replaceChildren(h('div', { class: 'ph' }, missing)); });
  return fig;
}

const badge = (text: string, kind: string) => h('span', { class: `badge ${kind}` }, text);
const list = (items: readonly string[] | undefined, cls: string) => items?.length ? h('ul', { class: cls }, ...items.map(t => h('li', {}, t))) : null;

function houseRow(house: SurveyHouse): El {
  const shop = house.shop ? [house.shop.name, house.shop.use].filter(Boolean).join(' · ') : '';
  const details = h('details', { class: 'house' },
    h('summary', {},
      h('span', { class: 'addr' }, house.address),
      shop ? h('span', { class: 'shop' }, shop) : null,
      house.defects?.length ? badge(`${house.defects.length} defect${house.defects.length === 1 ? '' : 's'}`, 'defect') : null),
    h('dl', {},
      h('dt', {}, 'BAG pand'), h('dd', {}, house.pandId),
      house.shop?.agreement ? h('dt', {}, 'Shop evidence') : null, house.shop?.agreement ? h('dd', {}, house.shop.agreement) : null,
      h('dt', {}, 'Rear'), h('dd', {}, house.rear ?? 'not recorded'),
    ),
    house.defects?.length ? h('p', { class: 'lbl' }, 'Render vs photo') : null, list(house.defects, 'defects'),
    house.limits.length ? h('p', { class: 'lbl' }, 'Recorded schema limits') : null, list(house.limits, 'limits'),
  );
  return details;
}

function faceCard(face: SurveyFace): El {
  const art = h('article', { class: `face ${face.status}`, id: face.id, 'data-status': face.status },
    face.chunkId ? h('span', { id: face.chunkId, class: 'anchor' }) : null,
    h('header', {},
      h('h3', {}, face.title),
      badge(STATUS_LABEL[face.status], face.status)),
    h('p', { class: 'reason' }, face.statusReason),
    h('p', { class: 'meta' }, [face.id, face.photoDate ? `photo ${face.photoDate}` : '', face.triangles ? `${face.triangles.toLocaleString('en')} triangles` : '', `${face.houses.length} house${face.houses.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')),
    h('div', { class: 'body' },
      h('div', { class: 'pair' },
        figure(face.photo, 'No photo strip staged for this face', `Photo strip of ${face.title}`),
        figure(face.model, face.status === 'staged' ? 'No model yet (intake only)' : 'Model render unavailable', `Model render of ${face.title}`)),
      h('div', { class: 'side' },
        face.review?.length ? h('div', { class: 'review' }, h('p', { class: 'lbl' }, 'Review (photo vs model)'), list(face.review, 'notes')) : null,
        h('div', { class: 'houses' }, ...face.houses.map(houseRow)))),
  );
  return art;
}

function recipeCard(house: SurveyRecipeHouse): El {
  const superseded = house.status === 'superseded';
  const statusText = superseded ? 'Superseded' : house.status === 'chunk' ? 'In a recipe chunk' : 'Standalone';
  return h('article', { class: `recipe ${house.status}`, id: house.id, 'data-status': house.status },
    h('span', { id: `ordinary-${house.pandId}`, class: 'anchor' }),
    h('header', {}, h('h3', {}, house.address), badge(statusText, house.status)),
    h('p', { class: 'meta', title: house.name }, `${house.id} · ${house.name.replace(/^[^(]*\(|\)$/g, '')}`),
    superseded && house.drawnBy
      ? h('p', { class: 'reason' }, 'Not drawn in game: block face ', h('a', { href: `#${house.drawnBy}` }, house.drawnBy.replace(/^chunk-face-/, '')), ' draws this pand. The per-house model is kept only as recipe history.')
      : h('div', { class: 'pair narrow' },
        figure(house.photo, 'No reference photo staged', `Reference photo of ${house.address}`),
        figure(house.model, 'Model render unavailable', `Model render of ${house.address}`)),
    !superseded ? h('p', { class: 'reason' }, house.status === 'chunk' ? `Drawn as part of ${house.drawnBy}.` : `Drawn in game as this per-house model (${house.reviewState ?? 'review state unknown'}).`) : null,
    !superseded && house.defects?.length ? h('div', { class: 'review' }, h('p', { class: 'lbl' }, 'Review (photo vs model)'), list(house.defects, 'notes')) : null,
  );
}

function pandTable(survey: StreetSurvey): El | null {
  const t = survey.pandTable;
  if (!t) return null;
  const counts = new Map<string, number>();
  for (const r of t.rows) counts.set(r.live, (counts.get(r.live) ?? 0) + 1);
  // One wrapper per cell: on phones each cell is a label | value grid row.
  const td = (label: string, ...kids: (Node | string | null | undefined | false)[]) => h('td', { 'data-label': label }, h('div', {}, ...kids));
  const rows = t.rows.map(r => h('tr', { class: `live-${r.live}` },
    td('Address', r.label),
    td('Built', r.buildYear ? String(r.buildYear) : '–'),
    td('In game', badge(LIVE_LABEL[r.live], `live ${r.live}`), r.pendingFace ? h('small', { class: 'pending' }, 'held face: ', h('a', { href: `#${r.pendingFace}` }, r.pendingFace)) : null),
    td('Drawn by', r.drawnBy ? h('a', { href: `#${r.drawnBy}` }, r.drawnBy) : '–'),
    td('Notes', r.note ?? '', list(r.defects, 'defects'), h('small', { class: 'pid' }, `pand ${shortId(r.pandId)}`)),
  ));
  return h('section', { class: 'pands', id: `${slug(survey.street)}-pands` },
    h('h3', {}, `Every pand on ${survey.street}`),
    h('p', { class: 'meta' }, `${t.rows.length} BAG pands with a current ${survey.street} address (${t.source}, fetched ${t.fetchedAt}) · `,
      [...counts].map(([k, n]) => `${n} ${LIVE_LABEL[k as keyof typeof LIVE_LABEL].toLowerCase()}`).join(' · ')),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ...['Address', 'Built', 'In game', 'Drawn by', 'Notes / defects'].map(c => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, ...rows))));
}

function streetSection(survey: StreetSurvey): El {
  const live = survey.recipeHouses.filter(r => r.status !== 'superseded'), old = survey.recipeHouses.filter(r => r.status === 'superseded');
  const n = (s: string) => survey.faces.filter(f => f.status === s).length;
  return h('section', { class: 'street', id: slug(survey.street) },
    h('h2', {}, survey.street),
    h('p', { class: 'meta' }, `${survey.faces.length} block face${survey.faces.length === 1 ? '' : 's'} (${n('installed')} installed, ${n('held')} held, ${n('staged')} staged) · ${live.length} per-house model${live.length === 1 ? '' : 's'} still drawn · ${old.length} superseded`),
    h('div', { class: 'faces' }, ...survey.faces.map(faceCard)),
    survey.recipeHouses.length ? h('h3', { class: 'sub' }, 'Per-house recipe models') : null,
    survey.recipeHouses.length ? h('div', { class: 'recipes' }, ...live.map(recipeCard), ...old.map(recipeCard)) : null,
    pandTable(survey));
}

declare global { interface Window { streetSurveys: { ready: boolean; errors: string[]; faces: number; houses: number } } }

export async function mount(root: El, url = './street-surveys-data/surveys.json'): Promise<void> {
  window.streetSurveys = { ready: false, errors: [], faces: 0, houses: 0 };
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`surveys.json ${res.status}`);
    render(root, await res.json() as StreetSurveyData);
  } catch (e) {
    root.replaceChildren(h('p', { class: 'empty' }, `Could not load the street-survey catalogue: ${(e as Error).message}`));
    window.streetSurveys.errors.push(String(e));
  }
  window.streetSurveys.ready = true;
}

export function render(root: El, data: StreetSurveyData): void {
  const nav = h('nav', { class: 'streets', 'aria-label': 'Streets' }, ...data.streets.map(s => h('a', { href: `#${slug(s.street)}` }, s.street)));
  root.replaceChildren(nav, ...data.streets.map(streetSection));
  window.streetSurveys.faces = data.streets.reduce((s, x) => s + x.faces.length, 0);
  window.streetSurveys.houses = data.streets.reduce((s, x) => s + x.faces.reduce((t, f) => t + f.houses.length, 0), 0);
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
}

const root = typeof document !== 'undefined' ? document.querySelector<El>('main#surveys') : null;
if (root) void mount(root);
