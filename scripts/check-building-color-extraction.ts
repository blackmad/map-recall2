import assert from 'node:assert/strict';
import { extractSurfaceColors, normalizeBuildingColor } from './lib/building-colors.ts';

assert.equal(normalizeBuildingColor('#abc'), '#aabbcc');
assert.equal(normalizeBuildingColor('abc'), '#aabbcc');
assert.equal(normalizeBuildingColor('red;white'), '#bd5b52');

const explicit = extractSurfaceColors({
  'building:colour': 'red',
  'building:facade:colour': '#abc',
  'roof:colour': 'blue',
});
assert.equal(explicit.sideColour, '#aabbcc', 'facade-specific colour takes precedence for sides');
assert.equal(explicit.roofColour, '#5a81a0', 'roof colour is extracted independently');

const americanAliases = extractSurfaceColors({
  'facade:color': 'white',
  'roof:color': 'black',
});
assert.equal(americanAliases.sideColour, '#eeeeea');
assert.equal(americanAliases.roofColour, '#222222');

const invalidPreferredAlias = extractSurfaceColors({
  'building:facade:colour': 'not-a-colour',
  'building:colour': 'green',
  'roof:colour': 'not-a-colour',
  'roof:color': '#123456',
});
assert.equal(invalidPreferredAlias.sideColour, '#4f7f52', 'an invalid facade value does not hide a valid building colour');
assert.equal(invalidPreferredAlias.roofColour, '#123456', 'an invalid British-spelling value does not hide a valid alias');

const materials = extractSurfaceColors({ 'building:material': ' Brick ', 'roof:material': ' METAL ' });
assert.equal(materials.sideColour, '#bd8161');
assert.equal(materials.roofColour, '#b7b1a6');

const sideOnly = extractSurfaceColors({ 'building:colour': 'brown' });
assert.equal(sideOnly.sideColour, '#8b5a3c');
assert.equal(sideOnly.roofColour, undefined, 'extractor does not misreport a side colour as a measured roof colour');
process.stdout.write('Building surface colour extraction checks passed.\n');
