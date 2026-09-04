import assert from 'node:assert/strict';
import {
  canShowMiniMap,
  canShowPoiLabels,
  canShowTeachingCard,
  teachingOwnsBottom,
} from '../src/canalRecall/game/teachingSurface.ts';

const idle = { quizOpen: false, feedbackVisible: false, promptVisible: false, utilityOpen: false };
const quiz = { quizOpen: true, feedbackVisible: false, promptVisible: true, utilityOpen: false };
const hold = { quizOpen: false, feedbackVisible: true, promptVisible: true, utilityOpen: false };
const staleFeedback = { quizOpen: false, feedbackVisible: true, promptVisible: false, utilityOpen: false };
const overlay = { quizOpen: false, feedbackVisible: false, promptVisible: false, utilityOpen: true };

assert.equal(teachingOwnsBottom(idle), false);
assert.equal(teachingOwnsBottom(quiz), true);
assert.equal(teachingOwnsBottom(hold), true);
assert.equal(teachingOwnsBottom(staleFeedback), true);
assert.equal(teachingOwnsBottom(overlay), true);

assert.equal(canShowTeachingCard(idle), true);
assert.equal(canShowTeachingCard(quiz), false, 'no museum card under a waterway question');
assert.equal(canShowTeachingCard(hold), false, 'no postcard under lingering feedback');
assert.equal(canShowTeachingCard(staleFeedback), false);

assert.equal(canShowMiniMap(true, idle), true);
assert.equal(canShowMiniMap(true, quiz), true, 'overview stays up while answering');
assert.equal(canShowMiniMap(true, hold), true, 'and during answer feedback');
assert.equal(canShowMiniMap(true, overlay), false, 'utility panels still own the screen');
assert.equal(canShowMiniMap(false, idle), false);
assert.equal(canShowMiniMap(false, quiz), false);

assert.equal(canShowPoiLabels(true, idle), true);
assert.equal(canShowPoiLabels(true, quiz), false);
assert.equal(canShowPoiLabels(false, idle), false);

console.log('teaching surface: 17 checks passed');
