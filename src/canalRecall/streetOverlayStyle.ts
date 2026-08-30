export const STREET_OVERLAY_LAYER_IDS = [
  'learned-streets-casing',
  'learned-streets-line',
  'active-street-casing',
  'active-street-glow',
  'active-street-line',
] as const;

export function streetOverlayLayers(): Array<Record<string, unknown>> {
  const zoomWidth = (low: number, high: number): unknown[] => [
    'interpolate', ['linear'], ['zoom'], 13, low, 18, high,
  ];
  return [
    {
      id: 'learned-streets-casing', type: 'line', source: 'learned-streets',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#352D24', 'line-width': zoomWidth(2.5, 10), 'line-opacity': 0.28 },
    },
    {
      id: 'learned-streets-line', type: 'line', source: 'learned-streets',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#F2B84B', 'line-width': zoomWidth(1.25, 6), 'line-opacity': 0.48 },
    },
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
