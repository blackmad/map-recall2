import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectProjectStatus } from './project-status';
export async function runProjectStatusTests() {
    const root = await mkdtemp(path.join(os.tmpdir(), 'project-status-'));
    try {
        await mkdir(path.join(root, 'public/data/city-expansion'), { recursive: true });
        await writeFile(path.join(root, 'public/data/city-expansion/current.json'), ' {"releaseId":"active"}\n');
        const s = await collectProjectStatus(root);
        assert.equal(s.releases.active.releaseId, 'active');
        assert.equal(s.artifacts.candidate.present, false);
        assert.ok(s.findings.some(x => x.includes('candidate')));
        assert.equal(s.costs.accountedUsd, null);
        await mkdir(path.join(root, '.cache/city-appearance'), { recursive: true });
        await mkdir(path.join(root, 'scripts/review/thousand-building-extraction'), { recursive: true });
        const ledger = path.join(root, '.cache/city-appearance/spend.json');
        await writeFile(ledger, JSON.stringify({ ceilingUsd: 10, entries: [{ actualUsd: 2, reservedUsd: 4, status: 'settled' }, { actualUsd: null, reservedUsd: .1, status: 'unknown' }] }));
        await writeFile(path.join(root, 'scripts/review/thousand-building-extraction/charge-reconciliation.json'), JSON.stringify({ accountedUsd: 1 }));
        const costs = (await collectProjectStatus(root)).costs;
        assert.equal(costs.accountedUsd, 2.1, 'batch reconciliation must not be added to the global ledger');
        assert.equal(costs.unresolvedEntries, 1);
        assert.equal(costs.ceilingUsd, 10);
        assert.equal(costs.knownConservativeChargeUsd, null, 'batch total is not an unknown-charge estimate');
        await writeFile(ledger, '{"entries":[{"actualUsd":1e999}]}');
        assert.equal((await collectProjectStatus(root)).costs.accountedUsd, null, 'nonfinite money is unknown');
        await writeFile(ledger, 'invalid JSON');
        const invalid = await collectProjectStatus(root);
        assert.equal(invalid.artifacts.spend.valid, false);
        assert.equal(invalid.costs.accountedUsd, null);
        return 'project status tests passed (missing data, global/batch costs, uncertainty and invalid inputs)';
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
}
if (import.meta.url === `file://${process.argv[1]}`)
    runProjectStatusTests().then(console.log);
