/* station.js — what happens inside one station: which activities run,
   in what order, how mistakes come back, and how the level check is scored. */

import { shuffle, isLevelCheck, PASS_RATIO } from './path.js';

export const ACTIVITY = {
  THIS_OR_THAT: 'this-or-that',
  IDENTIFICATION: 'identification',
  PINYIN_MATCH: 'pinyin-match',
  MEMORY_MATCH: 'memory-match',
};

export const ACTIVITY_LABEL = {
  [ACTIVITY.THIS_OR_THAT]: 'This or That',
  [ACTIVITY.IDENTIFICATION]: 'Identification',
  [ACTIVITY.PINYIN_MATCH]: 'Pinyin Match',
  [ACTIVITY.MEMORY_MATCH]: 'Memory Match',
};

/* Memory Match needs 6 pairs, so it never runs in station 1. */
const SECONDARY = [ACTIVITY.IDENTIFICATION, ACTIVITY.PINYIN_MATCH, ACTIVITY.MEMORY_MATCH];
const ALL = [ACTIVITY.THIS_OR_THAT, ...SECONDARY];

/* Stations 1–6: This or That first, then 2 distinct others.
   Stations 7–8: 3 distinct activities from all four. */
export function pickActivities(station, rng = Math.random) {
  if (station >= 7) return shuffle(ALL, rng).slice(0, 3);
  const pool = station === 1
    ? SECONDARY.filter((a) => a !== ACTIVITY.MEMORY_MATCH)
    : SECONDARY;
  return [ACTIVITY.THIS_OR_THAT, ...shuffle(pool, rng).slice(0, 2)];
}

/* ---------------- question queue ---------------- */

/* A queue that can push a missed item back for a second go, later in the
   same activity. `requeueGap` keeps it from reappearing immediately. */
export function createQuestionQueue(items, { requeueGap = 2 } = {}) {
  const queue = items.slice();
  let served = 0;

  return {
    get remaining() { return queue.length; },
    get served() { return served; },
    next() {
      if (queue.length === 0) return null;
      served += 1;
      return queue.shift();
    },
    requeue(item) {
      const at = Math.min(requeueGap, queue.length);
      queue.splice(at, 0, item);
    },
    peek() { return queue[0] ?? null; },
  };
}

/* ---------------- station run ---------------- */

/* Tracks everything that happens in one station so the caller can save
   word stats, show a progress bar, and score the level check. */
export function createStationRun({ station, words, activities }) {
  const firstAnswer = new Map();   // wordId -> true if the first answer was right
  const answers = [];              // { wordId, correct, activity }
  const missed = new Set();
  const levelCheck = isLevelCheck(station);

  let activityIndex = 0;
  let activityProgress = 0;        // 0..1 within the current activity

  return {
    station,
    words,
    activities,
    levelCheck,

    get activity() { return activities[activityIndex] ?? null; },
    get activityIndex() { return activityIndex; },
    get isLastActivity() { return activityIndex >= activities.length - 1; },
    get isFinished() { return activityIndex >= activities.length; },

    /* Called by an activity for every answer the child gives. */
    record(wordId, correct, activity = activities[activityIndex]) {
      if (!firstAnswer.has(wordId)) firstAnswer.set(wordId, Boolean(correct));
      answers.push({ wordId, correct: Boolean(correct), activity });
      if (correct) missed.delete(wordId); else missed.add(wordId);
      return { wordId, correct: Boolean(correct) };
    },

    /* Words still unresolved — they ended on a wrong answer. */
    get missedWords() { return [...missed]; },
    get answers() { return answers.slice(); },

    setActivityProgress(fraction) {
      activityProgress = Math.max(0, Math.min(1, fraction));
    },

    /* 0–100 across the whole station, for the progress bar. */
    get progress() {
      const total = activities.length || 1;
      return Math.round(((activityIndex + activityProgress) / total) * 100);
    },

    nextActivity() {
      activityIndex += 1;
      activityProgress = 0;
      return activities[activityIndex] ?? null;
    },

    /* Level check: share of words answered right on the first try. */
    get firstTryRatio() {
      if (firstAnswer.size === 0) return 0;
      let right = 0;
      for (const ok of firstAnswer.values()) if (ok) right += 1;
      return right / firstAnswer.size;
    },

    get firstTryCount() {
      let right = 0;
      for (const ok of firstAnswer.values()) if (ok) right += 1;
      return { right, total: firstAnswer.size };
    },

    get passed() {
      return levelCheck && this.firstTryRatio >= PASS_RATIO;
    },
  };
}

/* ---------------- activity word sets ---------------- */

/* Pinyin Match needs 5 words, Memory Match needs 6 pairs.
   Fill short sets from other already-introduced words. */
export function fillTo(selected, pool, size, rng = Math.random) {
  const have = new Set(selected.map((w) => w.id));
  const out = selected.slice(0, size);
  if (out.length >= size) return out;
  const extras = shuffle(pool.filter((w) => !have.has(w.id)), rng);
  return out.concat(extras.slice(0, size - out.length));
}

export const ACTIVITY_SIZE = {
  [ACTIVITY.PINYIN_MATCH]: 5,
  [ACTIVITY.MEMORY_MATCH]: 6,
};
