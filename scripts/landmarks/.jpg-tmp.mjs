import sharp from 'sharp';
const [,, inp, out, w='1600'] = process.argv;
await sharp(inp, {limitInputPixels: false}).resize({width: +w, withoutEnlargement: true}).jpeg({quality: 82}).toFile(out);
