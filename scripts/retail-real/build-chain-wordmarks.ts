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

type Made = { buf: Buffer; source: string; renderUrl?: string; licence: string; note: string; fetched?: string };
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
// The Bulldog (note 6927c21f: "bad image"; round 1's badge-and-small-word lockup drew a 1.6 m sign). Round 2
// (2026-11-20): the brand's round badge (cut from its horizontal logo) beside 'THE BULLDOG' set full height in a
// condensed sans, amber with a dark rim, as the channel letters over the Prinsengracht and Oudezijds fronts (city
// panoramas recording_2025-06-16_03-46-32_01045, recording_2025-06-16_06-42-40_02104).
{
  const src = fs.readFileSync(path.join(SRC, 'the-bulldog-horizontal.jpg'));
  const { w, h } = await meta(src);
  // The badge is the round mark at the left (cx, cy, r: the non-white bbox of the left third of the 600 x 200 file, less 1.5 px).
  const cx = 0.186 * w, cy = 0.4975 * h, r = 0.43 * h;
  const disc = await reink(src, (rr, g, b, _a, x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? [rr, g, b, 255] : [0, 0, 0, 0]));
  const badge = await trim(disc);
  const word = await trim(await sharp(svgText(2000, 360, `<text x="20" y="300" font-family="DIN Condensed" font-weight="bold" font-size="330" letter-spacing="8" fill="#f4ab37" stroke="#3a1c08" stroke-width="10" paint-order="stroke">THE BULLDOG</text>`)).png().toBuffer());
  made['the-bulldog'] = { buf: await row([{ buf: badge, h: H }, { buf: word, h: Math.round(H * 0.82) }], 36), source: 'https://www.thebulldog.com/', renderUrl: 'https://thebulldog.com/wp-content/uploads/2022/06/TB-International-Logo_horizontal_black-text.jpg', licence: 'trademark logo (badge, brand site JPG); lettering set in DIN Condensed Bold after the city panoramas', note: 'round 2: badge + full-height amber THE BULLDOG on the black board', fetched: '2026-11-20' };
}
// Bagels & Beans (note 28c63956: "need to figure out something better"; round 1 was plain cream Rockwell capitals).
// Round 2: the brand's own round badge (cup and bagel, from the site header SVG; the same disc hangs as a blade at
// Ferdinand Bolstraat) beside the name in an uncial face like the badge's lettering, in the cream of the fronts.
{
  const badge = await trim(await sharp(path.join(SRC, 'bagels-and-beans-badge.svg'), { density: 300 }).png().toBuffer());
  const word = await trim(await sharp(svgText(3000, 320, `<text x="10" y="240" font-family="Herculanum" font-size="240" letter-spacing="6" fill="#efe6cf">BAGELS &amp; BEANS</text>`)).png().toBuffer());
  made['bagels-and-beans'] = { buf: await row([{ buf: badge, h: H }, { buf: word, h: Math.round(H * 0.62) }], 40), source: 'https://www.bagelsbeans.nl/', renderUrl: 'https://www.bagelsbeans.nl/wp-content/themes/bagelsbeans/images/logo.svg', licence: 'trademark logo; brand site SVG; name set in Herculanum after the badge lettering', note: 'round 2: badge + cream uncial name on dark grey', fetched: '2026-11-20' };
}
// Vlaamsch Broodhuys (note fab9c87b: "a logo & wordmark", their Eerste Constantijn Huygensstraat page): the site's
// white logo (wordmark either side of the baker's-hat mark).
{
  const buf = await trim(await sharp(path.join(SRC, 'vlaamsch-broodhuys-white.svg'), { density: 600 }).png().toBuffer());
  const m = { buf, source: 'https://www.vlaamschbroodhuys.nl/winkels/amsterdam/eerste-constantijn-huygensstraat/', renderUrl: 'https://www.vlaamschbroodhuys.nl/wp-content/uploads/2026/02/Vlaamsch-broodhuys-logo-white.svg', licence: 'trademark logo; brand site SVG', note: 'white logo on the brand brown' };
  made['vlaamsch-broodhuys'] = m; made['vlaamsch-broodhuis'] = m;
}
// Le Pain Quotidien (note 487b0d15: "has to be a wordmark we can find"): the brand site's header wordmark, in black.
made['le-pain-quotidien'] = { buf: await trim(await sharp(Buffer.from(fs.readFileSync(path.join(SRC, 'le-pain-quotidien-word.svg'), 'utf8').replace(/currentcolor/gi, '#000000')), { density: 72 * 12 }).png().toBuffer()), source: 'https://www.lepainquotidien.com/nl/en', licence: 'trademark logo; brand site header SVG', note: 'black wordmark on the cream board' };

