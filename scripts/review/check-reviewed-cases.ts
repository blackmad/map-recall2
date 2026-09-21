/**
 * Single named command for the 2026-09-21 25-case review regressions.
 *
 * The review loop landed one named check per DEPTH lane; each check pins the
 * measured facts (and the data that must not drift) for its reviewed cases.
 * They are intentionally separate files with separate fixtures, but they are
 * only useful run together, so this command runs all of them in isolated child
 * processes and fails if any lane regresses.
 *
 * A child process per check, rather than one import, keeps each lane's
 * module-level side effects and process exits from leaking into the next, and
 * gives an unambiguous per-lane pass/fail line.
 *
 * Run: npx tsx scripts/review/check-reviewed-cases.ts
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

interface ReviewedCheck {
  /** Review taxonomy group the check protects. */
  lane: string;
  /** Reviewed cases the check pins. */
  cases: string;
  /** Repo-relative script path. */
  script: string;
}

const CHECKS: readonly ReviewedCheck[] = [
  {
    lane: 'inferred upper floors',
    cases: 'case-12/13/16/17',
    script: 'scripts/check-contextual-floors.ts',
  },
  {
    lane: 'ground-floor retail assemblies',
    cases: 'case-02/05/11/29',
    script: 'scripts/review/check-retail-ground-assembly.ts',
  },
  {
    lane: 'roof vertical geometry',
    cases: 'case-01/05/19/27',
    script: 'scripts/review/check-reviewed-roof-vertical.ts',
  },
  {
    lane: 'wall colour / material',
    cases: 'case-08/14',
    script: 'scripts/review/check-reviewed-wall-colour.ts',
  },
  {
    lane: 'framing / centering / overlap',
    cases: 'case-06/20/30',
    script: 'scripts/review/check-reviewed-framing.ts',
  },
  {
    lane: 'source-shape study delivery',
    cases: 'case-14',
    script: 'scripts/review/check-reviewed-shape-study.ts',
  },
  {
    lane: 'roof coverage delivery',
    cases: 'case-27',
    script: 'scripts/review/check-reviewed-roof-coverage.ts',
  },
  {
    lane: 'wall-colour render delivery',
    cases: 'case-08',
    script: 'scripts/review/check-reviewed-wall-colour-render.ts',
  },
  {
    lane: 'registered-frontage fallback',
    cases: 'case-09',
    script: 'scripts/review/check-reviewed-frontage-fallback.ts',
  },
  {
    lane: 'registered-frontage coverage gap',
    cases: 'case-02/13/19/22/29',
    script: 'scripts/review/check-reviewed-frontage-coverage.ts',
  },
  {
    lane: 'near-white window glazing guard',
    cases: 'case-11/18',
    script: 'scripts/review/check-reviewed-glazing.ts',
  },
  {
    lane: 'inferred upper-floor row delivery',
    cases: 'case-12',
    script: 'scripts/review/check-reviewed-floor-rows.ts',
  },
  {
    lane: 'opening-frame clearance delivery',
    cases: 'case-05',
    script: 'scripts/review/check-reviewed-opening-frames.ts',
  },
];

const root = process.cwd();
const failures: ReviewedCheck[] = [];
const results: Array<{ check: ReviewedCheck; ok: boolean; ms: number }> = [];

for (const check of CHECKS) {
  const script = path.resolve(root, check.script);
  const started = Date.now();
  process.stdout.write(`\n=== ${check.lane} (${check.cases}) — ${check.script} ===\n`);
  const run = spawnSync(process.execPath, ['--import', 'tsx', script], {
    cwd: root,
    stdio: 'inherit',
  });
  const ms = Date.now() - started;
  const ok = run.status === 0 && !run.error;
  if (!ok) {
    failures.push(check);
    if (run.error) process.stderr.write(`${run.error.message}\n`);
  }
  results.push({ check, ok, ms });
}

const passed = results.length - failures.length;
process.stdout.write('\n--- reviewed-case regressions ---\n');
for (const { check, ok, ms } of results) {
  process.stdout.write(
    `${ok ? 'pass' : 'FAIL'}  ${String(ms).padStart(6)} ms  ${check.lane} (${check.cases})\n`,
  );
}

if (failures.length > 0) {
  process.stderr.write(`\n${failures.length}/${results.length} reviewed-case lanes regressed\n`);
  process.exit(1);
}

process.stdout.write(
  `\n${passed}/${results.length} reviewed-case lanes pass; all pinned review facts hold.\n`,
);
