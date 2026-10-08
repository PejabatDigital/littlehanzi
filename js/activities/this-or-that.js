/* This or That (listening).
   The word plays, two cards are shown, the child taps one.
   Right: happy feedback and the word again. Wrong: gentle feedback, the right
   card is shown and played. A missed word comes back later in this activity. */

import { el, clear, CharacterCard, RoundButton } from '../ui.js';
import * as audio from '../audio.js';
import { shuffle } from '../engine/path.js';
import { createQuestionQueue } from '../engine/station.js';

const PAUSE_AFTER_CORRECT = 1400;
const PAUSE_AFTER_WRONG = 2400;

/* One distractor, drawn from the level but never the answer itself. */
function pickDistractor(answer, pool) {
  const others = pool.filter((w) => w.id !== answer.id && w.word !== answer.word);
  return others.length ? shuffle(others)[0] : null;
}

export async function start({ mount, words, allWords, recordAnswer, showFeedback, clearFeedback, setProgress, onFinish }) {
  const queue = createQuestionQueue(shuffle(words), { requeueGap: 2 });
  const total = words.length;
  let answeredFirstTime = 0;
  let locked = false;
  let disposed = false;

  // Several timers run per answer (replay the word, then move on), so they are
  // tracked together — one variable would leave the earlier one uncancellable.
  const timers = new Set();
  const after = (ms, fn) => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  const replay = RoundButton({
    iconName: 'speaker', size: 'l', style: 'audio',
    ariaLabel: 'Hear the word again',
    onClick: () => { if (current) audio.play(current.audio); },
  });
  const choices = el('div', { class: 'choices' });
  mount.append(replay, choices);

  let current = null;

  function nextQuestion() {
    if (disposed) return;
    clearTimers();
    clearFeedback();
    locked = false;
    current = queue.next();

    if (!current) { onFinish(); return; }

    const distractor = pickDistractor(current, allWords);
    const cards = shuffle([current, distractor].filter(Boolean));

    clear(choices);
    cards.forEach((word) => {
      const card = CharacterCard({
        word: word.word,
        size: 'l',
        ariaLabel: word.word,
        onClick: () => answer(word, card, cards),
      });
      card.dataset.wordId = word.id;
      choices.append(card);
    });

    audio.play(current.audio);
  }

  async function answer(picked, card) {
    if (locked || disposed) return;
    locked = true;

    const correct = picked.id === current.id;
    const answered = current;
    await recordAnswer(answered.id, correct);

    if (correct) {
      answeredFirstTime += 1;
      card.classList.add('is-correct');
      [...choices.children].forEach((c) => { if (c !== card) c.classList.add('is-dimmed'); });
      showFeedback('correct', 'Great job!');
      setProgress(Math.min(1, answeredFirstTime / total));
      after(450, () => audio.play(answered.audio));
      after(PAUSE_AFTER_CORRECT, nextQuestion);
    } else {
      card.classList.add('is-try-again');
      // Show the right answer and say it, so the child always hears the truth.
      const right = [...choices.children].find((c) => c.dataset.wordId === answered.id);
      if (right) {
        right.classList.add('is-correct');
        [...choices.children].forEach((c) => {
          if (c !== right && c !== card) c.classList.add('is-dimmed');
        });
      }
      showFeedback('try-again', 'Try again');
      queue.requeue(answered);
      after(700, () => audio.play(answered.audio));
      after(PAUSE_AFTER_WRONG, nextQuestion);
    }
  }

  nextQuestion();

  return () => {
    disposed = true;
    clearTimers();
    audio.stop();
  };
}
