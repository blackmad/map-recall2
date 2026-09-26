import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  externalIdentityDecision,
  externalPhotoLicenseIsReusable,
  scoreExternalPhotoCandidate,
  type ExternalIdentityAssessment,
  type ExternalPhotoCandidate,
} from '../../src/canalRecall/facade/externalIdentityReview.ts';
import { registrationObservationHash, type RegistrationGoldFixture } from '../../src/canalRecall/facade/registrationGold.ts';

type TraceLevel = 'info' | 'decision' | 'warning' | 'error';
type TracePhase = 'policy' | 'query' | 'license' | 'rank' | 'download' | 'assessment' | 'complete';
interface TraceEvent {
  seq: number;
  at: string;
  level: TraceLevel;
  phase: TracePhase;
  fixtureId?: string;
  pandId?: string;
  message: string;
  details?: Record<string, string | number | boolean | string[]>;
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    sha1?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

const outputRoot = path.resolve('public/canal-drive/facade-registration-review/local');
const imageRoot = path.join(outputRoot, 'external');
const progressPath = path.join(outputRoot, 'external-review-progress.json');
const evidencePath = path.join(outputRoot, 'external-evidence.json');
const sourcePolicy = JSON.parse(await readFile('src/canalRecall/facade/fixtures/external-photo-source-policy.json', 'utf8'));
const assessmentsPayload = JSON.parse(await readFile('src/canalRecall/facade/fixtures/external-identity-assessments.json', 'utf8')) as {
  assessments: ExternalIdentityAssessment[];
};
const fixturesPayload = JSON.parse(await readFile(path.join(outputRoot, 'fixtures.json'), 'utf8')) as {
  fixtures: RegistrationGoldFixture[];
};

const runId = `commons-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const progress = {
  schemaVersion: 2,
  runId,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'running' as 'running' | 'complete' | 'failed',
  currentStep: 'Applying source policy',
  totals: { fixtures: 0, queries: 0, candidates: 0, accepted: 0, rejected: 0, downloaded: 0 },
  sourcePolicies: sourcePolicy.sources,
  events: [] as TraceEvent[],
};

await mkdir(imageRoot, { recursive: true });

async function atomicJson(target: string, value: unknown): Promise<void> {
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
}

async function flush(): Promise<void> {
  progress.updatedAt = new Date().toISOString();
  await atomicJson(progressPath, progress);
}

async function event(
  phase: TracePhase,
  level: TraceLevel,
  message: string,
  context: { fixtureId?: string; pandId?: string; details?: TraceEvent['details'] } = {},
): Promise<void> {
  progress.currentStep = message;
  progress.events.push({ seq: progress.events.length + 1, at: new Date().toISOString(), phase, level, message, ...context });
  await flush();
}

function plainText(value = ''): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extensionFor(mime: string): string | null {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

async function commonsSearch(label: string): Promise<CommonsPage[]> {
  const parameters = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrnamespace: '6', gsrlimit: '20', gsrsearch: `"${label}" filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|sha1|size', iiurlwidth: '1200',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${parameters}`, {
    headers: { 'User-Agent': 'MapRecallFacadeReview/0.1 (local evidence review)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Wikimedia Commons API: HTTP ${response.status}`);
  const payload = await response.json() as { query?: { pages?: CommonsPage[] } };
  return payload.query?.pages ?? [];
}

async function download(url: string, target: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MapRecallFacadeReview/0.1 (local evidence review)' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Wikimedia thumbnail: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(target, bytes);
  return createHash('sha256').update(bytes).digest('hex');
}

await flush();

try {
  await event('policy', 'warning', 'Blocked Funda: terms do not permit automated reuse', {
    details: { source: 'funda.nl', termsUrl: sourcePolicy.sources.find((source: any) => source.id === 'funda.nl')?.termsUrl ?? '' },
  });
  await event('policy', 'decision', 'Allowed Wikimedia Commons with a per-file license gate', {
    details: { source: 'wikimedia-commons', rule: 'unknown or unsupported license is rejected' },
  });

  const ready = fixturesPayload.fixtures.filter(fixture => fixture.panorama?.localImageUrl);
  progress.totals.fixtures = ready.length;
  const fixtureResults: any[] = [];

  for (const fixture of ready) {
    const context = { fixtureId: fixture.fixtureId, pandId: fixture.pandId };
    progress.totals.queries += 1;
    await event('query', 'info', `Searching exact address: ${fixture.label}`, context);
    const pages = await commonsSearch(fixture.label);
    progress.totals.candidates += pages.length;
    await event('query', 'info', `Commons returned ${pages.length} candidate files`, {
      ...context, details: { query: `"${fixture.label}" filetype:bitmap`, candidates: pages.length },
    });

    const ranked: Array<{ page: CommonsPage; candidate: ExternalPhotoCandidate; score: number; reasons: string[] }> = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata ?? {};
      const licenseShortName = plainText(metadata.LicenseShortName?.value);
      const candidate: ExternalPhotoCandidate = {
        pageId: page.pageid,
        title: page.title,
        description: plainText(metadata.ImageDescription?.value),
        licenseShortName,
        mime: info?.mime ?? '',
      };
      const reusable = Boolean(info?.thumburl && extensionFor(candidate.mime) && externalPhotoLicenseIsReusable(licenseShortName));
      if (!reusable) {
        progress.totals.rejected += 1;
        await event('license', 'warning', `Rejected ${page.title}`, {
          ...context, details: { license: licenseShortName || 'missing', mime: candidate.mime || 'missing', reason: 'license, thumbnail, or browser image gate failed' },
        });
        continue;
      }
      progress.totals.accepted += 1;
      const scored = scoreExternalPhotoCandidate(candidate, fixture.label);
      ranked.push({ page, candidate, ...scored });
      await event('rank', 'decision', `Scored ${page.title}: ${scored.score}`, {
        ...context, details: { score: scored.score, license: licenseShortName, reasons: scored.reasons },
      });
    }

    ranked.sort((left, right) => right.score - left.score || left.page.pageid - right.page.pageid);
    const selected = ranked.filter(item => item.score >= 50).slice(0, 5);
    await event('rank', selected.length ? 'decision' : 'warning', `Selected ${selected.length} address-relevant files for visual review`, {
      ...context, details: { threshold: 50, selected: selected.map(item => item.page.title) },
    });

    const evidence = [];
    for (const item of selected) {
      const info = item.page.imageinfo![0];
      const metadata = info.extmetadata ?? {};
      const extension = extensionFor(item.candidate.mime)!;
      const filename = `${fixture.fixtureId}-commons-${item.page.pageid}.${extension}`;
      const sha256 = await download(info.thumburl!, path.join(imageRoot, filename));
      progress.totals.downloaded += 1;
      const author = plainText(metadata.Artist?.value) || 'Creator not supplied';
      const licenseUrl = plainText(metadata.LicenseUrl?.value);
      evidence.push({
        evidenceId: `commons-${item.page.pageid}`,
        pageId: item.page.pageid,
        title: item.page.title,
        description: item.candidate.description,
        localImageUrl: `local/external/${filename}`,
        sourcePageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(item.page.title.replace(/ /g, '_'))}`,
        originalUrl: info.url,
        author,
        credit: plainText(metadata.Credit?.value),
        licenseShortName: item.candidate.licenseShortName,
        licenseUrl,
        attribution: `${author} · ${item.candidate.licenseShortName}`,
        score: item.score,
        rankReasons: item.reasons,
        sha256,
        sourceSha1: info.sha1 ?? null,
        sourceWidth: info.width ?? null,
        sourceHeight: info.height ?? null,
        retrievedAt: new Date().toISOString(),
      });
      await event('download', 'info', `Cached attributed thumbnail: ${item.page.title}`, {
        ...context, details: { file: filename, sha256: sha256.slice(0, 16), license: item.candidate.licenseShortName },
      });
    }

    const assessment = assessmentsPayload.assessments.find(item => item.fixtureId === fixture.fixtureId);
    const conclusion = externalIdentityDecision(assessment, {
      fixtureId: fixture.fixtureId, pandId: fixture.pandId,
      observationHash: await registrationObservationHash(fixture), evidence,
    });
    await event('assessment', conclusion === 'insufficient' ? 'warning' : 'decision', `Visual identity verdict: ${conclusion}`, {
      ...context,
      details: assessment
        ? { reviewer: assessment.reviewer, citedFiles: assessment.evidenceTitles.length, correspondences: assessment.correspondences }
        : { reason: 'no committed visual assessment yet' },
    });
    fixtureResults.push({
      fixtureId: fixture.fixtureId,
      pandId: fixture.pandId,
      label: fixture.label,
      query: `"${fixture.label}" filetype:bitmap`,
      evidence,
      assessment: assessment ?? null,
      conclusion,
    });
  }

  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    runId,
    sourcePolicies: sourcePolicy.sources,
    rules: sourcePolicy.rules,
    fixtures: fixtureResults,
  };
  await atomicJson(evidencePath, output);
  progress.status = 'complete';
  await event('complete', 'decision', `Review evidence ready for ${fixtureResults.length} fixture${fixtureResults.length === 1 ? '' : 's'}`, {
    details: { evidencePath: 'local/external-evidence.json', fixtures: fixtureResults.length, downloaded: progress.totals.downloaded },
  });
  console.log(`External identity evidence: ${evidencePath}`);
  console.log(`Decision trace: ${progressPath}`);
} catch (error) {
  progress.status = 'failed';
  await event('complete', 'error', error instanceof Error ? error.message : String(error));
  throw error;
}
