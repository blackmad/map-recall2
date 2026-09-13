import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ArtifactStatus { path: string; present: boolean; valid: boolean; sha256?: string; error?: string; }
export interface ProjectStatus {
  schemaVersion: 1; generatedAt: string; root: string; findings: string[];
  artifacts: Record<string, ArtifactStatus>; releases: { active: unknown; staged: unknown };
  coverage: { processing: unknown; attached: unknown; rendered: unknown };
  acceptance: { registration: unknown; photographic: unknown; publication: unknown; expansion: unknown };
  costs: { accountedUsd: number | null; knownConservativeChargeUsd: number | null; unresolvedEntries: number | null; authorization: unknown };
  reviewStores: unknown;
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const rel = (p: string, root: string) => path.relative(root, p).split(path.sep).join('/');
async function artifact(root: string, p: string, findings: string[]): Promise<{value?: any; status: ArtifactStatus}> {
  const full = path.resolve(root, p); const status: ArtifactStatus = { path: p, present: false, valid: false };
  try { const b = await fs.readFile(full); status.present = true; status.sha256 = sha(b); try { const value = JSON.parse(b.toString('utf8')); status.valid = true; return { value, status }; } catch (e) { status.error = 'invalid JSON'; findings.push(`${p}: invalid JSON`); return { status }; } }
  catch (e: any) { status.error = e?.code === 'ENOENT' ? 'missing' : String(e?.message ?? e); findings.push(`${p}: ${status.error}`); return { status }; }
}
function valueOrUnknown(v: any, key: string): unknown { return v && Object.prototype.hasOwnProperty.call(v, key) ? v[key] : { status: 'unknown', reason: 'field missing' }; }
function numberOrNull(v: any): number | null { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
async function stores(root: string, findings: string[]) {
  const dirs = ['.cache/city-appearance/review-notes','.cache/city-appearance/repair-preview-notes','.cache/facade-rebuild/router-review'];
  const result: Record<string, unknown> = {};
  for (const d of dirs) { const full = path.resolve(root,d); let names: string[] = []; try { names = await fs.readdir(full); } catch (e: any) { if (e?.code !== 'ENOENT') findings.push(`${d}: ${e.message}`); }
    const files: unknown[] = []; for (const n of names.sort()) { if (!n.endsWith('.json')) continue; const p=path.join(full,n); try { const b=await fs.readFile(p); files.push({path:rel(p,root),sha256:sha(b),bytes:b.length});} catch(e:any){findings.push(`${rel(p,root)}: ${e.message}`);} }
    result[d] = { present: names.length > 0, files };
  } return result;
}
export async function collectProjectStatus(root = process.cwd()): Promise<ProjectStatus> {
  root = path.resolve(root); const findings: string[] = []; const paths = {
    current: 'public/data/city-expansion/current.json', candidate: 'scripts/review/thousand-building-candidate-report.json', extraction: 'scripts/review/thousand-building-extraction/final-report.json', spend: '.cache/city-appearance/spend.json', reconciliation: 'scripts/review/thousand-building-extraction/charge-reconciliation.json'
  }; const loaded: Record<string, any> = {}; const artifacts: Record<string, ArtifactStatus> = {};
  for (const [k,p] of Object.entries(paths)) { const x=await artifact(root,p,findings); artifacts[k]=x.status; loaded[k]=x.value; }
  const current=loaded.current, candidate=loaded.candidate, extraction=loaded.extraction, reconciliation=loaded.reconciliation;
  const processing = candidate?.coverage?.processing ?? extraction?.coverage?.processingCoverage ?? { status:'unknown', reason:'processing artifact missing or field missing' };
  const attached = candidate?.coverage?.attachment ?? extraction?.coverage?.bindingCoverage ?? { status:'unknown', reason:'attachment coverage unavailable' };
  const rendered = candidate?.coverage?.rendered ?? extraction?.coverage?.renderedFeatureCoverage ?? { status:'unknown', reason:'rendered coverage unavailable' };
  const authorization = extraction?.authorization ?? { status:'unknown', reason:'recorded budget authorization missing' };
  const spendAmount = spendValue(loaded.spend); const accounted = numberOrNull(extraction?.costs?.totalBudgetAccountedUsd ?? reconciliation?.budgetAccountedUsd ?? spendAmount);
  const known = numberOrNull(extraction?.costs?.conservativeUnknownChargeUsd ?? reconciliation?.accountedUsd); const unresolved = unresolvedCount(loaded.spend);
  if (accounted === null) findings.push('accounted costs: unknown'); if (known === null) findings.push('known conservative charge: unknown');
  return { schemaVersion:1, generatedAt:new Date().toISOString(), root, findings, artifacts,
    releases:{active: current ? {releaseId:valueOrUnknown(current,'releaseId'), pointerSha256:artifacts.current.sha256, publication:valueOrUnknown(current,'publication')} : {status:'unknown'}, staged:candidate ? {releaseId:valueOrUnknown(candidate,'stagedReleaseId'), mode:valueOrUnknown(candidate,'mode'), activated:valueOrUnknown(candidate.publication??{},'activated')} : {status:'unknown'}},
    coverage:{processing,attached,rendered}, acceptance:{registration: candidate ? {accepted:valueOrUnknown(candidate,'metricRegistrationAccepted'), status: candidate.metricRegistrationAccepted === true ? 'accepted' : 'unaccepted'} : {status:'unknown'}, photographic:candidate ? {accepted:valueOrUnknown(candidate,'photographicAcceptance')} : {status:'unknown'}, publication:candidate?.publication ?? {status:'unknown'}, expansion:extraction?.gates ? {activated:valueOrUnknown(extraction.gates,'expansionActivated')} : {status:'unknown'}},
    costs:{accountedUsd:accounted,knownConservativeChargeUsd:known,unresolvedEntries:unresolved,authorization}, reviewStores:await stores(root,findings) };
}
function spendValue(x:any): number | null { if (!x) return null; for (const k of ['totalUsd','total','accountedUsd','totalCostUsd']) if (typeof x[k] === 'number') return x[k]; return null; }
function unresolvedCount(x:any): number | null { if (!x) return null; for (const k of ['unresolvedEntries','unresolved','unknownCharges']) { if (Array.isArray(x[k])) return x[k].length; if (typeof x[k] === 'number') return x[k]; } return null; }
async function main() { const args=process.argv.slice(2); let root=process.cwd(),out:string|undefined; for(let i=0;i<args.length;i++){if(args[i]==='--root')root=args[++i];else if(args[i]==='--out')out=args[++i];else if(args[i]==='--help'){console.log('Usage: tsx scripts/review/project-status.ts [--root DIR] [--out FILE]');return;}} const result=JSON.stringify(await collectProjectStatus(root),null,2)+'\n'; if(out) await fs.writeFile(path.resolve(out),result); else process.stdout.write(result); }
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e=>{console.error(e.message);process.exitCode=1;});
