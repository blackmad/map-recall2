const originalFetch = window.fetch.bind(window);
const state = { records: new Map(), exposed: new Set(), scheduled: false };
const fields = ['shopfront', 'awning', 'awningKind', 'awningDeployment', 'roofShape', 'facadeTop'];

function currentId() {
  return decodeURIComponent(location.hash.slice(1));
}

function controlFor(field) {
  return document.querySelector(`select[name="${field}"], select#${field}`);
}

function suggestionFor(record, field) {
  const reviewed = record.visualReview;
  if (reviewed?.fieldEligibility?.[field] !== false && reviewed?.proposal?.[field] != null) {
    return reviewed.proposal[field];
  }
  return record.proposal?.[field];
}

function applySuggestions() {
  state.scheduled = false;
  const id = currentId();
  const record = state.records.get(id);
  if (!record || record.review) return;
  let shown = false;
  for (const field of fields) {
    const select = controlFor(field);
    const guess = suggestionFor(record, field);
    if (!select || guess == null || guess === 'unknown' || select.dataset.userEdited === 'true') continue;
    if (![...select.options].some(option => option.value === guess)) continue;
    if (select.value === 'unknown' || !select.value) select.value = guess;
    select.dataset.machineGuess = guess;
    if (!select.nextElementSibling?.classList.contains('machine-guess')) {
      const badge = document.createElement('small');
      badge.className = 'machine-guess';
      badge.textContent = `Machine guess: ${select.options[select.selectedIndex]?.text || guess}`;
      select.insertAdjacentElement('afterend', badge);
    }
    shown = true;
  }
  if (shown) state.exposed.add(id);
}

function scheduleSuggestions() {
  if (state.scheduled) return;
  state.scheduled = true;
  requestAnimationFrame(applySuggestions);
}

document.addEventListener('change', event => {
  if (!event.target.matches('select')) return;
  event.target.dataset.userEdited = 'true';
  if (event.target.nextElementSibling?.classList.contains('machine-guess')) {
    event.target.nextElementSibling.remove();
  }
}, true);

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('/api/neighbourhood/review') && init?.body && state.exposed.has(currentId())) {
    const body = JSON.parse(init.body);
    body.suggestionShown = true;
    body.reviewContext = {
      version: 2,
      mode: 'assisted',
      queue: new URLSearchParams(location.search).get('queue') || 'all',
      exposures: [{ kind: 'machine-text', at: new Date().toISOString() }]
    };
    init = { ...init, body: JSON.stringify(body) };
  }
  return originalFetch(input, init);
};

originalFetch('/api/neighbourhood')
  .then(response => response.json())
  .then(data => {
    state.records = new Map(data.records.map(record => [record.id, record]));
    scheduleSuggestions();
  });

addEventListener('hashchange', scheduleSuggestions);
new MutationObserver(scheduleSuggestions).observe(document.body, { childList: true, subtree: true });
