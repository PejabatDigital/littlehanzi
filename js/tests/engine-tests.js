/* engine-tests.js — assertions for the rules in the brief.
   Imported by tests.html (browser) and by the Node harness. No framework. */

import {
  emptyStat, recordAnswer, accuracy, isWeak, DIFFICULT_CLEAR_STREAK,
} from '../engine/tracking.js';

import {
  newWordsForStation, introducedWords, difficultCarry, weakestFirst,
  stationWordSet, completeStation, stationState, isStationPlayable,
  shuffle, STATIONS, MAX_DIFFICULT_CARRY, REVIEW_WORD_COUNT, PASS_RATIO,
} from '../engine/path.js';

import {
  ACTIVITY, pickActivities, createQuestionQueue, createStationRun, fillTo,
} from '../engine/station.js';

/* ---------------- tiny harness ---------------- */

const results = [];
let group = '';

function describe(name, fn) { group = name; fn(); }
function it(name, fn) {
  try {
    fn();
    results.push({ group, name, ok: true });
  } catch (err) {
    results.push({ group, name, ok: false, message: err.message });
  }
}
function eq(actual, expected, what = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}expected ${e}, got ${a}`);
}
function ok(value, what = 'expected truthy') {
  if (!value) throw new Error(what);
}

/* ---------------- fixtures ---------------- */

/* 30 stand-in words, same shape as data/a1.json */
const WORDS = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: `a1_${n}`, level: 'A1', word: `字${i + 1}`, pinyin: `p${i + 1}`, meaning: `m${i + 1}`, audio: `audio/a1/a1_${n}.mp3`, image: null };
});
const ids = (list) => list.map((w) => w.id);

function stats(spec) {
  const out = {};
  for (const [id, s] of Object.entries(spec)) out[id] = { ...emptyStat(), ...s };
  return out;
}

/* deterministic rng for tests */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- tracking ---------------- */

describe('tracking — word stats', () => {
  it('a new stat is all zeros and not difficult', () => {
    eq(emptyStat(), { seen: 0, correct: 0, wrong: 0, streak: 0, difficult: false, lastWrongAt: null });
  });

  it('a right answer increments seen, correct and streak', () => {
    const s = recordAnswer(emptyStat(), true, 1000);
    eq([s.seen, s.correct, s.wrong, s.streak], [1, 1, 0, 1]);
    eq(s.lastWrongAt, null);
  });

  it('a wrong answer marks the word difficult and stamps the time', () => {
    const s = recordAnswer(emptyStat(), false, 1234);
    eq([s.seen, s.correct, s.wrong, s.streak], [1, 0, 1, 0]);
    eq(s.difficult, true);
    eq(s.lastWrongAt, 1234);
  });

  it('difficult is NOT cleared by one right answer', () => {
    let s = recordAnswer(emptyStat(), false, 1);
    s = recordAnswer(s, true, 2);
    eq(s.difficult, true, 'after 1 correct: ');
    eq(s.streak, 1);
  });

  it(`difficult is cleared by exactly ${DIFFICULT_CLEAR_STREAK} right answers in a row`, () => {
    let s = recordAnswer(emptyStat(), false, 1);
    s = recordAnswer(s, true, 2);
    s = recordAnswer(s, true, 3);
    eq(s.difficult, false, 'after 2 correct: ');
    eq(s.streak, 2);
  });

  it('a wrong answer part-way resets the streak, so 2 fresh correct are needed', () => {
    let s = recordAnswer(emptyStat(), false, 1);
    s = recordAnswer(s, true, 2);   // streak 1
    s = recordAnswer(s, false, 3);  // streak 0, difficult again
    s = recordAnswer(s, true, 4);   // streak 1
    eq(s.difficult, true, 'still difficult: ');
    s = recordAnswer(s, true, 5);   // streak 2
    eq(s.difficult, false, 'now cleared: ');
  });

  it('a word can go difficult again after being cleared', () => {
    let s = recordAnswer(recordAnswer(recordAnswer(emptyStat(), false, 1), true, 2), true, 3);
    eq(s.difficult, false);
    s = recordAnswer(s, false, 4);
    eq(s.difficult, true);
    eq(s.streak, 0);
  });

  it('accuracy treats an unseen word as perfect, so it is not weak', () => {
    eq(accuracy(emptyStat()), 1);
    eq(isWeak(emptyStat()), false);
  });

  it('accuracy is correct over seen', () => {
    let s = recordAnswer(emptyStat(), true, 1);
    s = recordAnswer(s, false, 2);
    eq(accuracy(s), 0.5);
    eq(isWeak(s), true);
  });
});

/* ---------------- path: word sets ---------------- */

describe('path — new words per station', () => {
  it('station 1 introduces words 1–5', () => {
    eq(ids(newWordsForStation(WORDS, 1)), ['a1_01', 'a1_02', 'a1_03', 'a1_04', 'a1_05']);
  });

  it('station 6 introduces words 26–30', () => {
    eq(ids(newWordsForStation(WORDS, 6)), ['a1_26', 'a1_27', 'a1_28', 'a1_29', 'a1_30']);
  });

  it('stations 7 and 8 introduce nothing', () => {
    eq(newWordsForStation(WORDS, 7), []);
    eq(newWordsForStation(WORDS, 8), []);
  });

  it('stations 1–6 cover all 30 words exactly once, 5 each', () => {
    const seen = [];
    for (let s = 1; s <= 6; s += 1) {
      const batch = newWordsForStation(WORDS, s);
      eq(batch.length, 5, `station ${s} size: `);
      seen.push(...ids(batch));
    }
    eq(seen.length, 30);
    eq(new Set(seen).size, 30, 'no duplicates: ');
  });

  it('introducedWords grows 5 at a time and caps at 30', () => {
    eq(introducedWords(WORDS, 1).length, 5);
    eq(introducedWords(WORDS, 3).length, 15);
    eq(introducedWords(WORDS, 6).length, 30);
    eq(introducedWords(WORDS, 8).length, 30);
  });
});

describe('path — difficult words carried forward', () => {
  it('carries at most 5, most recently missed first', () => {
    const progress = stats({
      a1_01: { difficult: true, lastWrongAt: 100, seen: 1, wrong: 1 },
      a1_02: { difficult: true, lastWrongAt: 700, seen: 1, wrong: 1 },
      a1_03: { difficult: true, lastWrongAt: 300, seen: 1, wrong: 1 },
      a1_04: { difficult: true, lastWrongAt: 900, seen: 1, wrong: 1 },
      a1_05: { difficult: true, lastWrongAt: 500, seen: 1, wrong: 1 },
      a1_06: { difficult: true, lastWrongAt: 800, seen: 1, wrong: 1 },
      a1_07: { difficult: true, lastWrongAt: 200, seen: 1, wrong: 1 },
    });
    const carried = difficultCarry(WORDS, progress);
    eq(carried.length, MAX_DIFFICULT_CARRY);
    eq(ids(carried), ['a1_04', 'a1_06', 'a1_02', 'a1_05', 'a1_03']);
  });

  it('never carries a word that is new this station', () => {
    const progress = stats({
      a1_01: { difficult: true, lastWrongAt: 100, seen: 1, wrong: 1 },
      a1_06: { difficult: true, lastWrongAt: 200, seen: 1, wrong: 1 },
    });
    const carried = difficultCarry(WORDS, progress, ['a1_06']);
    eq(ids(carried), ['a1_01']);
  });

  it('carries nothing when no word is difficult', () => {
    eq(difficultCarry(WORDS, stats({ a1_01: { seen: 3, correct: 3 } })), []);
  });

  it('station 2 gives 5 new words plus the carried difficult ones', () => {
    const progress = stats({
      a1_01: { difficult: true, lastWrongAt: 100, seen: 1, wrong: 1 },
      a1_03: { difficult: true, lastWrongAt: 200, seen: 1, wrong: 1 },
    });
    const set = stationWordSet(WORDS, 2, progress);
    eq(ids(set.new), ['a1_06', 'a1_07', 'a1_08', 'a1_09', 'a1_10']);
    eq(ids(set.carried), ['a1_03', 'a1_01']);
    eq(set.all.length, 7);
  });

  it('station 1 carries nothing, because nothing has been seen', () => {
    const set = stationWordSet(WORDS, 1, {});
    eq(ids(set.new), ['a1_01', 'a1_02', 'a1_03', 'a1_04', 'a1_05']);
    eq(set.carried, []);
    eq(set.all.length, 5);
  });

  it('a station 2 carry only draws from words introduced in station 1', () => {
    const progress = stats({
      a1_20: { difficult: true, lastWrongAt: 999, seen: 1, wrong: 1 }, // not introduced yet
      a1_02: { difficult: true, lastWrongAt: 100, seen: 1, wrong: 1 },
    });
    const set = stationWordSet(WORDS, 2, progress);
    eq(ids(set.carried), ['a1_02']);
  });
});

describe('path — weakest first (stations 7 and 8)', () => {
  it('orders by most recent mistake first', () => {
    const progress = stats({
      a1_01: { seen: 2, correct: 1, wrong: 1, lastWrongAt: 100 },
      a1_02: { seen: 2, correct: 1, wrong: 1, lastWrongAt: 300 },
      a1_03: { seen: 2, correct: 1, wrong: 1, lastWrongAt: 200 },
    });
    const picked = weakestFirst(WORDS, progress, 3, mulberry32(1));
    eq(ids(picked), ['a1_02', 'a1_03', 'a1_01']);
  });

  it('breaks ties on the same timestamp by lowest accuracy', () => {
    const progress = stats({
      a1_01: { seen: 4, correct: 3, wrong: 1, lastWrongAt: 500 }, // 0.75
      a1_02: { seen: 4, correct: 1, wrong: 3, lastWrongAt: 500 }, // 0.25
      a1_03: { seen: 4, correct: 2, wrong: 2, lastWrongAt: 500 }, // 0.50
    });
    const picked = weakestFirst(WORDS, progress, 3, mulberry32(1));
    eq(ids(picked), ['a1_02', 'a1_03', 'a1_01']);
  });

  it('takes exactly 10 and fills from the level when fewer than 10 are weak', () => {
    const progress = stats({
      a1_01: { seen: 2, correct: 1, wrong: 1, lastWrongAt: 200 },
      a1_02: { seen: 2, correct: 1, wrong: 1, lastWrongAt: 100 },
    });
    const picked = weakestFirst(WORDS, progress, REVIEW_WORD_COUNT, mulberry32(7));
    eq(picked.length, 10);
    eq(ids(picked).slice(0, 2), ['a1_01', 'a1_02'], 'weak words lead: ');
    eq(new Set(ids(picked)).size, 10, 'no duplicates: ');
  });

  it('never returns more than the pool holds', () => {
    const picked = weakestFirst(WORDS.slice(0, 4), {}, 10, mulberry32(3));
    eq(picked.length, 4);
  });

  it('station 7 returns 10 review words, not a new/carried split', () => {
    const picked = stationWordSet(WORDS, 7, {}, mulberry32(5));
    ok(Array.isArray(picked), 'should be a flat array');
    eq(picked.length, 10);
  });

  it('station 8 returns 10 review words too', () => {
    const picked = stationWordSet(WORDS, 8, {}, mulberry32(5));
    eq(picked.length, 10);
  });
});

/* ---------------- path: unlocking ---------------- */

describe('path — station unlocking', () => {
  const fresh = { completedStations: [], unlockedStation: 1, passed: false, words: {} };

  it('only station 1 is playable at the start', () => {
    eq(stationState(1, fresh), 'current');
    eq(stationState(2, fresh), 'locked');
    eq(isStationPlayable(1, fresh), true);
    eq(isStationPlayable(2, fresh), false);
  });

  it('completing a station unlocks the next and marks it completed', () => {
    const after = completeStation(fresh, 1);
    eq(after.completedStations, [1]);
    eq(after.unlockedStation, 2);
    eq(stationState(1, after), 'completed');
    eq(stationState(2, after), 'current');
    eq(stationState(3, after), 'locked');
  });

  it('a completed station stays replayable', () => {
    const after = completeStation(fresh, 1);
    eq(isStationPlayable(1, after), true);
  });

  it('replaying a completed station does not double-list or skip ahead', () => {
    let p = completeStation(fresh, 1);
    p = completeStation(p, 2);
    const again = completeStation(p, 1);
    eq(again.completedStations, [1, 2]);
    eq(again.unlockedStation, 3, 'unlock must not move backwards: ');
  });

  it('station 8 unlocks nothing beyond itself', () => {
    let p = fresh;
    for (let s = 1; s <= STATIONS; s += 1) p = completeStation(p, s);
    eq(p.unlockedStation, STATIONS);
    eq(p.completedStations, [1, 2, 3, 4, 5, 6, 7, 8]);
    eq(stationState(8, p), 'completed');
  });

  it('walking all 8 stations keeps exactly one current station at a time', () => {
    let p = fresh;
    for (let s = 1; s < STATIONS; s += 1) {
      const current = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => stationState(n, p) === 'current');
      eq(current, [s], `at station ${s}: `);
      p = completeStation(p, s);
    }
  });
});

/* ---------------- station: activities ---------------- */

describe('station — activity sequence', () => {
  it('station 1 starts with This or That and never uses Memory Match', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const picked = pickActivities(1, mulberry32(seed));
      eq(picked.length, 3, `seed ${seed} length: `);
      eq(picked[0], ACTIVITY.THIS_OR_THAT, `seed ${seed} first: `);
      ok(!picked.includes(ACTIVITY.MEMORY_MATCH), `seed ${seed}: Memory Match must not appear in station 1`);
      eq(new Set(picked).size, 3, `seed ${seed} distinct: `);
    }
  });

  it('stations 2–6 start with This or That plus 2 distinct others', () => {
    for (let station = 2; station <= 6; station += 1) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const picked = pickActivities(station, mulberry32(seed));
        eq(picked.length, 3, `station ${station} seed ${seed} length: `);
        eq(picked[0], ACTIVITY.THIS_OR_THAT, `station ${station} seed ${seed} first: `);
        eq(new Set(picked).size, 3, `station ${station} seed ${seed} distinct: `);
      }
    }
  });

  it('stations 7–8 pick 3 distinct activities from all four', () => {
    const seenFirst = new Set();
    for (let seed = 1; seed <= 60; seed += 1) {
      const picked = pickActivities(7, mulberry32(seed));
      eq(picked.length, 3, `seed ${seed} length: `);
      eq(new Set(picked).size, 3, `seed ${seed} distinct: `);
      picked.forEach((a) => ok(Object.values(ACTIVITY).includes(a), `unknown activity ${a}`));
      seenFirst.add(picked[0]);
    }
    ok(seenFirst.size > 1, 'stations 7–8 should not always open with the same activity');
  });

  it('Memory Match does become available from station 2 onwards', () => {
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed += 1) {
      if (pickActivities(2, mulberry32(seed)).includes(ACTIVITY.MEMORY_MATCH)) found = true;
    }
    ok(found, 'Memory Match never appeared in station 2 across 60 seeds');
  });
});

describe('station — missed words come back', () => {
  it('a requeued item reappears later, not immediately', () => {
    const q = createQuestionQueue(['a', 'b', 'c', 'd'], { requeueGap: 2 });
    eq(q.next(), 'a');
    q.requeue('a');
    eq(q.next(), 'b', 'the missed word must not come straight back: ');
    eq(q.next(), 'c');
    eq(q.next(), 'a', 'the missed word comes back later: ');
    eq(q.next(), 'd');
    eq(q.next(), null);
  });

  it('a requeue near the end still lands inside the same activity', () => {
    const q = createQuestionQueue(['a', 'b'], { requeueGap: 2 });
    eq(q.next(), 'a');
    eq(q.next(), 'b');
    q.requeue('b');
    eq(q.remaining, 1);
    eq(q.next(), 'b');
  });

  it('the run reports which words are still unresolved', () => {
    const run = createStationRun({ station: 3, words: WORDS.slice(0, 3), activities: [ACTIVITY.THIS_OR_THAT] });
    run.record('a1_01', false);
    run.record('a1_02', true);
    eq(run.missedWords, ['a1_01']);
    run.record('a1_01', true);
    eq(run.missedWords, [], 'answering it right clears it: ');
  });
});

describe('station — level check scoring', () => {
  function runWith(station, answers) {
    const run = createStationRun({ station, words: WORDS.slice(0, 10), activities: [ACTIVITY.THIS_OR_THAT] });
    answers.forEach(([id, correct]) => run.record(id, correct));
    return run;
  }

  it('only the FIRST answer for a word counts towards the level check', () => {
    const run = runWith(8, [['a1_01', false], ['a1_01', true], ['a1_01', true]]);
    eq(run.firstTryCount, { right: 0, total: 1 });
    eq(run.firstTryRatio, 0);
  });

  it('exactly 80% first-try passes', () => {
    const answers = WORDS.slice(0, 10).map((w, i) => [w.id, i < 8]);
    const run = runWith(8, answers);
    eq(run.firstTryCount, { right: 8, total: 10 });
    eq(run.firstTryRatio, PASS_RATIO);
    eq(run.passed, true);
  });

  it('79% does not pass', () => {
    const answers = WORDS.slice(0, 10).map((w, i) => [w.id, i < 7]);
    const run = runWith(8, answers);
    eq(run.firstTryRatio, 0.7);
    eq(run.passed, false);
  });

  it('a perfect run passes', () => {
    const run = runWith(8, WORDS.slice(0, 10).map((w) => [w.id, true]));
    eq(run.firstTryRatio, 1);
    eq(run.passed, true);
  });

  it('stations 1–7 never report a pass, however well they go', () => {
    for (const station of [1, 2, 3, 4, 5, 6, 7]) {
      const run = runWith(station, WORDS.slice(0, 10).map((w) => [w.id, true]));
      eq(run.levelCheck, false, `station ${station} levelCheck: `);
      eq(run.passed, false, `station ${station} passed: `);
    }
  });

  it('retries inside station 8 cannot rescue a failed first try', () => {
    const answers = [];
    WORDS.slice(0, 10).forEach((w, i) => {
      answers.push([w.id, i < 5]);
      if (i >= 5) answers.push([w.id, true]);  // got it on the retry
    });
    const run = runWith(8, answers);
    eq(run.firstTryCount, { right: 5, total: 10 });
    eq(run.passed, false);
  });
});

describe('station — progress and activity flow', () => {
  it('progress runs 0 → 100 across the activities', () => {
    const run = createStationRun({ station: 2, words: WORDS.slice(0, 5), activities: ['a', 'b', 'c'] });
    eq(run.progress, 0);
    run.setActivityProgress(1);
    eq(run.progress, 33);
    run.nextActivity();
    eq(run.progress, 33);
    run.nextActivity();
    run.setActivityProgress(1);
    eq(run.progress, 100);
  });

  it('the run finishes after its last activity', () => {
    const run = createStationRun({ station: 2, words: WORDS.slice(0, 5), activities: ['a', 'b'] });
    eq(run.isFinished, false);
    eq(run.activity, 'a');
    run.nextActivity();
    eq(run.isLastActivity, true);
    run.nextActivity();
    eq(run.isFinished, true);
    eq(run.activity, null);
  });
});

describe('station — filling short word sets', () => {
  it('pads Pinyin Match to 5 from already-introduced words', () => {
    const selected = WORDS.slice(0, 3);
    const filled = fillTo(selected, WORDS.slice(0, 10), 5, mulberry32(2));
    eq(filled.length, 5);
    eq(ids(filled).slice(0, 3), ids(selected), 'keeps the station words first: ');
    eq(new Set(ids(filled)).size, 5, 'no duplicates: ');
  });

  it('pads Memory Match to 6 pairs', () => {
    const filled = fillTo(WORDS.slice(0, 4), WORDS.slice(0, 20), 6, mulberry32(4));
    eq(filled.length, 6);
    eq(new Set(ids(filled)).size, 6);
  });

  it('trims when the station has more words than the activity needs', () => {
    const filled = fillTo(WORDS.slice(0, 9), WORDS, 5, mulberry32(4));
    eq(filled.length, 5);
    eq(ids(filled), ids(WORDS.slice(0, 5)));
  });

  it('cannot pad beyond the pool', () => {
    const filled = fillTo(WORDS.slice(0, 2), WORDS.slice(0, 3), 6, mulberry32(4));
    eq(filled.length, 3);
  });
});

describe('path — shuffle', () => {
  it('keeps every element exactly once', () => {
    const out = shuffle(WORDS, mulberry32(11));
    eq(out.length, WORDS.length);
    eq(new Set(ids(out)).size, WORDS.length);
  });

  it('does not mutate its input', () => {
    const before = ids(WORDS).join(',');
    shuffle(WORDS, mulberry32(12));
    eq(ids(WORDS).join(','), before);
  });
});

/* ---------------- end-to-end walk ---------------- */

describe('integration — a full level walk', () => {
  it('a child who answers everything right walks 1 → 8 and passes', () => {
    const rng = mulberry32(99);
    let progress = { completedStations: [], unlockedStation: 1, passed: false, words: {} };

    for (let station = 1; station <= 8; station += 1) {
      ok(isStationPlayable(station, progress), `station ${station} should be playable`);
      const set = stationWordSet(WORDS, station, progress.words, rng);
      const list = Array.isArray(set) ? set : set.all;
      ok(list.length > 0, `station ${station} has words`);

      const run = createStationRun({ station, words: list, activities: pickActivities(station, rng) });
      for (const w of list) {
        run.record(w.id, true);
        progress.words[w.id] = recordAnswer(progress.words[w.id] || emptyStat(), true, station * 100);
      }
      if (station === 8) eq(run.passed, true, 'station 8 should pass: ');
      progress = completeStation(progress, station);
    }

    eq(progress.completedStations.length, 8);
    eq(Object.keys(progress.words).length, 30, 'all 30 words have stats: ');
    const anyDifficult = Object.values(progress.words).some((s) => s.difficult);
    eq(anyDifficult, false, 'nothing should be difficult: ');
  });

  it('a child who misses words carries them forward, then clears them', () => {
    const rng = mulberry32(42);
    let progress = { completedStations: [], unlockedStation: 1, passed: false, words: {} };

    // Station 1: miss the first two words.
    const s1 = stationWordSet(WORDS, 1, progress.words, rng);
    s1.all.forEach((w, i) => {
      const correct = i >= 2;
      progress.words[w.id] = recordAnswer(progress.words[w.id] || emptyStat(), correct, 100 + i);
    });
    eq(progress.words.a1_01.difficult, true);
    eq(progress.words.a1_02.difficult, true);
    progress = completeStation(progress, 1);

    // Station 2 must carry both, most recent first.
    const s2 = stationWordSet(WORDS, 2, progress.words, rng);
    eq(ids(s2.carried), ['a1_02', 'a1_01']);
    eq(s2.all.length, 7);

    // Answer both right twice -> no longer difficult.
    ['a1_02', 'a1_01'].forEach((id) => {
      progress.words[id] = recordAnswer(progress.words[id], true, 200);
      progress.words[id] = recordAnswer(progress.words[id], true, 201);
    });
    progress = completeStation(progress, 2);

    const s3 = stationWordSet(WORDS, 3, progress.words, rng);
    eq(s3.carried, [], 'cleared words are not carried: ');
    eq(s3.all.length, 5);
  });

  it('station 7 puts the most recently missed word first', () => {
    const rng = mulberry32(8);
    const progress = { completedStations: [1, 2, 3, 4, 5, 6], unlockedStation: 7, passed: false, words: {} };
    WORDS.forEach((w, i) => {
      progress.words[w.id] = { ...emptyStat(), seen: 2, correct: 2, streak: 2 };
      if (i === 17) progress.words[w.id] = { ...emptyStat(), seen: 2, correct: 1, wrong: 1, lastWrongAt: 9999 };
      if (i === 3)  progress.words[w.id] = { ...emptyStat(), seen: 2, correct: 1, wrong: 1, lastWrongAt: 5000 };
    });
    const picked = stationWordSet(WORDS, 7, progress.words, rng);
    eq(ids(picked).slice(0, 2), ['a1_18', 'a1_04']);
    eq(picked.length, 10);
  });
});

/* ---------------- runner ---------------- */

/* The describe() blocks above run at import time, so results are ready
   as soon as this module is loaded. */
export function getResults() {
  return results.slice();
}

export function summary() {
  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, total: results.length };
}
