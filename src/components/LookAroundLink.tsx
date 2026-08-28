import React from 'react';
import { StreetFeature } from '../types';

export const LookAroundLink: React.FC<{ feature: StreetFeature }> = ({ feature }) => {
  const [lat, lon] = feature.center;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
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
