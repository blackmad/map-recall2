import sharp from 'sharp';
const [out, ...slugs] = process.argv.slice(2);
const comps = await Promise.all(slugs.map(async (s, i) => ({ input: await sharp(`tmp/storefronts/gallery/${s}.jpg`).toBuffer(), left: (i % 2) * 640, top: Math.floor(i / 2) * 304 })));
await sharp({ create: { width: 1280, height: 304 * Math.ceil(slugs.length / 2), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
