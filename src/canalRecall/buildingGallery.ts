// A gallery of every custom building asset: facade cells for each look, shopfronts,
// roof and dormer textures, 3D roof and gable thumbnails, palettes, landmark kits.
// Static page (`building-gallery.html`), not linked from the app. Cells are tinted
// exactly as the game's shader does: colour x mix(1, wall, mask.r) x mix(1, accent, mask.g).

import { CELL_KINDS, CELL_PX, CELL_VARIANTS, paintCell, STYLE_DIMS } from './facadeCells.js';
import { FACADE_STYLES, FACADE_STYLE_COLOURS, mutedWallHex } from './genericFacades.js';
import { CONTEXTUAL_BUILDING_COLOURS } from './cityAppearancePalette.js';
import { BAY_ENTRIES, BAY_STYLES, CARTOON_WALLS, PHOTO_WALLS, STORYBOOK_WALLS, bayVariant } from './bayLook.js';
import { PALETTES, bayTextures, type Look } from './bayTextures.js';
import { ROOF_CELL_KINDS, paintRoofCell } from './roofCells.js';
import { fitRect, gableProfile, roofTriangles, type GableShape, type RoofPlan } from './roofMesh.js';
import { KITS, MAT_HEX } from './landmarkKits.js';
import { ROOF_TONES, calmBayLayers } from './threeBuildingsBrowser.js';

const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { cls?: string } = {}, ...kids: Array<Node | string>) => {
  const node = document.createElement(tag); const { cls, ...rest } = props as any;
  if (cls) node.className = cls; Object.assign(node, rest); for (const k of kids) node.append(k); return node;
};
const section = (title: string, note: string) => {
  const s = el('section', {}, el('h2', {}, title), el('p', { cls: 'note' }, note)); document.querySelector('main')!.append(s);
  const grid = el('div', { cls: 'grid' }); s.append(grid); return grid;
};
const tile = (canvas: HTMLElement, label: string, sub = '') => el('figure', {}, canvas, el('figcaption', {}, el('b', {}, label), sub ? ` ${sub}` : ''));

/** Tint one layer like the shader: rgba colour, rg mask, wall and accent colours. */
function compose(colour: Uint8Array | Uint8ClampedArray, mask: Uint8Array | Uint8ClampedArray, wall: [number, number, number], accent: [number, number, number], size = 160): HTMLCanvasElement {
  const canvas = el('canvas', { width: size, height: size });
  const ctx = canvas.getContext('2d')!, out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.floor((x / size) * CELL_PX), sy = CELL_PX - 1 - Math.floor((y / size) * CELL_PX); // layer rows run up from the ground
    const i = (sy * CELL_PX + sx), o = (y * size + x) * 4, m = mask[i * 2] / 255, a = mask[i * 2 + 1] / 255;
    for (let c = 0; c < 3; c++) out.data[o + c] = Math.min(255, (colour[i * 4 + c] / 255) * (1 + (wall[c] / 255 - 1) * m) * (1 + (accent[c] / 255 - 1) * a) * 255);
    out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}
const maskFromAlpha = (rgba: Uint8ClampedArray) => { const m = new Uint8Array(CELL_PX * CELL_PX * 2); for (let i = 0; i < CELL_PX * CELL_PX; i++) m[i * 2] = rgba[i * 4 + 3]; return m; };
const opaque = (rgba: Uint8ClampedArray) => { const c = new Uint8Array(rgba.length); for (let i = 0; i < rgba.length; i += 4) { c[i] = rgba[i]; c[i + 1] = rgba[i + 1]; c[i + 2] = rgba[i + 2]; c[i + 3] = 255; } return c; };

function swatches(colours: readonly string[], label: string) {
  return el('div', { cls: 'sw' }, el('b', {}, label), el('div', { cls: 'row' }, ...colours.map(c => { const sp = el('span', { title: c }); sp.setAttribute('style', `background:${c}`); return sp; })));
}

