import React, { useEffect, useRef, useState } from 'react';

const WIDTH = 640;
const HEIGHT = 400;
const FONT_FAMILY = 'Archivo Black';
let fontsPromise: Promise<unknown> | null = null;

/** The Archivo Black webfont (index.html links it); the outline TTF lets the compositor trace the letters. */
function loadFonts(): Promise<unknown> {
  fontsPromise ??= document.fonts?.load(`400 64px "${FONT_FAMILY}"`).catch(() => undefined) ?? Promise.resolve();
  return fontsPromise;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * "Greetings from <neighbourhood>": the large-letter postcard (src/canalRecall/largeLetterPostcard.ts)
 * with the area's photographs cut into the letters. Painted on a canvas, so it is loaded on demand;
 * if no photograph loads it renders nothing and the card keeps its small thumbnail.
 */
export const PostcardHeader: React.FC<{ name: string; cityName?: string; photos: string[] }> = ({ name, cityName, photos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);
  const key = `${name}|${photos.join('|')}`;

  useEffect(() => {
    let cancelled = false;
    setPainted(false);
    (async () => {
      const [postcard, , loaded] = await Promise.all([
        import('../canalRecall/largeLetterPostcard'),
        loadFonts(),
        Promise.all(photos.map(loadImage)),
      ]);
      const images = loaded.filter((image): image is HTMLImageElement => !!image);
      const canvas = canvasRef.current;
      if (cancelled || !canvas || !images.length) return;
      let font: Awaited<ReturnType<typeof postcard.loadLargeLetterFont>> | undefined;
      try { font = await postcard.loadLargeLetterFont(`${import.meta.env.BASE_URL}canal-drive/fonts/ArchivoBlack-Regular.ttf`); } catch { /* fillText still paints */ }
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const measure = (text: string, fontSpec: string) => { ctx.font = fontSpec; return ctx.measureText(text).width; };
      const layout = postcard.measureLargeLetterPostcard(
        { name, cityName, imageCount: images.length, width: WIDTH, height: HEIGHT },
        measure,
        font ? { font, pathWarp: true } : undefined,
      );
      canvas.width = layout.width;
      canvas.height = layout.height;
      ctx.clearRect(0, 0, layout.width, layout.height);
      postcard.drawLargeLetterPostcard(ctx, layout, images, font ? { font } : undefined);
      if (!cancelled) setPainted(true);
    })().catch(() => { /* no postcard: the thumbnail stays */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas
    ref={canvasRef}
    width={WIDTH}
    height={HEIGHT}
    data-testid="answer-postcard"
    data-painted={painted ? 'yes' : 'no'}
    role="img"
    aria-label={`Greetings from ${name}`}
    className={painted ? 'w-full rounded-lg shadow-md' : 'hidden'}
  />;
};
