import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { preparePostcard, type PreparedPostcard } from '../mapRecall/livePostcard';

/** The painted-photo SVG filter the letter photographs reference by id, added to the page once. */
function ensurePaintFilter(filterSvg: string): void {
  if (typeof document === 'undefined' || document.getElementById('large-letter-paint-defs')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'large-letter-paint-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs>${filterSvg}</defs>`;
  document.body.appendChild(svg);
}

/**
 * "Greetings from <neighbourhood>": the large-letter postcard with the area's photographs in its
 * letters (src/mapRecall/livePostcard.ts). The card is a canvas with transparent letter faces over
 * plain images, so it appears as soon as its frame is ready (prepared during the guess) and each
 * letter fills in when its photograph loads. Scales to its container's width; renders nothing when
 * the compositor cannot load, and the answer card keeps its thumbnail.
 */
export const PostcardHeader: React.FC<{
  name: string;
  cityName?: string;
  photos: string[];
  className?: string;
  /** The folded answer card's small copy. */
  thumbnail?: boolean;
}> = ({ name, cityName, photos, className, thumbnail = false }) => {
  const [card, setCard] = useState<PreparedPostcard | null>(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);
  const key = `${name}|${cityName ?? ''}|${photos.join('|')}`;

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setLoaded(0);
    void preparePostcard(name, cityName, photos).then((prepared) => { if (!cancelled) setCard(prepared); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Copy the shared frame into this card's own canvas, and again when it is repainted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!card || !canvas) return;
    const copy = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(card.frame, 0, 0);
    };
    copy();
    ensurePaintFilter(card.paintFilterSvg);
    grainRef.current?.getContext('2d')?.drawImage(card.grain, 0, 0);
    return card.onRepaint(copy);
  }, [card]);

  useLayoutEffect(() => {
    const holder = holderRef.current;
    if (!holder || !card) return;
    const fit = () => setScale(holder.clientWidth / card.width);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(holder);
    return () => observer.disconnect();
  }, [card]);

  if (!card) return null;
  const { windows, width, height } = card;
  const { clip } = windows;
  return <div
    ref={holderRef}
    data-testid={thumbnail ? 'answer-postcard-thumbnail' : 'answer-postcard'}
    data-painted="yes"
    data-photos={`${loaded}/${windows.windows.length}`}
    role="img"
    aria-label={`Greetings from ${name}`}
    className={`relative overflow-hidden ${className ?? (thumbnail ? 'rounded-md shadow-sm' : 'w-full rounded-lg shadow-md')}`}
    style={{ aspectRatio: `${width} / ${height}` }}
  >
    <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
      <div
        className="absolute inset-0"
        style={{ background: windows.fallbackFill, clipPath: `inset(${clip.y}px ${width - clip.x - clip.width}px ${height - clip.y - clip.height}px ${clip.x}px)` }}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `matrix(${windows.matrix.join(',')})` }}>
          {windows.windows.map((window, index) => {
            const src = card.photos[window.imageIndex];
            if (!src) return null;
            return <img
              key={index}
              src={src}
              alt=""
              referrerPolicy="no-referrer"
              decoding="async"
              draggable={false}
              onLoad={(event) => { event.currentTarget.style.opacity = '1'; setLoaded((count) => count + 1); }}
              className="absolute max-w-none select-none transition-opacity duration-300"
              style={{
                left: window.box.x,
                top: window.box.y,
                width: window.box.width,
                height: window.box.height,
                objectFit: 'cover',
                objectPosition: `${window.focusX * 100}% ${window.focusY * 100}%`,
                clipPath: `path('${window.d}')`,
                filter: windows.filter,
                opacity: 0,
              }}
            />;
          })}
        </div>
      </div>
      <canvas ref={canvasRef} width={width} height={height} className="absolute inset-0" style={{ width, height }} />
      {/* Print grain over everything, photographs included (the recipe's overlay noise). */}
      <canvas ref={grainRef} width={width} height={height} aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ width, height, mixBlendMode: 'overlay', opacity: 0.35 }} />
    </div>
  </div>;
};
