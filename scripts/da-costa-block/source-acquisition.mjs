import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicJson, digest, readJson } from './pipeline-state.mjs';

/** Cache bytes are reusable only when URL and hash match. Legacy retrieval times stay unknown. */
export async function createSourceCache({ root, fetchImpl = fetch, offline = false }) {
  const legacy = await readJson(path.join(root, 'acquisition.json'), { sources: [] });
  return async function get(name, url) {
    if (!/^[a-z0-9_-]+$/.test(name)) throw Error('Unsafe source cache name');
    const file = path.join(root, `${name}.json`), provenanceFile = `${file}.source.json`;
    let bytes, source;
    try {
      bytes = await fs.readFile(file);
      source = await readJson(provenanceFile, null) ?? legacy.sources?.find(item => item.name === name);
      if (!source || source.url !== url || source.sha256 !== digest(bytes)) throw Error(`Cache provenance mismatch for ${name}; use a new area/cache revision`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (offline) throw Error(`Offline source missing: ${name}`);
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { response = await fetchImpl(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'MapRecall-CityAppearance/1.0' } }); }
        catch (error) {
          if (attempt === 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
          continue;
        }
        if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
        const retryAfter = Number(response.headers?.get('retry-after'));
        await new Promise(resolve => setTimeout(resolve, Math.min(5000, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt)));
      }
      if (!response.ok) throw Error(`${name}: ${response.status} ${url}`);
      bytes = Buffer.from(await response.arrayBuffer());
      JSON.parse(bytes);
      source = { name, url, bytes: bytes.length, sha256: digest(bytes), retrievedAt: new Date().toISOString() };
      await fs.mkdir(root, { recursive: true });
      await atomicJson(provenanceFile, source);
      // Raw bytes must match their hash; do not reserialize provider JSON.
      const temporary = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, file);
    }
    source = { ...source, retrievedAt: source.retrievedAt ?? null, retrievalTimeKnown: Boolean(source.retrievedAt) };
    await atomicJson(provenanceFile, source);
    return { data: JSON.parse(bytes), source, artifacts: [file, provenanceFile] };
  };
}

/** Follow OGC/HAL links, or explicit WFS STARTINDEX; prove advertised counts when available. */
export async function acquirePages({ name, url, get, embedded = false, wfs = false, countUnit = 'features', maxPages = 10000 }) {
  if (!['features', 'cityobjects'].includes(countUnit)) throw Error('Unsupported source count unit');
  const features = [], sources = [], artifacts = [], seenUrls = new Set(), seenIds = new Set();
  const seenObjects = new Set();
  let expectedCount, page = 0, receivedUnits = 0, maxEnvelopeUnits = 0;
  while (url) {
    if (seenUrls.has(url)) throw Error(`${name}: pagination cycle`);
    if (page >= maxPages) throw Error(`${name}: pagination safety limit; completeness not established`);
    seenUrls.add(url);
    const result = await get(`${name}-${page++}`, url), data = result.data;
    const batch = embedded ? data._embedded?.panoramas : data.features;
    if (!Array.isArray(batch)) throw Error(`${name}: missing feature array`);
    const count = embedded ? data.count : data.numberMatched;
    if (count !== undefined && count !== null && count !== 'unknown') {
      if (!Number.isInteger(Number(count)) || Number(count) < 0) throw Error(`${name}: invalid advertised count`);
      if (expectedCount !== undefined && expectedCount !== Number(count)) throw Error(`${name}: source changed its count during pagination`);
      expectedCount = Number(count);
    }
    // 3DBAG counts CityObjects (Building + BuildingPart), not CityJSONFeature envelopes.
    const batchUnits = countUnit === 'cityobjects' ? batch.reduce((sum, feature) => {
      if (!feature.CityObjects || typeof feature.CityObjects !== 'object') throw Error(`${name}: missing CityObjects`);
      const objectIds=Object.keys(feature.CityObjects);maxEnvelopeUnits=Math.max(maxEnvelopeUnits,objectIds.length);
      for (const id of objectIds) { if (seenObjects.has(id)) throw Error(`${name}: duplicate CityObject ${id}`); seenObjects.add(id); }
      return sum + objectIds.length;
    }, 0) : batch.length;
    receivedUnits += batchUnits;
    // 3DBAG documents this endpoint as not yet OGC-compliant. Its pagination
    // cursor may split at a CityObject limit while returning the complete
    // CityJSONFeature envelope, so a page can legitimately contain 102 objects
    // with numberReturned=100. Unique IDs plus the final numberMatched total
    // still prove completeness; ordinary feature endpoints remain page-exact.
    if (countUnit === 'features' && data.numberReturned !== undefined && Number(data.numberReturned) !== batchUnits) throw Error(`${name}: returned count mismatch (${countUnit})`);
    for (const feature of batch) {
      const id = embedded ? feature.pano_id : feature.id ?? feature.properties?.identificatie;
      if (id !== undefined) {
        if (seenIds.has(String(id))) throw Error(`${name}: duplicate feature across pages: ${id}`);
        seenIds.add(String(id));
      }
    }
    features.push(...batch); sources.push(result.source); artifacts.push(...result.artifacts);
    let next = embedded ? data._links?.next?.href : data.links?.find(link => link.rel === 'next')?.href;
    if (next) {
      if (!batch.length) throw Error(`${name}: empty page with next link`);
      next = new URL(next, url).href;
    } else if (wfs) {
      const current = new URL(url), countPerPage = Number(current.searchParams.get('COUNT') ?? 1000);
      if (!Number.isInteger(countPerPage) || countPerPage < 1) throw Error(`${name}: invalid WFS page size`);
      if ((expectedCount !== undefined && features.length < expectedCount) || (expectedCount === undefined && batch.length === countPerPage)) {
        if (!batch.length) throw Error(`${name}: empty WFS page before advertised total`);
        current.searchParams.set('STARTINDEX', String(features.length)); next = current.href;
      }
    }
    url = next;
  }
  const overflow=expectedCount===undefined?0:receivedUnits-expectedCount;
  if (expectedCount !== undefined && (overflow<0 || countUnit==='features'&&overflow!==0 || countUnit==='cityobjects'&&overflow>maxEnvelopeUnits)) throw Error(`${name}: incomplete result ${receivedUnits}/${expectedCount} ${countUnit}`);
  return { features, sources, artifacts, completeness: { pages: page, received: features.length, receivedUnits, countUnit, expected: expectedCount ?? null, advertisedOverflow:overflow, method: expectedCount === undefined ? (wfs ? 'exhausted-wfs-pages' : 'exhausted-next-links') : overflow?'advertised-count-envelope-overflow':'advertised-count' } };
}
