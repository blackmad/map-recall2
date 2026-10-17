/**
 * Emit public/canal-drive/js/runtime-config.js from the deploy environment.
 *
 * Canal Recall is a static page outside the Vite build, so it cannot read
 * import.meta.env. It reads `window.CANAL_RUNTIME_CONFIG` set by this file.
 * The checked-in default has empty values, so every monitoring and abuse
 * protection feature stays a no-op until the matching key is provided.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const config = {
  sentryDsn: process.env.SENTRY_DSN || '',
  release: process.env.GITHUB_SHA || '',
  appCheckSiteKey: process.env.APPCHECK_SITE_KEY || '',
};

const target = path.join(process.cwd(), 'public', 'canal-drive', 'js', 'runtime-config.js');
const body = `// Generated at deploy time by scripts/write-runtime-config.mjs.\nwindow.CANAL_RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
await writeFile(target, body);
console.log(`Wrote ${target}:`, config);
