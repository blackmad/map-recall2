// usage: node roeterseiland-profile.mjs <image> <axis v|h> <fixed px start> <fixed px end> <from> <to> [smoothing]
// Mean brightness profile along one axis of a rectified panorama crop, to count storeys / bays by their periodicity.
import sharp from 'sharp';
const [img, axis, f0, f1, a0, a1, smooth = '1'] = process.argv.slice(2);
const {data, info} = await sharp(img).greyscale().raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height, n = Math.abs(+a1 - +a0), out = [];
for (let k = +a0; k < +a1; k++) {
  let s = 0, c = 0;
  for (let j = +f0; j < +f1; j++) { const x = axis === 'v' ? j : k, y = axis === 'v' ? k : j; if (x < W && y < H) { s += data[y * W + x]; c++; } }
  out.push(s / Math.max(1, c));
}
const sm = out.map((_, i) => { let s = 0, c = 0; for (let d = -+smooth; d <= +smooth; d++) if (out[i + d] !== undefined) { s += out[i + d]; c++; } return s / c; });
// local minima/maxima
const peaks = [];
for (let i = 2; i < sm.length - 2; i++) if (sm[i] > sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > sm[i - 2] && sm[i] >= sm[i + 2]) peaks.push(i + +a0);
console.log('max at', peaks.join(' '));
console.log('gaps', peaks.slice(1).map((p, i) => p - peaks[i]).join(' '));
console.log(`size ${W}x${H}`);
