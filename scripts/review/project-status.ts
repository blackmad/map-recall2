import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ArtifactStatus { path: string; present: boolean; valid: boolean; sha256?: string; error?: string; }
export interface ProjectStatus {
  schemaVersion: 1; generatedAt: string; root: string; findings: string[];
  artifacts: Record<string, ArtifactStatus>; releases: { active: unknown; staged: unknown };
  coverage: { processing: unknown; attached: unknown; rendered: unknown };
  acceptance: { registration: unknown; photographic: unknown; publication: unknown; expansion: unknown };
  costs: { accountedUsd: number | null; knownConservativeChargeUsd: number | null; unresolvedEntries: number | null; ceilingUsd: number | null; authorization: unknown };
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
  const dirs = ['.cache/city-appearance/review-notes','.cache/city-appearance/repair-preview-notes'];
  const result: Record<string, unknown> = {};
  for (const d of dirs) { const full = path.resolve(root,d); let names: string[] = []; try { names = await fs.readdir(full); } catch (e: any) { if (e?.code !== 'ENOENT') findings.push(`${d}: ${e.message}`); }
    const files: unknown[] = []; for (const n of names.sort()) { if (!n.endsWith('.json')) continue; const p=path.join(full,n); try { const b=await fs.readFile(p); files.push({path:rel(p,root),sha256:sha(b),bytes:b.length});} catch(e:any){findings.push(`${rel(p,root)}: ${e.message}`);} }
    result[d] = { present: names.length > 0, files };
  }
  const labels=path.resolve(root,'.cache/facade-rebuild/router-review/labels.json'); try{const b=await fs.readFile(labels);result['.cache/facade-rebuild/router-review']={present:true,files:[{path:rel(labels,root),sha256:sha(b),bytes:b.length}]};}catch(e:any){if(e?.code!=='ENOENT')findings.push(`.cache/facade-rebuild/router-review/labels.json: ${e.message}`);result['.cache/facade-rebuild/router-review']={present:false,files:[]};} return result;
}
export async function collectProjectStatus(root = process.cwd()): Promise<ProjectStatus> {
  root = path.resolve(root); const findings: string[] = []; const paths = {
    current: 'public/data/city-expansion/current.json', candidate: 'scripts/review/thousand-building-candidate-report.json', extraction: 'scripts/review/thousand-building-extraction/final-report.json', spend: '.cache/city-appearance/spend.json', reconciliation: 'scripts/review/thousand-building-extraction/charge-reconciliation.json'
  }; const loaded: Record<string, any> = {}; const artifacts: Record<string, ArtifactStatus> = {};
  for (const [k,p] of Object.entries(paths)) { const x=await artifact(root,p,findings); artifacts[k]=x.status; loaded[k]=x.value; }
  const current=loaded.current, candidate=loaded.candidate, extraction=loaded.extraction, reconciliation=loaded.reconciliation;
  const processing = extraction?.coverage?.processingCoverage ?? { status:'unknown', reason:'processing artifact missing or field missing' };
  const attached = candidate?.coverage?.attachment ?? extraction?.coverage?.bindingCoverage ?? { status:'unknown', reason:'attachment coverage unavailable' };
  const rendered = candidate?.coverage?.rendered ?? extraction?.coverage?.renderedFeatureCoverage ?? { status:'unknown', reason:'rendered coverage unavailable' };
  const authorization = loaded.spend ? { ceilingUsd:valueOrUnknown(loaded.spend,'ceilingUsd'), ceilingAuthorization:valueOrUnknown(loaded.spend,'ceilingAuthorization') } : { status:'unknown', reason:'global spend ledger missing' };
  const spendAmount = spendValue(loaded.spend); const accounted = spendAmount;
  const known = numberOrNull(extraction?.costs?.conservativeUnknownChargeUsd ?? reconciliation?.accountedUsd); const unresolved = unresolvedCount(loaded.spend);
  if (accounted === null) findings.push('accounted costs: unknown'); if (known === null) findings.push('known conservative charge: unknown');
  return { schemaVersion:1, generatedAt:new Date().toISOString(), root, findings, artifacts,
    releases:{active: current ? {releaseId:valueOrUnknown(current,'releaseId'), buildings:valueOrUnknown(current,'buildings'), pointerSha256:artifacts.current.sha256, publication:valueOrUnknown(current,'publication')} : {status:'unknown'}, staged:candidate ? {releaseId:valueOrUnknown(candidate,'stagedReleaseId'), mode:valueOrUnknown(candidate,'mode'), activated:valueOrUnknown(candidate.publication??{},'activated')} : {status:'unknown'}},
    coverage:{processing,attached,rendered:candidate?.coverage?.rendered ?? rendered}, acceptance:{registration: candidate ? {accepted:valueOrUnknown(candidate,'metricRegistrationAccepted'), status: typeof candidate.metricRegistrationAccepted === 'number' ? (candidate.metricRegistrationAccepted > 0 ? 'accepted' : 'unaccepted') : 'unknown'} : {status:'unknown'}, photographic:candidate ? {accepted:valueOrUnknown(candidate,'photographicAcceptance')} : {status:'unknown'}, publication:candidate?.publication ?? {status:'unknown'}, expansion:extraction?.gates ? {activated:valueOrUnknown(extraction.gates,'expansionActivated')} : {status:'unknown'}},
    costs:{accountedUsd:accounted,knownConservativeChargeUsd:known,unresolvedEntries:unresolved,ceilingUsd:loaded.spend?.ceilingUsd ?? null,authorization}, reviewStores:await stores(root,findings) };
}
function spendValue(x:any): number | null { if (!x || !Array.isArray(x.entries)) return null; let total=0; for(const e of x.entries){const n=typeof e.actualUsd==='number'?e.actualUsd:typeof e.reservedUsd==='number'?e.reservedUsd:null;if(n===null||n<0)return null;total+=n;} return total; }
function unresolvedCount(x:any): number | null { if (!x || !Array.isArray(x.entries)) return null; return x.entries.filter((e:any)=>e.actualUsd===null||e.actualUsd===undefined||e.status==='pending'||e.status==='unknown').length; }
async function main() { const args=process.argv.slice(2); let root=process.cwd(),out:string|undefined; for(let i=0;i<args.length;i++){if(args[i]==='--root')root=args[++i];else if(args[i]==='--out')out=args[++i];else if(args[i]==='--help'){console.log('Usage: tsx scripts/review/project-status.ts [--root DIR] [--out FILE]');return;}} const result=JSON.stringify(await collectProjectStatus(root),null,2)+'\n'; if(out) await fs.writeFile(path.resolve(out),result); else process.stdout.write(result); }
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e=>{console.error(e.message);process.exitCode=1;});
