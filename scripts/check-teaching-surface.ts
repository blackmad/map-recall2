import assert from 'node:assert/strict';
import {
  canShowDriveByCard,
  canShowMiniMap,
  canShowPostcard,
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

assert.equal(canShowDriveByCard('desktop', idle), true, 'desktop still gets drive-by cards');
assert.equal(canShowDriveByCard('compact', idle), false, 'the phone layout does not (user request 2026-09-28)');
assert.equal(canShowDriveByCard('desktop', quiz), false, 'and never under a quiz');

// A riding (non-blocking) question owns the trivia slot, not the postcard's corner.
const riding = { quizOpen: true, feedbackVisible: false, promptVisible: true, utilityOpen: false, ridingPromptOpen: true };
assert.equal(canShowTeachingCard(riding), false, 'no museum card under a riding question');
assert.equal(canShowDriveByCard('desktop', riding), false);
assert.equal(canShowPostcard('desktop', riding), true, 'the postcard shares the band on a desktop');
assert.equal(canShowPostcard('compact', riding), false, 'on a phone the postcard waits');
assert.equal(canShowPostcard('desktop', { ...riding, feedbackVisible: true }), false, 'lingering feedback still blocks it');
assert.equal(canShowPostcard('desktop', { ...riding, utilityOpen: true }), false);
assert.equal(canShowPostcard('desktop', quiz), false, 'a blocking question still hides it');
assert.equal(canShowPostcard('desktop', idle), true);

console.log('teaching surface: 28 checks passed');
