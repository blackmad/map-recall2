/**
 * A machine reviewer, kept honest by being recorded as one.
 *
 * A person adjudicating sixty cards is the bottleneck in this project, and the
 * cards that need a person are a minority — most are obviously right or
 * obviously wrong, and only the hard ones deserve the scarce attention. So a
 * vision model triages: it grades every card, and a human's time goes to what it
 * flags or cannot decide.
 *
 * Two rules make that safe rather than circular.
 *
 * **Its verdicts are stored under its own reviewer name**, never merged with a
 * person's. The `answers` table already records who said what, so agreement can
 * be *measured* — on the cards a human has also judged — instead of assumed. A
 * triage whose accuracy is unknown is not triage, it is noise with a confident
 * tone.
 *
 * **It answers the same questions in the same words**, so the comparison is
 * like for like. It is shown the same pictures a person is shown, and no more:
 * not the cross-view residual, not the house-number reading, not its own earlier
 * answer.
 *
 * The model here is the session's own agent rather than an API call, because
 * this project already has one looking at these images and adding a second
 * vendor would add a key, a bill and a licence question for nothing. The loop
 * is: `--next` prints a batch with image paths, the agent reads them and calls
 * `--submit` with its verdicts.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/llm-review.ts --next=8
 *   npx tsx scripts/facade-twin/llm-review.ts --submit='[{"pandId":"…","rightBuilding":"yes",
 *     "fit":"snug","visible":"clear","note":"…"}]'
 *   npx tsx scripts/facade-twin/llm-review.ts --agreement
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const CACHE = path.resolve('.cache/facade-twin');
const DECK = path.join(CACHE, 'registration-review');
const DB = path.resolve('.cache/facade-twin/review.sqlite');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const REVIEWER = arg('reviewer') ?? 'claude';

const db = new DatabaseSync(DB);
db.exec(`
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, pand_id TEXT NOT NULL, question TEXT NOT NULL,
    answer TEXT NOT NULL, reviewer TEXT NOT NULL DEFAULT 'human', note TEXT,
    answered_at TEXT NOT NULL DEFAULT (datetime('now')));`);

const QUESTIONS = ['right-building', 'fit', 'visible'] as const;

if (process.argv.includes('--agreement')) {
  /**
   * Agreement, on the cards both have judged — the only number that says
   * whether the machine's verdicts are worth acting on.
   */
  const rows = db.prepare(`
    SELECT a.pand_id, a.question, a.answer AS mine, h.answer AS theirs
    FROM answers a JOIN answers h
      ON a.pand_id = h.pand_id AND a.question = h.question AND h.reviewer = 'human'
    WHERE a.reviewer = ?
      AND a.id = (SELECT MAX(id) FROM answers x WHERE x.pand_id = a.pand_id AND x.question = a.question AND x.reviewer = a.reviewer)
      AND h.id = (SELECT MAX(id) FROM answers y WHERE y.pand_id = h.pand_id AND y.question = h.question AND y.reviewer = 'human')
  `).all(REVIEWER) as Array<{ pand_id: string; question: string; mine: string; theirs: string }>;
  if (!rows.length) {
    console.log(`No card has been judged by both '${REVIEWER}' and a human yet.`);
    console.log('Agreement cannot be reported, and the machine verdicts should not be acted on until it can.');
  } else {
    for (const question of QUESTIONS) {
      const these = rows.filter(r => r.question === question);
      if (!these.length) continue;
      const same = these.filter(r => r.mine === r.theirs).length;
      console.log(`  ${question.padEnd(16)} ${same}/${these.length} agree (${Math.round(100 * same / these.length)}%)`);
      for (const r of these.filter(r => r.mine !== r.theirs)) {
        console.log(`      ${r.pand_id.slice(-6)}  ${REVIEWER}: ${r.mine.padEnd(10)} human: ${r.theirs}`);
      }
    }
  }
  process.exit(0);
}

const deck = JSON.parse(await readFile(path.join(DECK, 'deck.json'), 'utf8'));

if (process.argv.some(v => v.startsWith('--submit'))) {
  const raw = arg('submit') ?? await readFile('/dev/stdin', 'utf8');
  const verdicts = JSON.parse(raw) as Array<{
    pandId: string; rightBuilding: string; fit?: string; visible: string; note?: string }>;
  const insert = db.prepare('INSERT INTO answers (pand_id, question, answer, reviewer, note) VALUES (?, ?, ?, ?, ?)');
  let n = 0;
  for (const v of verdicts) {
    if (!deck.cards.some((c: any) => c.pandId === v.pandId)) {
      console.error(`  skipped ${v.pandId}: not in the current deck`);
      continue;
    }
    insert.run(v.pandId, 'right-building', v.rightBuilding, REVIEWER, v.note ?? null);
    insert.run(v.pandId, 'fit', v.rightBuilding === 'no' ? 'n/a' : (v.fit ?? 'unsure'), REVIEWER, null);
    insert.run(v.pandId, 'visible', v.visible, REVIEWER, null);
    n++;
  }
  console.log(`recorded ${n} verdicts as reviewer '${REVIEWER}'`);
  process.exit(0);
}

// ---- --next: the batch to look at --------------------------------------
const done = new Set((db.prepare(
  'SELECT DISTINCT pand_id FROM answers WHERE reviewer = ?').all(REVIEWER) as Array<{ pand_id: string }>)
  .map(r => r.pand_id));
const batch = deck.cards.filter((c: any) => !done.has(c.pandId)).slice(0, Number(arg('next') ?? 8));

console.log(`${batch.length} cards to judge (${done.size} already done by '${REVIEWER}', ${deck.cards.length} in the deck)\n`);
for (const card of batch) {
  console.log(`${card.pandId}  ${card.label}`);
  console.log(`  wall ${card.wallWidthM} m (proposed ${card.proposedWidthM} m) · ground ${card.groundZ} m NAP`
    + (card.lensAboveGroundM == null ? '' : ` · lens ${card.lensAboveGroundM} m above it`));
  for (const frame of card.frames) {
    console.log(`  ${path.join(DECK, frame.projection ?? '')}`);
  }
  console.log();
}
console.log('Judge each on what the pictures show, then submit:');
console.log(`  rightBuilding: yes | no | unsure`);
console.log(`  fit:           snug | near | loose | wrong-wall | unsure`);
console.log(`  visible:       clear | partly | blocked`);
