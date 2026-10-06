import * as T from 'three';
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import artwork from './willem-de-zwijger-frontage-sign-artwork.json';

/** Original vector sign geometry. Font contours are a smooth approximation of
 * the real photographic sign, not pixels extracted from the photograph. */
const fontBytes = readFileSync(new URL('../../public/canal-drive/fonts/ArchivoBlack-Regular.ttf', import.meta.url));
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));

export function frontageSignGeometry(text: string, heightM: number, maxWidthM: number): T.BufferGeometry {
  const path = font.getPath(text, 0, 0, 100, { kerning: true });
  const contours = new T.ShapePath();
  for (const c of path.commands) {
    if (c.type === 'M') contours.moveTo(c.x, -c.y);
    else if (c.type === 'L') contours.lineTo(c.x, -c.y);
    else if (c.type === 'Q') contours.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') contours.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    else if (c.type === 'Z') contours.currentPath?.closePath();
  }
  const g = new T.ShapeGeometry(contours.toShapes(), 8);
  g.computeBoundingBox();
  const bounds = g.boundingBox!, size = bounds.getSize(new T.Vector3());
  if (!text.trim() || size.x <= 0 || size.y <= 0 || !Number.isFinite(heightM) || !Number.isFinite(maxWidthM) || heightM <= 0 || maxWidthM <= 0)
    throw Error('Invalid frontage sign dimensions');
  const scale = Math.min(heightM / size.y, maxWidthM / size.x);
  g.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, 0);
  g.scale(scale, scale, 1);
  g.userData = { role: 'source-supported-vector-sign', text, font: 'Archivo Black', measured: false };
  return g;
}

/** A painted annular sector has no tube-shaped silhouette or speculative relief. */
export function frontageRingSector(inner: number, outer: number, start: number, end: number): T.BufferGeometry {
  const s = new T.Shape();
  s.absarc(0, 0, outer, start, end, false);
  s.lineTo(inner * Math.cos(end), inner * Math.sin(end));
  s.absarc(0, 0, inner, end, start, true);
  s.closePath();
  return new T.ShapeGeometry(s, 48);
}

function artworkShapes(commands: (number|string)[][]): T.Shape[] {
  const p=new T.ShapePath();
  for(const c of commands){
    const v=c.slice(1) as number[];
    if(c[0]==='M')p.moveTo(v[0],v[1]);
    else if(c[0]==='L')p.lineTo(v[0],v[1]);
    else if(c[0]==='C')p.bezierCurveTo(v[0],v[1],v[2],v[3],v[4],v[5]);
    else if(c[0]==='Z')p.currentPath?.closePath();
  }
  return p.toShapes();
}

/** Exact operator SVG letter contours, selectively reproduced because the
 * same PADELNEXT wordmark is present on the real photographed fascia. */
export function padelWordmarkGeometry(heightM:number,maxWidthM:number):T.BufferGeometry {
  const g=new T.ShapeGeometry(artwork.wordmark.flatMap(p=>artworkShapes(p.commands)),10);
  g.computeBoundingBox();const b=g.boundingBox!,size=b.getSize(new T.Vector3());
  const scale=Math.min(heightM/size.y,maxWidthM/size.x);
  g.translate(-(b.min.x+b.max.x)/2,-b.min.y,0);g.scale(scale,scale,1);
  g.userData={role:'source-supported-vector-sign',text:'PADELNEXT',sourceUrl:artwork.sourceUrl,sourceSha256:artwork.sourceSha256};
  return g;
}

/** Flat exact SVG mural/entry emblem: no tube relief and no invented dots. */
export function padelEmblemGeometry(diameterM:number):{geometry:T.BufferGeometry;hex:string}[] {
  const parts=artwork.emblem.map(p=>({geometry:new T.ShapeGeometry(artworkShapes(p.commands),16),hex:p.hex}));
  const bounds=new T.Box3();for(const p of parts){p.geometry.computeBoundingBox();bounds.union(p.geometry.boundingBox!);}
  const scale=diameterM/Math.max(bounds.max.x-bounds.min.x,bounds.max.y-bounds.min.y);
  for(const p of parts){p.geometry.translate(-(bounds.min.x+bounds.max.x)/2,-(bounds.min.y+bounds.max.y)/2,0);p.geometry.scale(scale,scale,1);p.geometry.userData={role:'source-supported-vector-emblem',sourceUrl:artwork.sourceUrl,sourceSha256:artwork.sourceSha256};}
  return parts;
}
