#!/usr/bin/env node
/**
 * Install lightweight git hooks without husky.
 * pre-commit: typecheck. pre-push: typecheck + boot smoke e2e.
 * Skip with --no-verify when you must.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

if (!existsSync(join(process.cwd(), '.git'))) {
  console.log('install-git-hooks: no Git checkout metadata; skipping');
  process.exit(0);
}
// Linked worktrees have a .git file. Let Git resolve their shared hooks
// directory, including any configured core.hooksPath override.
const hooksDir = resolve(process.cwd(), execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
  encoding: 'utf8',
}).trim());
mkdirSync(hooksDir, { recursive: true });

const hooks = {
  'pre-commit': `#!/bin/sh
# Canal Recall — fast local gate (typecheck only).
npm run lint
`,
  'pre-push': `#!/bin/sh
# Canal Recall — catch blank-boot regressions before they leave the machine.
npm run lint || exit 1
npm run test:e2e:smoke || exit 1
`,
};

for (const [name, body] of Object.entries(hooks)) {
  const path = join(hooksDir, name);
  writeFileSync(path, body, { mode: 0o755 });
  chmodSync(path, 0o755);
  console.log(`installed ${path}`);
}
