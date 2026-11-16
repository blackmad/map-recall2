import sharp from 'sharp';
const [a, b] = process.argv.slice(2);
const r = async f => (await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
const A = await r(a), B = await r(b); let same = 0, n = 0;
for (let i = 0; i < A.data.length; i += 3) { const la = 0.2126*A.data[i]+0.7152*A.data[i+1]+0.0722*A.data[i+2], lb = 0.2126*B.data[i]+0.7152*B.data[i+1]+0.0722*B.data[i+2]; n++; if (Math.abs(lb - la) <= 1) same++; }
console.log(`|dL|<=1 ${(100 * same / n).toFixed(1)}%`);
