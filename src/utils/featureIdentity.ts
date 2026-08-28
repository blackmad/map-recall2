import { StreetFeature } from '../types';

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48);

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

/** Stable across extract rebuilds as long as the real-world name/type/location remain stable. */
export function getFeatureKey(feature: StreetFeature): string {
  const canonical = [
    feature.cityId,
    feature.type,
    normalize(feature.name),
    feature.center[0].toFixed(4),
    feature.center[1].toFixed(4),
  ].join('|');
  return `v1_${normalize(feature.cityId)}_${normalize(feature.name)}_${hash(canonical)}`;
}
