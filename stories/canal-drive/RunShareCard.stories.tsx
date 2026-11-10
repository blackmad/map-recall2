import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { renderRunShareCard, type RunShareInput, type RunShareStop } from '../../src/canalRecall/runShareCard.ts';
import { SHARE_CARD_H, SHARE_CARD_W } from '../../src/canalRecall/shareCard.ts';

// #295: the run card's share picture, one 1200×630 card for a whole chained
// run in the arrival share's language (Share card stories). The legs are
// real-shaped dog-legs between real stops, [lat, lng].
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';

const PLACES: Array<[string, number, number, string]> = [
  ['Westerkerk', 52.3746, 4.8840, 'Grachtengordel-West'],
  ['Rijksmuseum', 52.3600, 4.8852, 'Museumkwartier'],
  ['Heineken Experience', 52.3579, 4.8918, 'De Pijp'],
  ['Hortus Botanicus', 52.3667, 4.9080, 'Plantage'],
  ['Het Scheepvaartmuseum', 52.3717, 4.9152, 'Oostelijke Eilanden'],
  ['Centraal Station', 52.3791, 4.9003, 'Burgwallen-Oude Zijde'],
];

/** `count` stops, cycling the places; each leg bends once, as a street ride does. */
function stops(count: number, area?: string): RunShareStop[] {
  let prev: [number, number] = [52.3786, 4.8862];
  return Array.from({ length: count }, (_, i) => {
    const [name, lat0, lng0, buurt] = PLACES[i % PLACES.length];
    const lat = lat0 + Math.floor(i / PLACES.length) * 0.004, lng = lng0;
    const path: Array<[number, number]> = [prev, [prev[0] + (lat - prev[0]) * 0.3, prev[1]], [prev[0] + (lat - prev[0]) * 0.3, lng], [lat, lng]];
    prev = [lat, lng];
    return { number: i + 1, name, lat, lng, area: area ?? buurt, path };
  });
}
const line = (count: number, names: number, points: number) => `${count} ${count === 1 ? 'stop' : 'stops'}  ·  ${names} names  ·  ${points.toLocaleString('en-US')} points`;
const input = (count: number, extra: Partial<RunShareInput> = {}): RunShareInput => ({
  stops: stops(count), summary: line(count, count * 2 + 1, [0, 200, 410, 630, 860, 1100, 1350][count] ?? count * 230), city: 'Amsterdam', ...extra,
});

function useFonts(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS}"]`)) {
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS }));
    }
    Promise.all([document.fonts.load('800 72px "Barlow Condensed"'), document.fonts.load('700 32px "JetBrains Mono"')])
      .catch(() => undefined).then(() => setReady(true));
  }, []);
  return ready;
}

function RunShareCardHost({ input, scale = 'fit' }: { input: RunShareInput; scale?: number | 'fit' }) {
  const ready = useFonts();
  const host = useRef<HTMLDivElement>(null);
  const [texts, setTexts] = useState<string[]>([]);
  useEffect(() => {
    if (!ready || !host.current) return;
    const { canvas, layout } = renderRunShareCard(input, (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
    canvas.style.width = scale === 'fit' ? '100%' : `${SHARE_CARD_W * scale}px`;
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    canvas.style.boxShadow = '0 6px 18px rgba(0,0,0,.18)';
    canvas.dataset.testid = 'run-share-card';
    host.current.replaceChildren(canvas);
    setTexts(layout.texts.filter(t => t.role !== 'dot' && t.role !== 'stopNumber').map(t => t.text));
  }, [ready, input, scale]);
  return (
    <div style={{ padding: 16, background: '#e9e2d4', minHeight: '100vh', boxSizing: 'border-box', font: '15px system-ui, sans-serif', color: '#1f1c17' }}>
      <div ref={host} style={{ maxWidth: scale === 'fit' ? SHARE_CARD_W : undefined }} />
      <p style={{ color: '#6b5f4f', fontSize: 13 }} data-testid="run-share-card-texts">{SHARE_CARD_W}×{SHARE_CARD_H} · drawn: {texts.join(' | ')}</p>
    </div>
  );
}

const meta = {
  title: 'Canal Recall/Run share card',
  component: RunShareCardHost,
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta<typeof RunShareCardHost>;
export default meta;
type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'mobile2', isRotated: false } };
const LONG_BUURT = 'Burgwallen-Oude Zijde en de Nieuwmarkt rond de Waag';

export const OneStop: Story = { args: { input: input(1, { stops: stops(1, 'Grachtengordel-West') }) } };
export const ThreeStops: Story = { args: { input: input(3) } };
export const ThreeStopsPhone: Story = { args: { input: input(3) }, globals: phone };
/** The size a chat preview shows it: 300×158. */
export const ThreeStopsAtQuarterScale: Story = { args: { input: input(3), scale: 0.25 } };
export const SixStops: Story = { args: { input: input(6) } };
export const SixStopsPhone: Story = { args: { input: input(6) }, globals: phone };
/** Twelve stops: the earliest give way to "+N earlier"; every dot stays on the map. */
export const TwelveStops: Story = { args: { input: input(12) } };
/** Every stop in one buurt with a long name: the title takes two lines and the list still fits. */
export const LongBuurt: Story = { args: { input: input(3, { stops: stops(3, LONG_BUURT) }) } };
export const LongBuurtPhone: Story = { args: { input: input(3, { stops: stops(3, LONG_BUURT) }) }, globals: phone };
export const LongBuurtSixStops: Story = { args: { input: input(6, { stops: stops(6, LONG_BUURT) }) } };
/** The open question's answer is stop 2: it reads "Stop 2", drawn nowhere. */
export const HiddenStopName: Story = { args: { input: input(3, { hiddenNames: ['Rijksmuseum'] }) } };
/** Calm mode: the run line has no points. */
export const Calm: Story = { args: { input: input(3, { summary: '3 stops  ·  7 names' }) } };
/** A run saved before #295 kept no legs: the numbered list, an empty plate. */
export const NoGeometry: Story = { args: { input: input(3, { stops: stops(3).map(({ number, name }) => ({ number, name })) }) } };
export const DutchLabels: Story = {
  args: { input: input(3, { summary: '3 stops  ·  7 namen  ·  630 punten', labels: { run: 'REEKS', stop: 'Stop {n}', earlier: '+{count} eerder' } }) },
};
