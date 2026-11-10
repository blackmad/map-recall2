// The kit-gap classifier (house line H6, docs/house-line.md §5): fixed vocabulary, Dutch/English folding, first-rule-wins
// order, `other` for an unnamed line, and reproducible output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLimit, foldText, KIT_COMPONENTS, RULES } from './kitGapVocabulary.ts';

test('the component vocabulary is the kit\'s own part names plus other', () => {
  assert.deepEqual([...KIT_COMPONENTS], ['openings', 'pui', 'crown', 'cornice', 'ornament', 'wall', 'balcony', 'dormer', 'roof', 'door', 'other']);
  for (const r of RULES) assert.ok((KIT_COMPONENTS as readonly string[]).includes(r.component), `${r.what} uses ${r.component}`);
});

test('Dutch and English wordings fold onto one keyword before the rules run', () => {
  assert.equal(foldText('Muurankers zijn niet getekend'), 'anchor zijn niet getekend');
  assert.equal(foldText('de erkers en de dakkapel'), 'de oriel en de dormer');
  assert.equal(foldText('Glasblok band'), 'glass-block band');
});

test('the wall anchors example: muurankers, iron anchors and wall ties are one ornament gap', () => {
  for (const t of ['muurankers zijn niet getekend', 'iron anchors between the windows', 'wall ties on the front']) {
    assert.deepEqual(classifyLimit(t), { component: 'ornament', what: 'wall anchors' }, t);
  }
});

test('the three gaps the kit session watches keep their canonical wording', () => {
  assert.deepEqual(classifyLimit('iron wall anchors'), { component: 'ornament', what: 'wall anchors' });
  assert.deepEqual(classifyLimit('signs on the glass-block band are not drawn'), { component: 'pui', what: 'signs on the glass-block band' });
  assert.deepEqual(classifyLimit('brick flat-arch lintels over the windows are not drawn'), { component: 'openings', what: 'brick flat arches' });
});

test('first rule wins: a balcony row is a wall band, not a balcony; a shop mezzanine is a shopfront, not a sash', () => {
  assert.equal(classifyLimit('yellow brick courses of the 1902 balcony row').component, 'wall');
  assert.equal(classifyLimit('the shop and its mezzanine (white boards, arched or wide lights) drawn as one two-storey shop').component, 'pui');
  assert.equal(classifyLimit('the gable cap ornaments are not drawn').component, 'crown');
  assert.equal(classifyLimit('the pointed (bell) dormer caps of stalpertstraat are drawn as pediments').component, 'dormer');
});

test('a line no rule names is other and keeps its folded text; a garden line is other by rule', () => {
  assert.deepEqual(classifyLimit('Te huur board is not modelled'), { component: 'other', what: 'te huur board is not modelled' });
  assert.equal(classifyLimit('the front garden hedge').component, 'other');
});

test('a legacy structured component is kept when no rule names the line; palette maps to wall', () => {
  assert.deepEqual(classifyLimit('register finish stone (no wallmaterial for a stone front)', 'palette').component, 'wall');
  assert.deepEqual(classifyLimit('a note nothing matches', 'corner house'), { component: 'other', what: 'a note nothing matches' });
});

test('the same input gives the same output every time', () => {
  const lines = ['the dormer finial is not drawn', 'brick frieze under the cornice', 'the stair windows sit half a storey up'];
  const a = lines.map(l => classifyLimit(l));
  assert.deepEqual(lines.map(l => classifyLimit(l)), a);
});
