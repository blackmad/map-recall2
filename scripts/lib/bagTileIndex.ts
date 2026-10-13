/** Load BAG-keyed base tiles (`bag-tiles/14/x/y.geojson.gz`) from disk into a join index. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { addFeatures, emptyIndex, type BagPandIndex } from '../../src/canalRecall/bagPandIndex';

export { nearbyPands, resolveSuppressed, type BagPandIndex } from '../../src/canalRecall/bagPandIndex';

export function loadBagTiles(dir: string): BagPandIndex {
  const index = emptyIndex();
  for (const x of fs.readdirSync(dir).filter(name => /^\d+$/.test(name))) {
    for (const file of fs.readdirSync(path.join(dir, x)).filter(name => name.endsWith('.geojson.gz'))) {
      const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, x, file))).toString('utf8'));
      addFeatures(index, collection.features);
    }
  }
  return index;
}
