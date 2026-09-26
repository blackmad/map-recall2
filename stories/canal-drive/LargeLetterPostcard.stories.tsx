import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  drawLargeLetterPostcard,
  drawWordArtOverlay,
  loadLargeLetterFont,
  measureLargeLetterPostcard,
  type LargeLetterPostcardProps,
  type PostcardStyleId,
} from '../../src/canalRecall/largeLetterPostcard.ts';

import canalUrl from './fixtures/amsterdam-canal.jpg';
import housesUrl from './fixtures/amsterdam-houses.jpg';
import bridgeUrl from './fixtures/amsterdam-bridge.jpg';
import parkUrl from './fixtures/amsterdam-park.jpg';
import anneUrl from './fixtures/amsterdam-anne.jpg';
import westermarktUrl from './fixtures/amsterdam-westermarkt.jpg';
import canalhousesUrl from './fixtures/amsterdam-canalhouses.jpg';
import grachtUrl from './fixtures/amsterdam-gracht.jpg';

const PLACE_TRUE_URLS = [
  canalUrl,
  housesUrl,
  bridgeUrl,
  parkUrl,
  anneUrl,
  westermarktUrl,
  canalhousesUrl,
  grachtUrl,
];

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Pacifico&display=swap';

function ensureFontsLinked(): void {
  if (document.querySelector(`link[data-large-letter-fonts]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  link.dataset.largeLetterFonts = '1';
  document.head.appendChild(link);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

type HostProps = LargeLetterPostcardProps & {
  fixtures?: 'none' | 'one' | 'many';
  frameWidth?: number;
  /** Show only the word-art overlay (transparent letter faces) over a photo. */
  overlayDemo?: boolean;
};

function LargeLetterHost({
  fixtures = 'many',
  frameWidth = 640,
  overlayDemo = false,
  name,
  cityName,
  provinceCaption,
  greeting,
  style,
}: HostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureFontsLinked();
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.load('400 64px "Archivo Black"');
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
    let cancelled = false;
    (async () => {
      const urls =
        fixtures === 'none' ? []
          : fixtures === 'one' ? [PLACE_TRUE_URLS[0]]
            : PLACE_TRUE_URLS.slice(0, 7);
      const images = await Promise.all(urls.map(loadImage));
      if (cancelled) return;
      let otFont = null;
      try {
        otFont = await loadLargeLetterFont('/canal-drive/fonts/ArchivoBlack-Regular.ttf');
      } catch {
        // fillText + CircleType tilt still works without outlines.
      }
      if (cancelled) return;
      const measure = (text: string, font: string) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return text.length * 12;
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      const layout = measureLargeLetterPostcard(
        { name, cityName, provinceCaption, greeting, style, imageCount: images.length },
        measure,
        otFont ? { font: otFont, pathWarp: true } : undefined,
      );
      canvas.width = layout.width;
      canvas.height = layout.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, layout.width, layout.height);
      if (overlayDemo && images[0]) {
        ctx.drawImage(images[0], 0, 0, layout.width, layout.height);
        drawWordArtOverlay(ctx, layout, otFont ? { font: otFont } : undefined);
      } else {
        drawLargeLetterPostcard(ctx, layout, images, otFont ? { font: otFont } : undefined);
      }
    })().catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, [ready, fixtures, name, cityName, provinceCaption, greeting, style, overlayDemo]);

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
        data-testid="large-letter-canvas"
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

/** Default: one distinct photo window per letter. */
export const PerLetterPhotos: Story = {
  args: {
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    fixtures: 'many',
  },
};

/** Single image — still pans a different crop into each glyph. */
export const SingleImagePanned: Story = {
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

/** Word-art overlay alone over a full-bleed photo (transparent letter faces). */
export const OverlayOnPhoto: Story = {
  args: {
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    fixtures: 'one',
    overlayDemo: true,
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

/** Gallery presets — same name/photos, different recipes. */
export const StyleLinenArch: Story = {
  args: {
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'linen-arch' satisfies PostcardStyleId,
    fixtures: 'many',
  },
};

export const StyleFlatBlock: Story = {
  args: {
    name: 'Noord',
    cityName: 'Amsterdam',
    style: 'flat-block',
    fixtures: 'many',
  },
};

export const StyleRiseCoastal: Story = {
  args: {
    name: 'IJburg',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'rise-coastal',
    fixtures: 'many',
  },
};

export const StyleDesertWarm: Story = {
  args: {
    name: 'Oud-West',
    cityName: 'Amsterdam',
    style: 'desert-warm',
    fixtures: 'many',
  },
};
