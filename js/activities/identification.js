/* Identification (speaking, with a grown-up).
   A big character is shown; the child says it out loud. Tapping the card
   flips it to pinyin and plays the word. A grown-up then taps Got it or
   Try again, and that answer is recorded like any other. */

import { el, clear, iconEl, Button, GrownUpNote } from '../ui.js';
import * as audio from '../audio.js';
import { shuffle } from '../engine/path.js';
import { createQuestionQueue } from '../engine/station.js';

const PAUSE_AFTER_ANSWER = 1200;
export const FIRST_USE_FLAG = 'identification-note';

export async function start({ mount, words, recordAnswer, showFeedback, clearFeedback, setProgress, onFinish, showNote }) {
  const queue = createQuestionQueue(shuffle(words), { requeueGap: 2 });
  const total = words.length;
  let done = 0;
  let current = null;
  let flipped = false;
  let locked = false;
  let disposed = false;

  const timers = new Set();
  const after = (ms, fn) => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  const card = el('button', {
    class: 'ident-card edge',
    type: 'button',
    'aria-label': 'Tap to show the pinyin and hear the word',
    onClick: () => flip(),
  });

  const answerRow = el('div', { class: 'ident-answer' });
  const hint = el('span', { class: 'ident-hint' }, [iconEl('speaker', 24), el('span', { text: 'Tap the card' })]);

  if (showNote) mount.append(GrownUpNote());
  mount.append(card, hint, answerRow);

  function paintCard() {
    clear(card);
    card.classList.toggle('is-flipped', flipped);
    card.append(el('span', { class: 'ident-card__hanzi hanzi', text: current.word }));
    if (flipped) {
      card.append(
        el('span', { class: 'ident-card__pinyin', text: current.pinyin }),
        el('span', { class: 'ident-card__speaker' }, [iconEl('speaker', 44)]),
      );
    }
  }

  function paintAnswers() {
    clear(answerRow);
    hint.style.display = flipped ? 'none' : '';
    if (!flipped) return;
    answerRow.append(
      Button({
        label: 'Try again', iconName: 'retry', style: 'try-again',
        onClick: () => answer(false),
      }),
      Button({
        label: 'Got it', iconName: 'check', style: 'correct',
        onClick: () => answer(true),
      }),
    );
  }

  function flip() {
    if (disposed || locked) return;
    if (!flipped) {
      flipped = true;
      paintCard();
      paintAnswers();
    }
    audio.play(current.audio);   // tapping again replays the word
  }

  async function answer(correct) {
    if (disposed || locked || !flipped) return;
    locked = true;

    const answered = current;
    await recordAnswer(answered.id, correct);

    if (correct) {
      done += 1;
      setProgress(Math.min(1, done / total));
      showFeedback('correct', 'Great job!');
    } else {
      showFeedback('try-again', 'Try again');
      queue.requeue(answered);
    }
    after(PAUSE_AFTER_ANSWER, nextQuestion);
  }

  function nextQuestion() {
    if (disposed) return;
    clearTimers();
    clearFeedback();
    locked = false;
    flipped = false;
    current = queue.next();
    if (!current) { onFinish(); return; }
    paintCard();
    paintAnswers();
  }

  nextQuestion();

  return () => {
    disposed = true;
    clearTimers();
    audio.stop();
  };
}
