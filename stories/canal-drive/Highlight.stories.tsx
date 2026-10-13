import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as THREE from 'three';
import {
  applyMeshHighlight, highlightAccent, withinDesaturation, type HighlightStyle,
} from '../../src/canalRecall/look/highlight';
import { HighlightMarker } from '../../src/canalRecall/look/highlightMarker';

/**
 * The landmark highlight (default a; `?highlight=yellow|b|c`, src/canalRecall/look/highlight.ts) on a deterministic
 * canal row: the real pass materials, material variants and ground ring / beacon, outside MapLibre. One house is the
 * destination; the card sits at the bottom, compact, as in the game. `far` puts the chase camera ~250 m out, where
 * the outline widens (outlineWidthPx); `fallback` draws it as MapLibre's fallback extrusions get it (the marker's
 * hull round the footprint prism, the house itself untouched). `small` puts the camera ~380 m out, where the 6 m house
 * covers ~0.1 % of the frame: the small-target boost (roof wash, raised beacon) is full; at `far` it is partial. The game itself is exercised by
 * tests/e2e/highlight.spec.ts and the shots of tests/e2e/highlight-shots.spec.ts.
 */
type Args = { style: HighlightStyle; view: 'chase' | 'saddle'; name: string; longName?: boolean; far?: boolean; small?: boolean; fallback?: boolean };

const ORIGIN: [number, number] = [4.8838, 52.3750];
const M_LAT = 110_540, M_LNG = 111_320 * Math.cos(ORIGIN[1] * Math.PI / 180);
const lngLat = (x: number, y: number): [number, number] => [ORIGIN[0] + x / M_LNG, ORIGIN[1] + y / M_LAT];
const BRICKS = [0x9a5846, 0x7f4a3c, 0xa4523b, 0x8c5a48, 0xb05a40, 0x6e3b2e, 0xc58b5e, 0x9a5846, 0x7f6258];

/** A canal house: box + gable prism, x east, y north, z up; front faces -y (the street). */
function house(width: number, depth: number, height: number, colour: number): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: colour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), wall);
  body.position.z = height / 2;
  const gable = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, width * 0.75)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: 0x55585c }));
  roof.rotation.x = Math.PI / 2; roof.position.set(0, depth / 2, height);
  const windows = new THREE.MeshLambertMaterial({ color: 0x2b3640 });
  for (let f = 0; f < Math.floor(height / 3.2); f++) for (const dx of [-width / 4, width / 4]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.6), windows);
    w.rotation.x = Math.PI / 2; w.position.set(dx, -depth / 2 - 0.02, 2 + f * 3.2);
    g.add(w);
  }
  g.add(body, roof);
  return g;
}

