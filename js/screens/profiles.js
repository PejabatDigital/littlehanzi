/* 02 Who's playing — the app's home. Tapping a profile also unlocks audio.
   The grown-up button (top right) opens a maths gate, then the Grown-ups page. */

import { el, ProfileCard, AddProfileCard, RoundButton, Button, openDialog } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { setParentUnlocked } from '../session.js';
import { go } from '../app.js';

const TITLE = "Who's playing?";

/* Two-digit addition: quick for a grown-up, out of reach for most 5–8s. */
function newSum() {
  const a = 12 + Math.floor(Math.random() * 18);   // 12–29
  const b = 11 + Math.floor(Math.random() * 9);    // 11–19
  return { a, b, answer: a + b };
}

function openParentGate() {
  let sum = newSum();

  const question = el('p', { class: 'gate__sum', 'aria-live': 'polite' });
  const paint = () => { question.textContent = `${sum.a} + ${sum.b} = ?`; };
  paint();

  const input = el('input', {
    class: 'input gate__input',
    type: 'text',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    maxlength: '3',
    autocomplete: 'off',
    'aria-label': 'Answer',
    onKeydown: (e) => { if (e.key === 'Enter') check(); },
  });

  function check() {
    const value = Number(String(input.value).trim());
    if (input.value.trim() !== '' && value === sum.answer) {
      setParentUnlocked(true);
      dlg.close();
      go('parents');
      return;
    }
    // Wrong: a fresh sum, so guessing the same number twice gets nowhere.
    sum = newSum();
    paint();
    input.value = '';
    input.classList.remove('is-shaking');
    void input.offsetWidth;            // restart the shake animation
    input.classList.add('is-shaking');
    input.focus();
  }

  const dlg = openDialog({
    title: 'Grown-ups only',
    message: 'Solve this to continue.',
    content: el('div', { class: 'gate' }, [question, input]),
    actions: [
      Button({ label: 'Cancel', style: 'secondary', onClick: () => dlg.close() }),
      Button({ label: 'Go', iconName: 'play', style: 'primary', onClick: check }),
    ],
  });
}

export async function render(mount) {
  // Leaving the grown-up area always locks it again.
  setParentUnlocked(false);

  const profiles = await storage.getProfiles();

  const cards = profiles.map((profile) => ProfileCard({
    profile,
    onClick: async () => {
      audio.unlock();                       // deliberately not awaited
      await storage.setActiveProfileId(profile.id);
      go('path', { level: profile.levelId || 'A1' });
    },
  }));

  cards.push(AddProfileCard({
    onClick: () => { audio.unlock(); go('new-player'); },
  }));

  mount.append(el('div', { class: 'screen screen--scroll' }, [
    el('div', { class: 'screen__header' }, [
      // Spacer the width of the grown-up button keeps the title centred on phones.
      el('div', { class: 'screen__header-side' }, [el('span', { class: 'header-spacer', 'aria-hidden': 'true' })]),
      el('h1', { class: 't-title', text: TITLE }),
      el('div', { class: 'screen__header-side screen__header-side--end' }, [
        RoundButton({
          iconName: 'grown-up', size: 'm', style: 'secondary',
          ariaLabel: 'Grown-ups',
          onClick: openParentGate,
        }),
      ]),
    ]),
    el('div', { class: 'screen__body' }, [
      el('div', { class: 'row row--wrap', style: 'gap: var(--spacing-xl)' }, cards),
    ]),
  ]));
}
