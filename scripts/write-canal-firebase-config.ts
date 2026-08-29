/**
 * Emit public/canal-drive/firebase-config.json from the VITE_FIREBASE_* env.
 *
 * Canal Recall is a static page outside the Vite build, so it cannot read
 * import.meta.env. It fetches this file at runtime and falls back to guest mode
 * when it is absent. The file is gitignored: the Firebase web config is not a
 * server secret, but there is no reason to bake it into a committed bundle.
 */
import { writeFile, rm } from 'fs/promises';
import path from 'path';
import { config as loadEnv } from 'dotenv';

for (const file of ['.env.local', '.env']) loadEnv({ path: file, override: false });

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const target = path.join('public', 'canal-drive', 'firebase-config.json');

if (!config.apiKey || !config.projectId || !config.appId) {
  await rm(target, { force: true });
  console.log('No Firebase env found — Canal Recall will run in guest mode.');
} else {
  await writeFile(target, JSON.stringify(config, null, 2) + '\n');
  console.log(`Wrote ${target} for project ${config.projectId}`);
}