// ---- Round 2 (lane chain-logos2-20261120, David's Shopfronts notes of 2026-11-20). Colours read on city panoramas
// (data.amsterdam.nl, CC BY 4.0) of each chain's Amsterdam fronts; ids in each note.
const F2 = '2026-11-20';
/** Rasterise an SVG and trim it. */
const svgPng = async (file: string, density = 300) => trim(await sharp(path.join(SRC, file), { density }).png().toBuffer());
const near = (r: number, g: number, b: number, hex: string, tol = 90) => { const [R, G, B] = rgb(hex); return Math.abs(r - R) + Math.abs(g - G) + Math.abs(b - B) < tol; };
// New York Pizza (note f169fa60 "find logo"; Damstraat and Leidsestraat fronts: white name and red slice on a dark navy
// band): the brand's SVG with its green re-inked white and the white box cut away; the red slice kept.
made['new-york-pizza'] = {
  buf: await trim(await reink(await svgPng('new-york-pizza.svg', 900), (r, g, b, a) => (a < 20 ? [0, 0, 0, 0] : r > 200 && g > 200 && b > 200 ? [0, 0, 0, 0] : g > r + 40 ? [255, 255, 255, a] : [r, g, b, a]))),
  source: 'https://newyorkpizza.nl/', renderUrl: 'https://cdn.nyp01nlprd.solutions4delivery.com/ecom-cms/ecom-cms/assets/nyp_logo_original_RGB_7a3d4b3419.svg', licence: 'trademark logo; brand site SVG', note: 'round 2: white name, red slice, box cut away, on navy', fetched: F2,
};
// Domino's (note dedc4f0e; Overtoom/Ferdinand Bol fronts: the tile and a white 'Domino's' on a charcoal band): the
// Commons 2025 logo, its blue word re-inked white (the tile keeps its blue, red and white).
{
  const full = await svgPng('domino-s-2025.svg', 200), { w } = await meta(full);
  made['domino-s'] = { buf: await reink(full, (r, g, b, a, x) => (x > w * 0.2 && near(r, g, b, '#0090e2', 160) ? [255, 255, 255, a] : [r, g, b, a])), source: 'https://commons.wikimedia.org/wiki/File:Domino%27s_2025.svg', licence: 'Public domain (Commons)', note: 'round 2: tile + white word on charcoal', fetched: F2 };
}
// Pearle (note 74d10105; Leidsestraat/Ferdinand Bol fronts: white 'Pearle opticiens' and the dotted eye on a teal
// band): the brand SVG, its green re-inked white, the orange dots kept.
made.pearle = { buf: await reink(await svgPng('pearle.svg', 600), (r, g, b, a) => (near(r, g, b, '#009878', 200) ? [255, 255, 255, a] : [r, g, b, a])), source: 'https://www.pearle.nl/', renderUrl: 'https://cdn.grandvision.io/binaries/_ht_1560345119103/content/gallery/nl-pearle/logos/logo.svg', licence: 'trademark logo; brand site header SVG', note: 'round 2: white letters and eye, orange dots, on teal', fetched: F2 };
// De Pizzabakkers (note 38f5668d; Haarlemmerdijk front: white capitals on a warm grey band): the Commons logo in white.
made['de-pizzabakkers'] = { buf: await reink(await trim(fs.readFileSync(path.join(DIR, 'de-pizzabakkers.png'))), (_r, _g, _b, a) => [255, 255, 255, a]), source: 'https://commons.wikimedia.org/wiki/File:De_Pizzabakkers_Logo.png', licence: 'Public domain (Commons)', note: 'round 2: the logo in white on warm grey', fetched: F2 };
// Subway (note 6c7025c9; Kalverstraat corner: yellow SUB, white WAY over a dark green awning): the Commons logo, its
// green re-inked white.
made.subway = { buf: await reink(await svgPng('subway-2016.svg', 600), (r, g, b, a) => (g > r + 40 && g > b ? [255, 255, 255, a] : [r, g, b, a])), source: 'https://commons.wikimedia.org/wiki/File:Subway_2016_logo.svg', licence: 'Public domain (Commons)', note: 'round 2: yellow SUB, white WAY on dark green', fetched: F2 };
// Odido (note 0371c56d; the colour gradient mark read as blobs, so round 1 lettered the name): the mark in solid white
// on black, the brand's preferred use (merk.odido.nl/en/logo), from Simple Icons.
made.odido = { buf: await reink(await svgPng('odido-simple-icons.svg', 2400), (_r, _g, _b, a) => [255, 255, 255, a]), source: 'https://merk.odido.nl/en/logo', renderUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@16.38.0/icons/odido.svg', licence: 'trademark logo; Simple Icons path (CC0 data)', note: 'round 2: solid white mark on black', fetched: F2 };
// Grapedistrict (note 7e4a0ca9; Haarlemmerstraat and Ceintuurbaan fronts: lower-case yellow letters over a slate
// painted front): the brand site's SVG wordmark, in the sign's yellow.
made.grapedistrict = { buf: await reink(await svgPng('grapedistrict.svg', 600), (_r, _g, _b, a) => [244, 212, 40, a]), source: 'https://www.grapedistrict.nl/', renderUrl: 'https://www.grapedistrict.nl/media/0a/03/0c/1701770140/logo_%2879%29.svg', licence: 'trademark logo; brand site SVG', note: 'round 2: yellow wordmark on slate', fetched: F2 };
// Cigo (note 4ec47913 "crop sign or find wide one"): the brand site's wide logo (the red CIGO plate on its black band
// with 'da's mooi meegenomen'), on a black board.
made.cigo = { buf: await trim(fs.readFileSync(path.join(SRC, 'cigo-wide.png'))), source: 'https://www.cigo.nl/', renderUrl: 'https://www.cigo.nl/wp-content/uploads/2018/06/logo-cigo-1024x200.png', licence: 'trademark logo; brand site PNG', note: 'round 2: the wide band logo on black', fetched: F2 };
// ALDI (note 1e82ea1f "make it a long one"; Ceintuurbaan front, pano 2025_09_26_10_36_44_00814: blue ALDI channel
// letters with a white rim over a red bar): the square logo, then the long ALDI over its red bar.
{
  const mark = await trim(fs.readFileSync(path.join(DIR, 'aldi.png')));
  const t = await trim(await sharp(svgText(1400, 360, `<text x="20" y="300" font-family="Helvetica Neue" font-weight="bold" font-size="320" letter-spacing="10" fill="#1d6fb8" stroke="#ffffff" stroke-width="14" paint-order="stroke">ALDI</text>`)).png().toBuffer());
  const { w, h } = await meta(t), bar = Math.round(h * 0.12);
  const word = await sharp({ create: { width: w, height: h + bar * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, left: 0, top: 0 }, { input: svgText(w, bar, `<rect width="${w}" height="${bar}" fill="#e2001a"/>`), left: 0, top: h + bar }]).png().toBuffer();
  made.aldi = { buf: await row([{ buf: mark, h: H }, { buf: word, h: Math.round(H * 0.92) }], 50), source: 'https://commons.wikimedia.org/wiki/File:AldiNord-WorldwideLogo.svg', licence: 'Public domain (Commons) mark; ALDI set in Helvetica Neue Bold after the panorama', note: 'round 2: mark + long ALDI with red bar', fetched: F2 };
}
// Simon Meijssen (note 3215c933: "pretty iconic art-deco - front could be less generic"; Ruysdaelstraat corner, pano
// recording_2025-07-30_08-35-53_00865): a bottle-green glazed tile frieze edged above and below by a row of ochre
// diamonds, gold geometric capitals between. Drawn as the whole board (the chain's fascia is the tile green), with the
// pilasters' amber glaze as the frame and the brown awning (chain-overrides.json frame, awning).
{
  const W = 3000, Hh = 360, green = '#1f4b31', ochre = '#c98d36', gold = '#d2ab55';
  const diamonds = (y: number) => { let d = ''; for (let x = 26; x < W; x += 60) d += `<path d="M${x} ${y - 24}L${x + 24} ${y}L${x} ${y + 24}L${x - 24} ${y}Z" fill="${ochre}"/>`; return `<rect x="0" y="${y - 30}" width="${W}" height="4" fill="${gold}"/><rect x="0" y="${y + 27}" width="${W}" height="4" fill="${gold}"/>${d}`; };
  const svg = `<rect width="${W}" height="${Hh}" fill="${green}"/>${diamonds(36)}${diamonds(Hh - 36)}<text x="${W / 2}" y="254" text-anchor="middle" font-family="Futura" font-weight="500" font-size="200" letter-spacing="34" fill="${gold}">SIMON MEIJSSEN</text>`;
  made['simon-meijssen'] = { buf: await sharp(svgText(W, Hh, svg)).png().toBuffer(), source: 'https://api.data.amsterdam.nl/panorama/panoramas/recording_2025-07-30_08-35-53_00865/', licence: 'drawn after the city panorama (CC BY 4.0): tile frieze and lettering set in Futura Medium', note: 'round 2: green tile frieze, ochre diamonds, gold capitals', fetched: F2 };
}

// ---- Round 3 (lane shopfront-feedback-20261123, David's 41 Shopfronts notes of 2026-11-23). Sources fetched
// 2026-11-23 into chain-logos/src/ (URL per key); board colours read on city panoramas (data.amsterdam.nl, CC BY 4.0)
// where one shows the front (pano ids in each note), else the logo's own.
const F3 = '2026-11-23';
/** The horizontal bands of a transparent image: runs of rows holding any pixel with alpha > 24, top to bottom. */
async function bands(buf: Buffer): Promise<Array<[number, number]>> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let y = 0; y <= info.height; y++) {
    let any = false;
    if (y < info.height) for (let x = 0; x < info.width && !any; x++) any = data[(y * info.width + x) * 4 + 3] > 24;
    if (any && start < 0) start = y;
    if (!any && start >= 0) { out.push([start, y]); start = -1; }
  }
  return out;
}
const band = async (buf: Buffer, [y0, y1]: [number, number]) => { const { w } = await meta(buf); return trim(await sharp(buf).extract({ left: 0, top: y0, width: w, height: y1 - y0 }).png().toBuffer()); };
/** One line of lettering in a macOS face, trimmed. */
const letter = async (text: string, font: string, fill: string, extra = '') => trim(await sharp(svgText(Math.max(1200, text.length * 260), 360, `<text x="20" y="280" font-family="${font}" font-size="260" fill="${fill}" ${extra}>${text.replace(/&/g, '&amp;')}</text>`)).png().toBuffer());
const white = (_r: number, _g: number, _b: number, a: number): [number, number, number, number] => [255, 255, 255, a];

