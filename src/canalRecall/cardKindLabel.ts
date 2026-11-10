/**
 * The uppercase kind chip on a landmark card, the arrival card and the
 * neighbourhood postcard ("MUSEUM", "BRIDGE", "NEIGHBORHOOD"), in the
 * interface language. A kind the catalog has no word for keeps its raw
 * (English, data-given) spelling in capitals rather than printing a key.
 */
import { CATALOGS, t, type MessageKey } from '../i18n/index.ts';

function camel(raw: string): string {
  return raw.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1))).join('');
}

export function kindLabel(raw: string | undefined | null): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const key = `kind.${camel(text)}`;
  return key in CATALOGS.en ? t(key as MessageKey) : text.toUpperCase();
}
