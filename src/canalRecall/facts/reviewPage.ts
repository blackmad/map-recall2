import type { FactsFile } from './factTypes.ts';
import {
  countReviewLabels,
  emptyReviewFile,
  isFactStruck,
  reviewDownloadName,
  setFeatureNote,
  setFeatureVerdict,
  toggleStruckFact,
  type FactReviewFile,
} from './factReview.ts';
import { flattenFacts, matchesReviewItem, type Progress, type RejectedFact, type ReviewFact } from './reviewData.ts';

const cities = ['amsterdam', 'rotterdam', 'den-haag', 'utrecht'] as const;
type View = 'staged' | 'rejected' | 'published' | 'review';
let city = location.hash.slice(1).split('/')[0] || 'amsterdam';
if (!cities.includes(city as typeof cities[number])) city = 'amsterdam';
let view: View = (location.hash.slice(1).split('/')[1] as View) || 'staged';
if (!['staged', 'rejected', 'published', 'review'].includes(view)) view = 'staged';

const app = document.querySelector<HTMLElement>('#app')!;
const drafts = new Map<string, FactReviewFile>();

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));
const cityName = (id: string) => id === 'den-haag' ? 'Den Haag' : id[0].toUpperCase() + id.slice(1);
const reasonLabel = (reason: string) => reason === 'not-entailed'
  ? 'wording not supported'
  : reason.replaceAll('-', ' ');
const draftKey = (cityId: string, generatorVersion: string) =>
  `canalRecall.factsReview.${cityId}.${generatorVersion}`;

async function json<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.json() as T : null;
  } catch { return null; }
}

function loadDraft(cityId: string, generatorVersion: string): FactReviewFile {
  const cached = drafts.get(draftKey(cityId, generatorVersion));
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(draftKey(cityId, generatorVersion));
    if (raw) {
      const parsed = JSON.parse(raw) as FactReviewFile;
      if (parsed.generatorVersion === generatorVersion) {
        drafts.set(draftKey(cityId, generatorVersion), parsed);
        return parsed;
      }
    }
  } catch { /* private mode */ }
  const empty = emptyReviewFile(generatorVersion);
  drafts.set(draftKey(cityId, generatorVersion), empty);
  return empty;
}

function saveDraft(cityId: string, generatorVersion: string, review: FactReviewFile): void {
  const next = { ...review, generatorVersion, reviewedAt: new Date().toISOString().slice(0, 10) };
  drafts.set(draftKey(cityId, generatorVersion), next);
  try { localStorage.setItem(draftKey(cityId, generatorVersion), JSON.stringify(next)); } catch { /* private mode */ }
}