// Praxis City (note 2c64ffff "reuse praxis?"; Kinkerstraat front, pano TMX7316010203-001148_pano_0000_000805: the
// Praxis word and 'City' run together in the same yellow on a dark grey band): the Praxis logo, then 'City'.
{
  const mark = await trim(fs.readFileSync(path.join(DIR, 'praxis.png')));
  made['praxis-city'] = { buf: await row([{ buf: mark, h: H }, { buf: await letter('City', 'Helvetica Neue', '#ffd500', 'font-weight="bold"'), h: Math.round(H * 0.74) }], 30), source: 'https://commons.wikimedia.org/wiki/File:Praxis_logo_2018.svg', licence: 'Public domain (Commons) Praxis logo; City set in Helvetica Neue Bold after the panorama', note: 'round 3: Praxis logo + yellow City on dark grey', fetched: F3 };
}
// Taco Mundo (note 0ca8bd5e): the brand site's logo (red TACO MUNDO round the sun disc, 'Mexican Delivery' below).
made['taco-mundo'] = { buf: await trim(fs.readFileSync(path.join(SRC, 'taco-mundo.png'))), source: 'https://tacomundo.com/', renderUrl: 'https://cdn.prod.website-files.com/67c98627c9c2b7dee9caccea/67c99435bb64747cc726a005_TM_logo-mexican%20delivery_2023_-01.png', licence: 'trademark logo; brand site PNG', note: 'round 3: red logo on white', fetched: F3 };
// Anne&Max (note 2ed2ff9e): the brand site's header badge (brown Anne&Max on the white trapezoid), on a dark board.
made['anne-and-max'] = { buf: await svgPng('anne-and-max.svg', 600), source: 'https://www.annemax.nl/', renderUrl: 'https://annemax.nl/app/uploads/2026/04/logo-2.svg', licence: 'trademark logo; brand site SVG', note: 'round 3: white badge on dark board', fetched: F3 };
// pipoos (note 023b3ee6; Ceintuurbaan 334, pano TMX7316010203-002469_pano_0000_001968: red pipoos on a dark grey band).
made.pipoos = { buf: await svgPng('pipoos.svg', 600), source: 'https://www.pipoos.com/', renderUrl: 'https://www.pipoos.com/cdn/shop/files/pipoos-logo.svg?v=1781179010', licence: 'trademark logo; brand site SVG', note: 'round 3: red word on dark grey', fetched: F3 };
// Massimo Gelato (note 9d43e0cd): the site's round badge (green on cream), then the name in its green, so the round
// mark keeps to the board (a lone disc drew a 0.95 m lightbox).
made['massimo-gelato'] = { buf: await row([{ buf: await svgPng('massimo-gelato.svg', 600), h: H }, { buf: await letter('MASSIMO GELATO', 'Futura', '#5f7d43', 'font-weight="bold" letter-spacing="14"'), h: Math.round(H * 0.42) }], 50), source: 'https://www.massimogelato.nl/', renderUrl: 'https://www.massimogelato.nl/assets/files/logo.svg', licence: 'trademark logo; brand site SVG; name set in Futura Medium in the badge green', note: 'round 3: badge + green name on cream', fetched: F3 };
// De Bakkerszonen (note 973203b2; Land van Cocagneplein corner, pano: black frames): the site's logo (copper pretzel
// and black DE BAKKERS ZONEN), its black lettering re-inked white for the black board.
made['de-bakkerszonen'] = { buf: await reink(await trim(fs.readFileSync(path.join(SRC, 'de-bakkerszonen.png'))), (r, g, b, a) => (r + g + b < 150 ? [255, 255, 255, a] : [r, g, b, a])), source: 'https://www.debakkerszonen.nl/', renderUrl: 'https://mosveld.debakkerszonen.nl/storage/images/logos/6621366a7aa6c_BZ_Logo_staand.png', licence: 'trademark logo; brand site PNG', note: 'round 3: copper pretzel + white lettering on black', fetched: F3 };
// Halal Fried Chicken (note dd6c41f9; Burgemeester De Vlugtlaan 60-62, pano TMX7316010203-000831_pano_0000_001471:
// white flared small capitals on a maroon band; the brand site is a parked page): the name set in Copperplate Bold.
made['halal-fried-chicken'] = { buf: await letter('HALAL FRIED CHICKEN', 'Copperplate', '#ffffff', 'font-weight="bold" letter-spacing="10"'), source: 'https://api.data.amsterdam.nl/panorama/panoramas/TMX7316010203-000831_pano_0000_001471/', licence: 'drawn after the city panorama (CC BY 4.0): lettering set in Copperplate Bold', note: 'round 3: white capitals on maroon', fetched: F3 };
// Bakkerij Kara Firin (note 985d6e6a "Wordmark?"; Osdorp front, pano b_20240925_0919_Track35_Sphere_00951: heavy white
// capitals on a dark brown board; the site has no logo file): the name in Arial Black, white.
made['bakkerij-kara-firin'] = { buf: await letter('BAKKERIJ KARA FIRIN', 'Arial Black', '#ffffff', 'letter-spacing="6"'), source: 'https://api.data.amsterdam.nl/panorama/panoramas/b_20240925_0919_Track35_Sphere_00951/', licence: 'drawn after the city panorama (CC BY 4.0): lettering set in Arial Black', note: 'round 3: white heavy capitals on dark brown', fetched: F3 };
// Alexanderhoeve (note 0c373fc0 "why pure white": the site's footer A was white, packed on a white board). The brand
// site's white logo (farmhouse, Alexanderhoeve, 'kaas & noten') on the dark green fascia of the Rijnstraat front (pano
// TMX7316010203-001173_pano_0000_005735, fascia and banners #25402a-#425746 in shade).
made.alexanderhoeve = { buf: await trim(fs.readFileSync(path.join(SRC, 'alexanderhoeve-white.png'))), source: 'https://www.alexanderhoevekaas.nl/', renderUrl: 'https://alexanderhoeve.blob.core.windows.net/platform/alexanderhoeve-logo-wit.png', licence: 'trademark logo; brand site PNG', note: 'round 3: white logo on the shop green', fetched: F3 };
// GWK Travelex (note bb6d47b2; Kalverstraat 150, pano TMX7316010203-001530_pano_0004_000054: blue GWK Travelex and red
// 'worldwide money' over the door): the Commons logo (blue band and red tab).
made['gwk-travelex'] = { buf: await trim(fs.readFileSync(path.join(SRC, 'gwk-travelex-commons.jpg'))), source: 'https://commons.wikimedia.org/wiki/File:GWK_Travelex_logo.jpg', licence: 'Commons file (text logo)', note: 'round 3: blue band + red tab on white', fetched: F3 };
// Dunkin' (note 233ec46d; the chain was lettered because its Commons image was a shop photo): the Commons 2019
// wordmark (orange DUNKIN' with the pink apostrophe), on the dark grey of the Reguliersbreestraat front.
made.dunkin = { buf: await svgPng('dunkin-commons.svg', 300), source: "https://commons.wikimedia.org/wiki/File:Dunkin'_logo.svg", licence: 'Commons file (text logo)', note: 'round 3: orange wordmark on dark grey', fetched: F3 };
// Beter Bed (note 2084985b): the logo drew 'Beter Bed Holding' (the holding company's box). Its blue Beter Bed alone,
// on the orange of the box.
made['beter-bed'] = { buf: await trim(await reink(fs.readFileSync(path.join(SRC, 'beter-bed-holding.png')), (r, g, b, a) => (b > r + 40 && b > g ? [r, g, b, a] : [0, 0, 0, 0]))), source: 'https://commons.wikimedia.org/wiki/File:BeterBed-logo.svg', licence: 'Commons file (text logo)', note: "round 3: blue 'Beter Bed' without 'Holding', on orange", fetched: F3 };
// Nespresso (note 1dac1124 "logo then wordmark on one line"): the Commons monogram (white N on black), then the Commons
// wordmark in white, for the black board.
{
  const mono = await trim(fs.readFileSync(path.join(SRC, 'nespresso-monogram.png')));
  const word = await reink(await svgPng('nespresso-wordmark.svg', 600), white);
  made.nespresso = { buf: await row([{ buf: mono, h: H }, { buf: word, h: Math.round(H * 0.62) }], 40), source: 'https://commons.wikimedia.org/wiki/File:Nespresso_logo_(wordmark).svg', licence: 'Commons files (text logo): monogram File:Monogramme_Nespresso.png, wordmark File:Nespresso_logo_(wordmark).svg', note: 'round 3: monogram + white wordmark on one line, on black', fetched: F3 };
}
// Rituals (note 79ee786c "long wordmark ... ideally both"): the square mark (Commons), then the brand site's
// RITUALS... wordmark in white, on black.
made.rituals = { buf: await row([{ buf: await trim(fs.readFileSync(path.join(SRC, 'rituals-mark.png'))), h: H }, { buf: await reink(await svgPng('rituals-word.svg', 1200), white), h: Math.round(H * 0.42) }], 50), source: 'https://www.rituals.com/', renderUrl: 'https://www.rituals.com/en-nl/home (header SVG)', licence: 'trademark logo; mark from Commons File:Rituals_Cosmetics_logo.png, wordmark from the brand site header SVG', note: 'round 3: square mark + RITUALS... on black', fetched: F3 };
// Simon Lévelt (note eab1ebda "split out the since line"): the brand site's logo, its 'SINDS 1826' band set beside the
// script name (stacked under it, it shrank the name), in the logo's green on white.
{
  const full = await svgPng('simon-levelt.svg', 600), bs = await bands(full);
  const name = await band(full, [bs[0][0], bs[bs.length - 2][1]]), since = await band(full, bs[bs.length - 1]);
  made['simon-levelt'] = { buf: await row([{ buf: name, h: H }, { buf: since, h: Math.round(H * 0.16) }], 60), source: 'https://www.simonlevelt.nl/', renderUrl: 'https://www.simonlevelt.nl/on/demandware.static/-/Sites-simonlevelt-Library/default/dw62b437bc/branding/logo.svg', licence: 'trademark logo; brand site SVG', note: "round 3: script name with 'SINDS 1826' beside it", fetched: F3 };
}
// Ekoplaza (note b76bc5bd "rearrange the logo to be wide"): the Commons logo's leaf (its green pixels, without the
// purple rules) beside EKOPLAZA, on one line.
{
  const full = await trim(fs.readFileSync(path.join(SRC, 'ekoplaza-commons.png'))), bs = await bands(full);
  const leaf = await trim(await reink(await band(full, bs[0]), (r, g, b, a) => (g > r + 20 && g > b ? [r, g, b, a] : [0, 0, 0, 0])));
  const word = await band(full, bs[bs.length - 1]);
  made.ekoplaza = { buf: await row([{ buf: leaf, h: H }, { buf: word, h: Math.round(H * 0.62) }], 36), source: 'https://commons.wikimedia.org/wiki/File:Logo_of_Ekoplaza.svg', licence: 'Commons file (text logo)', note: 'round 3: leaf + EKOPLAZA on one line', fetched: F3 };
  // Ekoplaza Foodmarqt (note cbe3fcb1 "a different logo that includes Marqt"; the former Marqt fronts on Bilderdijkstraat
  // and Ceintuurbaan, panos TMX7316010203-002059_pano_0000_002311 and -002112_pano_0001_001579: lower-case 'marqt' and
  // green-and-white striped awnings): the wide Ekoplaza, then 'foodmarqt' in lower case in the leaf green.
  const fm = await letter('foodmarqt', 'Helvetica Neue', '#4c8c2b', 'font-weight="500"');
  made['ekoplaza-foodmarqt'] = { buf: await row([{ buf: leaf, h: H }, { buf: word, h: Math.round(H * 0.62) }, { buf: fm, h: Math.round(H * 0.7) }], 36), source: 'https://www.ekoplaza.nl/nl/foodmarqt', licence: "Commons Ekoplaza logo (text logo); 'foodmarqt' set in Helvetica Neue Medium after the store fronts", note: 'round 3: leaf + EKOPLAZA + foodmarqt', fetched: F3 };
}
// H&M (note b89bf416 "doesn't fit good") and Uniqlo (note 981a7974 "overflowing"): their marks are square-ish (aspect
// under 1.6), so the front drew them as a 0.95 m lightbox standing over the 0.6 m board. chain-overrides.json minAspect
// pads them to a wordmark cell inside the board (as Lidl); the sources are the committed Commons renders.
// Pets Place: the stacked two-line mark read as two small lines on the board; the name on one line, white on the red board.
made['pets-place'] = { buf: await letter('pets place', 'Arial Rounded MT Bold', '#ffffff'), source: 'https://commons.wikimedia.org/wiki/File:Pets_Place_logo_01.png', licence: 'name set in Arial Rounded Bold after the Commons logo (src/pets-place-commons.png)', note: 'round 3b: white pets place on one line, on red', fetched: F3 };
made['h-and-m'] = { buf: await trim(fs.readFileSync(path.join(SRC, 'h-and-m-commons.png'))), source: 'https://commons.wikimedia.org/wiki/File:H%26M-Logo.svg', licence: 'Public domain (Commons)', note: 'round 3: padded to fit the board (minAspect)', fetched: F3 };
made.uniqlo = { buf: await trim(fs.readFileSync(path.join(SRC, 'uniqlo-commons.png'))), source: 'https://commons.wikimedia.org/wiki/File:UNIQLO_logo.svg', licence: 'Public domain (Commons)', note: 'round 3: padded to fit the board (minAspect)', fetched: F3 };

