/**
 * The street the game names must be the one being driven, not the cross street.
 *
 * `pickRoadContact` has preferred the heading-aligned way at junctions for a
 * while, and `check-road-surface.ts` proves it does. The plaque and the route
 * quiz still named the cross street, because none of their callers passed the
 * player's heading — the rule existed and was never consulted. That is a
 * wiring failure, so this check pins the wiring in two ways:
 *
 *  1. Behaviour: `_updateCanalQuiz` on a real `roadSurface` junction, with the
 *     player a few px off the through street's centreline (where the cross
 *     street's centreline is geometrically nearer), must adopt the through
 *     street as the quiz candidate.
 *  2. Source: every `getRoadName(` / `getNearestRoad(` call in the game
 *     runtimes passes a heading. A two-argument call is the regression.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildRoadSpatialIndex,
  contactsAt,
  pickRoadContact,
  roadNameAt,
  roadsNear,
  type RoadSegmentLike,
} from '../src/canalRecall/routing/roadSurface.ts';

// The runtime registers itself on `window` when loaded and reads the quiz
// timing constants from the page's `constants.js`; give it both.
Object.assign(globalThis, { window: globalThis, QUIZ_CANDIDATE_DELAY: 0.65, QUIZ_RETEST_DELAY: 0.3 });
const { GameRecallRuntime } = await import('../src/canalRecall/game/recallRuntime.ts');

// ---- 1. Behaviour ---------------------------------------------------------
// Hasebroekstraat meets Kinkerstraat in the Kinkerbuurt; driving along
// Kinkerstraat past the junction, a few px toward the side street, is where
// the plaque used to flip to "Hasebroekstraat".
const through: RoadSegmentLike = {
  points: [{ x: -500, y: 0 }, { x: 500, y: 0 }], width: 32, name: 'Kinkerstraat',
};
const side: RoadSegmentLike = {
  points: [{ x: 0, y: -500 }, { x: 0, y: 500 }], width: 24, name: 'Hasebroekstraat',
};
const segments = [through, side];
const index = buildRoadSpatialIndex(segments);

const calls: Array<[string, number | null | undefined]> = [];
const track = {
  segments,
  getNearestRoad(x: number, y: number, preferredAngle: number | null = null) {
    calls.push(['getNearestRoad', preferredAngle]);
    return pickRoadContact(contactsAt(roadsNear(index, x, y, 2), x, y), preferredAngle);
  },
  getRoadName(x: number, y: number, preferredAngle: number | null = null) {
    calls.push(['getRoadName', preferredAngle]);
    return roadNameAt(segments, this.getNearestRoad(x, y, preferredAngle));
  },
};

// 4 px east of the side street's centreline, 6 px south of the through
// street's: the side street is nearer, the heading says east.
const player = { x: 4, y: 6, angle: 0, speed: 120 };
assert.equal(track.getRoadName(player.x, player.y), 'Hasebroekstraat',
  'fixture: without a heading the nearest centreline is the cross street');
calls.length = 0;

const host = {
  player,
  track,
  quizCurrentName: '',
  quizCandidateName: '',
  quizCandidateTimer: 0,
  revealedNames: new Set<string>(),
  learnedNames: new Set<string>(),
  travelMode: 'car',
  _isRecallSuppressedHere: () => false,
  _revealName: () => { throw new Error('should not reveal on the first frame'); },
  _showStreetKnowledge: () => { throw new Error('should not adopt on the first frame'); },
  _openQuizPrompt: () => { throw new Error('should not ask on the first frame'); },
};
GameRecallRuntime.prototype._updateCanalQuiz.call(host as unknown as GameRecallRuntime, 1 / 60);

assert.equal(host.quizCandidateName, 'Kinkerstraat',
  'the quiz candidate is the street being driven, not the cross street underfoot');
assert.ok(calls.length > 0, 'the quiz consulted the track');
for (const [method, heading] of calls) {
  assert.equal(heading, player.angle, `${method} was called with the player heading`);
}

// ---- 2. Source ------------------------------------------------------------
// Names or quizzes the road under the wheels; each call must carry a heading.
// The one place that has none — deriving the start heading from the nearest
// road in `_setupRace` — says so with an explicit `null`.
const runtimeFiles = [
  'src/canalRecall/game/recallRuntime.ts',
  'src/canalRecall/game/presentationRuntime.ts',
  'public/canal-drive/js/game-route.js',
];
const callPattern = /\.(getRoadName|getNearestRoad)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
let inspected = 0;
for (const file of runtimeFiles) {
  const source = readFileSync(path.resolve(file), 'utf8');
  for (const match of source.matchAll(callPattern)) {
    inspected++;
    const args = match[2].split(',').map(part => part.trim()).filter(Boolean);
    const line = source.slice(0, match.index).split('\n').length;
    assert.equal(args.length, 3,
      `${file}:${line} ${match[0]} — pass the player's heading, or a junction names the cross street`);
  }
}
assert.ok(inspected >= 8, `expected to inspect the runtime call sites, saw ${inspected}`);

process.stdout.write(`Road-name heading checks passed (junction quiz candidate, ${inspected} call sites carry a heading).\n`);
