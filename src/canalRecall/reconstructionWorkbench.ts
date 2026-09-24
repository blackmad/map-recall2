import { mountPreviewNotesForCandidate } from '../../scripts/review/preview-notes';
import type { WorkbenchPayload, WorkbenchCase, WorkbenchImage, ReconstructionCandidateVariant } from './reconstructionWorkbenchTypes';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const number = (value: number | null) => value === null ? 'Not measured' : value.toLocaleString('en');
const dollars = (value: number | null) => value === null ? 'Unknown' : `$${value.toFixed(4)}`;
const line = (label: string, value: string) => {
  const element = document.createElement('div'); element.className = 'metric';
  const caption = document.createElement('span'); caption.textContent = label;
  const strong = document.createElement('strong'); strong.textContent = value;
  element.append(caption, strong); return element;
};
const list = (id: string, values: string[]) => $(id).replaceChildren(...values.map(value => {
  const item = document.createElement('li'); item.textContent = value; return item;
}));
const localUrl = (value: string) => /^\/(?:data|canal-drive)\//.test(value) && !value.startsWith('//');
// Isolated building previews are separate from the editable source study.
// Bind navigation to the reviewed photograph so a later source replacement
// cannot silently inherit an older building candidate.
const buildingPreviews: Record<string, { sourceSha256: string; url: string; limitation?: string }> = {
  'case-20': { sourceSha256: 'c85f193a00e009915f48bc506ec9c589cdaefdaa3351e3a0cc5a5c5f72b672c0', url: '/canal-drive/source-to-owner-city-preview.html?packet=./data/case20-dormer-city-preview.json' },
  'case-22': { sourceSha256: 'af27bca35f3f6f1ca50ef6cfa6e94733eec36f8790bc47ab3f54fe5aad4e3c70', url: '/canal-drive/source-to-owner-city-preview.html' },
  'case-24': { sourceSha256: 'd41fbad9b2cab955a11725296c74f17d65e9e36907763f86eaf1396467186ebb', url: '/canal-drive/case24-gable-city-preview.html' },
  'case-25': { sourceSha256: 'e4a4b377bf89267f26ea395fd6bb5bb066770063279004d3b1dea0ea2031ea7d', url: '/canal-drive/source-to-owner-city-preview.html?packet=./data/case25-flat-city-preview.json' },
  'case-30': { sourceSha256: '410f61590e953b0982563bfebf25d247f7f9b228ce0005ca0f07ecd1aa5403b7', url: '/canal-drive/source-to-owner-city-preview.html?packet=./data/case30-glazed-balcony-door-preview.json', limitation: 'Three upper glazed balcony doors only; roof, balcony structure and ground finish remain unresolved.' },
};

function showImage(id: string, source?: WorkbenchImage) {
  const image = $<HTMLImageElement>(`${id}-image`), link = $<HTMLAnchorElement>(`${id}-link`);
  const valid = source && localUrl(source.url);
  image.hidden = !valid;
  if (valid) { image.src = source.url; link.href = source.url; }
  else { image.removeAttribute('src'); link.removeAttribute('href'); }
  $(`${id}-date`).textContent = source ? `${source.captureDate?.slice(0, 10) || 'Date unknown'} · ${source.width} × ${source.height} pixels` : 'No source image';
}