async function main() {
  const brick = new Image(); brick.src = new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href;
  try { await brick.decode(); } catch { /* flat brick */ }

  // 1. Painted (procedural) cells, tinted by the style's own palette.
  const painted = section('Painted: procedural facade cells', 'The default three.js look. Each style has two variants (a) and (b) and five cell kinds: upper storey, ground floor, door, bare wall and shopfront. Tinted by the style\'s period wall colours.');
  for (const style of FACADE_STYLES) for (let v = 0; v < CELL_VARIANTS; v++) {
    const dims = STYLE_DIMS[style], wall = hex(mutedWallHex(CONTEXTUAL_BUILDING_COLOURS[FACADE_STYLE_COLOURS[style][v % FACADE_STYLE_COLOURS[style].length]]));
    const row = el('div', { cls: 'cells' });
    for (const kind of CELL_KINDS) { const px = paintCell(style, kind, v); row.append(tile(compose(opaque(px), maskFromAlpha(px), wall, [255, 255, 255], 120), kind)); }
    painted.append(el('div', { cls: 'group' }, el('h3', {}, `${style} (${'ab'[v]})`, el('small', {}, ` bay ${dims.bay} m, storey ${dims.storey} m, ground ${dims.ground} m`)), row));
  }

  // 2. Bay looks.
  const walls: Record<Look, readonly string[]> = { photo: PHOTO_WALLS, storybook: STORYBOOK_WALLS, cartoon: CARTOON_WALLS };
  const blurbs: Record<Look, string> = {
    photo: 'Real brick photograph under drawn sash windows, shutters, fanlit doors; brick softened and lifted as in the game.',
    storybook: 'Softly painted, natural colours, thin outlines.',
    cartoon: 'Flat bold colour, thick outlines, bigger windows; the game adds three-band cel shading.',
  };
  for (const look of ['photo', 'storybook', 'cartoon'] as const) {
    const grid = section(`${look[0].toUpperCase()}${look.slice(1)}: bay drawings`, `${blurbs[look]} Every window style, shopfront type and bare wall for each period archetype (canal, school, modern).`);
    const palette = PALETTES[look];
    const cells = new Map<string, { colour: Uint8Array; mask: Uint8Array }>();
    for (const entry of BAY_ENTRIES) {
      const { colour, mask } = bayTextures(bayVariant(entry), brick, look);
      const scratch = el('canvas', { width: CELL_PX, height: CELL_PX }), ctx = scratch.getContext('2d', { willReadFrequently: true })!;
      const read = (src: HTMLCanvasElement) => { ctx.clearRect(0, 0, CELL_PX, CELL_PX); ctx.drawImage(src, 0, 0, CELL_PX, CELL_PX); return ctx.getImageData(0, 0, CELL_PX, CELL_PX).data; };
      const c = read(colour), m = read(mask), colourArr = new Uint8Array(CELL_PX * CELL_PX * 4), maskArr = new Uint8Array(CELL_PX * CELL_PX * 2);
      // Canvas rows run down; layer rows run up. Flip into layer order like the game's packer.
      for (let y = 0; y < CELL_PX; y++) for (let x = 0; x < CELL_PX; x++) {
        const from = ((CELL_PX - 1 - y) * CELL_PX + x) * 4, to = y * CELL_PX + x;
        colourArr.set([c[from], c[from + 1], c[from + 2], 255], to * 4); maskArr[to * 2] = m[from]; maskArr[to * 2 + 1] = m[from + 1];
      }
      calmBayLayers(colourArr, maskArr, 1, look);
      cells.set(`${entry.layer}`, { colour: colourArr, mask: maskArr });
      const arche = entry.archetype as 'canal' | 'school' | 'modern';
      const wallHex = (look === 'cartoon' || look === 'storybook' ? walls[look] : PHOTO_WALLS)[(entry.layer * 3) % walls[look].length];
      const v = bayVariant(entry);
      const detail = `${v.windows}w ${v.shape}${v.shutters ? ' shutters' : ''}${v.paintedFrames ? ' painted' : ''}`;
      grid.append(tile(compose(colourArr, maskArr, hex(wallHex), hex(palette[arche].accents[(entry.layer * 5) % palette[arche].accents.length]), 150), `${entry.archetype} / ${entry.kind}`, entry.kind === 'upper' || entry.kind === 'ground' || entry.kind === 'groundDoor' ? detail : ''));
    }
  }

  // 3. Roof and dormer textures.
  const roofTex = section('Roof, dormer and flat-surface textures', 'One cell serves every roof colour. Each has a realistic and a toon (cartoon) version.');
  for (const toon of [false, true]) for (const kind of ROOF_CELL_KINDS) {
    const px = paintRoofCell(kind, toon), tint = hex(kind === 'tile' ? '#b5543a' : kind === 'slate' ? '#4a525d' : kind === 'dormer' ? '#a24d38' : '#d9b24c');
    roofTex.append(tile(compose(opaque(px), maskFromAlpha(px), tint, [255, 255, 255], 140), `${kind}${toon ? ' (toon)' : ''}`));
  }

  // 4. Palettes.
  const pal = section('Palettes', 'Wall colours per look, and the roof tones. Photo reds dominate; cartoon is a short sticker palette.');
  pal.append(swatches(PHOTO_WALLS, 'Photo walls'), swatches(STORYBOOK_WALLS, 'Storybook walls'), swatches(CARTOON_WALLS, 'Cartoon walls'));
  for (const look of ['procedural', 'photo', 'storybook', 'cartoon'] as const) pal.append(swatches([...ROOF_TONES[look].tile, ...ROOF_TONES[look].slate], `Roofs, ${look}`));
  pal.append(swatches(Object.values(MAT_HEX), `Landmark materials (${Object.keys(MAT_HEX).join(', ')})`));
  for (const look of ['photo', 'storybook', 'cartoon'] as const) for (const arche of ['canal', 'school', 'modern'] as const) pal.append(swatches(PALETTES[look][arche].accents, `${look} accents, ${arche}`));
  void BAY_STYLES;

  // 5. Roof and gable 3D thumbnails.
  const roofs = section('Roofs and gables in 3D', 'Pitched, mansard with dormers, and the five Amsterdam gable shapes, on a 5.5 x 13 m footprint.');
  const THREE = (window as any).CanalRecallThree?.THREE;
  if (THREE) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(300, 230);
    const rect = fitRect([[0, 0], [5.5, 0], [5.5, 13], [0, 13], [0, 0]])!;
    const shot = (plan: RoofPlan, label: string, azimuth: number) => {
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#ece7d8');
      scene.add(new THREE.HemisphereLight(0xffffff, 0x998f80, 1.7)); const sun = new THREE.DirectionalLight(0xfff2dd, 1.8); sun.position.set(-20, 40, 30); scene.add(sun);
      const h0 = 10, tris = roofTriangles(rect, plan, h0, { bayM: 5, storeyM: 3.1, cellM: 1.2 });
      const pos: number[] = [], col: number[] = [];
      const colourFor = (part: string) => hex(part === 'slope' || part === 'dormerSide' ? (plan.material === 'tile' ? '#b5543a' : '#4a525d') : '#c9b99a');
      for (const t of tris) for (let k = 0; k < 3; k++) { pos.push(t.p[k][0], t.p[k][2], -t.p[k][1]); const s = 0.6 + 0.4 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8), c = colourFor(t.part); col.push(c[0] / 255 * s, c[1] / 255 * s, c[2] / 255 * s); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      const body = new THREE.Mesh(new THREE.BoxGeometry(5.5, h0, 13), new THREE.MeshLambertMaterial({ color: '#a8604a' })); body.position.set(rect.cx, h0 / 2, -rect.cy); body.rotation.y = Math.atan2(rect.uy, rect.ux) * 0 ; scene.add(body);
      const cam = new THREE.PerspectiveCamera(36, 300 / 230, 1, 200), a = azimuth * Math.PI / 180;
      cam.position.set(rect.cx + Math.sin(a) * 30, 13, -rect.cy - Math.cos(a) * 30); cam.lookAt(rect.cx, 8.6, -rect.cy);
      renderer.render(scene, cam);
      const img = el('img', { src: renderer.domElement.toDataURL(), width: 300, height: 230 }); roofs.append(tile(img, label));
    };
    const base = { dormers: false, material: 'tile' as const, tone: 0.2, seed: 'gallery', chimney: false };
    shot({ ...base, kind: 'pitched', gable: 'plain', riseM: 2.2 }, 'pitched, tile', 35);
    shot({ ...base, kind: 'pitched', gable: 'plain', riseM: 2.2, dormers: true, material: 'slate', chimney: true, seed: 'c' }, 'pitched, slate, dormers, chimney', 35);
    shot({ ...base, kind: 'mansard', gable: 'plain', riseM: 2.6, dormers: true, material: 'slate' }, 'mansard with dormers', 35);
    for (const gable of ['step', 'neck', 'bell', 'spout', 'plain'] as GableShape[]) shot({ ...base, kind: 'gable', gable, riseM: 2.0 }, `gable: ${gable}`, 25);
    void gableProfile;
  }

  // 6. Landmark kits, live from their OSM parts.
  const kits = section('Landmark kits (live 3D)', 'Towers, spires, domes and roofs generated from each landmark\'s real OSM parts, drawn in flat colours over grey context. Each loads its own tiles.');
  const views: Record<string, string> = { Westerkerk: 'az=50&el=10&r=170&y=42', Zuiderkerk: 'az=40&el=10&r=160&y=40', Montelbaanstoren: 'az=40&el=10&r=90&y=22', Noorderkerk: 'az=40&el=12&r=110&y=16', 'Royal Palace': 'az=100&el=14&r=150&y=22' };
  for (const kit of KITS) {
    const frame = el('iframe', { src: `kit-viewer.html?kit=${encodeURIComponent(kit.name)}&${views[kit.name]}`, width: 440, height: 330, loading: 'lazy' } as any);
    kits.append(tile(frame, kit.name, `${kit.tiers.length} tiers, ${kit.stacks.length} stacks, ${kit.roofs.length} roofs`));
  }
  const compare = section('Low-poly landmark reconstructions', 'Left to right: plain OSM prism, low-poly reconstruction (kit plus a measured front, flat colours, no textures), and the street panorama it was measured from, shown only as a reference. Panoramas: Gemeente Amsterdam.');
  for (const [name, view] of [['waag', 'r=95&el=14&az=-35'], ['bijenkorf', 'r=90&el=16&az=-35'], ['beurs', 'r=75&el=8&az=-25']]) {
    const frame = el('iframe', { src: `facade-compare.html?name=${name}&${view}`, width: 900, height: 330, loading: 'lazy' } as any);
    compare.append(tile(frame, name === 'waag' ? 'Waag' : name === 'beurs' ? 'Beurs van Berlage' : 'Bijenkorf'));
  }
  document.title = 'Building assets';
}

main();
