// node commons.mjs list "<Category name>"            -> list files (title, size, date, author short)
// node commons.mjs get <outDir> "<File:...>" ...        -> download 1600px thumbs + <name>.json provenance (url, licence, author)
const [cmd, ...args] = process.argv.slice(2);
const api = 'https://commons.wikimedia.org/w/api.php';
const UA = {headers: {'User-Agent': 'MapRecallResearch/1.0 (whizziwig research; landmark modelling)'}};
import fs from 'node:fs';
if (cmd === 'list') {
  let cont = '';
  for (let i = 0; i < 6; i++) {
    const u = `${api}?action=query&format=json&generator=categorymembers&gcmtitle=${encodeURIComponent('Category:' + args[0])}&gcmlimit=200&gcmtype=file|subcat&prop=imageinfo&iiprop=size|timestamp|extmetadata${cont}`;
    const j = await (await fetch(u, UA)).json();
    for (const p of Object.values(j.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      const md = ii?.extmetadata ?? {};
      console.log(p.title, ii ? `${ii.width}x${ii.height}` : '', (md.DateTimeOriginal?.value ?? '').replace(/<[^>]+>/g, '').slice(0, 20));
    }
    if (!j.continue) break;
    cont = `&gcmcontinue=${encodeURIComponent(j.continue.gcmcontinue)}`;
  }
} else if (cmd === 'get') {
  const [outDir, ...titles] = args;
  fs.mkdirSync(outDir, {recursive: true});
  for (const t of titles) {
    const u = `${api}?action=query&format=json&titles=${encodeURIComponent(t)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600`;
    const j = await (await fetch(u, UA)).json();
    const p = Object.values(j.query.pages)[0], ii = p.imageinfo?.[0];
    if (!ii) { console.log('missing', t); continue; }
    const name = t.replace(/^File:/, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/\.(jpe?g|png|tiff?)$/i, '');
    const r = await fetch(ii.thumburl ?? ii.url, UA);
    fs.writeFileSync(`${outDir}/${name}.jpg`, Buffer.from(await r.arrayBuffer()));
    const md = ii.extmetadata ?? {};
    const clean = k => (md[k]?.value ?? '').replace(/<[^>]+>/g, '').trim();
    fs.writeFileSync(`${outDir}/${name}.json`, JSON.stringify({title: t, descriptionUrl: ii.descriptionurl, original: ii.url, fetched: ii.thumburl, retrieved: new Date().toISOString().slice(0, 10), width: ii.width, height: ii.height, licence: clean('LicenseShortName'), author: clean('Artist'), date: clean('DateTimeOriginal')}, null, 1));
    console.log(`${outDir}/${name}.jpg`, clean('LicenseShortName'), clean('DateTimeOriginal').slice(0, 10));
    await new Promise(r => setTimeout(r, 400));
  }
}
