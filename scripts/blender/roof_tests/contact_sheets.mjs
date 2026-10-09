import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const output = 'artifacts/building-library/roof-tests';
const recipeRoot = 'scripts/blender/building_lib/recipes';
const allRecipes = await Promise.all((await fs.readdir(recipeRoot)).filter(name => name.endsWith('.json')).sort().map(async name => JSON.parse(await fs.readFile(path.join(recipeRoot, name), 'utf8'))));
const recipes = (await Promise.all(allRecipes.map(async recipe => {
  try {
    await fs.access(path.join(output, `${recipe.id}-before-front-gable.png`));
    return recipe;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}))).filter(Boolean);
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

for (const view of ['front-gable', 'roof-join', 'rear-roof']) {
  const layers = [];
  for (const [index, recipe] of recipes.entries()) {
    const pairColumn = index % 2;
    const row = Math.floor(index / 2);
    for (const [stateIndex, state] of ['before', 'after'].entries()) {
      const left = (pairColumn * 2 + stateIndex) * 320;
      const top = row * 412;
      const filename = path.join(output, `${recipe.id}-${state}-${view}.png`);
      const resized = await sharp(filename).resize({ width: 308, height: 365, fit: 'inside' }).toBuffer({ resolveWithObject: true });
      layers.push({ input: resized.data, left: left + Math.floor((320 - resized.info.width) / 2), top: top + 42 });
      layers.push({ input: Buffer.from(`<svg width="320" height="40"><text x="8" y="15" font-size="13">${xml(recipe.id)}</text><text x="8" y="32" font-size="13">${state} / ${view}</text></svg>`), left, top });
    }
  }
  await sharp({ create: { width: 1280, height: Math.ceil(recipes.length / 2) * 412, channels: 3, background: '#eeeeee' } }).composite(layers).jpeg({ quality: 94 }).toFile(path.join(output, `compare-${view}.jpg`));
}

const fixtureRoot = path.join(output, 'fixtures');
try {
  const files = (await fs.readdir(fixtureRoot)).filter(name => name.endsWith('-roof.png')).sort();
  const layers = [];
  for (const [index, name] of files.entries()) {
    const left = index % 5 * 300;
    const top = Math.floor(index / 5) * 330;
    const image = await sharp(path.join(fixtureRoot, name)).resize(290, 290).toBuffer();
    layers.push({ input: image, left: left + 5, top: top + 35 });
    layers.push({ input: Buffer.from(`<svg width="300" height="32"><text x="5" y="22" font-size="12">${xml(name.replace('-roof.png', ''))}</text></svg>`), left, top });
  }
  await sharp({ create: { width: 1500, height: Math.ceil(files.length / 5) * 330, channels: 3, background: '#eeeeee' } }).composite(layers).jpeg({ quality: 94 }).toFile(path.join(output, 'fixture-contact-sheet.jpg'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
