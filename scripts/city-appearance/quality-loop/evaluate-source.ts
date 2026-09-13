#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSourceEvaluation } from './source-evaluation.ts';

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(value);
  if (!match) throw new Error(`Unexpected argument: ${value}`);
  return [match[1], match[2] ?? true];
}));
if (typeof args.root !== 'string') throw new Error('Usage: evaluate-source.ts --root=/absolute/input/root [--reference=path] [--analysis=path] [--manifest=path[,path]] [--iou=0.5] [--out=path]');
const report = await buildSourceEvaluation({
  root: path.resolve(args.root),
  referencePath: typeof args.reference === 'string' ? args.reference : undefined,
  analysisPath: typeof args.analysis === 'string' ? args.analysis : undefined,
  manifestPaths: typeof args.manifest === 'string' ? args.manifest.split(',') : undefined,
  iouThreshold: typeof args.iou === 'string' ? Number(args.iou) : undefined,
});
const json = `${JSON.stringify(report, null, 2)}\n`;
if (typeof args.out === 'string') {
  const out = path.resolve(args.out);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, json, { flag: 'wx' });
  process.stderr.write(`staged source evaluation: ${out}\n`);
} else process.stdout.write(json);
