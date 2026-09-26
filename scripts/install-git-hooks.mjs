#!/usr/bin/env node
/**
 * Install lightweight git hooks without husky.
 * pre-commit: typecheck. pre-push: typecheck + boot smoke e2e.
 * Skip with --no-verify when you must.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const hooksDir = join(process.cwd(), '.git', 'hooks');
if (!existsSync(join(process.cwd(), '.git'))) {
  console.log('install-git-hooks: no .git directory; skipping');
  process.exit(0);
}
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
