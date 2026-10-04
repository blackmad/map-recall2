// Cheap city-scale footprint coverage. Detailed geometry remains in the z14 source tiles.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { tileBounds, tileFor } from '../src/canalRecall/slippyTiles.ts';

const root = 'public/data/extracts/amsterdam', source = `${root}/building-tiles`, output = `${root}/building-overview`;
const zoom = 12, size = 512, scale = 2 ** zoom;
const tiles = new Map<string, string[]>(), digest = createHash('sha256');
let buildings = 0;
for (const file of fs.readdirSync(source, { recursive: true }).filter(f => String(f).endsWith('.geojson.gz')).sort()) {
  const data = fs.readFileSync(path.join(source, String(file))); digest.update(String(file)); digest.update(data);
  for (const f of JSON.parse(gunzipSync(data).toString()).features) {
    const polygons: number[][][][] = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const polygon of polygons) {
      if (!polygon[0]?.length) continue;
      const points = polygon[0], west = Math.min(...points.map(p=>p[0])), east = Math.max(...points.map(p=>p[0])), south = Math.min(...points.map(p=>p[1])), north = Math.max(...points.map(p=>p[1]));
      const nw = tileFor(west,north,zoom), se = tileFor(east,south,zoom);
      for(let x=nw.x;x<=se.x;x++) for(let y=nw.y;y<=se.y;y++) {
        const key = `${x}/${y}`;
        const rings = polygon.map(ring => 'M'+ring.map(([lng,lat]) => {
          const rad = lat*Math.PI/180;
          return `${(((lng+180)/360*scale-x)*size).toFixed(2)},${(((1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*scale-y)*size).toFixed(2)}`;
        }).join('L')+'Z').join('');
        let list=tiles.get(key); if(!list) tiles.set(key,list=[]); list.push(rings);
      }
    }
    buildings++;
  }
}
const xs=[...tiles.keys()].map(k=>Number(k.split('/')[0])), ys=[...tiles.keys()].map(k=>Number(k.split('/')[1]));
const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
let bytes=0;
for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++) {
  const paths=(tiles.get(`${x}/${y}`)??[]).map(d=>`<path d="${d}"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g fill="#938b80" fill-rule="evenodd">${paths}</g></svg>`;
  const dir=`${output}/${zoom}/${x}`; fs.mkdirSync(dir,{recursive:true});
  const file=`${dir}/${y}.png`; await sharp(Buffer.from(svg)).png({palette:true}).toFile(file); bytes+=fs.statSync(file).size;
}
const nw=tileBounds({z:zoom,x:minX,y:minY}), se=tileBounds({z:zoom,x:maxX,y:maxY});
const manifest={version:1,zoom,tileSize:size,bounds:[nw[0],se[1],se[2],nw[3]],buildings,tiles:(maxX-minX+1)*(maxY-minY+1),bytes,sourceSha256:digest.digest('hex'),projection:'Web Mercator',geometry:'Surveyed footprint raster; original holes preserved; no inferred heights or facades'};
fs.writeFileSync(`${output}/index.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
