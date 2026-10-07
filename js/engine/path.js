/* path.js — station unlocking, station word sets, weakest-first ordering. */

import { statFor, accuracy, isWeak } from './tracking.js';

export const STATIONS = 8;
export const NEW_WORDS_PER_STATION = 5;
export const MAX_DIFFICULT_CARRY = 5;
export const REVIEW_WORD_COUNT = 10;
export const LEVEL_CHECK_STATION = 8;
export const PASS_RATIO = 0.8;

export function isLevelCheck(station) {
  return station === LEVEL_CHECK_STATION;
}

/* Stations 1–6 each introduce the next 5 words in list order.
   Stations 7–8 introduce nothing. */
export function newWordsForStation(words, station) {
  if (station < 1 || station > 6) return [];
  const start = (station - 1) * NEW_WORDS_PER_STATION;
  return words.slice(start, start + NEW_WORDS_PER_STATION);
}

/* Every word introduced at or before this station. */
export function introducedWords(words, station) {
  const upto = Math.min(station, 6);
  return words.slice(0, upto * NEW_WORDS_PER_STATION);
}

/* Difficult words to carry into a station: most recently missed first,
   capped at MAX_DIFFICULT_CARRY, never including this station's new words. */
export function difficultCarry(words, progressWords, excludeIds = [], limit = MAX_DIFFICULT_CARRY) {
  const exclude = new Set(excludeIds);
  return words
    .filter((w) => !exclude.has(w.id) && statFor(progressWords, w.id).difficult)
    .sort((a, b) => {
      const ta = statFor(progressWords, a.id).lastWrongAt ?? 0;
      const tb = statFor(progressWords, b.id).lastWrongAt ?? 0;
      return tb - ta;                         // most recent mistake first
    })
    .slice(0, limit);
}

/* Weakest first: most recent mistake, then lowest accuracy.
   If fewer than `count` words are weak, fill at random from the rest. */
export function weakestFirst(words, progressWords, count = REVIEW_WORD_COUNT, rng = Math.random) {
  const weak = words.filter((w) => isWeak(statFor(progressWords, w.id)));

  weak.sort((a, b) => {
    const sa = statFor(progressWords, a.id);
    const sb = statFor(progressWords, b.id);
    const ta = sa.lastWrongAt ?? 0;
    const tb = sb.lastWrongAt ?? 0;
    if (tb !== ta) return tb - ta;            // most recent mistake first
    const accDiff = accuracy(sa) - accuracy(sb);
    if (accDiff !== 0) return accDiff;        // lowest accuracy first
    return 0;
  });

  const picked = weak.slice(0, count);
  if (picked.length >= count) return picked;

  const chosen = new Set(picked.map((w) => w.id));
  const rest = shuffle(words.filter((w) => !chosen.has(w.id)), rng);
  return picked.concat(rest.slice(0, count - picked.length));
}

/* The word set a station plays with. */
export function stationWordSet(words, station, progressWords, rng = Math.random) {
  if (station >= 7) {
    const pool = introducedWords(words, station);
    return weakestFirst(pool.length ? pool : words, progressWords, REVIEW_WORD_COUNT, rng);
  }
  const fresh = newWordsForStation(words, station);
  const freshIds = fresh.map((w) => w.id);
  const carried = difficultCarry(introducedWords(words, station - 1), progressWords, freshIds);
  return { new: fresh, carried, all: fresh.concat(carried) };
}

/* ---------------- unlocking ---------------- */

export function stationState(station, progress) {
  const completed = progress.completedStations || [];
  const unlocked = progress.unlockedStation || 1;
  if (completed.includes(station)) return 'completed';
  if (station === unlocked) return 'current';
  if (station < unlocked) return 'completed';
  return 'locked';
}

export function isStationPlayable(station, progress) {
  return stationState(station, progress) !== 'locked';
}

/* Mark a station done. Station 8 only unlocks nothing — the level result decides. */
export function completeStation(progress, station) {
  const next = {
    ...progress,
    completedStations: [...new Set([...(progress.completedStations || []), station])].sort((a, b) => a - b),
  };
  if (station < STATIONS && (progress.unlockedStation || 1) <= station) {
    next.unlockedStation = station + 1;
  }
  return next;
}

/* ---------------- helpers ---------------- */

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
