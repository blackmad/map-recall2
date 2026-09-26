/** The old readers have no source/wall hashes or registration certificates.
 * Stop before cache reads, model requests or export writes. Diagnostic camera
 * tests and raw-source rectification remain available in their own entrypoints.
 */
export function rejectLegacyStreetInputs(entrypoint: string): never {
  throw new Error(`QUARANTINED_STREET_INPUT: ${entrypoint} consumes unversioned street-derived artifacts. ` +
    'Use the facade-rebuild registration review and a version-bound measurement/export path. ' +
    'An old crop, copied directory or pandId cannot certify registration. ' +
    'Policy: src/canalRecall/facade/fixtures/street-derived-invalidation.json');
}
