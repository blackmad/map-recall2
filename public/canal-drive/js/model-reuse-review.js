const storageKey = 'amsterdam-model-review-v1';
const fields = Object.fromEntries(['search', 'category', 'license', 'decision', 'size'].map(id => [id, document.getElementById(id)]));
const grid = document.getElementById('grid');
const stats = document.getElementById('stats');
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Start a new local review. */ }
let catalogue;
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
function link(title, url) { const node = el('a', title); const safe = safeUrl(url); if (safe) { node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; } return node; }
function save() { try { localStorage.setItem(storageKey, JSON.stringify(decisions)); } catch { stats.textContent = 'Browser storage unavailable. Export your choices before closing this page.'; } }
function render() {
 const query = fields.search.value.toLowerCase().trim();
 const rows = catalogue.models.filter(model => {
  const decision = decisions[model.uid] || 'unreviewed';
  return (!query || [model.name, model.author, model.category, model.note].join(' ').toLowerCase().includes(query)) && (!fields.category.value || fields.category.value === model.category) && (!fields.license.value || fields.license.value === model.license.slug) && (!fields.decision.value || fields.decision.value === decision) && (!fields.size.value || (typeof model.triangles === 'number' && (fields.size.value === 'small' ? model.triangles <= 40000 : model.triangles > 40000)));
 });
 stats.textContent = `${rows.length} of ${catalogue.models.length} entries · ${catalogue.models.filter(m => decisions[m.uid] === 'interested').length} interested`;
 grid.replaceChildren();
 if (!rows.length) { grid.append(el('p', 'No models match these filters.', 'message')); return; }
 for (const model of rows) {
  const card = el('article', null, 'card');
  const preview = el('div', model.thumbnailUrl ? null : model.category, 'image');
  const thumbnail = safeUrl(model.thumbnailUrl);
  if (thumbnail) { const img = el('img'); img.src = thumbnail; img.alt = `${model.name} — preview by ${model.author}`; img.loading = 'lazy'; img.addEventListener('error', () => { preview.replaceChildren(el('span', 'Preview unavailable')); }); preview.append(img); }
  const content = el('div', null, 'content');
  content.append(el('span', model.category, `badge${model.category === 'Needs source check' ? ' hold' : ''}`), el('h2', model.name));
  const author = el('div', 'By ', 'meta'); author.append(link(model.author, model.authorUrl)); content.append(author);
  const details = el('div', null, 'meta'); details.append(link(model.license.name, model.license.url), document.createTextNode(` · ${typeof model.triangles === 'number' ? model.triangles.toLocaleString() + ' triangles' : 'Pack / survey; mesh count varies'}`)); content.append(details);
  content.append(el('p', model.note), el('p', model.license.requirements, 'meta'));
  const links = el('div', null, 'links'); links.append(link('View model / download', model.sourceUrl)); if (model.metadataUrl) links.append(link('Provider metadata', model.metadataUrl)); content.append(links);
  content.append(el('p', model.downloadNote, 'download'));
  const actions = el('div', null, 'actions');
  for (const [choice, label] of [['interested', 'Interested'], ['pass', 'Pass']]) {
   const button = el('button', label, decisions[model.uid] === choice ? 'active' : ''); button.type = 'button'; button.setAttribute('aria-pressed', String(decisions[model.uid] === choice)); button.addEventListener('click', () => { if (decisions[model.uid] === choice) delete decisions[model.uid]; else decisions[model.uid] = choice; save(); render(); }); actions.append(button);
  }
  content.append(actions); card.append(preview, content); grid.append(card);
 }
}
for (const field of Object.values(fields)) field.addEventListener('input', render);
document.getElementById('export').addEventListener('click', () => {
 if (!catalogue) return;
 const selection = { checkedOn: catalogue.checkedOn, exportedAt: new Date().toISOString(), models: catalogue.models.filter(model => decisions[model.uid] === 'interested') };
 const url = URL.createObjectURL(new Blob([JSON.stringify(selection, null, 2) + '\n'], {type:'application/json'}));
 const anchor = el('a'); anchor.href = url; anchor.download = 'amsterdam-model-shortlist.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
 const response = await fetch('./model-reuse-review.json'); if (!response.ok) throw new Error(`HTTP ${response.status}`); catalogue = await response.json();
 for (const category of [...new Set(catalogue.models.map(m => m.category))].sort()) { const option = el('option', category); option.value = category; fields.category.append(option); }
 for (const [slug, name] of new Map(catalogue.models.map(m => [m.license.slug, m.license.name]))) { const option = el('option', name); option.value = slug; fields.license.append(option); }
 const held = catalogue.models.filter(m => m.category === 'Needs source check').length;
 document.getElementById('research').textContent = `${catalogue.models.length - held} open-license candidates + ${held} requiring source checks. Checked ${catalogue.checkedOn}. Researched ${catalogue.research.sketchfabCandidatesExamined} Sketchfab results and ${catalogue.research.polyHavenModelCatalogueExamined} Poly Haven assets, alongside other primary providers.`;
 render();
} catch (error) { document.getElementById('research').textContent = 'Catalogue unavailable.'; grid.append(el('p', `Could not load the review data: ${error.message}. Reload this page after starting the development server.`, 'message')); }
