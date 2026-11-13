/**
 * One-off catalogue repair for recipe installs (lane BA, 2026-11-13); install.ts writes the new form from now on.
 *
 *   node --import tsx scripts/building-recipes/catalogue-recipe-fields.ts [--dry-run]
 *
 * - renames recipe.footprintIoU / recipe.frontZoneIoU to shareFootprintIoU / shareFrontZoneIoU: they compare this house's
 *   BAG footprint with the footprint of the house whose mesh it reuses (1 when it is its own master), not the mesh with BAG;
 * - rewrites the scope's street for entries whose scope names 'Bilderdijkstraat' but whose house front is on another street
 *   (install.ts defaulted --street to Bilderdijkstraat; 175 belt houses of belt-20261113 carried it).
 */
import fs from 'node:fs';

const FILE = 'public/canal-drive/ordinary-buildings-data/catalogue.json';
const catalogue = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let renamed = 0, scopes = 0;
for (const m of catalogue.models) {
  if (m.recipe && ('footprintIoU' in m.recipe || 'frontZoneIoU' in m.recipe)) {
    m.recipe = Object.fromEntries(Object.entries(m.recipe).map(([k, v]) => [k === 'footprintIoU' ? 'shareFootprintIoU' : k === 'frontZoneIoU' ? 'shareFrontZoneIoU' : k, v]));
    renamed++;
  }
  if (typeof m.scope === 'string' && m.scope.includes('Bilderdijkstraat') && m.recipe?.id) {
    const intentFile = `scripts/building-recipes/houses/${m.recipe.id}/intent.json`;
    const intent = fs.existsSync(intentFile) ? JSON.parse(fs.readFileSync(intentFile, 'utf8')) : null;
    const street: string | undefined = intent?.fronts?.[0]?.street;
    if (street && street !== 'Bilderdijkstraat') {
      m.scope = m.scope.replace('Bilderdijkstraat', street)
        .replace('facade classified from the rectified municipal panorama crop', m.recipe.id.startsWith('spec-') ? 'design from its published house spec' : 'facade classified from the rectified municipal panorama crop');
      if (Array.isArray(m.limitations)) m.limitations = m.limitations.map((l: string) => l.replace(/; footprint IoU /, '; share footprint IoU '));
      scopes++;
    }
  }
}
console.log(`${renamed} entries: IoU keys renamed; ${scopes} entries: scope street rewritten`);
if (!process.argv.includes('--dry-run')) fs.writeFileSync(FILE, JSON.stringify(catalogue, null, 2) + '\n');
