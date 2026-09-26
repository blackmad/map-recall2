/** Targeted calibration, not a random accuracy sample. Never select by model answer. */
export const TONIGHT_CALIBRATION = [
  ['0363100012237064_e_1hyy18v', 'Broad frontage: correct building, wall extent and crop?'],
  ['0363100012236141_e_041dz1t', 'Street-facing storefront; distinguish roof volume from facade top.'],
  ['0363100012236521_e_030nf28', 'Does photographic evidence establish the roof? Unknown is useful.'],
  ['0363100012152665_e_0xe8qma', 'Ordinary-house control: facade top and ground-floor use.'],
  ['0363100012157075_e_0udbbkk', 'Ordinary-house control: separate visible front from hidden roof.'],
  ['0363100012165211_e_15djkoz', 'Ordinary-house control: only label visible features.'],
  ['0363100012081167_e_0c21yw2', 'Corner storefront: which physical wall supports the observation?'],
  ['0363100012166975_e_1bab2bg', 'Storefront and canopy construction; fabric deployment if visible.'],
  ['0363100012165505_e_1w8io25', 'Storefront extent and separation from neighbouring walls.'],
  ['0363100012162168_e_04g3jtu', 'Distinguish rigid canopy construction from fabric deployment.'],
  ['0363100012156454_e_12agwal', 'Label roof only when supported by photographs.'],
  ['0363100012157618_e_0w0gh94', 'Label roof only when supported by photographs.'],
];
export function calibrationSourceReady(record) {
  return record?.reviewSourceCurrent !== false && !!record?.derivationKey && !!record.evidenceKey && ['full', 'ground', 'roof', 'context'].every(kind => {
    const image = record.images?.[kind];
    return !!image?.file && /^[a-f0-9]{64}$/.test(image.sha256 || '') && Number.isFinite(Date.parse(image.date));
  });
}
export function calibrationQueue(records) {
  const byId = new Map(records.map(record => [record.id, record]));
  return TONIGHT_CALIBRATION.map(([id]) => byId.get(id)).filter(record => calibrationSourceReady(record) && !record.review);
}
