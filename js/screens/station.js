/* The station screen — the frame the four activities run inside.
   It owns the header, the progress bar, the feedback banner and the
   sequencing; an activity only has to ask a question and report answers. */

import { el, clear, RoundButton, ProgressBar, ActivityBadge, FeedbackBanner } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { getWords } from '../data.js';
import { recordAnswer as applyAnswer } from '../engine/tracking.js';
import { stationWordSet, completeStation, isStationPlayable } from '../engine/path.js';
import { pickActivities, createStationRun, ACTIVITY, ACTIVITY_LABEL } from '../engine/station.js';
import { setStationRun, clearStationRun } from '../session.js';
import { go } from '../app.js';

import * as thisOrThat from '../activities/this-or-that.js';
import * as identification from '../activities/identification.js';
import * as pinyinMatch from '../activities/pinyin-match.js';
import * as memoryMatch from '../activities/memory-match.js';

const ACTIVITY_MODULES = {
  [ACTIVITY.THIS_OR_THAT]: thisOrThat,
  [ACTIVITY.IDENTIFICATION]: identification,
  [ACTIVITY.PINYIN_MATCH]: pinyinMatch,
  [ACTIVITY.MEMORY_MATCH]: memoryMatch,
};

export async function render(mount, params) {
  const profileId = await storage.getActiveProfileId();
  const profile = profileId ? await storage.getProfile(profileId) : null;
  if (!profile) { go('profiles'); return; }

  const levelId = params.level || profile.levelId || 'A1';
  const station = Number(params.n) || 1;

  const progress = await storage.getProgress(profile.id, levelId);
  if (!isStationPlayable(station, progress)) { go('path', { level: levelId }); return; }

  const allWords = await getWords(levelId);
  const set = stationWordSet(allWords, station, progress.words);
  const words = Array.isArray(set) ? set : set.all;

  // Only activities that exist yet. The rest arrive in the next phase.
  const planned = pickActivities(station).filter((a) => ACTIVITY_MODULES[a]);
  const activities = planned.length ? planned : [ACTIVITY.THIS_OR_THAT];

  const run = createStationRun({ station, words, activities });
  setStationRun(run);

  /* ---------------- shell ---------------- */

  const progressBar = ProgressBar(0);
  const badge = ActivityBadge(activities[0], ACTIVITY_LABEL[activities[0]]);
  const body = el('div', { class: 'activity' });
  const feedbackSlot = el('div', { class: 'activity__feedback' });
  body.append(feedbackSlot);

  let activityCleanup = null;
  let feedbackTimer = null;
  let finished = false;

  function showFeedback(type, message) {
    clear(feedbackSlot).append(FeedbackBanner({ type, message }));
    if (type === 'correct') audio.playCorrect(); else audio.playTryAgain();
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => clear(feedbackSlot), 2000);
  }

  function clearFeedback() {
    clearTimeout(feedbackTimer);
    clear(feedbackSlot);
  }

  /* Record one answer: in the run (for the level check) and in storage
     (for the difficult flag and weakest-first). */
  async function recordAnswer(wordId, correct) {
    run.record(wordId, correct);
    const current = await storage.getProgress(profile.id, levelId);
    current.words[wordId] = applyAnswer(current.words[wordId], correct, Date.now());
    await storage.saveProgress(profile.id, levelId, current);
  }

  function setProgress(fraction) {
    run.setActivityProgress(fraction);
    progressBar.setProgress(run.progress);
  }

  async function finishStation() {
    if (finished || disposed) return;
    finished = true;
    const latest = await storage.getProgress(profile.id, levelId);
    await storage.saveProgress(profile.id, levelId, completeStation(latest, station));
    go('done', { level: levelId, n: String(station) });
  }

  async function nextActivity() {
    if (disposed) return;
    if (typeof activityCleanup === 'function') {
      try { activityCleanup(); } catch (err) { console.warn('[station] cleanup failed', err); }
      activityCleanup = null;
    }
    clearFeedback();

    const name = run.nextActivity();
    if (!name) { await finishStation(); return; }
    await mountActivity(name);
  }

  async function mountActivity(name) {
    if (disposed) return;
    const mod = ACTIVITY_MODULES[name];
    badge.textContent = ACTIVITY_LABEL[name];
    badge.dataset.activity = name;
    setProgress(0);

    // Keep the feedback slot; replace everything else.
    [...body.children].forEach((c) => { if (c !== feedbackSlot) c.remove(); });
    const host = el('div', { class: 'activity__host' });
    body.insertBefore(host, feedbackSlot);

    let showNote = false;
    if (name === ACTIVITY.IDENTIFICATION) {
      showNote = !(await storage.hasSeen(profile.id, identification.FIRST_USE_FLAG));
      if (showNote) await storage.markSeen(profile.id, identification.FIRST_USE_FLAG);
    }

    activityCleanup = await mod.start({
      mount: host,
      words,
      allWords,
      station,
      showNote,
      recordAnswer,
      showFeedback,
      clearFeedback,
      setProgress,
      onFinish: nextActivity,
    });
  }

  mount.append(el('div', { class: 'screen' }, [
    el('div', { class: 'screen__header' }, [
      el('div', { class: 'screen__header-side' }, [
        RoundButton({
          iconName: 'home', size: 'm', style: 'secondary',
          ariaLabel: 'Back to the path',
          onClick: () => go('path', { level: levelId }),
        }),
      ]),
      progressBar,
      el('div', { class: 'screen__header-side screen__header-side--end' }, [badge]),
    ]),
    body,
  ]));

  let disposed = false;

  // The screen goes up immediately; audio loads behind a short loading state.
  // Rendering must never wait on the network or on decoding.
  const loading = el('p', { class: 't-body t-muted', text: 'Getting ready…' });
  body.insertBefore(loading, feedbackSlot);

  (async () => {
    try {
      await audio.preload(words.map((w) => w.audio));
    } catch (err) {
      console.warn('[station] preload failed', err);
    }
    if (disposed) return;
    loading.remove();
    await mountActivity(activities[0]);
  })();

  return () => {
    disposed = true;
    clearTimeout(feedbackTimer);
    audio.stop();
    if (typeof activityCleanup === 'function') activityCleanup();
    clearStationRun();
  };
}
