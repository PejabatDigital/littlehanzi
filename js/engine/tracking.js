/* tracking.js — per-word stats and the difficult-flag rules.
   Pure functions: they take a stat and return a new stat. No storage here. */

export const DIFFICULT_CLEAR_STREAK = 2;

export function emptyStat() {
  return { seen: 0, correct: 0, wrong: 0, streak: 0, difficult: false, lastWrongAt: null };
}

export function normaliseStat(stat) {
  const s = stat || {};
  return {
    seen: Number(s.seen) || 0,
    correct: Number(s.correct) || 0,
    wrong: Number(s.wrong) || 0,
    streak: Number(s.streak) || 0,
    difficult: Boolean(s.difficult),
    lastWrongAt: s.lastWrongAt ?? null,
  };
}

/* Record one answer for one word.
   Right: streak grows; 2 in a row clears the difficult flag.
   Wrong: streak resets, word becomes difficult, timestamp recorded. */
export function recordAnswer(stat, correct, now = Date.now()) {
  const s = normaliseStat(stat);
  s.seen += 1;

  if (correct) {
    s.correct += 1;
    s.streak += 1;
    if (s.difficult && s.streak >= DIFFICULT_CLEAR_STREAK) s.difficult = false;
  } else {
    s.wrong += 1;
    s.streak = 0;
    s.difficult = true;
    s.lastWrongAt = now;
  }
  return s;
}

export function accuracy(stat) {
  const s = normaliseStat(stat);
  if (s.seen === 0) return 1;            // unseen words are not "weak"
  return s.correct / s.seen;
}

export function isWeak(stat) {
  const s = normaliseStat(stat);
  return s.wrong > 0 || s.difficult;
}

/* Stats map helper: read a stat from a progress.words object. */
export function statFor(words, wordId) {
  return normaliseStat(words && words[wordId]);
}
