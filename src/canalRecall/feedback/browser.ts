export {};
/** Shared static-page feedback. Firebase loads only when a user opens the form. */
declare const __FEEDBACK_BUILD__: { builtAt: string; sha: string; workspaceDirty: boolean };
type Context = Record<string, unknown>;
type Target = { id: string; label: string; canvas?: HTMLCanvasElement; image?: HTMLImageElement; context?: () => Context; map?: any };
declare global {
  interface Window {
    CanalFeedback: { attach: (container: HTMLElement, target: Target) => void; open: (target?: Target) => void };
  }
}
const w = window as any;
let cloudPromise: Promise<typeof import('./cloud')> | undefined;
function cloud() { return cloudPromise ??= import('./cloud').catch(e => { cloudPromise = undefined; throw e; }); }
const style = document.createElement('style');
style.textContent = `
.cf-launch{position:fixed;right:12px;bottom:calc(56px + env(safe-area-inset-bottom));z-index:90}
.cf-button{font:13px system-ui;padding:8px 12px;border:1px solid #8b887f;border-radius:7px;background:#f7f4ec;color:#303b43;cursor:pointer;min-height:44px}
.cf-note{margin:6px 14px 12px;align-self:flex-start}
.cf-dialog{margin:auto;box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:20px;border:1px solid #8b887f;border-radius:12px;background:#f7f4ec;color:#303b43;font:14px/1.5 system-ui;z-index:1000}
.cf-dialog::backdrop{background:#0008}.cf-dialog h2{margin:0 0 8px;font-size:18px;padding:0}.cf-dialog textarea{box-sizing:border-box;width:100%;min-height:100px;font:inherit;padding:8px;margin:8px 0}.cf-actions{display:flex;gap:8px;flex-wrap:wrap}.cf-preview{max-width:100%;max-height:220px;display:block;cursor:crosshair}.cf-dialog small{display:block}.cf-history{max-height:180px;overflow:auto}.cf-history p{border-top:1px solid #d4cfc3;padding-top:6px}.cf-dialog [role=status]{white-space:pre-wrap}`;
document.head.append(style);
const dialog = document.createElement('dialog');
dialog.className = 'cf-dialog';
dialog.setAttribute('aria-label', 'Leave feedback');
dialog.innerHTML = `<h2>Leave feedback</h2><small class="cf-target"></small><img class="cf-preview" alt="Captured view for this feedback" hidden><small class="cf-anchor"></small><label for="cf-text">What should change?</label><textarea id="cf-text" maxlength="12000" placeholder="Describe what you see and what you expected…"></textarea><div class="cf-actions"><button type="button" class="cf-button cf-save">Save feedback</button><button type="button" class="cf-button cf-login">Sign in with Google</button><button type="button" class="cf-button cf-history-button">My feedback</button><button type="button" class="cf-button cf-close">Close</button></div><p role="status" aria-live="polite"></p><div class="cf-history"></div>`;
document.body.append(dialog);
const text = dialog.querySelector('textarea')!;
const status = dialog.querySelector('[role=status]')!;
const preview = dialog.querySelector('img')!;
const saveButton = dialog.querySelector('.cf-save') as HTMLButtonElement;
let current: Target;
let payload: Context;
let anchor: { x: number; y: number } | null = null;
let noteId = '';
let captured = '';
let draftKey = '';
let previousFocus: HTMLElement | null;
let frozenGame: any;
let saving = false;
let buildPromise: Promise<unknown>;
let capturePromise: Promise<void>;
let readyCloud: typeof import('./cloud') | undefined;
function pageUrl() {
  const u = new URL(location.href);
  // Do not store GPS/home query values, tokens or other arbitrary URL data.
  for (const key of [...u.searchParams.keys()]) if (!['only','kit','look','az','el','case','queue','id'].includes(key)) u.searchParams.delete(key);
  u.hash = '';
  return u.href;
}
function snapshot(target: Target) {
  try {
    const source = target.canvas || target.image;
    if (!source) return '';
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) return '';
    const c = document.createElement('canvas');
    const ratio = Math.min(1, 960 / width, 640 / height);
    c.width = Math.round(width * ratio); c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d')!;
    if (source.id === 'gameCanvas') {
      const mapCanvas = w.canalRecallGame?.vectorMap?.map?.getCanvas?.();
      if (mapCanvas) {
        const gameRect = source.getBoundingClientRect(), mapRect = mapCanvas.getBoundingClientRect();
        ctx.drawImage(mapCanvas, (mapRect.left - gameRect.left) / gameRect.width * c.width,
          (mapRect.top - gameRect.top) / gameRect.height * c.height,
          mapRect.width / gameRect.width * c.width, mapRect.height / gameRect.height * c.height);
      }
    }
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', .72);
    return data.length <= 240000 ? data : '';
  } catch { return ''; }
}
function gameContext(): Context {
  const g = w.canalRecallGame;
  if (!g) return {};
  const center = g.vectorMap?.map?.getCenter?.();
  return {
    city: g.cityId, travelMode: g.travelMode, viewMode: g.viewMode, themeMode: g.themeMode,
    buildingLook: g.vectorMap?.buildingLook?.(), state: g.state,
    player: g.player ? { x: g.player.x, y: g.player.y, angle: g.player.angle } : null,
    camera: g.camera ? { x: g.camera.x, y: g.camera.y, zoom: g.camera.zoom } : null,
    mapCenter: center ? { lng: center.lng, lat: center.lat } : null,
    destination: g.routeTo && g.routeTo.id !== 'home' ? { id: g.routeTo.id, name: g.routeTo.name } : null,
    landmark: g._landmarkNotice?.id || null,
  };
}
function open(target?: Target) {
  if (dialog.open) return;
  current = target || w.CanalFeedbackPage?.() || { id: 'page', label: document.title, canvas: document.querySelector('#gameCanvas, main canvas, canvas') as HTMLCanvasElement, context: gameContext };
  anchor = null; noteId = crypto.randomUUID(); captured = ''; readyCloud = undefined;
  payload = JSON.parse(JSON.stringify(current.context?.() || {}));
  draftKey = `canalFeedback.draft:${location.pathname}:${current.id}`;
  previousFocus = document.activeElement as HTMLElement;
  // Freeze the frame while typing, without invoking the game's pause-menu rendering.
  frozenGame = w.canalRecallGame;
  if (frozenGame) { frozenGame._feedbackOpen = true; frozenGame.input.keys = {}; frozenGame.input.justPressed = {}; frozenGame.sound?.silence?.(); }
  dialog.querySelector('.cf-target')!.textContent = current.label;
  preview.hidden = true;
  dialog.querySelector('.cf-anchor')!.textContent = captured ? 'Tap the image to mark the spot you mean (optional).' : 'Page and view context will be included.';
  try { text.value = localStorage.getItem(draftKey) || ''; } catch { text.value = ''; }
  status.textContent = ''; dialog.querySelector('.cf-history')!.replaceChildren();
  saveButton.disabled = false;
  buildPromise = fetch(new URL('deployment.json', location.href), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  dialog.showModal(); text.focus();
  const login = dialog.querySelector('.cf-login') as HTMLButtonElement;
  login.disabled = true;
  void cloud().then(api => { readyCloud = api; login.disabled = false; if (api.userLabel()) status.textContent = `Signed in as ${api.userLabel()}.`; }).catch(e => { login.disabled = false; status.textContent = (e as Error).message; });
  // Capture a fresh WebGL render in its render callback; no permanent drawing
  // buffer and no continuous screenshot cost during normal gameplay.
  capturePromise = new Promise<void>(resolve => {
    const map = current.map || (current.canvas?.id === 'gameCanvas' ? w.canalRecallGame?.vectorMap?.map : null);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      captured = snapshot(current); preview.src = captured; preview.hidden = !captured;
      dialog.querySelector('.cf-anchor')!.textContent = captured ? 'Tap the image to mark the spot you mean (optional).' : 'Page and view context will be included.';
      resolve();
    };
    if (map?.isStyleLoaded?.()) { map.once('render', finish); map.triggerRepaint(); setTimeout(finish, 2000); }
    else finish();
  });
}
function close() {
  if (saving) return;
  dialog.close();
}
dialog.addEventListener('close', () => {
  if (frozenGame) { frozenGame._feedbackOpen = false; frozenGame.input.keys = {}; frozenGame.input.justPressed = {}; frozenGame = null; }
  previousFocus?.focus();
});
dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
// Keep shortcuts on modal buttons out of the game's window listeners.
for (const event of ['keydown', 'keyup']) dialog.addEventListener(event, e => e.stopPropagation());
dialog.querySelector('.cf-close')!.addEventListener('click', close);
text.addEventListener('input', () => { try { localStorage.setItem(draftKey, text.value); } catch { /* local storage unavailable */ } });
preview.addEventListener('click', e => {
  const r = preview.getBoundingClientRect();
  anchor = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  dialog.querySelector('.cf-anchor')!.textContent = `Marked spot: ${Math.round(anchor.x * 100)}% across, ${Math.round(anchor.y * 100)}% down.`;
});
dialog.querySelector('.cf-login')!.addEventListener('click', async () => {
  try { const api = readyCloud; if (!api) throw new Error('Connection is not ready. Try again.'); await api.signIn(); status.textContent = `Signed in as ${api.userLabel()}.`; }
  catch (e) { status.textContent = `Sign-in failed: ${(e as Error).message}`; }
});
saveButton.addEventListener('click', async () => {
  if (saving || !text.value.trim()) { if (!saving) status.textContent = 'Write a note first.'; return; }
  saving = true; saveButton.disabled = true; text.disabled = true; status.textContent = 'Saving to Firestore…';
  try {
    const api = await cloud();
    const build = await buildPromise;
    await capturePromise;
    await api.save(noteId, {
      text: text.value.trim(), target: { id: current.id.slice(0,2048), label: current.label.slice(0,500), imageUrl: current.image?.currentSrc?.startsWith('http') ? current.image.currentSrc.slice(0,4096) : '', anchor },
      screenshot: captured, context: payload,
      environment: { kind: ['localhost','127.0.0.1','[::1]'].includes(location.hostname) ? 'local-development' : /\.(web\.app|firebaseapp\.com)$/.test(location.hostname) ? 'firebase-hosting' : location.hostname.endsWith('github.io') ? 'github-pages' : 'custom-host', feedbackBuild: __FEEDBACK_BUILD__, host: location.host, origin: location.origin, page: pageUrl(), local: ['localhost','127.0.0.1','[::1]'].includes(location.hostname), userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, capturedAt: new Date().toISOString(), build: build || w.CanalRecallBuild || null },
    });
    try { localStorage.removeItem(draftKey); } catch { /* optional local storage */ }
    text.value = ''; noteId = crypto.randomUUID();
    status.textContent = 'Saved to the feedback queue.';
  } catch (e) { status.textContent = `Not saved: ${(e as Error).message}\nYour draft is still here. Sign in if needed, then retry.`; }
  finally { saving = false; saveButton.disabled = false; text.disabled = false; }
});
dialog.querySelector('.cf-history-button')!.addEventListener('click', async () => {
  try {
    const api = await cloud();
    if (!api.userLabel()) throw new Error('Sign in to see your feedback.');
    const notes = await api.list() as any[];
    const root = dialog.querySelector('.cf-history')!; root.replaceChildren();
    notes.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    for (const n of notes) { const p = document.createElement('p'); p.textContent = `[${n.status}] ${n.target.label}: ${n.text}${n.resolution ? ` — ${n.resolution}` : ''}`; root.append(p); }
    status.textContent = `${notes.length} saved notes${notes.length === 100 ? ' (showing up to 100)' : ''}.`;
  } catch (e) { status.textContent = (e as Error).message; }
});
function attach(container: HTMLElement, target: Target) {
  if (container.querySelector(':scope > .cf-note')) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'cf-button cf-note'; button.textContent = 'Add note';
  button.addEventListener('click', () => open(target)); container.append(button);
}
window.CanalFeedback = { attach, open };
const launch = document.createElement('button'); launch.type = 'button'; launch.className = 'cf-button cf-launch'; launch.textContent = 'Feedback'; launch.addEventListener('click', () => open()); document.body.append(launch);
// Other gallery pages opt in simply by loading this module. Dynamic cards are supported.
function discover() {
  for (const card of document.querySelectorAll<HTMLElement>('article, .card, [data-feedback-id]')) {
    const source = card.querySelector<HTMLCanvasElement | HTMLImageElement>('canvas, img');
    if (!source || card.querySelector(':scope > .cf-note')) continue;
    const label = card.querySelector('h2, h3, b')?.textContent?.trim() || source.getAttribute('alt') || document.title;
    attach(card, { id: card.dataset.feedbackId || card.dataset.kit || source.id || (source instanceof HTMLImageElement ? source.currentSrc : label), label, ...(source instanceof HTMLCanvasElement ? { canvas: source } : { image: source }) });
  }
}
new MutationObserver(records => { if (records.some(r => [...r.addedNodes].some(n => n instanceof HTMLElement))) discover(); }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true }); discover();
