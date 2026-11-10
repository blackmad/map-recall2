import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CATALOGS } from '../../src/i18n/index.ts';
import { drawPauseCard, pauseCardLayout, pauseStatsText, type PauseAction, type PauseActionId } from '../../src/canalRecall/game/pauseCard.ts';

// #319: the pause card ("ugly and uncentered", user 2026-11-09). The game draws
// it on the ride canvas; this harness draws the same layout and paint on a
// canvas of the game's logical size (desktop 1280×800, phone 390×664), so the
// card can be judged without driving to it.
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const FONTS = {
  plaque: '"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif',
  ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", Menlo, Consolas, monospace',
};
const PAINT = { ink: '#1f1c17', muted: '#5f584d', copper: '#c9844a', rule: 'rgba(31,28,23,0.16)', good: '#8a4a18', fontMono: FONTS.mono };

function useFonts(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_CSS}"]`)) {
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS_CSS }));
    }
    Promise.all([document.fonts.load('800 30px "Barlow Condensed"'), document.fonts.load('700 11px "JetBrains Mono"')])
      .catch(() => undefined).then(() => setReady(true));
  }, []);
  return ready;
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

interface PauseCardHostProps {
  lang: 'en' | 'nl';
  compact: boolean;
  freeRide: boolean;
  destination?: string;
  buurt?: string;
  attempts?: number;
  correct?: number;
  share?: boolean;
  copied?: boolean;
  hover?: PauseActionId;
}

function PauseCardHost({ lang, compact, freeRide, destination = 'Westerkerk', buurt = 'Jordaan', attempts = 3, correct = 2, share = true, copied = false, hover }: PauseCardHostProps) {
  const ready = useFonts();
  const ref = useRef<HTMLCanvasElement>(null);
  const [facts, setFacts] = useState('');
  const width = compact ? 390 : 1280, height = compact ? 664 : 800;
  useEffect(() => {
    const canvas = ref.current;
    if (!ready || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A stand-in for the ride under the card: canal blue, street grey, the dim veil.
    ctx.fillStyle = '#9bb7c4'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#d8d2c4';
    for (let x = -40; x < width; x += 160) ctx.fillRect(x, 0, 60, height);
    ctx.fillStyle = 'rgba(28,24,18,0.34)'; ctx.fillRect(0, 0, width, height);

    const c = CATALOGS[lang];
    const tr = (key: 'ride.pauseSummary' | 'ride.pauseStats', vars: Record<string, string | number>) =>
      c[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k]));
    const actions: PauseAction[] = [
      { id: 'resume', key: 'P / ESC', caption: c['ride.resume'] },
      { id: 'route', key: 'M', caption: c['ride.routeSetup'] },
    ];
    if (share) actions.push({ id: 'copy', key: 'C', caption: copied ? c['ride.linkCopied'] : c['ride.shareRoute'] });
    const subtitle = freeRide ? [c['freeRide.badge'], buurt].filter(Boolean).join('  ·  ') : c['hud.toDestination'].replace('{name}', destination);
    const stats = pauseStatsText(tr, { timeS: 693.386, km: 15.97, correct, attempts, freeRide });
    const measure = (text: string, font: string) => { ctx.font = font; return ctx.measureText(text).width; };
    const layout = pauseCardLayout(measure, { title: c['ride.paused'], subtitle, stats, actions }, { width, height, compact }, FONTS);
    const hovered = hover && layout.rows.flatMap(row => row.items.map(item => ({ item, row }))).find(({ item }) => actions[item.index].id === hover);
    drawPauseCard(ctx, layout, actions, {
      ...PAINT,
      paper: rect => {
        ctx.save();
        ctx.shadowColor = 'rgba(31,28,23,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#fbf6ea';
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.restore();
      },
      roundRect,
      doneId: copied ? 'copy' : null,
      mouse: hovered && !compact ? { x: hovered.item.x + 4, y: hovered.row.top + 10 } : null,
    });
    const margins = [layout.title, layout.subtitle, layout.stats].filter(Boolean)
      .map(line => Math.round((line!.x - line!.width / 2 - layout.inner.left) - (layout.inner.right - line!.x - line!.width / 2)));
    const rowMargins = layout.rows.map(row => Math.round((row.x - layout.inner.left) - (layout.inner.right - row.x - row.w)));
    setFacts(`card ${layout.card.w}×${layout.card.h} · rows ${layout.rows.length} · left−right margin per line ${[...margins, ...rowMargins].join(', ')} px · stats "${stats}"`);
  }, [ready, lang, compact, freeRide, destination, buurt, attempts, correct, share, copied, hover, width, height]);
  return (
    <div style={{ padding: 12, background: '#e9e2d4', minHeight: '100vh', boxSizing: 'border-box', font: '13px system-ui, sans-serif', color: '#5f584d' }}>
      <canvas ref={ref} data-testid="pause-card" style={{ width: '100%', maxWidth: width, height: 'auto', aspectRatio: `${width} / ${height}`, display: 'block' }} />
      <p data-testid="pause-card-facts">{facts}</p>
    </div>
  );
}

const meta = {
  title: 'Canal Recall/Pause card',
  component: PauseCardHost,
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta<typeof PauseCardHost>;
export default meta;
type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const QuizRide: Story = { args: { lang: 'en', compact: false, freeRide: false } };
export const QuizRidePhone: Story = { args: { lang: 'en', compact: true, freeRide: false }, globals: phone };
export const FreeRide: Story = { args: { lang: 'en', compact: false, freeRide: true } };
export const FreeRidePhone: Story = { args: { lang: 'en', compact: true, freeRide: true }, globals: phone };
/** Dutch, no question asked yet: no "0 van 0 benoemd". */
export const DutchNoAttempts: Story = { args: { lang: 'nl', compact: false, freeRide: false, attempts: 0, correct: 0 } };
export const DutchNoAttemptsPhone: Story = { args: { lang: 'nl', compact: true, freeRide: false, attempts: 0, correct: 0 }, globals: phone };
/** A long destination is cut at a word rather than widening the card past the window. */
export const LongDestinationLinkCopied: Story = {
  args: { lang: 'nl', compact: false, freeRide: false, destination: 'Stedelijk Museum Amsterdam aan het Museumplein bij de Van Baerlestraat en het Concertgebouw', copied: true },
};
export const LongDestinationLinkCopiedPhone: Story = {
  args: { lang: 'nl', compact: true, freeRide: false, destination: 'Stedelijk Museum Amsterdam aan het Museumplein bij de Van Baerlestraat', copied: true },
  globals: phone,
};
/** The keycap under the mouse (#301): darker cap, ink caption, underline. */
export const HoverRouteSetup: Story = { args: { lang: 'en', compact: false, freeRide: false, hover: 'route' } };
/** No share link (a dealt route without lat-lngs): two actions, still centred. */
export const NoShareLink: Story = { args: { lang: 'en', compact: false, freeRide: true, share: false, buurt: '' } };
export const NoShareLinkPhone: Story = { args: { lang: 'en', compact: true, freeRide: true, share: false, buurt: '' }, globals: phone };
