import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { mountLightbox, type LightboxImage } from '../../src/canalRecall/whatsNewLightbox.ts';

// What's New screenshots open in an in-page lightbox (user, 2026-11-22), not a
// new tab. These stories mount the real dialog over a stand-in notes list with
// local images, so they render offline and deterministically.

// A stand-in "screenshot": a 16:10 street row drawn as SVG, so nothing loads from the network.
function shot(wall: string, trim: string, label: string): string {
  const houses = Array.from({ length: 6 }, (_, i) => {
    const x = 40 + i * 150, h = 300 + ((i * 37) % 80);
    return `<rect x="${x}" y="${560 - h}" width="140" height="${h}" fill="${wall}"/><rect x="${x}" y="${552 - h}" width="140" height="10" fill="${trim}"/>`
      + [0, 1, 2].map(r => [0, 1].map(c => `<rect x="${x + 22 + c * 58}" y="${600 - h + r * 80}" width="38" height="56" fill="#2b3a44" stroke="${trim}" stroke-width="4"/>`).join('')).join('');
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><rect width="960" height="600" fill="#9cc3dc"/>${houses}`
    + `<rect y="560" width="960" height="40" fill="#5d6b70"/><text x="24" y="44" font-family="sans-serif" font-size="30" fill="#1d2327">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const BEFORE = shot('#7a5a44', '#7a5a44', 'Before');
const AFTER = shot('#8e4a33', '#f3efe5', 'After');

const SINGLE: LightboxImage[] = [
  { src: BEFORE, alt: 'A canal row at dusk', caption: 'Herengracht from the Leidsegracht bridge, after the roofline pass — the caption can run to two lines on a phone without covering the picture' },
];
const PAIR: LightboxImage[] = [
  { src: BEFORE, alt: 'Before', caption: 'Before: flat brown kit fronts' },
  { src: AFTER, alt: 'After', caption: 'After: measured brick, white cornices and sash windows' },
  { src: BEFORE, alt: 'Wider view', caption: 'Wider view from the bridge' },
];

function Lightbox({ images, index }: { images: LightboxImage[]; index: number }) {
  useEffect(() => {
    const ctl = mountLightbox(document);
    ctl.open(images, index, null);
    return () => ctl.destroy();
  }, [images, index]);
  return (
    <div style={{ padding: 16, font: '15px/1.5 system-ui, sans-serif' }}>
      <b>Roofs and cornices along the Herengracht</b>
      <p>The note text sits behind the lightbox; Esc, the backdrop or × closes it.</p>
    </div>
  );
}

const meta: Meta<typeof Lightbox> = {
  title: 'Canal Drive/What’s New lightbox',
  component: Lightbox,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lightbox>;

export const OpenWithCaption: Story = { args: { images: SINGLE, index: 0 } };
const phone = { viewport: { value: 'mobile2', isRotated: false } };
export const OpenWithCaptionMobile: Story = { args: { images: SINGLE, index: 0 }, globals: phone };
export const MultiImageNote: Story = { args: { images: PAIR, index: 1 } };
export const MultiImageNoteMobile: Story = { args: { images: PAIR, index: 1 }, globals: phone };
