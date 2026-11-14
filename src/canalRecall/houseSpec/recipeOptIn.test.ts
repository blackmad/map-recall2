// The recipe route is opt-in (toRecipe.ts withRoute / recipeOptIn) and house:publish never rewrites an installed house's
// intent.json (publishPlan.ts recipeInstallPlan). docs/house-line.md sections 1 and 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CanalHouseIntent } from '../buildingRecipe/intent.ts';
import { validateIntent } from '../buildingRecipe/intent.ts';
import { fromRecipeIntent } from './adapters.ts';
import { recipeInstallPlan } from './publishPlan.ts';
import { recipeOptIn, toRecipe, withRoute } from './toRecipe.ts';

const complete = () => fromRecipeIntent(validateIntent(JSON.parse(readFileSync('scripts/building-recipes/houses/bilder-079721/intent.json', 'utf8'))) as CanalHouseIntent)!;

test('a complete spec is generic unless it opts in', () => {
  const spec = complete();
  assert.ok(toRecipe(spec), 'the fixture is recipe-eligible');
  assert.equal(withRoute(spec).route, 'generic');
  assert.equal(withRoute({ ...spec, route: 'generic' }).route, 'generic');
  assert.equal(withRoute({ ...spec, route: 'recipe' }).route, 'recipe');
  assert.equal(withRoute(spec, true).route, 'recipe');
  assert.equal(withRoute({ ...spec, route: 'recipe' }, false).route, 'generic', 'an explicit opt-out wins');
});

test('opting in cannot make an incomplete spec a recipe', () => {
  const spec = complete();
  delete spec.design.roof;
  assert.equal(withRoute({ ...spec, route: 'recipe' }).route, 'generic');
});

test('recipeOptIn: an installed source or any part saying recipe', () => {
  const spec = complete();
  assert.equal(recipeOptIn([spec], false), false);
  assert.equal(recipeOptIn([spec], true), true);
  assert.equal(recipeOptIn([spec, { ...spec, route: 'recipe' }], false), true);
});

test('recipeInstallPlan: only spec-<pand> directories are written, installed houses are protected', () => {
  const existing = new Map([['A', 'cw-heren-179665'], ['B', 'spec-B']]);
  const plan = recipeInstallPlan(['A', 'B', 'C'], existing);
  assert.deepEqual(plan.install, [{ pand: 'B', id: 'spec-B' }, { pand: 'C', id: 'spec-C' }]);
  assert.deepEqual(plan.protectedHouses, [{ pand: 'A', id: 'cw-heren-179665' }]);
  assert.deepEqual(recipeInstallPlan([], existing), { install: [], protectedHouses: [] }, 'a D1 batch: no recipe specs, nothing to install');
});