function HighlightScene({ style, view, name, longName, far, small, fallback }: Args) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0xc4d0d8);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdbe8ff, 0x8d8270, 2.6));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(-Math.sin(215 * Math.PI / 180) * 100, -Math.cos(215 * Math.PI / 180) * 100, 85);
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0xe9e4d8 }));
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(4000, 22), new THREE.MeshLambertMaterial({ color: 0x9fbbe8 }));
    canal.position.set(0, -30, 0.05);
    scene.add(ground, canal);
    // Two rows: this side of the canal (the destination is the fifth house) and the far side.
    const rows: { group: THREE.Group; at: [number, number] }[] = [];
    let x = -40;
    BRICKS.forEach((c, i) => {
      const w = 6 + (i % 3), h = 13 + ((i * 7) % 6), g = house(w, 16, h, c);
      g.position.set(x + w / 2, 0, 0); x += w + 0.1;
      scene.add(g); rows.push({ group: g, at: [g.position.x, 0] });
    });
    for (let i = 0; i < 9; i++) {
      const g = house(7, 14, 14 + (i % 4), BRICKS[(i + 4) % BRICKS.length]);
      g.rotation.z = Math.PI; g.position.set(-40 + i * 8.5, -62, 0);
      scene.add(g); rows.push({ group: g, at: [g.position.x, -62] });
    }
    const target = rows[4];
    // Fallback: MapLibre's extrusion is a flat prism (no gable), the shape the hull is built from.
    if (fallback) for (const child of [...target.group.children]) if ((child as THREE.Mesh).geometry instanceof THREE.ExtrudeGeometry) target.group.remove(child);
    // The style's whole-mesh states: the destination keeps its materials (+ passes) or turns yellow; style c dims neighbours.
    for (const r of rows) {
      const state = r === target ? 'highlight' : withinDesaturation(lngLat(...target.at), lngLat(...r.at)) ? 'dim' : 'plain';
      // Fallback: MapLibre draws the house in its own colours; the outline comes from the marker's hull below.
      if (fallback && r === target) continue;
      applyMeshHighlight(THREE, r.group, style === 'yellow' && state === 'dim' ? 'plain' : state, { style });
    }
    // Ground ring and beacon: the game's marker, mounted on a stand-in frame (its local space is metres about the footprint).
    const wrapper = new THREE.Group();
    scene.add(wrapper);
    const frame = { register: (_id: string, p: { root: THREE.Object3D }) => { wrapper.add(p.root); return () => wrapper.remove(p.root); } };
    const marker = new HighlightMarker(THREE, { triggerRepaint: () => {} }, { sharedFrame: frame, style });
    const box = new THREE.Box3().setFromObject(target.group);
    const fp = [[box.min.x, box.min.y], [box.max.x, box.min.y], [box.max.x, box.max.y], [box.min.x, box.max.y], [box.min.x, box.min.y]].map(([px, py]) => lngLat(px, py));
    marker.set({ lngLat: lngLat(...target.at), polygons: [[fp]], heightM: box.max.z, hull: !!fallback });
    const centre = new THREE.Vector3(); box.getCenter(centre);
    wrapper.position.set(centre.x, centre.y, 0);
    const camera = new THREE.PerspectiveCamera(view === 'saddle' ? 60 : 45, el.clientWidth / el.clientHeight, 0.5, 2000);
    camera.up.set(0, 0, 1);
    if (view === 'saddle') { camera.position.set(target.at[0] + 28, -30, 2.2); camera.lookAt(target.at[0] - 4, 0, 9); }
    else if (small) { camera.position.set(target.at[0] + 140, -350, 150); camera.lookAt(target.at[0], 0, 6); }
    else if (far) { camera.position.set(target.at[0] + 95, -230, 120); camera.lookAt(target.at[0], 0, 6); }
    else { camera.position.set(target.at[0] + 45, -110, 70); camera.lookAt(target.at[0], 0, 6); }
    let raf = 0;
    const tick = () => { renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
    tick();
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); marker.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, [style, view, far, small, fallback]);
  const accent = highlightAccent(style, '');
  return <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: '"Barlow Condensed", Helvetica, sans-serif' }}>
    <div ref={host} data-testid="highlight-scene" style={{ position: 'absolute', inset: 0 }} />
    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 14, maxWidth: 420, margin: '0 auto', padding: '8px 12px', background: 'rgba(250,247,240,0.94)', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.18)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, flex: 'none', background: accent, boxShadow: `0 0 0 2px ${style === 'yellow' ? '#fff' : 'rgba(0,0,0,0.15)'}` }} />
      <span style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {longName ? 'Rijksmuseum Research Library and Print Room of the Rijksmuseum Amsterdam' : name}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 14, color: '#555', whiteSpace: 'nowrap' }}>destination</span>
    </div>
  </div>;
}

const meta = {
  title: 'Canal Recall/Landmark highlight',
  component: HighlightScene,
  parameters: { controls: { disable: true } },
  args: { name: 'Anne Frank House', view: 'chase' },
} satisfies Meta<typeof HighlightScene>;

export default meta;
type Story = StoryObj<typeof meta>;
const phone = { viewport: { defaultViewport: 'mobile1' } };

/** The default (docs/LOOK.md §Highlight): outline + ground ring + beacon. */
export const OutlineRingBeacon: Story = { args: { style: 'a' } };
export const OutlineRingBeaconPhone: Story = { args: { style: 'a' }, parameters: phone };
export const OutlineRingBeaconSaddle: Story = { args: { style: 'a', view: 'saddle' } };
export const OutlineRingBeaconSaddlePhone: Story = { args: { style: 'a', view: 'saddle' }, parameters: phone };
export const OutlineRingBeaconLongNamePhone: Story = { args: { style: 'a', longName: true }, parameters: phone };
/** Chase distance (~250 m): the outline widens toward 3.5 px so a 6 m house still reads. */
export const OutlineFarChase: Story = { args: { style: 'a', far: true } };
export const OutlineFarChasePhone: Story = { args: { style: 'a', far: true }, parameters: phone };
/**
 * Small target (~0.1 % of the frame): the coral roof wash on the house's roof planes and the beacon raised by the
 * shortfall; the facade keeps its brick. Fallback: the wash on the top cap of the hull prism.
 */
export const SmallTargetWash: Story = { args: { style: 'a', small: true } };
export const SmallTargetWashPhone: Story = { args: { style: 'a', small: true }, parameters: phone };
export const SmallTargetFallback: Story = { args: { style: 'a', small: true, fallback: true } };
export const SmallTargetFallbackPhone: Story = { args: { style: 'a', small: true, fallback: true }, parameters: phone };
export const SmallTargetLongNamePhone: Story = { args: { style: 'a', small: true, longName: true }, parameters: phone };
/** MapLibre's fallback extrusions (three.js does not own the city): the marker's hull carries the outline. */
export const FallbackHull: Story = { args: { style: 'a', fallback: true } };
export const FallbackHullPhone: Story = { args: { style: 'a', fallback: true }, parameters: phone };
/** The old yellow (`?highlight=yellow`), and the other two candidates, for comparison. */
export const TodayYellow: Story = { name: 'Yellow (comparison)', args: { style: 'yellow' } };
export const RimPulse: Story = { args: { style: 'b' } };
export const DesaturateRest: Story = { args: { style: 'c' } };
