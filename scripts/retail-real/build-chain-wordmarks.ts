/**
 * Chain wordmarks (lane chain-logos-20261116, David's 13 Shopfronts-page notes of 2026-11-16): clean lettering for the
 * chains whose logo read badly on the fascia, each a trimmed transparent PNG in data/retail-ground/chain-logos/<key>.png
 * with its source in provenance.json. Sources are the brands' own SVG/PNG files (data/retail-ground/chain-logos/src/,
 * fetched 2026-11-16, URL per key below) or, where the brand's lettering is a plain face, SVG text in that face.
 * build-chain-logos.ts then packs them on the chain's board colour (chain-overrides.json, retailTemplates.ts LOOKS).
 *   node --import tsx scripts/retail-real/build-chain-wordmarks.ts && node --import tsx scripts/retail-real/build-chain-logos.ts --publish
 * The SVG text uses macOS faces (Helvetica Neue, Arial Rounded MT Bold, Rockwell); the PNGs are committed.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = 'data/retail-ground/chain-logos', SRC = path.join(DIR, 'src'), FETCHED = '2026-11-16';
const H = 300;
const svgText = (w: number, h: number, body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const trim = async (buf: Buffer) => sharp(buf).trim({ threshold: 1 }).png().toBuffer();
const meta = async (buf: Buffer) => { const m = await sharp(buf).metadata(); return { w: m.width!, h: m.height! }; };
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Lay parts side by side at height `h`, `gap` px apart, vertically centred. */
async function row(parts: Array<{ buf: Buffer; h: number }>, gap: number): Promise<Buffer> {
  const sized = await Promise.all(parts.map(async p => { const b = await sharp(p.buf).resize({ height: p.h }).png().toBuffer(); return { b, ...(await meta(b)) }; }));
  const W = sized.reduce((t, s) => t + s.w, 0) + gap * (sized.length - 1), Hh = Math.max(...sized.map(s => s.h));
  let x = 0;
  const comps = sized.map(s => { const c = { input: s.b, left: x, top: Math.round((Hh - s.h) / 2) }; x += s.w + gap; return c; });
  return sharp({ create: { width: W, height: Hh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toBuffer();
}

/** Re-ink a mask: every pixel's alpha from `alpha(r, g, b, a)`, its colour `ink(r, g, b, a)`. */
async function reink(input: Buffer, f: (r: number, g: number, b: number, a: number, x: number, y: number) => [number, number, number, number]): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, o = f(data[i], data[i + 1], data[i + 2], data[i + 3], x, y);
    data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2]; data[i + 3] = o[3];
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

type Made = { buf: Buffer; source: string; renderUrl?: string; licence: string; note: string };
const made: Record<string, Made> = {};

// Albert Heijn (note c2ad6915: "AH has a wordmark", a photo of the Arnhem front; round-7 readers: light-blue lit
// 'Albert Heijn' on a dark grey band). Its Commons mark, then the name in AH blue in a rounded sans like the photo's.
{
  const mark = await sharp('data/retail-ground/logos/ah.png').trim().png().toBuffer();
  const word = await trim(await sharp(svgText(1400, 300, `<text x="10" y="230" font-family="Arial Rounded MT Bold" font-size="220" fill="#00a0e2">Albert Heijn</text>`)).png().toBuffer());
  made['ah-wordmark'] = { buf: await row([{ buf: mark, h: H }, { buf: word, h: Math.round(H * 0.72) }], 50), source: 'https://commons.wikimedia.org/wiki/File:Albert_Heijn_Logo.svg', licence: 'Commons mark (public domain) and lettering set in Arial Rounded MT Bold', note: 'David 2026-11-16 reference: https://thumbs.dreamstime.com/b/logo-albert-heijn-facade-arnhem-netherlands-january-largest-most-famous-dutch-supermarket-chain-173674961.jpg' };
}
// Jumbo (note 58f77672: "just JUMBO, white text with black shadow on yellow BG"): the Commons wordmark's own letters,
// its yellow faces turned white, the black shadow kept, "supermarkten" dropped (chain-logos/jumbo.png is the word alone).
made['jumbo-wordmark'] = {
  buf: await reink(await sharp(path.join(DIR, 'jumbo.png')).trim().png().toBuffer(), (r, g, b, a) => (r > 120 && g > 90 && b < 120 ? [255, 255, 255, a] : [r, g, b, a])),
  source: 'https://commons.wikimedia.org/wiki/File:Jumbo_Logo.svg', licence: 'Public domain (Commons)', note: 'yellow letter faces re-inked white, black shadow kept',
};
// Dirk (note c09ff873: "full name"; round-7 readers: a red band with white 'Dirk van den Broek'): white bold condensed
// sans with the underline of the brand's sign.
{
  const t = await trim(await sharp(svgText(2400, 360, `<text x="10" y="250" font-family="Helvetica Neue" font-weight="bold" font-stretch="condensed" font-size="250" fill="#ffffff">Dirk van den Broek</text>`)).png().toBuffer());
  const { w, h } = await meta(t);
  const under = svgText(w, h + 60, `<rect x="${Math.round(w * 0.27)}" y="${h + 22}" width="${Math.round(w * 0.73)}" height="22" fill="#ffffff"/>`);
  made['dirk-wordmark'] = { buf: await sharp(under).composite([{ input: t, left: 0, top: 0 }]).png().toBuffer(), source: 'https://www.dirk.nl/', licence: 'lettering set in Helvetica Neue Condensed Bold after the sign photo', note: 'white on the template red; David 2026-11-16 reference: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCyoiFr1TcTIV0-sVK2JF6gS2-jV4WY-6IwQzH16yLMvLIVeSBJjoOzv0&s=10' };
}
// Gall & Gall (note 976d722a: "pull out the Gall & Gall and make it bigger"): the Commons logo without its box and the
// 'SINDS 1884' line, so the word alone fills the board.
{
  const svg = fs.readFileSync(path.join(SRC, 'gall-and-gall.svg'), 'utf8').replace(/<rect class="cls-1"[^>]*\/>/, '');
  const k = 2, full = await sharp(Buffer.from(svg), { density: 72 * k }).png().toBuffer();
  const word = await sharp(full).extract({ left: 0, top: 0, width: Math.round(1848.63 * k), height: Math.round(580 * k) }).png().toBuffer();
  made['gallgall-wordmark'] = { buf: await trim(word), source: 'https://commons.wikimedia.org/wiki/File:Gall_logo.svg', licence: 'Public domain (Commons)', note: 'box and tagline removed' };
}
// Starbucks (note f0b92ddf: "starbucks logo?"): the siren disc beside the Commons wordmark in white.
{
  const siren = await sharp(path.join(SRC, 'starbucks-siren.svg'), { density: 300 }).png().toBuffer();
  const sm = await meta(siren), disc = await sharp(siren).extract({ left: 0, top: 0, width: Math.min(sm.w, sm.h), height: Math.min(sm.w, sm.h) }).png().toBuffer();
  const word = await reink(await sharp(path.join(SRC, 'starbucks-wordmark.png')).trim().png().toBuffer(), (_r, _g, _b, a) => [255, 255, 255, a]);
  made.starbucks = { buf: await row([{ buf: await trim(disc), h: H }, { buf: word, h: Math.round(H * 0.45) }], 40), source: 'https://en.wikipedia.org/wiki/File:Starbucks_Corporation_Logo_2011.svg', renderUrl: 'https://en.wikipedia.org/wiki/Special:FilePath/Starbucks_Corporation_Logo_2011.svg', licence: 'trademark logo (Wikipedia non-free file); wordmark from Commons File:Starbucks_coffee_wordmark.png', note: 'siren disc + white wordmark' };
}
// Wakuli (note 062479c5: "a wordmark to write WAKULI"): the brand site's wordmark (its blue).
made.wakuli = { buf: await trim(fs.readFileSync(path.join(SRC, 'wakuli-word.png'))), source: 'https://www.wakuli.com/', renderUrl: 'https://www.wakuli.com/cdn/shop/files/Wakuli-logo-RGB-base-white.png?v=1717596574&width=1000', licence: 'trademark logo; brand site PNG', note: 'blue WAKULI wordmark on the brand yellow' };
// The Bulldog (note 6927c21f: "bad image": the old file was a street photo): the brand's horizontal logo, the badge
// kept and the black 'THE BULLDOG' re-inked in the board's yellow, the white ground cut away.
{
  const src = fs.readFileSync(path.join(SRC, 'the-bulldog-horizontal.jpg'));
  const { w, h } = await meta(src);
  // The badge is the round mark at the left: opaque inside its circle (cx, cy, r: the non-white bbox of the left third of the 600 x 200 file, less 1.5 px).
  const cx = 0.186 * w, cy = 0.4975 * h, r = 0.43 * h;
  const yellow = rgb('#f2c230');
  const out = await reink(src, (rr, g, b, _a, x, y) => {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return [rr, g, b, 255];
    const ink = 1 - Math.min(rr, g, b) / 255; // dark lettering on white
    return [yellow[0], yellow[1], yellow[2], Math.round(Math.min(1, Math.max(0, (ink - 0.15) / 0.6)) * 255)];
  });
  made['the-bulldog'] = { buf: await trim(out), source: 'https://www.thebulldog.com/', renderUrl: 'https://thebulldog.com/wp-content/uploads/2022/06/TB-International-Logo_horizontal_black-text.jpg', licence: 'trademark logo; brand site JPG', note: 'badge kept, lettering re-inked yellow, white cut away' };
}
// Bagels & Beans (note 28c63956: "need something better"; round-7 readers: cream 'BAGELS & BEANS' capitals fixed on a
// dark grey front): the capitals in a slab face like the brand badge's, in the measured cream.
made['bagels-and-beans'] = { buf: await trim(await sharp(svgText(2600, 300, `<text x="10" y="230" font-family="Rockwell" font-weight="bold" font-size="220" fill="#efe6cf">BAGELS &amp; BEANS</text>`)).png().toBuffer()), source: 'https://www.bagelsbeans.nl/', licence: 'lettering set in Rockwell Bold after the round-7 panorama read (retailBrandStyles.gen.ts)', note: 'cream capitals on dark grey' };
// Vlaamsch Broodhuys (note fab9c87b: "a logo & wordmark", their Eerste Constantijn Huygensstraat page): the site's
// white logo (wordmark either side of the baker's-hat mark).
{
  const buf = await trim(await sharp(path.join(SRC, 'vlaamsch-broodhuys-white.svg'), { density: 600 }).png().toBuffer());
  const m = { buf, source: 'https://www.vlaamschbroodhuys.nl/winkels/amsterdam/eerste-constantijn-huygensstraat/', renderUrl: 'https://www.vlaamschbroodhuys.nl/wp-content/uploads/2026/02/Vlaamsch-broodhuys-logo-white.svg', licence: 'trademark logo; brand site SVG', note: 'white logo on the brand brown' };
  made['vlaamsch-broodhuys'] = m; made['vlaamsch-broodhuis'] = m;
}
// Le Pain Quotidien (note 487b0d15: "has to be a wordmark we can find"): the brand site's header wordmark, in black.
made['le-pain-quotidien'] = { buf: await trim(await sharp(Buffer.from(fs.readFileSync(path.join(SRC, 'le-pain-quotidien-word.svg'), 'utf8').replace(/currentcolor/gi, '#000000')), { density: 72 * 12 }).png().toBuffer()), source: 'https://www.lepainquotidien.com/nl/en', licence: 'trademark logo; brand site header SVG', note: 'black wordmark on the cream board' };

const provFile = path.join(DIR, 'provenance.json'), prov = JSON.parse(fs.readFileSync(provFile, 'utf8')) as Record<string, Record<string, unknown>>;
for (const [key, m] of Object.entries(made)) {
  // Each wordmark at most 1200 px wide (the chain pages pack them at ~14000 px² anyway).
  const out = await sharp(m.buf).resize({ width: 1200, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  fs.writeFileSync(path.join(DIR, `${key}.png`), out);
  const { w, h } = await meta(out);
  prov[key] = { ...(prov[key] ?? {}), source: m.source, ...(m.renderUrl ? { renderUrl: m.renderUrl } : { renderUrl: undefined }), licence: m.licence, wordmark: m.note, fetched: FETCHED, file: undefined, sha1: undefined };
  console.log(`${key}: ${w} x ${h} (${(w / h).toFixed(2)})`);
}
fs.writeFileSync(provFile, JSON.stringify(prov, null, 1));
