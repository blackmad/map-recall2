import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/landmarks/cafe-kobalt-cpu-review.mjs','artifacts/gerard-dou-synagogue-cpu/gerard-dou-synagogue-compressed.glb','artifacts/gerard-dou-synagogue-cpu/views-final','335'],{stdio:'inherit'});process.exit(result.status??1);
