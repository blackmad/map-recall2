/** Bind a proposal to the exact compact request and original source crops. */
export function routingBindingDisposition(record, result, inputs, report, sourceManifestSha256) {
  if (report.inputSetHash !== inputs.inputSetHash || inputs.manifestSha256 !== sourceManifestSha256) return 'stale-input-manifest';
  const input = inputs.items?.find(item => item.id === result.id);
  if (!record || result.status !== 'ok' || !input || record.id !== result.id || record.buildingId !== input.buildingId || result.buildingId !== record.buildingId) return 'missing-or-mismatched-source-identity';
  for (const kind of ['full', 'ground']) {
    const compact = input.images?.[kind], source = record.images?.[kind], requested = result.requestImages?.find(image => image.kind === kind);
    if (!compact || !source || !requested || compact.sourceSha256 !== source.sha256 || compact.sha256 !== requested.sha256) return 'crop-binding-mismatch';
  }
  return 'bound';
}
