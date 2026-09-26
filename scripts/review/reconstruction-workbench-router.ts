import { Router } from 'express';
import { summarizeWorkbenchRoof } from './workbench-roofs.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectProjectStatus } from './project-status.js';
import { buildSourceEvaluation } from '../city-appearance/quality-loop/source-evaluation.js';
import { verifyReviewSnapshot } from './review-snapshot.js';
import type { WorkbenchCase, WorkbenchImage, WorkbenchPayload } from '../../src/canalRecall/reconstructionWorkbenchTypes.js';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const hash = (value: unknown): string | null => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
function publicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const url = new URL(value, 'http://workbench.local');
  if (url.origin !== 'http://workbench.local' || !/^\/(data|canal-drive)\//.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
async function preview(root: string): Promise<WorkbenchPayload['preview']> {
  try {
    const bytes = await fs.readFile(path.join(root, 'public/data/facade-repair-preview/cases.json'));
    const data = JSON.parse(bytes.toString());
    if (!Array.isArray(data.cases) || data.previewOnly !== true) throw Error('Expected a development preview with source-bound cases');
    const image = async (value: any): Promise<WorkbenchImage | undefined> => {
      const url = publicUrl(value?.url), digest = hash(value?.sha256);
      if (!url?.startsWith('/data/') || !digest || !finite(value.width) || !finite(value.height)) return undefined;
      const file = path.resolve(root, 'public', new URL(url, 'http://workbench.local').pathname.slice(1));
      const publicRoot = path.resolve(root, 'public/data');
      const real = await fs.realpath(file).catch(() => null);
      if (!real || !real.startsWith(`${publicRoot}${path.sep}`) || sha(await fs.readFile(real)) !== digest) return undefined;
      return { url, sha256: digest, captureDate: typeof value.captureDate === 'string' ? value.captureDate : '', width: value.width, height: value.height };
    };
    const cases: WorkbenchCase[] = [];
    for (const item of data.cases) {
      if (typeof item.caseId !== 'string' || typeof item.owner?.id !== 'string') throw Error('Invalid preview case identity');
      const [full, ground] = await Promise.all([image(item.source?.full), image(item.source?.ground)]);
      cases.push({ caseId: item.caseId, buildingId: item.owner.id, address: typeof item.address === 'string' ? item.address : '', note: typeof item.note === 'string' ? item.note : '',
        source: { full, ground }, roof: summarizeWorkbenchRoof({ ...item, source: { full, ground } }), previousRenderUrl: publicUrl(item.previousRenderUrl), previewUrl: `/canal-drive/facade-repair-preview.html?case=${encodeURIComponent(item.caseId)}`,
        omissions: [...strings(item.omissions), ...(!full ? ['Full image unavailable or failed source hash verification.'] : []), ...(!ground ? ['Ground image unavailable or failed source hash verification.'] : [])] });
    }
    if (new Set(cases.map(c => c.caseId)).size !== cases.length) throw Error('Duplicate preview case IDs');
    return { sha256: sha(bytes), cases, error: null };
  } catch (error) { return { sha256: null, cases: [], error: String(error) }; }
}

async function snapshots(root: string) {
  const directory = path.join(root, 'review-data/snapshots');
  const names = await fs.readdir(directory).catch(() => []);
  let valid = 0, invalid = 0, incomplete = 0;
  for (const name of names.filter(name => /^[a-f0-9]{64}$/.test(name))) {
    const result = await verifyReviewSnapshot(path.join(directory, name));
    if (result.valid) { valid++; if (result.manifest?.missingBindings.length) incomplete++; } else invalid++;
  }
  return { count: valid, status: valid ? `${valid} verified review snapshot${valid === 1 ? '' : 's'} saved outside the cache.${incomplete ? ` ${incomplete} preserve notes with missing historical source bindings; see their manifests.` : ''}${invalid ? ` ${invalid} snapshots failed verification.` : ''}` : 'No verified durable review snapshot found yet.' };
}

/** Collection is read-only. Review writes continue through the existing notes API. */
export async function collectWorkbench(root = process.cwd()): Promise<WorkbenchPayload> {
  root = path.resolve(root);
  const [statusResult, qualityResult, previewResult, saved] = await Promise.allSettled([
    collectProjectStatus(root), buildSourceEvaluation({ root, iouThreshold: .7 }), preview(root), snapshots(root),
  ]);
  const status: any = statusResult.status === 'fulfilled' ? statusResult.value : {};
  const quality: any = qualityResult.status === 'fulfilled' ? qualityResult.value : null;
  const previewData = previewResult.status === 'fulfilled' ? previewResult.value : { sha256: null, cases: [], error: String(previewResult.reason) };
  const snapshot = saved.status === 'fulfilled' ? saved.value : { count: 0, status: `Snapshot verification unavailable: ${String(saved.reason)}` };
  const active = object(status.releases?.active), candidate = object(status.releases?.staged);
  const processing = object(status.coverage?.processing), rendered = object(status.coverage?.rendered), costs = object(status.costs);
  const findings = strings(status.findings);
  if (statusResult.status === 'rejected') findings.push(`Project state unavailable: ${String(statusResult.reason)}`);
  findings.unshift('Review current development cases and turn source differences into specific corrections.');
  if (finite(status.acceptance?.registration?.accepted) === 0) findings.push('Metric registration remains unaccepted; source-image diagnostics can proceed independently.');
  const diagnostics = (quality?.cases ?? []).map((value: any) => {
    const matching = previewData.cases.filter(c => c.buildingId === value.buildingId && Object.values(c.source).some(s => s?.sha256 === value.cropSha256));
    const typeErrors = (value.matches ?? []).filter((m: any) => m.type === 'incorrect').length;
    const headErrors = (value.matches ?? []).filter((m: any) => m.head === 'incorrect').length;
    return { caseId: value.caseId, buildingId: value.buildingId, cropSha256: value.cropSha256, tier: value.tier,
      binding: value.analysis?.outcome ?? value.status ?? 'unknown', matched: value.scorable ? value.matches.length : null,
      complete: value.denominators?.completeVisibleReferences ?? 0, partial: value.denominators?.partialVisibleExtentsIgnored ?? 0,
      explanation: `${typeErrors} type differences; ${headErrors} opening-head differences. Precision unscored: image annotation is incomplete.`, reviewCaseId: matching.length === 1 ? matching[0].caseId : null };
  });
  const queue = quality?.repairQueue ?? [];
  const actionCounts = new Map<string, Set<string>>();
  for (const item of queue) { const cases = actionCounts.get(item.category) ?? new Set<string>(); cases.add(item.caseId); actionCounts.set(item.category, cases); }
  const actionLabel: Record<string, string> = { 'bad-source': 'Recheck source binding', 'missing-or-ambiguous-analysis': 'Resolve cached analysis', 'detection-layout': 'Inspect opening layout', 'annotation-needed': 'Complete reference annotations', 'opening-head': 'Inspect opening-head shape', 'head-shape': 'Inspect opening-head shape' };
  const qualityExplanation = quality
    ? `${quality.coverage.validReferenceCases} development photographs have ${quality.coverage.scorableCompleteVisibleReferences ?? quality.coverage.completeVisibleReferencesOnVerifiedSources} scorable complete reference openings and ${quality.coverage.partialVisibleExtentsIgnored} excluded partial extents. ${quality.summary.completeReferenceMatches} reference openings match at IoU ≥ ${quality.evaluator.iouThreshold}. These are agent-inspected development references. Overall precision, metric accuracy and held-out performance are not established.`
    : `Source diagnostics unavailable: ${qualityResult.status === 'rejected' ? String(qualityResult.reason) : 'no report'}`;
  return { version: 1, generatedAt: new Date().toISOString(),
    project: { activeReleaseId: hash(active.releaseId), activeBuildings: finite(active.buildings), candidateReleaseId: hash(candidate.releaseId), analyzedGround: finite(processing.safeGroundValid), analyzedFull: finite(processing.fullTierValid), renderedBuildings: finite(rendered.renderableObservedUniqueBuildings), acceptedRegistrations: finite(status.acceptance?.registration?.accepted), accountedUsd: finite(costs.accountedUsd), ceilingUsd: finite(costs.ceilingUsd), conservativeUsd: finite(costs.knownConservativeChargeUsd), unresolvedCharges: finite(costs.unresolvedEntries), snapshotCount: snapshot.count, snapshotStatus: snapshot.status, findings },
    quality: { status: quality ? 'development-diagnostics' : 'unavailable', explanation: qualityExplanation, diagnostics, actions: [...actionCounts].map(([category, cases]) => `${actionLabel[category] ?? category}: ${cases.size} reference case${cases.size === 1 ? '' : 's'}.`) },
    preview: previewData,
  };
}

export function reconstructionWorkbenchRouter(root = process.cwd(), options: { load?: () => Promise<WorkbenchPayload> } = {}) {
  const router = Router();
  router.get('/workbench', async (_req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await (options.load ? options.load() : collectWorkbench(root))); }
    catch (error) { res.status(500).json({ error: String(error) }); }
  });
  return router;
}
