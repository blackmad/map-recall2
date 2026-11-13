// house:from-face (belt builder lanes, docs/house-line.md §6c): turn the houses of a block face that never installed
// (a lane branch's staged run face) into hand HouseSpecs on the recipe route, with the reviewer's corrections as
// `author` fields. The face's own design is kept field by field under the face's strip receipt
// (`streetlevel-measured`), so the spec says which value came from the strip and which from a reading of the photo.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { validateBlockFace } from '../../src/canalRecall/blockFace/intent.ts';
import { fromBlockFace } from '../../src/canalRecall/houseSpec/adapters.ts';
import { specFromFace, type FaceFixes } from '../../src/canalRecall/houseSpec/fromFace.ts';
import { specProblems } from '../../src/canalRecall/houseSpec/spec.ts';
import { toRecipe } from '../../src/canalRecall/houseSpec/toRecipe.ts';
import { validateIntent } from '../../src/canalRecall/buildingRecipe/intent.ts';

export const HELP = `house:from-face: write hand HouseSpecs from the houses of a block face (recipe route).

  node --import tsx scripts/house-specs/from-face.ts (--face <id> | --face-file <run.json> --strip-face <id>)
                                                      [--pands <id,...>] [--fixes <fixes.json>] [--out <dir>] [--check]
  --help                this text

--face <id>       scripts/block-face/faces/<id>/intent.json (a run face such as herengracht-84-148-r1)
--face-file <f>   a run file in block-face form that is not a face (no install, no extract source): houses typed by
                  hand from a strip (type, crown, mirror, overrides, measuredPalette), e.g.
                  scripts/house-specs/belt-gg-west/runs/<run>.json; needs --strip-face
--strip-face <id> the face whose strip.json the run was read from (the receipt's ref)
--pands <ids>     only these pands (16 digits, comma separated; default every house of the face)
--fixes <file>    the reviewer's corrections: {"<pandId>": {"fields": {"<field path>": value}, "why": {"<field path>":
                  "<what the photo shows>"}, "ref": "<photo the fields were read from>", "at": "YYYY-MM-DD",
                  "limits": [{"component", "what"}], "drop": ["<field path>"]}}; each field is written as source author
                  (confidence 0.9) with its why; "drop" removes a face field (e.g. a wrong type default)
--out <dir>       where to write <pandId>.json (default scripts/house-specs/specs)
--check           print each spec's route and problems, write nothing

Each face field is kept under its own path with the face's receipt (streetlevel-measured, 0.85 authored or 0.6
auto-placed; a type-default bay count stays source default). A spec that does not validate, or whose design is not a
valid canal-house intent (route generic), is reported and not written. Unchanged specs are not rewritten (their mtime
is the house:stage receipt rule).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const flag = (args: string[], name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

function main(args: string[]): number {
  if (args.includes('--help') || !args.length) { console.log(HELP); return args.length ? 0 : 1; }
  const faceFileArg = flag(args, 'face-file'), stripFace = flag(args, 'strip-face');
  const faceId = faceFileArg ? stripFace : flag(args, 'face');
  if (!faceId) { console.error('house:from-face: --face, or --face-file with --strip-face, is required (--help)'); return 1; }
  const faceFile = faceFileArg ? path.resolve(faceFileArg) : path.join(ROOT, 'scripts/block-face/faces', faceId, 'intent.json');
  const face = validateBlockFace(JSON.parse(readFileSync(faceFile, 'utf8')));
  const only = flag(args, 'pands')?.split(',').filter(Boolean);
  const fixesFile = flag(args, 'fixes');
  const fixes: Record<string, FaceFixes> = fixesFile ? JSON.parse(readFileSync(path.resolve(fixesFile), 'utf8')) : {};
  const out = path.resolve(flag(args, 'out') ?? path.join(ROOT, 'scripts/house-specs/specs'));
  const check = args.includes('--check');
  let bad = 0;
  for (const h of face.houses) {
    if (only && !only.includes(h.pandId)) continue;
    const base = fromBlockFace(face, h.pandId, `scripts/block-face/faces/${faceId}/strip.json`);
    if (!base) { console.log(`${h.pandId} not on ${face.id}`); bad++; continue; }
    const spec = specFromFace(base, fixes[h.pandId]);
    const problems = specProblems(spec);
    const recipe = toRecipe(spec);
    let why = '';
    if (!recipe) { try { validateIntent({ schemaVersion: 1, kind: 'canal-house', id: 'x', pandId: spec.pandId, address: 'x', sources: [], ...spec.design }); why = 'no dated receipt'; } catch (e) { why = (e as Error).message.split('\n').slice(0, 3).join(' | '); } }
    const fixed = Object.values(spec.provenance).filter(p => p.source === 'author').length;
    console.log(`${h.pandId} ${h.address ?? ''}: route ${recipe ? 'recipe' : 'generic'}, ${fixed} author field(s)${problems.length ? `, problems: ${problems.join('; ')}` : ''}${why ? `, intent: ${why}` : ''}`);
    if (problems.length || !recipe) { bad++; continue; }
    if (check) continue;
    mkdirSync(out, { recursive: true });
    const file = path.join(out, `${h.pandId}.json`), text = JSON.stringify(spec, null, 1) + '\n';
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
  }
  return bad ? 2 : 0;
}

process.exitCode = main(process.argv.slice(2));
