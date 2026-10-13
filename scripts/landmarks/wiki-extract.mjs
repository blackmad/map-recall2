// Usage: node scripts/landmarks/wiki-extract.mjs <outFile.json> <lang> <title>
// Saves the plain-text extract of a Wikipedia article (raw API response) for research records; prints the first 3000 chars.
import fs from 'node:fs';
const [out, lang, title] = process.argv.slice(2);
const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`;
const r = await fetch(url, {headers: {'User-Agent': 'MapRecallResearch/1.0 (landmark modelling)'}});
const body = await r.text();
fs.writeFileSync(out, JSON.stringify({url, retrieved: new Date().toISOString(), status: r.status, body: JSON.parse(body)}, null, 1));
const page = Object.values(JSON.parse(body).query.pages)[0];
console.log(page.title, '\n', (page.extract ?? '').slice(0, 3000));
