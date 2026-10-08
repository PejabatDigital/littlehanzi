/* Pinyin Match (reading pinyin).
   Characters in one group, their pinyin in another, both shuffled. Tap a
   character (it plays), then a pinyin. A correct pair locks in; a wrong one
   shakes and clears. Only the FIRST wrong pairing for a character counts as
   a mistake for that word. */

import { el, clear, CharacterCard, PinyinChip } from '../ui.js';
import * as audio from '../audio.js';
import { shuffle } from '../engine/path.js';
import { fillTo, ACTIVITY_SIZE, ACTIVITY } from '../engine/station.js';

const SHAKE_MS = 320;
const SIZE = ACTIVITY_SIZE[ACTIVITY.PINYIN_MATCH];

export async function start({ mount, words, allWords, recordAnswer, showFeedback, clearFeedback, setProgress, onFinish }) {
  const chosen = fillTo(words, allWords, SIZE);
  const total = chosen.length;

  let selected = null;        // the chosen character's word
  let selectedEl = null;
  let locked = false;
  let matched = 0;
  let disposed = false;
  const missedOnce = new Set();   // characters that have already cost a mistake

  const timers = new Set();
  const after = (ms, fn) => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  const charRow = el('div', { class: 'pm__chars' });
  const pinyinRow = el('div', { class: 'pm__pinyin' });
  mount.append(el('div', { class: 'pm' }, [charRow, pinyinRow]));

  const charEls = new Map();
  const chipEls = new Map();

  shuffle(chosen).forEach((word) => {
    const card = CharacterCard({
      word: word.word, size: 'm', ariaLabel: word.word,
      onClick: () => pickCharacter(word),
    });
    card.dataset.wordId = word.id;
    charEls.set(word.id, card);
    charRow.append(card);
  });

  shuffle(chosen).forEach((word) => {
    const chip = PinyinChip({ pinyin: word.pinyin, onClick: () => pickPinyin(word) });
    chip.dataset.wordId = word.id;
    chipEls.set(word.id, chip);
    pinyinRow.append(chip);
  });

  function pickCharacter(word) {
    if (disposed || locked) return;
    if (charEls.get(word.id).disabled) return;

    if (selectedEl) selectedEl.classList.remove('is-selected');
    selected = word;
    selectedEl = charEls.get(word.id);
    selectedEl.classList.add('is-selected');
    audio.play(word.audio);
  }

  async function pickPinyin(word) {
    if (disposed || locked || !selected) return;
    const chip = chipEls.get(word.id);
    if (chip.disabled) return;

    if (word.id === selected.id) {
      locked = true;
      const card = charEls.get(word.id);
      card.classList.remove('is-selected');
      card.classList.add('is-correct');
      card.disabled = true;
      chip.classList.add('is-matched');
      chip.disabled = true;
      // A word matched without a prior slip counts as a clean first try.
      await recordAnswer(word.id, true);
      matched += 1;
      setProgress(matched / total);
      selected = null;
      selectedEl = null;
      locked = false;
      if (matched === total) {
        showFeedback('correct', 'All matched!');
        after(900, onFinish);
      }
      return;
    }

    // Wrong pairing: shake both, clear, and count it once per character.
    locked = true;
    const card = charEls.get(selected.id);
    const missedId = selected.id;
    chip.classList.add('is-try-again');
    card.classList.remove('is-selected');
    card.classList.add('is-try-again');

    if (!missedOnce.has(missedId)) {
      missedOnce.add(missedId);
      await recordAnswer(missedId, false);
    }

    after(SHAKE_MS, () => {
      chip.classList.remove('is-try-again');
      card.classList.remove('is-try-again');
      selected = null;
      selectedEl = null;
      locked = false;
    });
  }

  setProgress(0);

  return () => {
    disposed = true;
    clearTimers();
    audio.stop();
  };
}