async function start() {
  const response = await fetch('/api/reconstruction/workbench', { cache: 'no-store' });
  if (!response.ok) throw Error(`Project report unavailable (${response.status})`);
  const report = await response.json() as WorkbenchPayload;
  const p = report.project;
  $('metrics').replaceChildren(
    line('Active district buildings', number(p.activeBuildings)),
    line('Ground / full analyses in staged batch', `${number(p.analyzedGround)} / ${number(p.analyzedFull)}`),
    line('Candidate buildings with compiled features', number(p.renderedBuildings)),
    line('Accepted metric registrations in candidate', number(p.acceptedRegistrations)),
  );
  $('release-status').textContent = `Active ${p.activeReleaseId?.slice(0, 12) ?? 'unknown'} · staged ${p.candidateReleaseId?.slice(0, 12) ?? 'unknown'}`;
  $('cost-status').textContent = `${dollars(p.accountedUsd)} accounted · ${dollars(p.ceilingUsd)} recorded ceiling. ${dollars(p.conservativeUsd)} is conservatively accounted; ${number(p.unresolvedCharges)} unresolved charges.`;
  $('snapshot-status').textContent = p.snapshotStatus;
  list('findings', p.findings);
  $('quality-status').textContent = report.quality.explanation;
  list('actions', report.quality.actions);
  $('diagnostics').replaceChildren(...report.quality.diagnostics.map(d => {
    const row = document.createElement('tr');
    for (const text of [d.caseId, d.binding, d.matched === null ? `Unscored / ${d.complete} complete references` : `${d.matched} / ${d.complete} complete references`, `${d.partial} partial extents excluded`, d.explanation]) {
      const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
    }
    if (d.reviewCaseId) {
      const cell = document.createElement('td'), link = document.createElement('a');
      link.href = `?case=${encodeURIComponent(d.reviewCaseId)}#case-review`; link.textContent = 'Review source'; cell.append(link); row.append(cell);
    }
    return row;
  }));
  $('status').textContent = `Loaded ${new Date(report.generatedAt).toLocaleString()} · Refreshing this page runs read-only diagnostics. Saving feedback records a review; it does not activate a release.`;
  if (!report.preview.cases.length || !report.preview.sha256) {
    $('case-review').hidden = true;
    $('preview-error').textContent = report.preview.error ?? 'No development preview available.';
    return;
  }
  let notes: Awaited<ReturnType<typeof mountPreviewNotesForCandidate>> | undefined;
  try { notes = await mountPreviewNotesForCandidate(report.preview.sha256); }
  catch (error) { $('repair-note-message').textContent = `Saved notes unavailable: ${String(error)}`; }
  type Focus = 'roof' | 'facade' | 'ground';
  const parameters = new URLSearchParams(location.search);
  let rememberedFocus: string | null = null;
  try { rememberedFocus = localStorage.getItem('reconstruction-review-focus'); } catch {}
  const requestedFocus = parameters.get('focus') ?? rememberedFocus;
  let focus: Focus = requestedFocus === 'ground' || requestedFocus === 'facade' ? requestedFocus : 'roof';
  let queueMode = parameters.get('queue') === 'roofs' ? 'roofs' : 'all';
  let candidateVariant: ReconstructionCandidateVariant = parameters.get('candidateVariant') === 'roof-planes' ? 'roof-planes' : 'baseline';
  let overlayOpacity = Math.max(0, Math.min(1, Number(parameters.get('overlayOpacity') ?? 0) / 100));
  let comparisonMode = parameters.get('comparisonMode') === 'model-view' ? 'model-view' : 'source-aligned';
  const allCases = report.preview.cases;
  const orderedCases = () => queueMode === 'roofs' ? [...allCases].sort((a, b) => a.roof.priority.rank - b.roof.priority.rank || a.caseId.localeCompare(b.caseId)) : allCases;
  let cases = orderedCases();
  const select = $<HTMLSelectElement>('case-select'), queueSelect = $<HTMLSelectElement>('queue-select');
  const box = $<HTMLTextAreaElement>('repair-note'), noteStatus = $<HTMLSelectElement>('repair-note-status');
  const saveNext = $<HTMLButtonElement>('save-next');
  const candidateFrame = $<HTMLIFrameElement>('current-preview');
  const variantSelect = $<HTMLSelectElement>('candidate-variant');
  const overlaySlider = $<HTMLInputElement>('overlay-opacity');
  const overlayValue = $('overlay-opacity-value');
  const comparisonModeSelect = $<HTMLSelectElement>('comparison-mode');
  const requested = parameters.get('case');
  let index = Math.max(0, cases.findIndex(c => c.caseId === requested));
  let navigating = false;
  const edit = () => { if (!box.disabled) box.focus({ preventScroll: true }); };
  const selectCandidate = () => candidateFrame.contentWindow?.postMessage({ type: 'reconstruction-preview-select', caseId: cases[index].caseId, previewSha256: report.preview.sha256, focus, candidateVariant, comparisonMode, overlayOpacity }, location.origin);
  candidateFrame.addEventListener('load', selectCandidate);
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === candidateFrame.contentWindow && event.data?.type === 'reconstruction-preview-ready' && event.data.previewSha256 === report.preview.sha256) selectCandidate();
    const frame = event.data;
    if (event.origin !== location.origin || event.source !== candidateFrame.contentWindow || frame?.type !== 'reconstruction-preview-framing' || frame.previewSha256 !== report.preview.sha256 || frame.caseId !== cases[index].caseId || comparisonMode !== 'source-aligned') return;
    const tier = focus === 'ground' ? 'ground' : 'full';
    if (frame.sourceTier !== tier || frame.focus !== (focus === 'facade' ? 'full' : focus)) return;
    if (![frame.imageWidth, frame.imageHeight, frame.imageTop, frame.viewportTop, frame.viewportHeight].every(Number.isFinite) || frame.imageWidth <= 0 || frame.imageHeight <= 0) return;
    const photo = $<HTMLImageElement>(`${tier}-image`), viewport = $(`${tier}-link`);
    viewport.style.height = `${candidateFrame.offsetHeight}px`;
    viewport.style.position = 'relative';
    const border = candidateFrame.clientTop;
    Object.assign(photo.style, { position: 'absolute', width: `${frame.imageWidth}px`, height: `${frame.imageHeight}px`, maxWidth: 'none', left: '50%', top: `${border + frame.imageTop}px`, transform: 'translateX(-50%)', border: '0', clipPath: `inset(${Math.max(0, frame.viewportTop - frame.imageTop)}px 0 ${Math.max(0, frame.imageTop + frame.imageHeight - frame.viewportTop - frame.viewportHeight)}px 0)` });
    viewport.dataset.framing = 'measured-candidate-viewport';
  });
  const options = () => {
    select.replaceChildren(...cases.map(c => new Option(`${c.caseId} · ${c.address || c.buildingId}${queueMode === 'roofs' ? ` · ${c.roof.status}` : ''}`, c.caseId)));
    queueSelect.value = queueMode;
  };
  const navigationState = () => {
    const locked = navigating || Boolean(notes && box.disabled);
    $<HTMLButtonElement>('prev-case').disabled = locked || index === 0;
    $<HTMLButtonElement>('next-case').disabled = locked || index === cases.length - 1;
    saveNext.disabled = locked || !notes || candidateVariant !== 'baseline';
    saveNext.textContent = navigating ? 'Saving…' : index === cases.length - 1 ? 'Save final note' : 'Save & next →';
    select.disabled = locked; queueSelect.disabled = locked;
  };
  const showFocus = (c: WorkbenchCase) => {
    for (const tier of ['full', 'ground']) {
      $(`${tier}-image`).removeAttribute('style');
      $(`${tier}-link`).removeAttribute('style');
      delete $(`${tier}-link`).dataset.framing;
    }
    const roofExperimentSupported = c.caseId === 'case-20' && focus !== 'ground';
    const roofOption = variantSelect.querySelector<HTMLOptionElement>('option[value="roof-planes"]');
    if (roofOption) roofOption.disabled = !roofExperimentSupported;
    if (!roofExperimentSupported) candidateVariant = 'baseline';
    notes?.setPersistenceEnabled(candidateVariant === 'baseline');
    document.body.dataset.reviewFocus = focus;
    $('full-view-label').textContent = focus === 'roof' ? 'Roof / upper floors' : 'Full façade';
    document.querySelectorAll<HTMLButtonElement>('[data-review-focus]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.reviewFocus === focus)));
    $('full-panel').hidden = focus === 'ground'; $('ground-panel').hidden = focus !== 'ground';
    $('roof-issues').hidden = focus !== 'roof'; $('roof-checklist').hidden = focus !== 'roof';
    $('roof-summary').hidden = focus !== 'roof';
    $('review-prompt').textContent = focus === 'roof' ? 'Compare roofline, gable, dormers and chimneys. Use “Not visible” for hidden or cropped details.' : focus === 'ground' ? 'Compare doors, entrances, storefronts, awnings and ground-floor finishes.' : 'Compare the full building: silhouette, window rhythm, colours and balconies.';
    box.placeholder = focus === 'roof' ? 'Roofline, gable, dormers, chimney: what differs from the photo?' : 'What differs from the source photo? Which details are already good enough?';
    $('repair-note-label').textContent = focus === 'roof' ? 'Roof review' : 'Your review';
    const roof = c.roof;
    $('roof-summary').textContent = `${roof.frontalSilhouette.status === 'agent-reviewed-source-outline' ? 'Existing outline correction' : 'Outline awaiting review'} · Original building mesh: ${roof.roof3D.surfaceCount} roof faces (separate from source study). ${roof.reasons[0]}${roof.occlusion.detail ? ` ${roof.occlusion.detail}` : ''}`;
    list('roof-checklist', ['Roofline and gable shape', 'Dormers, chimneys and roof openings', 'Keep hidden details marked unknown']);
    const params = new URLSearchParams({ case: c.caseId, focus, candidateVariant, comparisonMode, overlayOpacity: String(Math.round(overlayOpacity * 100)) }); if (queueMode === 'roofs') params.set('queue', queueMode);
    history.replaceState(null, '', `?${params}${location.hash}`);
    const viewerUrl = `${c.previewUrl}&focus=${focus}&candidateVariant=${candidateVariant}&comparisonMode=${comparisonMode}&overlayOpacity=${Math.round(overlayOpacity * 100)}`;
    const previewLink = $<HTMLAnchorElement>('open-preview');
    if (localUrl(viewerUrl)) previewLink.href = viewerUrl;
    let buildingLink = document.getElementById('open-building-preview') as HTMLAnchorElement | null;
    if (!buildingLink) {
      buildingLink = document.createElement('a'); buildingLink.id = 'open-building-preview';
      buildingLink.target = '_blank'; buildingLink.rel = 'noopener';
      buildingLink.textContent = 'Building preview · approximate placement ↗';
      previewLink.after(buildingLink);
    }
    const buildingPreview = buildingPreviews[c.caseId];
    buildingLink.hidden = !buildingPreview || buildingPreview.sourceSha256 !== c.source.full?.sha256;
    buildingLink.style.display = buildingLink.hidden ? 'none' : 'block';
    if (!buildingLink.hidden) {
      buildingLink.href = buildingPreview.url;
      buildingLink.textContent = buildingPreview.limitation
        ? `Building preview · ${buildingPreview.limitation} ↗`
        : 'Building preview · approximate placement ↗';
    }
    else buildingLink.removeAttribute('href');
    if (!candidateFrame.getAttribute('src')) candidateFrame.src = `${viewerUrl}&embed=1&preview=${report.preview.sha256}`;
    else selectCandidate();
  };
  const show = () => {
    const c = cases[index]; select.value = c.caseId;
    $('case-title').textContent = c.address || c.caseId;
    $('case-position').textContent = `${index + 1} / ${cases.length}`;
    $('case-identity').textContent = `${c.caseId} · building ${c.buildingId}`;
    $('original-note').textContent = c.note || 'No original written feedback.';
    showImage('full', c.source.full); showImage('ground', c.source.ground);
    const prior = $<HTMLImageElement>('previous-image');
    prior.hidden = !c.previousRenderUrl || !localUrl(c.previousRenderUrl);
    if (!prior.hidden) prior.src = c.previousRenderUrl!; else prior.removeAttribute('src');
    $('case-limitations').textContent = c.omissions.length ? c.omissions.join(' · ') : '';
    const fullDate = c.source.full?.captureDate?.slice(0, 10), groundDate = c.source.ground?.captureDate?.slice(0, 10);
    $('date-warning').textContent = fullDate && groundDate && fullDate !== groundDate ? 'These photographs have different dates. Check tenant and temporary-feature changes before combining them.' : '';
    showFocus(c);
    notes?.show(c.caseId);
    notes?.setPersistenceEnabled(candidateVariant === 'baseline');
    variantSelect.value = candidateVariant;
    comparisonModeSelect.value = comparisonMode;
    overlaySlider.value = String(Math.round(overlayOpacity * 100));
    overlayValue.textContent = `${Math.round(overlayOpacity * 100)}%`;
    $('comparison-status').textContent = candidateVariant === 'roof-planes'
      ? 'Roof planes experiment · source aligned review only; saves are disabled until variant binding exists.'
      : comparisonMode === 'source-aligned' ? 'Source aligned overlay · camera matched depth is not measured.' : 'Model view · geometry perspective is illustrative.';
    navigationState(); edit();
  };
  const move = async (next: number) => {
    if (navigating || box.disabled && notes) { select.value = cases[index].caseId; return; }
    navigating = true; navigationState();
    try {
      if (notes && !await notes.saveCurrent()) { select.value = cases[index].caseId; edit(); return; }
      index = Math.max(0, Math.min(cases.length - 1, next)); show();
    } finally { navigating = false; navigationState(); edit(); }
  };
  select.addEventListener('change', () => { const next = cases.findIndex(c => c.caseId === select.value); void move(next); });
  $('prev-case').addEventListener('click', () => { void move(index - 1); });
  $('next-case').addEventListener('click', () => { void move(index + 1); });
  saveNext.addEventListener('click', () => { void move(index + 1); });
  queueSelect.addEventListener('change', () => {
    const current = cases[index].caseId; queueMode = queueSelect.value; cases = orderedCases(); index = cases.findIndex(c => c.caseId === current); options(); show();
  });
  variantSelect.addEventListener('change', () => {
    candidateVariant = variantSelect.value === 'roof-planes' && cases[index].caseId === 'case-20' && focus !== 'ground' ? 'roof-planes' : 'baseline';
    show();
    navigationState();
  });
  overlaySlider.addEventListener('input', () => {
    overlayOpacity = Number(overlaySlider.value) / 100;
    overlayValue.textContent = `${overlaySlider.value}%`;
    const params = new URLSearchParams(location.search); params.set('overlayOpacity', overlaySlider.value); history.replaceState(null, '', `?${params}${location.hash}`);
    selectCandidate();
  });
  comparisonModeSelect.addEventListener('change', () => {
    comparisonMode = comparisonModeSelect.value === 'model-view' ? 'model-view' : 'source-aligned';
    show();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-review-focus]').forEach(button => button.addEventListener('click', () => {
    focus = button.dataset.reviewFocus as Focus;
    try { localStorage.setItem('reconstruction-review-focus', focus); } catch {}
    show();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-roof-issue]').forEach(button => button.addEventListener('click', () => {
    if (box.disabled || box.readOnly) return;
    const prefix = `${box.value && !box.value.endsWith('\n') ? '\n' : ''}${button.dataset.roofIssue}: `;
    box.setRangeText(prefix, box.value.length, box.value.length, 'end'); box.dispatchEvent(new Event('input', { bubbles: true }));
    noteStatus.value = 'needs-work'; noteStatus.dispatchEvent(new Event('change', { bubbles: true })); edit();
  }));
  document.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void move(index + (event.shiftKey ? -1 : 1)); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!box.disabled) void notes?.saveCurrent(); return; }
    if (event.key === 'Escape' && event.target === box) { box.blur(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest('input,textarea,select,button,[contenteditable]')) return;
    if (event.key === 'j' || event.key === 'ArrowRight') { event.preventDefault(); void move(index + 1); }
    else if (event.key === 'k' || event.key === 'ArrowLeft') { event.preventDefault(); void move(index - 1); }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); edit(); }
  });
  $('show-project').addEventListener('click', () => { $<HTMLDetailsElement>('project-overview').open = true; });
  new MutationObserver(navigationState).observe(box, { attributes: true, attributeFilter: ['disabled'] });
  options(); show();

}

start().catch(error => { $('status').textContent = String(error); $('status').classList.add('error'); });
