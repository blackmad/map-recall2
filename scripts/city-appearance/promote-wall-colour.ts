/** Promote only owner grades bound to the current observation, building and crop. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteWallColour, sha256, type WallGrade, type WallMeasurement } from '../../src/canalRecall/facade/wallColourPublication.js';

const flag = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const measurementsPath = flag('measurements') ?? 'review-data/wall-colour/v1/measurements.json';
const gradesPath = flag('grades');
const outputPath = flag('out') ?? 'review-data/wall-colour/v1/accepted.json';

export async function promoteWallColourFile(measurementsFile: string, gradesFile: string, outputFile: string): Promise<number> {
  const measurementBytes = await fs.readFile(measurementsFile);
  const measurementDoc = JSON.parse(measurementBytes.toString()) as { measurements: WallMeasurement[] };
  if (!Array.isArray(measurementDoc.measurements)) throw Error('Invalid wall measurements');
  const gradesDoc = JSON.parse(await fs.readFile(gradesFile, 'utf8')) as { grades: Record<string, WallGrade> };
  if (!gradesDoc.grades || typeof gradesDoc.grades !== 'object' || Array.isArray(gradesDoc.grades)) throw Error('Invalid wall grades');
  const set = promoteWallColour(measurementDoc.measurements, gradesDoc.grades, sha256(measurementBytes));
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(set, null, 2) + '\n');
  return set.accepted.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!gradesPath) throw Error('Supply an exported review payload with --grades=<path>');
  const count = await promoteWallColourFile(measurementsPath, gradesPath, outputPath);
  console.log(`Promoted ${count} accepted wall colours to ${outputPath}`);
}
