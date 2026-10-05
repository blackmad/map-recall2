/** Bounded, offline street evidence. Never assigns recipes or infers BAG identity by proximity.
 * Reproduce: npx tsx scripts/monument-register/inspect-street.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

type Json = Record<string, any>;
const input = 'scripts/data/amsterdam-monument-register';
const output = 'artifacts/street-appearance/register-transition';
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const normalize = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const street = /\bbethanien(?:dwars)?straat\b/;
const bytes = await readFile(`${input}/records.json.gz`);
const manifest = JSON.parse(await readFile(`${input}/manifest.json`, 'utf8'));
if (sha(bytes) !== manifest.snapshot.sha256) throw Error('Archive compressed checksum mismatch');
const expanded = gunzipSync(bytes);
if (sha(expanded) !== manifest.snapshot.uncompressedSha256) throw Error('Archive expanded checksum mismatch');
const archive = JSON.parse(expanded.toString('utf8'));
const surveyFile = 'public/data/street-appearance/frontage-survey.json';
const surveyBytes = await readFile(surveyFile);
const survey = JSON.parse(surveyBytes.toString('utf8'));
const cohorts = survey.profiles.filter((p: Json) => /bethanien/.test(p.id));
const scopedPandIds = new Set(cohorts.flatMap((p: Json) => p.frontages.map((f: Json) => f.buildingId.split('.').at(-1))));
const byNumber = new Map<string, Json>(archive.rce.map((r: Json) => [r.monumentNumber, r]));
const municipal = archive.municipal.filter((r: Json) => street.test(normalize(r.metadata.adressering ?? '')) || r.bagPandIds.some((id: string) => scopedPandIds.has(id)));
const rules: Array<[string, string, RegExp]> = [
  ['crown', 'point-crown / point alteration', /\b(?:punt|puntvorm|puntgevel)\b/i],
  ['crown', 'stepped crown', /trapgevel/i],
  ['crown', 'neck crown', /halsgevel/i],
  ['crown', 'bell crown', /klokgevel/i],
  ['crown', 'straight cornice', /rechte lijst|kroonlijst/i],
  ['roof', 'hipped roof', /schilddak|omlopende schilden/i],
  ['crown-detail', 'stone crown components', /natuurstenen.*(?:top|afdek)|(?:top|afdek).*natuurstenen/i],
  ['opening', 'oculi', /oeils-de-boeuf/i],
  ['opening', 'muntins / ornamental transoms', /roedenverdeling|sierbovenlichten/i],
  ['opening', 'door surround / historic shopfront', /deuromlijsting|houten pui|winkelpui|gebogen ramen/i],
];
const evidence = municipal.map((m: Json) => {
  // Numbers are register-specific: this bridge is valid only for a municipal Rijksmonument.
  const r = /rijksmonument/i.test(m.status) ? byNumber.get(m.monumentNumber) : undefined;
  const pandIds = [...new Set<string>([...m.bagPandIds, ...(r?.bagPandIds ?? [])])].sort();
  const descriptions = [
    ...m.descriptions.map((d: Json) => ({ ...d, register: 'amsterdam', sourceUrl: m.recordUrl,
      descriptionRegistrationDates: [], dateState: 'Municipal description publication date not provided; designation date is separate.' })),
    ...(r?.descriptions ?? []).map((d: Json) => ({ ...d, register: 'rce', sourceUrl: r!.recordUrl,
      descriptionRegistrationDates: r!.metadata.filter((t: Json) => t.s.value === d.sourceUri && /#registratiedatum$/.test(t.p.value)).map((t: Json) => t.o.value),
      dateState: 'RCE registratiedatum dates the description record, not observation, construction or alteration.' })),
  ];
  const assertions = descriptions.flatMap((d: Json) => d.text.split(/(?<=[.!?])\s+/).flatMap((sentence: string) =>
    rules.filter(([, , pattern]) => pattern.test(sentence)).map(([part, trait]) => ({
      part, trait, verbatim: sentence, register: d.register, sourceUrl: d.sourceUrl,
      sourceUri: d.sourceUri ?? null, descriptionRegistrationDates: d.descriptionRegistrationDates,
      confidence: 'Explicit prose assertion; current survival and street-facing visibility require photo review.',
      dateHandling: 'Retain date wording verbatim, including uncertainty and alterations; no period inferred from construction year.',
    }))));
  return {
    address: m.metadata.adressering, municipalSourceId: m.sourceId, municipalNumber: m.monumentNumber,
    admissionReason: street.test(normalize(m.metadata.adressering ?? '')) ? 'Explicit named-street address' : 'Explicit Pand link matches an existing scoped survey frontage; no proximity join',
    municipalUrl: m.recordUrl, status: m.status, designationDate: m.metadata.datumAanwijzing,
    rceNumber: r?.monumentNumber ?? null, rceUrl: r?.recordUrl ?? null,
    identityBridge: r ? 'Municipal explicit Rijksmonument status + national monument number; no spatial join.' : 'No national-register bridge.',
    municipalBagPandIds: m.bagPandIds, rceBagPandIds: r?.bagPandIds ?? [], rceBagVboIds: r?.bagVboIds ?? [],
    explicitPandLinks: m.metadata._links?.betreftBagPand ?? [],
    rceBagIdentifierStatements: r?.metadata.filter((t: Json) => /(?:pandIdentificatie|pandidentificatie|bagPandIdentificatie|verblijfsobjectIdentificatie)$/.test(t.p.value)) ?? [],
    identityState: !pandIds.length ? 'VBO only: no explicit VBO-to-Pand relation in this snapshot; do not assign a building.' :
      pandIds.length > 1 ? 'Multiple explicit Pand identities: resolve native scope before building-level assignment.' :
      !r ? 'Municipal Pand explicit; municipal-only description with no national-register bridge.' :
      !m.bagPandIds.length ? 'Pand supplied by explicit RCE predicate; municipal Pand link absent.' :
      !(r?.bagPandIds.length) ? 'Municipal Pand explicit; RCE lacks Pand predicate. National text bridge preserved separately.' : 'Explicit Pand present in both registers.',
    surveyMembership: cohorts.flatMap((p: Json) => p.frontages.filter((f: Json) => pandIds.includes(f.buildingId.split('.').at(-1))).map((f: Json) => ({ profileId: p.id, ...f }))),
    descriptions, assertions,
  };
}).sort((a: Json, b: Json) => a.address.localeCompare(b.address, 'nl', { numeric: true }));
const inventory = cohorts.map((p: Json) => ({ profileId: p.id, frontages: p.frontages.map((f: Json) => ({ ...f,
  sourceRecords: evidence.filter((e: Json) => [...e.municipalBagPandIds, ...e.rceBagPandIds].includes(f.buildingId.split('.').at(-1))).map((e: Json) => ({ address: e.address, municipalSourceId: e.municipalSourceId, rceNumber: e.rceNumber })),
  absenceMeaning: 'No matching monument record does not imply modern construction or a modern facade.',
})) }));
const report = {
  schemaVersion: 1, purpose: 'Bounded Bethaniënstraat / Bethaniëndwarsstraat historic-modern transition evidence; research only.',
  reproduction: 'npx tsx scripts/monument-register/inspect-street.ts',
  inputs: { archive: `${input}/records.json.gz`, sha256: sha(bytes), uncompressedSha256: sha(expanded),
    collectionStartedAt: manifest.collectionStartedAt, generation: manifest.generation, surveyFile, surveySha256: sha(surveyBytes), surveyRevision: survey.revision },
  admission: 'Exact named-street address OR explicit Pand matches an existing scoped survey frontage. Corner addresses retained. Description-only mentions of the monastery are excluded. No coordinates or nearest-building heuristics used.',
  limits: [
    'Listed buildings are a biased sample: do not estimate whole-street crown frequency from these counts.',
    'Historical prose, designation dates and description registration dates are distinct from current visual observation.',
    'VBO identifiers do not establish a parent Pand without an explicit parent relation.',
    'Descriptions do not establish frontage width, white trim, current window grouping or balcony frequency unless explicitly stated.',
    'This report neither resolves the photo-to-building transition nor accepts a heldout transfer.',
  ],
  coverage: { municipalStreetRecords: evidence.filter((e: Json) => e.admissionReason === 'Explicit named-street address').length,
    additionalExplicitScopedPandRecords: evidence.filter((e: Json) => e.admissionReason !== 'Explicit named-street address').length,
    linkedRceRecords: evidence.filter((e: Json) => e.rceNumber).length,
    noExplicitPand: evidence.filter((e: Json) => !e.municipalBagPandIds.length && !e.rceBagPandIds.length).map((e: Json) => e.address) },
  evidence, scopedFrontageInventory: inventory,
};
await mkdir(output, { recursive: true });
await writeFile(`${output}/evidence.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: `${output}/evidence.json`, coverage: report.coverage,
  profiles: inventory.map((p: Json) => ({ id: p.profileId, frontages: p.frontages.length, explicitlyLinked: p.frontages.filter((f: Json) => f.sourceRecords.length).length })) }));
