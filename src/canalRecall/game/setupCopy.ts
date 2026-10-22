// Setup-screen glosses that change with the selection.
//
// Gameplay clarity review 2026-10-17: "Naming help. Expert & Custom sit under
// More options." told a first-time player nothing about what Easy or Hard
// changes. Each level now says what it does, from DIFFICULTY_PRESETS.
//
// The copy lives in the message catalog (`setup.difficulty.*`); this module
// only decides which sentence applies, so the same rule reads correctly in
// Dutch.

import { DIFFICULTY_PRESETS, type CanalPreferences } from './preferences.ts';
import { t as defaultT, type MessageKey } from '../../i18n/index.ts';

type Difficulty = CanalPreferences['difficulty'];
type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function difficultyGloss(difficulty: Difficulty, translate: Translate = defaultT): string {
  if (difficulty === 'custom') return translate('setup.difficulty.customGloss');
  const preset = DIFFICULTY_PRESETS[difficulty as Exclude<Difficulty, 'custom'>];
  if (!preset) return '';
  const answer = preset.answerMode === 'multiple'
    ? translate('setup.difficulty.chooseName')
    : translate('setup.difficulty.typeName');
  const off: string[] = [];
  if (!preset.line) off.push(translate('setup.assist.routeLine'));
  if (!preset.arrow) off.push(translate('setup.assist.arrow'));
  if (!preset.minimap) off.push(translate('setup.assist.minimap'));
  const help = off.length === 0
    ? translate('setup.difficulty.lineOn')
    : translate('setup.difficulty.assistsOff', { assists: listOf(off, translate) });
  return `${answer} ${help}`;
}

/** "route line or minimap" / "route line, arrow or minimap" — Oxford-less in both languages. */
function listOf(items: readonly string[], translate: Translate): string {
  if (items.length <= 1) return items[0] ?? '';
  return translate('setup.difficulty.assistsOffList', {
    list: items.slice(0, -1).join(', '),
    last: items[items.length - 1]!,
  });
}
