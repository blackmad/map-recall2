/** Exercise paid-call guards with mock fetch only. Never contacts OpenRouter. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await fs.mkdtemp(path.resolve('.cache/facade-rebuild/router-budget-check-'));
const stub = path.join(root, 'fetch.mjs');
await fs.writeFile(path.join(root, 'mock.env'), '');
await fs.writeFile(stub, `
import fs from 'node:fs';
globalThis.fetch = async (url, options) => {
  const mode = process.env.ROUTER_MOCK_MODE;
  if (url.endsWith('/models')) return Response.json({data: [{id:'test/vision', architecture:{input_modalities:['image']},
    supported_parameters:['reasoning'], reasoning:{mandatory:true},
    pricing:{prompt:'0.00000001',completion:'0.00000001', ...(mode==='tier' ? {overrides:[{min_prompt_tokens:32000,prompt:'0.00001',completion:'0.00001'}]} : {})}}]});
  if (!url.endsWith('/chat/completions')) throw Error('Unexpected network destination');
  const body = JSON.parse(options.body);
  fs.appendFileSync(process.env.ROUTER_MOCK_TRACE, JSON.stringify({max_tokens:body.max_tokens,reasoning:body.reasoning})+'\\n');
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({family:'historic-narrow',wallMaterial:'brick',wallColour:'brown',openingLayout:'regular',shopfront:'no',sign:'no',awning:'no',occlusion:'low'})}}],
    usage:mode==='unknown'?{}:{cost:0.0008}});
};
`);
for (const mode of ['known', 'unknown', 'tier', 'teacher']) {
  const out = path.join(root, mode), trace = path.join(root, mode + '.jsonl');
  const result = spawnSync(process.execPath, ['--import', stub, 'scripts/facade-rebuild/benchmark-appearance-routing.mjs',
    '--provider=openrouter', '--env-file=' + path.join(root, 'mock.env'), '--source=public/canal-drive/facade-photo-review/local/dino-base-city-variety-raw-01',
    '--out=' + out, '--models=test/vision', '--sizes=512', '--limit=' + (mode === 'teacher' ? 1 : 2),
    '--max-output-tokens=' + (mode === 'teacher' ? 2048 : 350), '--budget-usd=' + (mode === 'tier' ? '.01' : '.001')],
    { env: { ...process.env, OPENROUTER_API_KEY: 'synthetic-mock-only', OPENROUTER_SPEND_LIMIT_USD: '1', ROUTER_MOCK_MODE: mode, ROUTER_MOCK_TRACE: trace }, encoding: 'utf8' });
  const calls = await fs.readFile(trace, 'utf8').then(s => s.trim().split('\n').map(JSON.parse)).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
  assert.equal(calls.length, mode === 'tier' ? 0 : 1, `${mode}: ${result.stderr}`);
  if (mode === 'teacher') {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(calls[0], { max_tokens: 2048, reasoning: { effort: 'low' } });
  } else {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, mode === 'unknown' ? /charge unknown/ : /reservation would exceed/);
  }
  if (mode !== 'tier') {
    const report = JSON.parse(await fs.readFile(path.join(out, 'report.json')));
    assert.equal(report.results.length, 1);
    assert.ok(report.observedOrReservedCostUsd > 0 && report.observedOrReservedCostUsd <= .001);
  }
}
console.log('Passed: pre-call spend ceilings, price-tier reservation, unknown-charge stop, and mandatory teacher reasoning. All requests mocked.');
