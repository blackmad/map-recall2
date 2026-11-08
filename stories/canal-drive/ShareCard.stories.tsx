import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { renderShareCard, SHARE_CARD_H, SHARE_CARD_W, type ShareCardInput } from '../../src/canalRecall/shareCard.ts';

// G6 (#276): the share card a finished ride offers. The route is a real-shaped
// ride (Fo Guang Shan temple to the Portuguese Synagogue, world px, y down).
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
const ROUTE = [
  [80, -5910], [150, -5884], [260, -5790], [300, -5600], [420, -5520], [470, -5300], [455, -5120], [560, -5000],
  [700, -4980], [760, -4820], [740, -4600], [850, -4480], [900, -4300], [1010, -4180], [1040, -4000], [1097, -3860],
].map(([x, y]) => ({ x, y }));
const SILVER = { label: 'SILVER RIBBON', color: '#4f5864', dim: 'rgba(79,88,100,.12)' };
const BASE: ShareCardInput = { route: ROUTE, destination: 'Portugese Synagoge', distanceM: 2410, timeS: 372, ribbon: SILVER, modeLabel: 'By bike' };

function useFonts(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS}"]`)) {
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS }));
    }
    const fonts = document.fonts;
    Promise.all([fonts.load('800 72px "Barlow Condensed"'), fonts.load('700 32px "JetBrains Mono"')])
      .catch(() => undefined).then(() => setReady(true));
  }, []);
  return ready;
}

/** The card at `scale` of its 1200×630 size; scale 'fit' fills the frame's width. */
function ShareCardHost({ input, scale = 'fit', shareAction = false }: { input: ShareCardInput; scale?: number | 'fit'; shareAction?: boolean }) {
  const ready = useFonts();
  const host = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [texts, setTexts] = useState<string[]>([]);
  useEffect(() => {
    if (!ready || !host.current) return;
    const { canvas, layout } = renderShareCard(input, (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
    canvas.style.width = scale === 'fit' ? '100%' : `${SHARE_CARD_W * scale}px`;
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    canvas.style.boxShadow = '0 6px 18px rgba(0,0,0,.18)';
    canvas.dataset.testid = 'share-card';
    host.current.replaceChildren(canvas);
    setTexts(layout.texts.map(t => t.text));
    if (shareAction) setUrl(canvas.toDataURL('image/png'));
  }, [ready, input, scale, shareAction]);
  return (
    <div style={{ padding: 16, background: '#e9e2d4', minHeight: '100vh', boxSizing: 'border-box', font: '15px system-ui, sans-serif', color: '#1f1c17' }}>
      <div ref={host} style={{ maxWidth: scale === 'fit' ? SHARE_CARD_W : undefined }} />
      {shareAction && (
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={url} download="ride-amsterdam-portugese-synagoge.png" style={{ padding: '12px 18px', minHeight: 44, boxSizing: 'border-box', borderRadius: 8, background: '#1f1c17', color: '#fbf6ea', textDecoration: 'none', fontWeight: 700 }}>Share this route</a>
          <span style={{ color: '#6b5f4f' }}>The system share sheet where it takes files; elsewhere the picture is saved and the link copied.</span>
        </div>
      )}
      <p style={{ color: '#6b5f4f', fontSize: 13 }} data-testid="share-card-texts">{SHARE_CARD_W}×{SHARE_CARD_H} · drawn: {texts.join(' | ')}</p>
    </div>
  );
}

const meta = {
  title: 'Canal Recall/Share card',
  component: ShareCardHost,
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta<typeof ShareCardHost>;
export default meta;
type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'mobile2', isRotated: false } };

export const Card: Story = { args: { input: BASE } };
export const CardPhone: Story = { args: { input: BASE }, globals: phone };
/** The size a chat preview shows it: 300×158. */
export const CardAtQuarterScale: Story = { args: { input: BASE, scale: 0.25 } };
export const CardAtQuarterScalePhone: Story = { args: { input: BASE, scale: 0.25 }, globals: phone };
export const LongNameGoldRibbon: Story = {
  args: { input: { ...BASE, destination: 'Stedelijk Museum Amsterdam aan het Museumplein', ribbon: { label: 'GOLD RIBBON', color: '#7a5d0f', dim: 'rgba(196,150,30,.16)' }, distanceM: 11_840, timeS: 3725 } },
};
export const CalmNoRibbonBoat: Story = { args: { input: { ...BASE, ribbon: null, modeLabel: 'By boat', destination: 'Westerkerk' } } };
/** A destination naming the open question's answer: a neutral place stands in. */
export const HiddenNameDestination: Story = {
  args: { input: { ...BASE, destination: 'Jonas Daniël Meijerplein', hiddenNames: ['Jonas Daniël Meijerplein'] } },
};
export const DutchLabels: Story = {
  args: { input: { ...BASE, modeLabel: 'Per fiets', labels: { arrived: 'BESTEMMING', distance: 'AFSTAND', time: 'TIJD' } } },
};
export const ShareAction: Story = { args: { input: BASE, shareAction: true } };
export const ShareActionPhone: Story = { args: { input: BASE, shareAction: true }, globals: phone };
