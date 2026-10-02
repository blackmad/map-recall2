// Guards the published neighbourhood trivia of every extract city: shape, provenance, and
// that no Dutch text ships without a reviewed English.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EXTRACT_CITIES } from '../src/mapRecall/cityExtracts';

let checked = 0;
for (const city of EXTRACT_CITIES) {
  const dir = `public/data/extracts/${city.id}`;
  if (!existsSync(`${dir}/neighborhood-history.json`)) continue;
  const names = new Set<string>(JSON.parse(readFileSync(`${dir}/boundaries.json`, 'utf8')).map((b: { name: string }) => b.name));
  const history = JSON.parse(readFileSync(`${dir}/neighborhood-history.json`, 'utf8')).neighborhoods as Array<Record<string, any>>;
  const seen = new Set<string>();
  for (const entry of history) {
    assert.ok(names.has(entry.name), `${city.id}: "${entry.name}" is not a boundary name`);
    assert.ok(!seen.has(entry.name), `${city.id}: duplicate entry for ${entry.name}`);
    seen.add(entry.name);
    for (const field of ['description', 'history', 'nameOrigin']) {
      const text = entry[field];
      if (!text) continue;
      const where = `${city.id}/${entry.name}.${field}`;
      assert.ok(typeof text.en === 'string' && text.en.length > 20, `${where}: missing English`);
      assert.match(text.sourceUrl, /^https:\/\//, `${where}: source URL`);
      assert.ok(text.lang === 'en' || text.lang === 'nl', `${where}: language`);
      if (text.lang === 'nl') {
        assert.ok(text.original && text.original !== text.en, `${where}: Dutch needs its original kept and a different English`);
        assert.ok(!/\b(het|een|van de|naar de)\b/.test(text.en.replace(/'[^']*'/g, '')), `${where}: English still looks Dutch`);
      }
      if (text.kind === 'derived') assert.ok(text.sourceLabel, `${where}: composed text must name its source`);
      assert.ok(text.en.length < 1200, `${where}: unreasonably long`);
    }
  }
  if (existsSync(`${dir}/neighborhoods-enriched.json`)) {
    for (const photo of JSON.parse(readFileSync(`${dir}/neighborhoods-enriched.json`, 'utf8')) as Array<Record<string, any>>) {
      assert.ok(names.has(photo.name), `${city.id}: photo for unknown area "${photo.name}"`);
      if (photo.imageUrl) {
        assert.match(photo.imageUrl, /^https:\/\//, `${city.id}/${photo.name}: image URL`);
        assert.ok(photo.imageAttribution, `${city.id}/${photo.name}: a photo needs its attribution`);
        assert.ok(!/(Map[_-]NL|locator|_kaart\.)/i.test(photo.imageUrl), `${city.id}/${photo.name}: locator maps are not photos`);
      }
    }
  }
  checked++;
}
assert.ok(checked >= 1, 'at least one city has published trivia');
console.log(`Neighbourhood trivia data OK for ${checked} cities.`);
