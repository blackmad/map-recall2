import React, { useEffect, useState } from 'react';
import { StreetFeature } from '../types';

export const LookAroundLink: React.FC<{ feature: StreetFeature }> = ({ feature }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lat, lon] = feature.center;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY as string | undefined;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
  const embedUrl = apiKey
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(apiKey)}&location=${lat},${lon}&fov=80&pitch=0`
    : null;

  useEffect(() => setIsOpen(false), [feature.id]);

  if (embedUrl) return (
    <div className="overflow-hidden rounded-xl border border-sky-500/30 bg-slate-950/70">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-500/20"
        aria-expanded={isOpen}
      >
        <span>{isOpen ? 'Hide Street View' : 'Look around this place'}</span>
        <span aria-hidden="true">360° {isOpen ? '▴' : '▾'}</span>
      </button>
      {isOpen && (
        <iframe
          title={`Street View near ${feature.name}`}
          src={embedUrl}
          className="h-56 w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );

  return (
    <a
      href={streetViewUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200 transition hover:border-sky-300 hover:bg-sky-500/20"
    >
      <span>Open Street View</span>
      <span aria-hidden="true">360° ↗</span>
    </a>
  );
};