function downloadReview(cityId: string, review: FactReviewFile): void {
  const blob = new Blob([JSON.stringify(review, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = reviewDownloadName(cityId);
  link.click();
  URL.revokeObjectURL(url);
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

function reviewCards(
  staged: ReviewFact[],
  review: FactReviewFile,
  query: string,
  collection: string,
): string {
  const byFeature = new Map<string, ReviewFact[]>();
  for (const item of staged) {
    if (!matchesReviewItem(item, query, collection)) continue;
    const list = byFeature.get(item.featureId) || [];
    list.push(item);
    byFeature.set(item.featureId, list);
  }
  if (!byFeature.size) return '<div class="empty">Nothing here yet. Try another filter or city.</div>';
  return [...byFeature.entries()].map(([featureId, facts]) => {
    const label = review.features?.[featureId];
    const verdict = label?.verdict || '';
    const note = label?.note || '';
    const stateClass = verdict === 'approved' ? 'ok' : verdict === 'rejected' ? 'nope' : 'pending';
    return `<article class="card review ${stateClass}" data-feature="${escapeHtml(featureId)}">
      <div class="cardtop">
        <span class="pill">${verdict || 'unreviewed'}</span>
        <span>${escapeHtml(facts[0].collection)} · ${facts.length} fact${facts.length === 1 ? '' : 's'}</span>
      </div>
      <h2>${escapeHtml(facts[0].featureName)}</h2>
      <div class="actions">
        <button type="button" data-verdict="approved" class="${verdict === 'approved' ? 'active' : ''}">Approve</button>
        <button type="button" data-verdict="rejected" class="${verdict === 'rejected' ? 'active' : ''}">Reject</button>
        <button type="button" data-verdict="clear">Clear</button>
      </div>
      ${facts.map((fact) => {
        const struck = isFactStruck(review, featureId, fact.text);
        return `<div class="fact-row ${struck ? 'struck' : ''}">
          <p class="fact"><span class="pill">${escapeHtml(fact.kind)}</span> ${escapeHtml(fact.text)}</p>
          <button type="button" data-strike="${escapeHtml(fact.text)}" ${verdict === 'rejected' ? 'disabled' : ''}>
            ${struck ? 'Restore' : 'Strike'}
          </button>
          ${evidence(fact)}
          <a class="source" href="${escapeHtml(fact.sourceUrl)}" target="_blank" rel="noreferrer">Open Wikipedia source ↗</a>
        </div>`;
      }).join('')}
      <label class="note">Reviewer note
        <textarea data-note rows="2" placeholder="Optional — why this label, what to watch next" ${verdict ? '' : 'disabled'}>${escapeHtml(note)}</textarea>
      </label>
    </article>`;
  }).join('');
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
  const generatorVersion = stagedFile?.generatorVersion || progress?.generatorVersion || 'unknown';
  let review = loadDraft(city, generatorVersion);
  const labels = countReviewLabels(review);
  const current = view === 'staged' ? staged : view === 'rejected' ? rejected : view === 'published' ? published : staged;
  const reasons = [...new Set(rejected.map((item) => item.reason))].sort();
  const collections = [...new Set(current.map((item) => item.collection))].sort();
  const live = progress?.status === 'running';
  const featureCount = new Set(staged.map((item) => item.featureId)).size;
  app.innerHTML = `<header>
    <a class="eyebrow" href="./">CANAL RECALL</a><h1>Trivia Lab <span>🧪</span></h1>
    <p>Browse what OpenRouter found, label what humans may publish, and export a version-matched review file for <code>npm run facts:publish</code>.</p>
    <nav class="cities">${cities.map((id) => `<button data-city="${id}" class="${city === id ? 'active' : ''}">${cityName(id)}</button>`).join('')}</nav>
  </header>
  <section class="meter ${live ? 'live' : ''}">
    <div><span class="dot"></span><b>${live ? 'Extraction running' : progress ? 'Extraction complete' : 'No active run'}</b><small>${progress ? `Updated ${new Date(progress.updatedAt).toLocaleTimeString()}` : 'Start a build to see progress'}</small></div>
    <strong>${progress?.considered || 0}<small>features tried</small></strong><strong>${staged.length}<small>passed gates</small></strong><strong>${rejected.length}<small>rejected</small></strong><strong>$${(progress?.openRouterSpentUsd || 0).toFixed(4)}<small>this run</small></strong>
    <button id="refresh" title="Load the latest checkpoint">Refresh data</button>
  </section>
  <nav class="views">
    <button data-view="staged" class="${view === 'staged' ? 'active' : ''}">✨ Passed gates <span>${staged.length}</span></button>
    <button data-view="review" class="${view === 'review' ? 'active' : ''}">✍️ Human review <span>${labels.labelled}/${featureCount}</span></button>
    <button data-view="rejected" class="${view === 'rejected' ? 'active' : ''}">🧯 Rejected <span>${rejected.length}</span></button>
    <button data-view="published" class="${view === 'published' ? 'active' : ''}">🏛 Published <span>${published.length}</span></button>
  </nav>
  <p class="meaning">${view === 'staged' ? 'Passed automatic grounding and editorial checks; awaiting human review.'
    : view === 'review' ? `Label features for generator <code>${escapeHtml(generatorVersion)}</code>. Draft is saved in this browser; download the JSON into <code>scripts/</code> before publishing.`
    : view === 'rejected' ? 'Kept for audit: proposed facts whose wording was not sufficiently supported by its cited evidence, or that failed another editorial rule.'
    : 'Human-reviewed facts currently available to the game.'}</p>
  ${view === 'review' ? `<section class="review-bar">
    <strong>${labels.approved} approved</strong>
    <strong>${labels.rejected} rejected</strong>
    <strong>${Math.max(0, featureCount - labels.labelled)} unreviewed</strong>
    <label class="file">Load review…<input id="load-review" type="file" accept="application/json,.json"></label>
    <button id="download-review" type="button">Download ${escapeHtml(reviewDownloadName(city))}</button>
  </section>` : ''}
  <section class="filters"><input id="search" type="search" placeholder="Search names, facts, or evidence…"><select id="collection"><option value="">All collections</option>${collections.map((x) => `<option>${escapeHtml(x)}</option>`).join('')}</select>${view === 'rejected' ? `<select id="reason"><option value="">All rejection reasons</option>${reasons.map((x) => `<option>${escapeHtml(x)}</option>`).join('')}</select>` : ''}<span id="shown"></span></section>
  <main id="cards"></main>`;

  const updateCards = () => {
    const query = (document.querySelector<HTMLInputElement>('#search')?.value || '').trim();
    const collection = document.querySelector<HTMLSelectElement>('#collection')?.value || '';
    const reason = document.querySelector<HTMLSelectElement>('#reason')?.value || '';
    if (view === 'review') {
      document.querySelector('#cards')!.innerHTML = reviewCards(staged, review, query, collection);
      document.querySelector('#shown')!.textContent = `${countReviewLabels(review).labelled} labelled · ${featureCount} features`;
      bindReviewActions();
      return;
    }
    const filtered = current.filter((item) => matchesReviewItem(item, query, collection, reason));
    document.querySelector('#cards')!.innerHTML = filtered.length
      ? filtered.map((item) => card(item, view === 'rejected')).join('')
      : '<div class="empty">Nothing here yet. Try another filter or city.</div>';
    document.querySelector('#shown')!.textContent = `${filtered.length} shown`;
  };

  const bindReviewActions = () => {
    document.querySelectorAll<HTMLElement>('.card.review').forEach((cardEl) => {
      const featureId = cardEl.dataset.feature!;
      cardEl.querySelectorAll<HTMLButtonElement>('[data-verdict]').forEach((button) => {
        button.onclick = () => {
          const value = button.dataset.verdict!;
          review = setFeatureVerdict(review, featureId,
            value === 'clear' ? null : value as 'approved' | 'rejected');
          saveDraft(city, generatorVersion, review);
          updateCards();
        };
      });
      cardEl.querySelectorAll<HTMLButtonElement>('[data-strike]').forEach((button) => {
        button.onclick = () => {
          review = toggleStruckFact(review, featureId, button.dataset.strike || '');
          if (!review.features?.[featureId]?.verdict) {
            review = setFeatureVerdict(review, featureId, 'approved');
          }
          saveDraft(city, generatorVersion, review);
          updateCards();
        };
      });
      const note = cardEl.querySelector<HTMLTextAreaElement>('[data-note]');
      if (note) {
        note.onchange = () => {
          review = setFeatureNote(review, featureId, note.value);
          saveDraft(city, generatorVersion, review);
        };
      }
    });
  };

  document.querySelectorAll<HTMLElement>('[data-city]').forEach((button) => button.onclick = () => {
    city = button.dataset.city!; location.hash = `${city}/${view}`; void render();
  });
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => button.onclick = () => {
    view = button.dataset.view as View; location.hash = `${city}/${view}`; void render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.filters input,.filters select').forEach((input) => input.oninput = updateCards);
  document.querySelector<HTMLButtonElement>('#refresh')!.onclick = () => void render();
  document.querySelector<HTMLButtonElement>('#download-review')?.addEventListener('click', () => {
    downloadReview(city, review);
  });
  document.querySelector<HTMLInputElement>('#load-review')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as FactReviewFile;
      if (parsed.generatorVersion && parsed.generatorVersion !== generatorVersion) {
        const ok = window.confirm(
          `This review is for ${parsed.generatorVersion}, but staged facts are ${generatorVersion}. Load anyway as a draft?`,
        );
        if (!ok) return;
      }
      review = {
        ...emptyReviewFile(generatorVersion),
        ...parsed,
        generatorVersion,
        features: parsed.features || {},
      };
      saveDraft(city, generatorVersion, review);
      updateCards();
    } catch (error) {
      window.alert(`Could not read that review file: ${(error as Error).message}`);
    }
  });
  updateCards();
}

window.addEventListener('hashchange', () => {
  const [nextCity, nextView] = location.hash.slice(1).split('/');
  city = cities.includes(nextCity as typeof cities[number]) ? nextCity : 'amsterdam';
  view = (['staged', 'rejected', 'published', 'review'] as const).includes(nextView as View)
    ? nextView as View : 'staged';
  void render();
});
void render();
