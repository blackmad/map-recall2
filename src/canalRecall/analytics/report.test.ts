import test from 'node:test';
import assert from 'node:assert/strict';
import { buurtRides, dayRange, mergeDays, summariseDay, tally } from './report';

const counters = {
  '_meta|batches': 4,
  'session|device=phone': 3,
  'session|device=desktop': 1,
  'ride_start|mode=bike|entry=surprise|city=amsterdam|seq=1': 3,
  'ride_start|mode=boat|entry=tour|city=amsterdam|seq=2': 1,
  'ride_end|mode=bike|outcome=finished|step=finished|progress=75-100|answered=3-5': 2,
  'ride_end|mode=boat|outcome=abandoned|step=riding|progress=25-50|answered=0': 1,
  'answer|mode=bike|kind=street|prompt=route|input=multiple|outcome=correct': 6,
  'answer|mode=bike|kind=street|prompt=route|input=multiple|outcome=wrong': 2,
  'buurt|mode=bike|code=AA01': 3,
  'buurt|mode=boat|code=AA01': 1,
  'buurt|mode=bike|code=AB02': 5,
  'buurt|mode=bike|code=not-a-code': 9,
};

test('dayRange crosses month ends', () => {
  assert.deepEqual(dayRange('2026-11-02', 4), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});

test('summary and tallies', () => {
  assert.deepEqual(summariseDay({ day: '2026-10-29', counters }), {
    day: '2026-10-29', sessions: 4, rideStarts: 4, finished: 2, abandoned: 1, completion: 0.5, answers: 8, correct: 6,
  });
  assert.deepEqual(tally(counters, 'ride_start', ['mode']), { bike: 3, boat: 1 });
});

test('buurt rides: most ridden first, invalid keys ignored, names attached', () => {
  assert.deepEqual(buurtRides(counters, new Map([['AA01', 'Planciusbuurt-Noord']])), [
    { code: 'AB02', name: '', rides: 5, byMode: { bike: 5 } },
    { code: 'AA01', name: 'Planciusbuurt-Noord', rides: 4, byMode: { bike: 3, boat: 1 } },
  ]);
});

test('mergeDays', () => {
  assert.deepEqual(mergeDays([{ day: 'a', counters: { x: 1 } }, { day: 'b', counters: { x: 2, y: 1 } }]), { x: 3, y: 1 });
});
