// Setup-screen glosses that change with the selection.
//
// Gameplay clarity review 2026-10-17: "Naming help. Expert & Custom sit under
// More options." told a first-time player nothing about what Easy or Hard
// changes. Each level now says what it does, from DIFFICULTY_PRESETS.

import { DIFFICULTY_PRESETS, type CanalPreferences } from './preferences.ts';

type Difficulty = CanalPreferences['difficulty'];

export function difficultyGloss(difficulty: Difficulty): string {
  if (difficulty === 'custom') return 'Your own mix of help, set under More options.';
  const preset = DIFFICULTY_PRESETS[difficulty as Exclude<Difficulty, 'custom'>];
  if (!preset) return '';
  const answer = preset.answerMode === 'multiple' ? 'Pick the name from a list.' : 'Type each name.';
  const off: string[] = [];
  if (!preset.line) off.push('route line');
  if (!preset.arrow) off.push('arrow');
  if (!preset.minimap) off.push('minimap');
  const help = off.length === 0
    ? 'Route line shown.'
    : `No ${off.join(' or ').replace(/ or (?=[^ ]+ or )/, ', ')}.`;
  return `${answer} ${help}`;
}
