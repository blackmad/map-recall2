import type { FactsFile } from './factTypes.ts';
import { flattenFacts, matchesReviewItem, type Progress, type RejectedFact, type ReviewFact } from './reviewData.ts';

const cities = ['amsterdam', 'rotterdam', 'den-haag', 'utrecht'] as const;
type View = 'staged' | 'rejected' | 'published';
let city = location.hash.slice(1).split('/')[0] || 'amsterdam';
if (!cities.includes(city as typeof cities[number])) city = 'amsterdam';
let view: View = 'staged';

const app = document.querySelector<HTMLElement>('#app')!;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));
const cityName = (id: string) => id === 'den-haag' ? 'Den Haag' : id[0].toUpperCase() + id.slice(1);
const reasonLabel = (reason: string) => reason === 'not-entailed'
  ? 'wording not supported'
  : reason.replace(/-/g, ' ');

async function json<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

function evidence(item: ReviewFact | RejectedFact): string {
  const original = item.sourceQuote || '';
  const translated = item.sourceLanguage === 'nl' && item.sourceQuoteEnglish
    ? `<div class="translation"><b>Local English translation</b>${escapeHtml(item.sourceQuoteEnglish)}</div>` : '';
  return original ? `<details><summary>Show source evidence</summary><blockquote lang="${escapeHtml(item.sourceLanguage)}">${escapeHtml(original)}</blockquote>${translated}</details>` : '';
}

function card(item: ReviewFact | RejectedFact, rejected: boolean): string {
  const tag = rejected ? reasonLabel((item as RejectedFact).reason) : (item as ReviewFact).kind;
  const why = rejected && (item as RejectedFact).detail
    ? `<p class="why"><b>Verifier:</b> ${escapeHtml((item as RejectedFact).detail)}</p>` : '';
  return `<article class="card ${rejected ? 'nope' : 'yep'}">
    <div class="cardtop"><span class="pill">${escapeHtml(tag)}</span><span>${escapeHtml(item.collection)} · ${escapeHtml(item.section || 'introduction')}</span></div>
    <h2>${escapeHtml(item.featureName)}</h2><p class="fact">${escapeHtml(item.text)}</p>${why}${evidence(item)}
    <a class="source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">Open Wikipedia source ↗</a>
  </article>`;
}

async function render(): Promise<void> {
  app.innerHTML = '<div class="loading">Opening the trivia lab…</div>';
  const root = `../data/extracts/${city}`;
  const [progress, stagedFile, rejectedFile, publishedFile] = await Promise.all([
    json<Progress>(`${root}/staging/fact-progress.json`),
    json<FactsFile>(`${root}/staging/facts.json`),
    json<{ rejections: RejectedFact[] }>(`${root}/staging/fact-rejections.json`),
    json<FactsFile>(`${root}/facts.json`),
  ]);
  const staged = flattenFacts(stagedFile);
  const rejected = rejectedFile?.rejections || [];
  const published = flattenFacts(publishedFile);
  const current = view === 'staged' ? staged : view === 'rejected' ? rejected : published;
  const reasons = [...new Set(rejected.map((item) => item.reason))].sort();
  const collections = [...new Set(current.map((item) => item.collection))].sort();
  const live = progress?.status === 'running';
  app.innerHTML = `<header>
    <a class="eyebrow" href="./">CANAL RECALL</a><h1>Trivia Lab <span>🧪</span></h1>
    <p>Browse what OpenRouter found, what the safety gates bounced, and what humans actually published.</p>
    <nav class="cities">${cities.map((id) => `<button data-city="${id}" class="${city === id ? 'active' : ''}">${cityName(id)}</button>`).join('')}</nav>
  </header>
  <section class="meter ${live ? 'live' : ''}">
    <div><span class="dot"></span><b>${live ? 'Extraction running' : progress ? 'Extraction complete' : 'No active run'}</b><small>${progress ? `Updated ${new Date(progress.updatedAt).toLocaleTimeString()}` : 'Start a build to see progress'}</small></div>
    <strong>${progress?.considered || 0}<small>features tried</small></strong><strong>${staged.length}<small>passed gates</small></strong><strong>${rejected.length}<small>rejected</small></strong><strong>$${(progress?.openRouterSpentUsd || 0).toFixed(4)}<small>this run</small></strong>
    <button id="refresh" title="Load the latest checkpoint">Refresh data</button>
  </section>
  <nav class="views">
    <button data-view="staged" class="${view === 'staged' ? 'active' : ''}">✨ Passed gates <span>${staged.length}</span></button>
    <button data-view="rejected" class="${view === 'rejected' ? 'active' : ''}">🧯 Rejected <span>${rejected.length}</span></button>
    <button data-view="published" class="${view === 'published' ? 'active' : ''}">🏛 Published <span>${published.length}</span></button>
  </nav>
  <p class="meaning">${view === 'staged' ? 'Passed automatic grounding and editorial checks; awaiting human review.' : view === 'rejected' ? 'Kept for audit: proposed facts whose wording was not sufficiently supported by its cited evidence, or that failed another editorial rule.' : 'Human-reviewed facts currently available to the game.'}</p>
  <section class="filters"><input id="search" type="search" placeholder="Search names, facts, or evidence…"><select id="collection"><option value="">All collections</option>${collections.map((x) => `<option>${escapeHtml(x)}</option>`).join('')}</select>${view === 'rejected' ? `<select id="reason"><option value="">All rejection reasons</option>${reasons.map((x) => `<option>${escapeHtml(x)}</option>`).join('')}</select>` : ''}<span id="shown"></span></section>
  <main id="cards"></main>`;
  const updateCards = () => {
    const query = (document.querySelector<HTMLInputElement>('#search')?.value || '').trim();
    const collection = document.querySelector<HTMLSelectElement>('#collection')?.value || '';
    const reason = document.querySelector<HTMLSelectElement>('#reason')?.value || '';
    const filtered = current.filter((item) => matchesReviewItem(item, query, collection, reason));
    document.querySelector('#cards')!.innerHTML = filtered.length
      ? filtered.map((item) => card(item, view === 'rejected')).join('')
      : '<div class="empty">Nothing here yet. Try another filter or city.</div>';
    document.querySelector('#shown')!.textContent = `${filtered.length} shown`;
  };
  document.querySelectorAll<HTMLElement>('[data-city]').forEach((button) => button.onclick = () => {
    city = button.dataset.city!; location.hash = city; void render();
  });
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => button.onclick = () => {
    view = button.dataset.view as View; void render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filters input,.filters select').forEach((input) => input.oninput = updateCards);
  document.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => void render();
  updateCards();
}

window.addEventListener('hashchange', () => { city = location.hash.slice(1).split('/')[0] || 'amsterdam'; void render(); });
void render();
