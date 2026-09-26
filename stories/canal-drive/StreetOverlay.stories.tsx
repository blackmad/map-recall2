import { useEffect, useMemo, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  stitchOverlayPaths,
  streetOverlayLayers,
  type OverlayPoint,
} from '../../src/canalRecall/streetOverlayStyle';

type FixtureName = 'single' | 'connected' | 'duplicates' | 'disjoint';

const ORIGIN = { lng: 4.8788, lat: 52.3698 };
const METRES_PER_DEGREE_LAT = 111_320;
const METRES_PER_DEGREE_LNG = METRES_PER_DEGREE_LAT * Math.cos(ORIGIN.lat * Math.PI / 180);

const fixtures: Record<FixtureName, OverlayPoint[][]> = {
  single: [[
    { x: -170, y: -36 }, { x: -75, y: -12 }, { x: 10, y: 18 }, { x: 170, y: 58 },
  ]],
  connected: [
    [{ x: -170, y: -36 }, { x: -75, y: -12 }],
    [{ x: -75, y: -12 }, { x: 10, y: 18 }],
    [{ x: 170, y: 58 }, { x: 10, y: 18 }],
  ],
  duplicates: [
    [{ x: -170, y: -36 }, { x: -75, y: -12 }],
    [{ x: -75, y: -12 }, { x: -170, y: -36 }],
    [{ x: -75, y: -12 }, { x: 10, y: 18 }],
    [{ x: 170, y: 58 }, { x: 10, y: 18 }],
    [{ x: 10, y: 18 }, { x: 170, y: 58 }],
  ],
  disjoint: [
    [{ x: -170, y: -36 }, { x: -75, y: -12 }, { x: 10, y: 18 }],
    [{ x: 70, y: 70 }, { x: 150, y: 92 }],
  ],
};

const fixtureCopy: Record<FixtureName, { title: string; expectation: string }> = {
  single: {
    title: 'Single source segment',
    expectation: 'One source segment · one visible centreline',
  },
  connected: {
    title: 'Connected OSM segments',
    expectation: 'Three touching source segments · one visible centreline',
  },
  duplicates: {
    title: 'Duplicate and reversed segments',
    expectation: 'Five source paths · duplicates removed · one visible centreline',
  },
  disjoint: {
    title: 'Disconnected same-name segments',
    expectation: 'Disconnected geometry stays separate · no false joining chord',
  },
};

function toLngLat(point: OverlayPoint): [number, number] {
  return [
    ORIGIN.lng + point.x / METRES_PER_DEGREE_LNG,
    ORIGIN.lat + point.y / METRES_PER_DEGREE_LAT,
  ];
}

function rectangle(x: number, y: number, width: number, depth: number) {
  return [
    toLngLat({ x, y }),
    toLngLat({ x: x + width, y }),
    toLngLat({ x: x + width, y: y + depth }),
    toLngLat({ x, y: y + depth }),
    toLngLat({ x, y }),
  ];
}

const buildings = [
  [-185, 15, 48, 52, 22], [-128, 28, 42, 48, 34], [-76, 42, 50, 62, 26],
  [-15, 58, 58, 54, 38], [55, 74, 44, 55, 25], [110, 90, 62, 48, 31],
  [-166, -92, 56, 42, 27], [-98, -75, 48, 40, 36], [-38, -48, 42, 38, 24],
  [32, -28, 54, 43, 33], [98, -9, 68, 48, 28],
].map(([x, y, width, depth, height], index) => ({
  type: 'Feature' as const,
  properties: { height, shade: index % 3 },
  geometry: { type: 'Polygon' as const, coordinates: [rectangle(x, y, width, depth)] },
}));

const style: StyleSpecification = {
  version: 8,
  sources: {
    context: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: fixtures.single[0].map(toLngLat),
            },
          },
        ],
      },
    },
    buildings: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: buildings },
    },
  },
  layers: [
    { id: 'ground', type: 'background', paint: { 'background-color': '#D8D6CD' } },
    {
      id: 'street-bed',
      type: 'line',
      source: 'context',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#F7F5EB', 'line-width': 30 },
    },
    {
      id: 'street-edge',
      type: 'line',
      source: 'context',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#D0B865', 'line-width': 2 },
    },
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'buildings',
      paint: {
        'fill-extrusion-color': [
          'match', ['get', 'shade'], 0, '#A9A59C', 1, '#96928A', '#B9B4AA',
        ],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-opacity': 1,
      },
    },
  ],
  light: {
    anchor: 'viewport',
    color: '#FFF7E5',
    intensity: 0.55,
    position: [1.2, 210, 45],
  },
};

function StreetOverlayWorkbench({ fixture }: { fixture: FixtureName }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const chains = useMemo(() => stitchOverlayPaths(fixtures[fixture]), [fixture]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [ORIGIN.lng, ORIGIN.lat],
      zoom: 17.1,
      pitch: 58,
      bearing: -22,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.addSource('active-street', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: chains.map(points => ({
            type: 'Feature',
            properties: { fixture },
            geometry: { type: 'LineString', coordinates: points.map(toLngLat) },
          })),
        },
      });
      for (const layer of streetOverlayLayers()) {
        map.addLayer(layer as StyleSpecification['layers'][number], 'building-3d');
      }
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [chains, fixture]);

  const copy = fixtureCopy[fixture];
  return (
    <main style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      minHeight: 480,
      overflow: 'hidden',
      background: '#071430',
      fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif',
    }}>
      <div ref={containerRef} aria-label={`${copy.title} map rendering`} style={{ position: 'absolute', inset: 0 }} />
      <section style={{
        position: 'absolute',
        left: 24,
        bottom: 24,
        maxWidth: 'min(440px, calc(100% - 48px))',
        padding: '18px 20px 16px',
        color: '#FFFFFF',
        background: 'rgba(7, 20, 48, 0.92)',
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(7, 20, 48, 0.32)',
      }}>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1, fontWeight: 800 }}>
          {copy.title}
        </h1>
        <p style={{
          margin: '8px 0 0',
          color: 'rgba(255,255,255,0.78)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          lineHeight: 1.45,
        }}>
          {copy.expectation}
        </p>
      </section>
    </main>
  );
}

const meta = {
  title: 'Canal Drive/Map overlays/Active street',
  component: StreetOverlayWorkbench,
  parameters: {
    layout: 'fullscreen',
    options: { showPanel: false },
  },
} satisfies Meta<typeof StreetOverlayWorkbench>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedSegments: Story = { args: { fixture: 'connected' } };
export const DuplicateSegments: Story = { args: { fixture: 'duplicates' } };
export const SingleSegment: Story = { args: { fixture: 'single' } };
export const DisconnectedSegments: Story = { args: { fixture: 'disjoint' } };
