// Lane N1 (#323): pick the sentence of a Dutch Wikipedia article that states the
// same fact as an English fact. Pure text; no translation, no invention: the
// result is always one verbatim sentence of the article, or nothing.

export interface SentenceMatch { sentence: string; score: number }

const ABBREVIATIONS = /\b(?:ca|bijv|o\.a|d\.w\.z|m\.n|vgl|nr|dr|mr|ir|drs|St|Jr|Sr|blz|resp|enz|etc|c|d|e|v|vnl|ong|tot|geb|gest|prof|jhr)\.$/i;

/** Sentences of a plain-text article: headings dropped, abbreviations kept whole. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n+/)) {
    const line = block.trim();
    if (!line || /^=+.*=+$/.test(line)) continue;
    const parts = line.split(/(?<=[.!?])\s+(?=[A-Z"'“‘(\[À-Ý])/);
    let carry = '';
    for (const part of parts) {
      const joined = carry ? `${carry} ${part}` : part;
      if (ABBREVIATIONS.test(part) || /\b[A-Z]\.$/.test(part) || /\d\.$/.test(part) && part.length < 12) { carry = joined; continue; }
      carry = '';
      out.push(joined.replace(/\s+/g, ' ').trim());
    }
    if (carry) out.push(carry.replace(/\s+/g, ' ').trim());
  }
  return out.filter(s => s.length >= 40 && s.length <= 300 && /[.!?]["”’)]?$/.test(s) && /\p{Ll}/u.test(s));
}

const STOP = new Set(['The', 'This', 'That', 'It', 'In', 'On', 'At', 'As', 'A', 'An', 'Its', 'His', 'Her', 'He', 'She', 'They', 'Of', 'For', 'By', 'And', 'But', 'With', 'During', 'After', 'Before', 'When', 'Since', 'Today', 'De', 'Het', 'Een', 'In', 'Op', 'Bij', 'Van', 'Voor', 'Na', 'Tot', 'Met', 'Dat', 'Die', 'Dit', 'Deze', 'Het', 'Door', 'Om', 'Als', 'Ook', 'Er', 'Zij', 'Hij', 'Sinds', 'Tijdens']);

const numbers = (s: string) => new Set((s.match(/\b\d{1,4}(?:[.,]\d+)?\b/g) ?? []).filter(n => n.length >= 2));
function names(s: string): Set<string> {
  const out = new Set<string>();
  const re = /(?<![.!?"“]\s)(?<!^)\b\p{Lu}[\p{L}'’-]{2,}/gu;
  for (const m of s.matchAll(re)) if (!STOP.has(m[0])) out.add(m[0].toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''));
  return out;
}
const stems = (s: string) => new Set((s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/\p{L}{6,}/gu) ?? []).map(w => w.slice(0, 5)));
const inter = <T>(a: Set<T>, b: Set<T>) => [...a].filter(x => b.has(x)).length;

/** Best sentence for `english` (fact text plus its English quote), or undefined. */
export function matchFact(english: string, sentences: string[], used: ReadonlySet<string> = new Set()): SentenceMatch | undefined {
  const num = numbers(english), nam = names(english), stm = stems(english);
  let best: SentenceMatch | undefined;
  for (const sentence of sentences) {
    if (used.has(sentence)) continue;
    const n = inter(num, numbers(sentence)), p = inter(nam, names(sentence)), t = inter(stm, stems(sentence));
    if (num.size && n === 0) continue;
    if (num.size && n < Math.min(num.size, 2) && p < 1) continue;
    const score = 3 * n + 1.5 * p + 0.5 * t;
    if (score < 5 || (p + n) < 2) continue;
    if (!best || score > best.score) best = { sentence, score };
  }
  return best;
}
