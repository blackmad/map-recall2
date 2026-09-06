import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  drawLargeLetterPostcard,
  measureLargeLetterPostcard,
  type LargeLetterPostcardProps,
} from '../../src/canalRecall/largeLetterPostcard.ts';

/** Procedural stand-ins so Storybook never hits Wikimedia CORS. */
function makeFixture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx, width, height);
  return canvas;
}

const canalFixture = () => makeFixture(800, 500, (ctx, w, h) => {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#7eb6d9');
  sky.addColorStop(1, '#cfe6f4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f6f4e';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = '#1f4d8c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.quadraticCurveTo(w * 0.35, h * 0.48, w * 0.7, h * 0.64);
  ctx.quadraticCurveTo(w * 0.85, h * 0.7, w, h * 0.58);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c43d35';
  for (let i = 0; i < 6; i++) {
    const x = 60 + i * 120;
    ctx.fillRect(x, h * 0.42, 36, h * 0.2);
    ctx.fillStyle = '#f2e6c9';
    ctx.fillRect(x + 8, h * 0.48, 8, 10);
    ctx.fillRect(x + 20, h * 0.48, 8, 10);
    ctx.fillStyle = '#c43d35';
  }
});

const bridgeFixture = () => makeFixture(800, 500, (ctx, w, h) => {
  ctx.fillStyle = '#d8c4a0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5b7c99';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(40, h * 0.55);
  ctx.quadraticCurveTo(w / 2, h * 0.2, w - 40, h * 0.55);
  ctx.stroke();
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();
});

const parkFixture = () => makeFixture(800, 500, (ctx, w, h) => {
  ctx.fillStyle = '#8fbf6a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3d6b2f';
  for (let i = 0; i < 18; i++) {
    const x = (i * 97) % w;
    const y = (i * 53) % h;
    ctx.beginPath();
    ctx.arc(x, y, 28 + (i % 5) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f0f4e8';
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h * 0.6, 90, 40, 0, 0, Math.PI * 2);
  ctx.fill();
});

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Pacifico&display=swap';

function ensureFontsLinked(): void {
  if (document.querySelector(`link[data-large-letter-fonts]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  link.dataset.largeLetterFonts = '1';
  document.head.appendChild(link);
}

type HostProps = LargeLetterPostcardProps & {
  fixtures?: 'none' | 'one' | 'many';
  frameWidth?: number;
};

function LargeLetterHost({
  fixtures = 'one',
  frameWidth = 640,
  name,
  cityName,
  provinceCaption,
  greeting,
}: HostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureFontsLinked();
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.load('800 64px "Barlow Condensed"');
        await document.fonts.load('400 32px "Pacifico"');
      } catch {
        // System fallbacks still paint.
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const images =
      fixtures === 'none' ? []
        : fixtures === 'one' ? [canalFixture()]
          : [canalFixture(), bridgeFixture(), parkFixture()];
    const measure = (text: string, font: string) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return text.length * 12;
      ctx.font = font;
      return ctx.measureText(text).width;
    };
    const layout = measureLargeLetterPostcard(
      { name, cityName, provinceCaption, greeting, imageCount: images.length },
      measure,
    );
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, layout.width, layout.height);
    drawLargeLetterPostcard(ctx, layout, images);
  }, [ready, fixtures, name, cityName, provinceCaption, greeting]);

  const scale = Math.min(1, frameWidth / 640);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(160deg, #1a2433 0%, #3a2f28 100%)',
      padding: 24,
      boxSizing: 'border-box',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: 640 * scale,
          height: 400 * scale,
          maxWidth: '100%',
          boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
          borderRadius: 10,
        }}
      />
    </div>
  );
}

const meta: Meta<typeof LargeLetterHost> = {
  title: 'Canal Drive/Large Letter Postcard',
  component: LargeLetterHost,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LargeLetterHost>;

export const PhotoSpan: Story = {
  args: {
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    fixtures: 'one',
  },
};

export const MultiImageStrips: Story = {
  args: {
    name: 'Centrum',
    cityName: 'Amsterdam',
    fixtures: 'many',
  },
};

export const NoImageFallback: Story = {
  args: {
    name: 'De Pijp',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    fixtures: 'none',
  },
};

export const LongName: Story = {
  args: {
    name: 'Sloterdijk-Centrum',
    cityName: 'Amsterdam',
    fixtures: 'one',
  },
};

export const Grachtengordel: Story = {
  args: {
    name: 'Grachtengordel',
    cityName: 'Amsterdam',
    fixtures: 'one',
  },
};

export const PhoneWidth: Story = {
  args: {
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    fixtures: 'one',
    frameWidth: 360,
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
