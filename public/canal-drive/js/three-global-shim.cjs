// Resolves bare `three` imports to the one shared copy on the page.
//
// esbuild's IIFE output cannot leave an import unresolved, so a dependency that
// imports three — 3d-tiles-renderer does — would otherwise bundle a second
// complete copy of it. CommonJS is deliberate: esbuild compiles named imports
// from a CJS module into runtime property lookups, which is what lets this
// stand in for three's whole named-export surface without enumerating it.
module.exports = window.CanalRecallThree.THREE;
