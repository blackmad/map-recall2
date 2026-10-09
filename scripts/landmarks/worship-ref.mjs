// Usage: node scripts/landmarks/worship-ref.mjs <out.jpg> <lng> <lat> [radius]
// Saves the nearest Amsterdam municipal panorama (aimed at the point) as a JPG.
import fs from 'node:fs';
const [out, lng, lat, radius = '30'] = process.argv.slice(2);
const j = await (await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/?lon=${lng}&lat=${lat}&radius=${radius}&width=1200&fov=80`, {headers: {accept: 'application/json'}})).json();
fs.writeFileSync(out, Buffer.from(await (await fetch(j.url)).arrayBuffer()));
console.log(j.pano_id, j.heading);
