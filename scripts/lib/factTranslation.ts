import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sourceSentences } from '../../src/canalRecall/facts/groundedSummary.ts';
import {
  cleanTranslatorOutput,
  droppedProperNames,
  protectNames,
  translatorInvocation,
} from './translation.ts';

const cacheDirectory = path.resolve('.cache/local-fact-translations');
const TRANSLATOR_VERSION = 'trn-0.2.0-quality-high-sentence-v1';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function translateSentence(sentence: string, names: readonly string[]): Promise<string> {
  const key = hash(`${TRANSLATOR_VERSION}\0${names.join('\0')}\0${sentence}`);
  const cacheFile = path.join(cacheDirectory, `${key}.json`);
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as { key?: string; english?: string };
    if (cached.key === key && cached.english) return cached.english;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const held = protectNames(sentence, names);
  const invocation = translatorInvocation('trn', 'nl', held.text);
  const english = await new Promise<string>((resolve, reject) => {
    const child = execFile('trn', invocation.args);
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout!.on('data', (chunk: Buffer | string) => stdout.push(chunk.toString()));
    child.stderr!.on('data', (chunk: Buffer | string) => stderr.push(chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`trn exited ${code}: ${stderr.join('').trim()}`));
        return;
      }
      resolve(held.restore(cleanTranslatorOutput(stdout.join(''))));
    });
    if (invocation.stdin === null) child.stdin!.end();
    else child.stdin!.end(invocation.stdin);
  });
  if (!english) throw new Error('trn returned an empty translation');
  const dropped = droppedProperNames(sentence, english, names);
  if (dropped.length) throw new Error(`trn dropped proper names: ${dropped.join(', ')}`);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ key, sentence, english }));
  return english;
}

/** Translate independently so Dutch and English sentence IDs stay one-to-one. */
export async function translateDutchPassage(
  source: string,
  names: readonly string[],
  concurrency = 4,
): Promise<{ original: string[]; english: string[] }> {
  const original = sourceSentences(source);
  const english = new Array<string>(original.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < original.length) {
      const index = cursor++;
      english[index] = await translateSentence(original[index], names);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, original.length) }, worker));
  return { original, english };
}
