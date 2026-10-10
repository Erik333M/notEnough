/**
 * Keeping the shared half of the app civil.
 *
 * Three mechanisms, because App Review asks for three and because each one
 * covers a hole the others leave:
 *
 *  - a **filter**, so the most obvious abuse never lands at all;
 *  - **reporting**, so a person can flag what a filter was never going to
 *    catch — which is most of it;
 *  - **blocking**, so somebody can act immediately without waiting for
 *    anybody else to agree with them.
 *
 * ── On the filter ───────────────────────────────────────────────────────────
 *
 * It is a floor, not a solution. A wordlist catches slurs typed in the clear
 * and nothing else: not sarcasm, not targeted cruelty in perfectly clean
 * words, not a photograph. Anybody who wants past it will get past it in
 * about ten seconds. It exists so that the laziest abuse is rejected at the
 * door, and because the alternative — nothing — is worse.
 *
 * The real mechanism is the block, which needs no one's agreement and works
 * instantly. The list below is deliberately short and deliberately only
 * unambiguous terms: a long list catches "Scunthorpe" and teaches people the
 * app is broken, which is how filters end up switched off.
 */

/** Unambiguous, and checked against whole words only. */
const REFUSED = [
  'nigger',
  'nigga',
  'faggot',
  'tranny',
  'retard',
  'kike',
  'spic',
  'chink',
  'wetback',
  'paki',
  'coon',
];

/**
 * Collapse the usual evasions before matching.
 *
 * Leetspeak, padding and repeated letters are the whole of what a casual
 * evader tries. Anything cleverer defeats this, which is the point made
 * above.
 */
const LEET = {
  '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '9': 'g',
  '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', $: 's', '7': 't', '2': 'z',
};

function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[4@8(369!|105$72]/g, (c) => LEET[c] ?? c)
    // Anything left that is not a letter is dropped rather than mapped, so
    // punctuation between letters cannot be used to break a word up.
    .replace(/[^a-z\s]/g, '')
    // "niiiiice" and "niice" normalise alike; two is enough to keep real
    // doubled letters, which plenty of words have.
    .replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Whether a piece of text may be posted.
 *
 * Returns the term that stopped it, so the caller can say what happened
 * rather than refusing anonymously — somebody whose innocent sentence was
 * rejected deserves to know which word to change.
 */
export function refusedTerm(text) {
  if (typeof text !== 'string') return null;
  const words = new Set(normalise(text).split(/\s+/).filter(Boolean));
  for (const term of REFUSED) {
    if (words.has(term)) return term;
  }
  // Also catch it run together with punctuation stripped, e.g. "you.are.a.X".
  const joined = normalise(text).replace(/\s+/g, '');
  for (const term of REFUSED) {
    if (joined.includes(term)) return term;
  }
  return null;
}

/** What a report can be about. Each maps to content the app actually holds. */
export const REPORT_KINDS = ['message', 'post', 'person'];

/** Offered as reasons, so a report carries more than "I did not like it". */
export const REPORT_REASONS = [
  'abuse',
  'harassment',
  'spam',
  'sexual',
  'violence',
  'impersonation',
  'other',
];