// ---- Round 3b (coordinator review of the logo sheet): a logo must never read worse than the lettering it replaces. A
// mark whose name is small inside it (a badge, a stacked or square mark) is set as mark + the name in big letters on one
// line, or the name alone is lifted out of the mark, so the name fills the board's height (retailFront.ts draws a wide
// logo at the board's height).
const keep = (pred: (r: number, g: number, b: number, a: number) => boolean, ink?: string) => (r: number, g: number, b: number, a: number): [number, number, number, number] => {
  if (!pred(r, g, b, a)) return [0, 0, 0, 0];
  if (!ink) return [r, g, b, a];
  const [R, G, B] = rgb(ink); return [R, G, B, a];
};
const tallest = async (buf: Buffer) => { const bs = await bands(buf); return band(buf, bs.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m))); };
{
  // Anne&Max: the brown name lifted out of the white badge (no subtitle, no rule), white on the dark board.
  const svg = await svgPng('anne-and-max.svg', 600);
  const name = await tallest(await trim(await reink(svg, keep((r, g, b, a) => a > 60 && r + g + b < 330 && !(g > r + 20), '#ffffff'))));
  made['anne-and-max'] = { buf: name, source: 'https://www.annemax.nl/', renderUrl: 'https://annemax.nl/app/uploads/2026/04/logo-2.svg', licence: 'trademark logo; brand site SVG (the name lifted out of the badge)', note: 'round 3b: the Anne&Max name, white, filling the dark board', fetched: F3 };
}
made['massimo-gelato'] = { buf: await row([{ buf: await svgPng('massimo-gelato.svg', 600), h: H }, { buf: await letter('MASSIMO GELATO', 'Futura', '#5f7d43', 'font-weight="bold" letter-spacing="6"'), h: Math.round(H * 0.72) }], 40), source: 'https://www.massimogelato.nl/', renderUrl: 'https://www.massimogelato.nl/assets/files/logo.svg', licence: 'trademark logo; brand site SVG; name set in Futura Bold in the badge green', note: 'round 3b: badge + big green name on cream', fetched: F3 };
{
  // De Bakkerszonen: the copper pretzel, then the name on one line in white capitals (the stacked logo's name was a quarter of the board).
  const pretzel = await trim(await reink(fs.readFileSync(path.join(SRC, 'de-bakkerszonen.png')), keep((r, g, b, a) => a > 24 && r > b + 50)));
  made['de-bakkerszonen'] = { buf: await row([{ buf: pretzel, h: H }, { buf: await letter('DE BAKKERSZONEN', 'Helvetica Neue', '#ffffff', 'font-weight="bold"'), h: Math.round(H * 0.6) }], 40), source: 'https://www.debakkerszonen.nl/', renderUrl: 'https://mosveld.debakkerszonen.nl/storage/images/logos/6621366a7aa6c_BZ_Logo_staand.png', licence: 'trademark logo (pretzel) from the brand site PNG; name set in Helvetica Neue Bold', note: 'round 3b: copper pretzel + DE BAKKERSZONEN on one line, on black', fetched: F3 };
}
made['burger-king'] = { buf: await row([{ buf: await trim(fs.readFileSync(path.join(SRC, 'burger-king-commons.png'))), h: H }, { buf: await letter('BURGER KING', 'Arial Rounded MT Bold', '#f5ebdc'), h: Math.round(H * 0.72) }], 40), source: 'https://commons.wikimedia.org/wiki/File:Burger_King_2020.svg', licence: 'Public domain (Commons); name set in Arial Rounded Bold', note: 'round 3b: bun mark + cream BURGER KING on the brown board', fetched: F3 };
{
  const v = await trim(fs.readFileSync(path.join(SRC, 'vodafone-commons.png'))), bs = await bands(v);
  made.vodafone = { buf: await row([{ buf: await band(v, bs[0]), h: H }, { buf: await band(v, bs[bs.length - 1]), h: Math.round(H * 0.85) }], 40), source: 'https://commons.wikimedia.org/wiki/File:Vodafone_logo_1997.png', licence: 'Public domain (Commons)', note: 'round 3b: speech mark + vodafone side by side on one line', fetched: F3 };
}
// Specsavers: the white name lifted out of the green ovals, on a green board (chain-overrides fascia).
made.specsavers = { buf: await trim(await reink(fs.readFileSync(path.join(SRC, 'specsavers-commons.png')), keep((r, g, b, a) => a > 60 && r > 200 && g > 200 && b > 200))), source: 'https://commons.wikimedia.org/wiki/File:Specsavers_logo.svg', licence: 'Public domain (Commons); the name lifted out of the ovals', note: 'round 3b: white Specsavers on the green board', fetched: F3 };
// Papa John's: the red name lifted out of the badge (no PIZZA banner, no outline), red on white.
made['papa-john-s'] = { buf: await tallest(await trim(await reink(fs.readFileSync(path.join(SRC, 'papa-john-s-commons.png')), keep((r, g, b, a) => a > 60 && r > 150 && g < 90 && b < 90)))), source: "https://commons.wikimedia.org/wiki/File:Papa_John%27s_Logo_2019.svg", licence: 'Public domain (Commons); the name lifted out of the badge', note: "round 3b: red PAPA JOHN'S on white", fetched: F3 };
made['dille-and-kamille'] = { buf: await row([{ buf: await trim(fs.readFileSync(path.join(SRC, 'dille-and-kamille-commons.png'))), h: H }, { buf: await letter('DILLE & KAMILLE', 'American Typewriter', '#111111', 'font-weight="bold"'), h: Math.round(H * 0.5) }], 40), source: 'https://commons.wikimedia.org/wiki/File:Dille_%26_Kamille_Logo.png', licence: 'Public domain (Commons); name set in American Typewriter Bold', note: 'round 3b: octagon mark + DILLE & KAMILLE on one line, on white', fetched: F3 };
{
  const t = await trim(fs.readFileSync(path.join(SRC, 'flying-tiger-copenhagen-commons.png'))), bs = await bands(t);
  made['flying-tiger-copenhagen'] = { buf: await band(t, bs[0]), source: 'https://commons.wikimedia.org/wiki/File:Flying_Tiger_Copenhagen.svg', licence: 'Public domain (Commons)', note: "round 3b: 'flying tiger' alone (the small 'copenhagen' line dropped) so the name fills the board", fetched: F3 };
}
{
  // GWK Travelex: the name in the brand blue, big, then the red 'worldwide money' tab (cut from the Commons logo) at full height.
  const jpg = await sharp(path.join(SRC, 'gwk-travelex-commons.jpg')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = jpg.info, my = Math.floor(h / 2);
  let cut = w - 1;
  for (let x = 0; x < w; x++) { const i = (my * w + x) * 4; if (jpg.data[i] > 180 && jpg.data[i + 1] < 90 && jpg.data[i + 2] < 90) { cut = x; break; } }
  const tab = await trim(await sharp(path.join(SRC, 'gwk-travelex-commons.jpg')).extract({ left: cut, top: 0, width: w - cut, height: h }).png().toBuffer());
  made['gwk-travelex'] = { buf: await row([{ buf: await letter('GWK Travelex', 'Helvetica Neue', '#1d3f94', 'font-weight="bold"'), h: Math.round(H * 0.86) }, { buf: tab, h: H }], 30), source: 'https://commons.wikimedia.org/wiki/File:GWK_Travelex_logo.jpg', licence: 'Commons file (text logo); name set in Helvetica Neue Bold in the brand blue', note: "round 3b: big blue GWK Travelex + the red 'worldwide money' tab, on white (panorama TMX7316010203-001530_pano_0004_000054)", fetched: F3 };
}
// Pets Place: the stacked two-line mark read as two small lines on the board; the name on one line, white on the red board.
made['pets-place'] = { buf: await letter('pets place', 'Arial Rounded MT Bold', '#ffffff'), source: 'https://commons.wikimedia.org/wiki/File:Pets_Place_logo_01.png', licence: 'name set in Arial Rounded Bold after the Commons logo (src/pets-place-commons.png)', note: 'round 3b: white pets place on one line, on red', fetched: F3 };
made['h-and-m'] = { buf: await trim(fs.readFileSync(path.join(SRC, 'h-and-m-commons.png'))), source: 'https://commons.wikimedia.org/wiki/File:H%26M-Logo.svg', licence: 'Public domain (Commons)', note: 'round 3b: the mark at the board height (retailFront.ts own-front square mark)', fetched: F3 };
made.uniqlo = { buf: await row([{ buf: await trim(fs.readFileSync(path.join(SRC, 'uniqlo-commons.png'))), h: H }, { buf: await letter('UNIQLO', 'Helvetica Neue', '#e3001b', 'font-weight="bold" letter-spacing="30"'), h: Math.round(H * 0.7) }], 50), source: 'https://commons.wikimedia.org/wiki/File:UNIQLO_logo.svg', licence: 'Public domain (Commons); UNIQLO set in Helvetica Neue Bold in the brand red', note: 'round 3b: red square + big red UNIQLO on white', fetched: F3 };

// `--only=a,b`: write just these keys (round 1's files stay as committed).
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const provFile = path.join(DIR, 'provenance.json'), prov = JSON.parse(fs.readFileSync(provFile, 'utf8')) as Record<string, Record<string, unknown>>;
for (const [key, m] of Object.entries(made)) {
  if (only && !only.includes(key)) continue;
  // Each wordmark at most 1200 px wide (the chain pages pack them at ~14000 px² anyway).
  const out = await sharp(m.buf).resize({ width: 1200, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  fs.writeFileSync(path.join(DIR, `${key}.png`), out);
  const { w, h } = await meta(out);
  prov[key] = { ...(prov[key] ?? {}), source: m.source, ...(m.renderUrl ? { renderUrl: m.renderUrl } : { renderUrl: undefined }), licence: m.licence, wordmark: m.note, fetched: m.fetched ?? FETCHED, file: undefined, sha1: undefined };
  console.log(`${key}: ${w} x ${h} (${(w / h).toFixed(2)})`);
}
fs.writeFileSync(provFile, JSON.stringify(prov, null, 1));
