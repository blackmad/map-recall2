import assert from 'node:assert/strict';
import { advanceNeighborhood, type NeighborhoodTransitionState } from '../src/canalRecall/neighborhoodState';

const start = (): NeighborhoodTransitionState => ({ current: 'Jordaan', candidate: '', candidateSeconds: 0 });

let state = start();
state = advanceNeighborhood(state, 'Grachtengordel', 0.1).state;
state = advanceNeighborhood(state, 'Jordaan', 0.1).state;
assert.deepEqual(state, start(), 'a one-frame overlap does not change neighborhood');

let transition = advanceNeighborhood(start(), 'Grachtengordel', 0.1);
for (let index = 0; index < 10 && !transition.changed; index++) {
  transition = advanceNeighborhood(transition.state, 'Grachtengordel', 0.1);
}
assert.equal(transition.changed, true);
assert.equal(transition.state.current, 'Grachtengordel');

transition = advanceNeighborhood(transition.state, '', 0.1);
for (let index = 0; index < 10 && !transition.changed; index++) {
  transition = advanceNeighborhood(transition.state, '', 0.1);
}
assert.equal(transition.changed, true, 'leaving all mapped areas is also stable');
assert.equal(transition.state.current, '');

process.stdout.write('Neighborhood transition checks passed.\n');
