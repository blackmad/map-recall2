/**
 * Where a kit test reads a recipe's intent.json and facts.json. Most tests read live recipes under
 * scripts/building-recipes/houses/<id>. Recipes retired from the factory because a bespoke landmark replaced the building
 * (lane #226, 2026-11-05: pand-233585 by graansilo-korthals-altes, beursplein-5-165051 by the Beurs van Berlage) stay
 * here as frozen fixtures, so the kit tests built on them (giant order, arcade, facade dress, large tier) keep testing
 * the same inputs without the factory and check:stale-installs seeing an uninstalled recipe.
 */
export const HOUSES = 'scripts/building-recipes/houses';
export const RETIRED_RECIPE_FIXTURES = 'src/canalRecall/buildingRecipe/fixtures/retired-recipes';
const RETIRED = new Set(['pand-233585', 'beursplein-5-165051']);
export const recipeDir = (id: string): string => (RETIRED.has(id) ? `${RETIRED_RECIPE_FIXTURES}/${id}` : `${HOUSES}/${id}`);
