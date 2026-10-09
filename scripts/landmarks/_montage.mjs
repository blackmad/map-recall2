import sharp from 'sharp';
const [d, id, ...azs] = process.argv.slice(2);
const comp = azs.map((a, i) => ({input: `${d}/${id}-az${a}.png`, left: (i % 2) * 600, top: Math.floor(i / 2) * 450}));
await sharp({create: {width: 1200, height: 900, channels: 3, background: '#fff'}}).composite(comp).png().toFile(`${d}/montage.png`);
