// Blind A/B against today: the after band of <sheet> ("new") against its before band ("old", what the game draws now).
// shuffled into A/B by tag + salt; key appended to <keyFile>.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const [sheet, oldSheet, outDir, tag, keyFile, salt = 'r7vs'] = process.argv.slice(2);
const bandOf = async (f: string, i: number) => { const m = await sharp(f).metadata(); const H = (m.height! - 182) / 3; return sharp(f).extract({ left: 0, top: 26 + i * (H + 52) + 26, width: m.width!, height: H }); };
const dir = path.join(outDir, tag); fs.mkdirSync(dir, { recursive: true });
const flip = crypto.createHash('sha1').update(tag + salt).digest()[0] % 2 === 1;
await (await bandOf(sheet, 0)).jpeg({ quality: 88 }).toFile(path.join(dir, 'photo.jpg'));
const nw = await bandOf(sheet, 2), od = await bandOf(oldSheet, 1);
await (flip ? nw : od).jpeg({ quality: 88 }).toFile(path.join(dir, 'A.jpg'));
await (flip ? od : nw).jpeg({ quality: 88 }).toFile(path.join(dir, 'B.jpg'));
const keys = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')) : {};
keys[tag] = { A: flip ? 'new' : 'old', B: flip ? 'old' : 'new', sheet, oldSheet };
fs.writeFileSync(keyFile, JSON.stringify(keys, null, 1));
console.log(tag, flip);
