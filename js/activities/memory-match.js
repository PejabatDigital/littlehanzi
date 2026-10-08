/* Memory Match (memory).
   6 pairs, 12 cards face down. Each pair is a character card plus a speaker
   card. Flipping a speaker card plays the word; flipping a character card
   shows it and plays it too. A mistake is recorded only when the child pairs
   a character with a non-matching speaker AFTER both have been seen once. */

import { el, CharacterCard, SpeakerCard } from '../ui.js';
import * as audio from '../audio.js';
import { shuffle } from '../engine/path.js';
import { fillTo, ACTIVITY_SIZE, ACTIVITY } from '../engine/station.js';

const FLIP_BACK_MS = 1100;
const SIZE = ACTIVITY_SIZE[ACTIVITY.MEMORY_MATCH];

export async function start({ mount, words, allWords, recordAnswer, showFeedback, clearFeedback, setProgress, onFinish }) {
  const pairs = fillTo(words, allWords, SIZE);
  const total = pairs.length;

  let first = null;          // { word, kind, node }
  let locked = false;
  let matchedPairs = 0;
  let disposed = false;
  const seen = new Set();    // "wordId:kind" the child has already turned over

  const timers = new Set();
  const after = (ms, fn) => {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

  const grid = el('div', { class: 'mm' });
  mount.append(grid);

  /* Build 12 cards: one character and one speaker per word. */
  const deck = shuffle(pairs.flatMap((word) => [
    { word, kind: 'character' },
    { word, kind: 'speaker' },
  ]));

  const nodes = new Map();   // key -> element

  deck.forEach(({ word, kind }) => {
    const key = `${word.id}:${kind}`;
    const node = kind === 'character'
      ? CharacterCard({ word: word.word, size: 'm', state: 'face-down', ariaLabel: 'Turn over', onClick: () => flip(word, kind, node) })
      : SpeakerCard({ state: 'face-down', ariaLabel: 'Turn over', onClick: () => flip(word, kind, node) });
    node.dataset.key = key;
    nodes.set(key, node);
    grid.append(node);
  });

  function faceUp(word, kind, node) {
    if (kind === 'character') {
      node.classList.remove('is-face-down');
      node.textContent = word.word;
    } else {
      node.classList.remove('is-face-down');
      node.classList.add('is-face-up');
      const q = node.querySelector('span:not(.icon)');
      if (q) q.remove();
    }
    audio.play(word.audio);
  }

  function faceDown(word, kind, node) {
    if (kind === 'character') {
      node.classList.add('is-face-down');
      node.textContent = '?';
    } else {
      node.classList.remove('is-face-up');
      node.classList.add('is-face-down');
      if (!node.querySelector('span:not(.icon)')) {
        node.prepend(el('span', { text: '?' }));
      }
    }
  }

  function markMatched(word) {
    ['character', 'speaker'].forEach((kind) => {
      const node = nodes.get(`${word.id}:${kind}`);
      node.classList.remove('is-face-up', 'is-face-down');
      node.classList.add(kind === 'character' ? 'is-correct' : 'is-matched');
      node.disabled = true;
    });
  }

  async function flip(word, kind, node) {
    if (disposed || locked) return;
    const key = `${word.id}:${kind}`;
    if (node.disabled) return;
    if (first && first.key === key) return;        // same card twice

    const wasSeen = seen.has(key);
    faceUp(word, kind, node);

    if (!first) {
      first = { word, kind, node, key, wasSeen };
      seen.add(key);
      return;
    }

    locked = true;
    const second = { word, kind, node, key, wasSeen };

    if (first.word.id === second.word.id && first.kind !== second.kind) {
      markMatched(word);
      await recordAnswer(word.id, true);
      matchedPairs += 1;
      setProgress(matchedPairs / total);
      first = null;
      locked = false;
      seen.add(key);
      if (matchedPairs === total) {
        showFeedback('correct', 'All matched!');
        after(900, onFinish);
      }
      return;
    }

    // Only count a miss once both of these cards had been seen BEFORE this
    // turn: until then the child is discovering the board, not getting it
    // wrong. seen.add() happens after, so the flags are captured on flip.
    const bothSeenBefore = first.wasSeen && second.wasSeen;
    const mixedKinds = first.kind !== second.kind;
    if (bothSeenBefore && mixedKinds) {
      const charWord = first.kind === 'character' ? first.word : second.word;
      await recordAnswer(charWord.id, false);
    }
    seen.add(key);

    const a = first;
    after(FLIP_BACK_MS, () => {
      faceDown(a.word, a.kind, a.node);
      faceDown(second.word, second.kind, second.node);
      first = null;
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
