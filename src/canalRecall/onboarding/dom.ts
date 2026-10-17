// Renders the first-run intro (`steps.ts`) as a small enamel dialog over the
// setup screen. Exposed to the legacy page through `CanalRecallUi`:
// `maybeShowOnboarding()` on load, `openOnboarding()` from How to play.

import { readWindowViewport } from '../viewport.ts';
import {
  markOnboardingSeen,
  onboardingSteps,
  shouldShowOnboarding,
  type OnboardingInput,
  type OnboardingSpecimen,
  type OnboardingStep,
} from './steps.ts';

const ROOT_ID = 'onboarding';
const STYLE_ID = 'onboarding-style';

// Tokens come from the page (`--day-*`, `--font-*`); fallbacks keep Storybook
// and a bare page legible.
const CSS = `
#${ROOT_ID}{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  padding:calc(16px + var(--safe-top,0px)) 16px calc(16px + var(--safe-bottom,0px));
  background:rgba(28,24,18,.38);animation:onb-fade .22s ease-out both}
@keyframes onb-fade{from{opacity:0}to{opacity:1}}
#${ROOT_ID} .onb-card{position:relative;width:min(100%,440px);max-height:100%;overflow:auto;
  display:flex;flex-direction:column;gap:10px;padding:44px 22px 16px;
  border:1px solid var(--day-line-strong,#b9ad98);border-radius:14px;background:var(--day-paper,#f4efe5);
  box-shadow:0 18px 48px rgba(31,28,23,.28),0 2px 6px rgba(31,28,23,.12);
  color:var(--day-ink,#1f1c17);font-family:var(--font-ui,system-ui,sans-serif);
  animation:onb-rise .32s cubic-bezier(.16,1,.3,1) both}
@keyframes onb-rise{from{transform:translateY(10px)}to{transform:none}}
@media (prefers-reduced-motion:reduce){#${ROOT_ID},#${ROOT_ID} .onb-card{animation:none}}
#${ROOT_ID} h2{margin:2px 0 0;font:800 24px/1.1 var(--font-plaque,inherit);letter-spacing:.03em;text-transform:uppercase;text-wrap:balance}
#${ROOT_ID} .onb-body{margin:0;font:15px/1.5 var(--font-ui,inherit);max-width:52ch}
#${ROOT_ID} .onb-caption{margin:0;color:var(--day-ink-muted,#5c554a);font:600 13px/1.4 var(--font-ui,inherit)}
#${ROOT_ID} .onb-specimen{display:flex;align-items:center;justify-content:center;min-height:96px;padding:12px;
  border:1px solid var(--day-line,#d8cfbf);border-radius:10px;background:var(--day-paper-raised,#fbf8f2)}
#${ROOT_ID} .onb-keys{display:grid;gap:5px;justify-items:center}
#${ROOT_ID} .onb-keyrow{display:flex;gap:5px}
#${ROOT_ID} kbd{display:inline-grid;place-items:center;min-width:34px;height:34px;padding:0 8px;
  border:1px solid var(--day-line-strong,#b9ad98);border-bottom-width:3px;border-radius:6px;
  background:#fff;color:var(--day-ink,#1f1c17);font:700 15px/1 var(--font-mono,ui-monospace,monospace)}
#${ROOT_ID} .onb-ring{width:84px;height:84px;border-radius:50%;border:2px solid var(--day-line-strong,#b9ad98);
  background:radial-gradient(circle at 50% 50%,var(--day-line,#d8cfbf) 0 17px,transparent 18px),rgba(255,255,255,.7);
  position:relative}
#${ROOT_ID} .onb-ring::after{content:"";position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-36px 0 0 2px;
  border-radius:50%;background:var(--day-accent,#c8834a);opacity:.75;box-shadow:0 2px 6px rgba(31,28,23,.25)}
#${ROOT_ID} .onb-question{display:grid;gap:8px;width:min(100%,260px)}
#${ROOT_ID} .onb-plaque{padding:6px 10px;border-radius:8px;background:#fff;box-shadow:0 1px 4px rgba(31,28,23,.16);
  font:800 18px/1 var(--font-plaque,inherit);letter-spacing:.12em}
#${ROOT_ID} .onb-choices{display:grid;grid-template-columns:1fr 1fr;gap:5px}
#${ROOT_ID} .onb-choice{display:flex;align-items:center;gap:6px;height:24px;padding:0 6px;border:1px solid var(--day-line,#d8cfbf);border-radius:5px;background:#fff}
#${ROOT_ID} .onb-choice span{font:700 10px/1 var(--font-mono,monospace);color:var(--day-ink-muted,#5c554a)}
#${ROOT_ID} .onb-choice i{flex:1;height:6px;border-radius:3px;background:var(--day-line,#d8cfbf)}
#${ROOT_ID} .onb-tally{padding:8px 12px;border-radius:8px;background:#fff;box-shadow:0 1px 4px rgba(31,28,23,.16);
  font:700 16px/1 var(--font-mono,ui-monospace,monospace)}
#${ROOT_ID} .onb-foot{display:flex;align-items:center;gap:8px;margin-top:4px}
#${ROOT_ID} .onb-dots{display:flex;gap:6px;margin:0 auto 0 0;padding:0;list-style:none}
#${ROOT_ID} .onb-dots li{width:8px;height:8px;border-radius:50%;background:var(--day-line-strong,#b9ad98)}
#${ROOT_ID} .onb-dots li[aria-current="step"]{background:var(--day-accent-ink,#8a4a1c);width:20px;border-radius:4px}
#${ROOT_ID} .onb-foot button{min-height:44px;padding:0 14px;border-radius:8px;cursor:pointer;font:700 14px/1 var(--font-plaque,inherit);letter-spacing:.06em;text-transform:uppercase}
#${ROOT_ID} .onb-quiet{border:1px solid transparent;background:transparent;color:var(--day-ink-muted,#5c554a)}
#${ROOT_ID} .onb-quiet:hover{color:var(--day-ink,#1f1c17);border-color:var(--day-line,#d8cfbf)}
#${ROOT_ID} .onb-next{min-width:112px}
#${ROOT_ID} button:focus-visible{outline:2px solid var(--day-accent-ink,#8a4a1c);outline-offset:2px}
#${ROOT_ID} .onb-close{position:absolute;top:8px;right:8px;width:36px;height:36px;display:grid;place-items:center;
  border:0;border-radius:8px;background:transparent;color:var(--day-ink-muted,#5c554a);cursor:pointer}
#${ROOT_ID} .onb-close:hover{background:rgba(31,28,23,.06);color:var(--day-ink,#1f1c17)}
#${ROOT_ID} .onb-close svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
@media (max-width:480px){
  #${ROOT_ID}{align-items:flex-end}
  #${ROOT_ID} .onb-card{padding:44px 16px 12px}
  #${ROOT_ID} h2{font-size:22px}
}
`;

