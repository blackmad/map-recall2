export const STREET_OVERLAY_LAYER_IDS = [
  'active-street-casing',
  'active-street-glow',
  'active-street-line',
] as const;

// Learned streets used to be painted yellow over the basemap. The Liberty
// basemap already draws its road network in yellow, so the overlay read as a
// second, arbitrary highlight on top of it rather than as knowledge. Mastered
// streets still announce themselves — by staying *named* on the map, which is
// the thing worth knowing — so only the street actively under question keeps a
// drawn highlight.
export function streetOverlayLayers(): Array<Record<string, unknown>> {
  const zoomWidth = (low: number, high: number): unknown[] => [
    'interpolate', ['linear'], ['zoom'], 13, low, 18, high,
  ];
  return [
    {
      id: 'active-street-casing', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#071E2B', 'line-width': zoomWidth(5, 16), 'line-opacity': 0.78 },
    },
    {
      id: 'active-street-glow', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#7DD3FC', 'line-width': zoomWidth(5, 14), 'line-opacity': 0.42, 'line-blur': 3 },
    },
    {
      id: 'active-street-line', type: 'line', source: 'active-street',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#38BDF8', 'line-width': zoomWidth(2, 6), 'line-opacity': 0.96 },
    },
  ];
}