export interface OnboardingOptions {
  doc?: Document;
  win?: Window;
  /** Override the detected input (Storybook, tests). */
  input?: OnboardingInput;
  /** Zero-based step to open on. */
  startAt?: number;
  /** Called once when the intro closes, however it closed. */
  onClose?: (how: 'done' | 'skip') => void;
}

function detectInput(win: Window): OnboardingInput {
  try {
    return readWindowViewport(win).touch ? 'touch' : 'keyboard';
  } catch {
    return 'keyboard';
  }
}

function storageOf(win: Window): Storage | null {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderSpecimen(doc: Document, specimen: OnboardingSpecimen): HTMLElement {
  const box = el(doc, 'div', 'onb-specimen');
  box.setAttribute('aria-hidden', 'true');
  if (specimen.kind === 'keys') {
    const keys = el(doc, 'div', 'onb-keys');
    for (const row of specimen.keys) {
      const line = el(doc, 'div', 'onb-keyrow');
      for (const key of row) line.append(el(doc, 'kbd', undefined, key));
      keys.append(line);
    }
    box.append(keys);
  } else if (specimen.kind === 'ring') {
    box.append(el(doc, 'div', 'onb-ring'));
  } else if (specimen.kind === 'question') {
    const q = el(doc, 'div', 'onb-question');
    q.append(el(doc, 'div', 'onb-plaque', specimen.plaque));
    const choices = el(doc, 'div', 'onb-choices');
    for (const key of specimen.choices) {
      const choice = el(doc, 'div', 'onb-choice');
      choice.append(el(doc, 'span', undefined, key), el(doc, 'i'));
      choices.append(choice);
    }
    q.append(choices);
    box.append(q);
  } else {
    box.append(el(doc, 'div', 'onb-tally', specimen.tally));
  }
  return box;
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

/** Open the intro. Returns a function that closes it. Opening while it is
 *  already open jumps to `startAt`. */
export function openOnboarding(options: OnboardingOptions = {}): () => void {
  const win = options.win ?? window;
  const doc = options.doc ?? win.document;
  doc.getElementById(ROOT_ID)?.remove();
  ensureStyle(doc);

  const steps: OnboardingStep[] = onboardingSteps(options.input ?? detectInput(win));
  let index = Math.max(0, Math.min(steps.length - 1, options.startAt ?? 0));
  const opener = doc.activeElement as HTMLElement | null;

  const root = el(doc, 'div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'onboarding-title');
  root.setAttribute('aria-describedby', 'onboarding-body');
  const card = el(doc, 'div', 'onb-card');
  const close = el(doc, 'button', 'onb-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the intro');
  close.dataset.onboarding = 'close';
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const specimenSlot = el(doc, 'div');
  const title = el(doc, 'h2');
  title.id = 'onboarding-title';
  const body = el(doc, 'p', 'onb-body');
  body.id = 'onboarding-body';
  const caption = el(doc, 'p', 'onb-caption');
  caption.dataset.onboarding = 'hint';
  const foot = el(doc, 'div', 'onb-foot');
  const dots = el(doc, 'ol', 'onb-dots');
  const skip = el(doc, 'button', 'onb-quiet', 'Skip');
  skip.type = 'button';
  skip.dataset.onboarding = 'skip';
  const back = el(doc, 'button', 'onb-quiet', 'Back');
  back.type = 'button';
  back.dataset.onboarding = 'back';
  const next = el(doc, 'button', 'onb-next enamel-plaque enamel-framed enamel-start');
  next.type = 'button';
  next.dataset.onboarding = 'next';
  foot.append(dots, skip, back, next);
  card.append(close, specimenSlot, title, body, caption, foot);
  root.append(card);

  let closed = false;
  const finish = (how: 'done' | 'skip') => {
    if (closed) return;
    closed = true;
    markOnboardingSeen(storageOf(win));
    root.remove();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    options.onClose?.(how);
  };

  const render = () => {
    const step = steps[index]!;
    root.dataset.step = step.id;
    specimenSlot.replaceChildren(renderSpecimen(doc, step.specimen));
    title.textContent = step.title;
    body.textContent = step.body;
    caption.textContent = step.specimen.caption;
    dots.setAttribute('aria-label', `Step ${index + 1} of ${steps.length}`);
    dots.replaceChildren(...steps.map((_, i) => {
      const dot = el(doc, 'li');
      if (i === index) dot.setAttribute('aria-current', 'step');
      return dot;
    }));
    const last = index === steps.length - 1;
    back.hidden = index === 0;
    skip.hidden = last;
    next.textContent = last ? 'Got it' : 'Next';
  };

  const go = (delta: number) => {
    const target = index + delta;
    if (target >= steps.length) { finish('done'); return; }
    if (target < 0) return;
    index = target;
    render();
    next.focus();
  };

  next.addEventListener('click', () => go(1));
  back.addEventListener('click', () => go(-1));
  skip.addEventListener('click', () => finish('skip'));
  close.addEventListener('click', () => finish('skip'));
  // A tap on the dimmed backdrop is a dismissal, as on the other panels.
  root.addEventListener('click', event => { if (event.target === root) finish('skip'); });
  // The game listens for keys on window; while the intro is up its keys are
  // the intro's (G would open settings behind it, 1–4 would answer nothing).
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); finish('skip'); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    else if (event.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusable = [...card.querySelectorAll<HTMLButtonElement>('button')].filter(b => !b.hidden);
      const first = focusable[0];
      const lastButton = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); lastButton?.focus(); }
      else if (!event.shiftKey && doc.activeElement === lastButton) { event.preventDefault(); first?.focus(); }
    }
  });
  root.addEventListener('keyup', event => event.stopPropagation());

  render();
  doc.body.append(root);
  next.focus();
  return () => finish('skip');
}

/** Show the intro on a first visit only. Returns whether it opened. */
export function maybeShowOnboarding(options: OnboardingOptions = {}): boolean {
  const win = options.win ?? window;
  // Storybook frames and the screenshot harness stage their own states.
  if (/[?&]storybook=/.test(win.location?.search ?? '')) return false;
  // Automated runs boot on empty storage every time, and the intro would sit
  // over every setup click in the e2e suite. A test that wants it sets
  // `window.__canalRecallOnboarding = true` before load.
  const forced = (win as Window & { __canalRecallOnboarding?: boolean }).__canalRecallOnboarding;
  if (forced === false) return false;
  if (win.navigator?.webdriver && forced !== true) return false;
  if (!shouldShowOnboarding(storageOf(win))) return false;
  openOnboarding(options);
  return true;
}

export function isOnboardingOpen(doc: Document = document): boolean {
  return !!doc.getElementById(ROOT_ID);
}
