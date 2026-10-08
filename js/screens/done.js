/* 12 Well done — end of a station. */

import { el, iconEl, Avatar, Button, RoundButton } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { go } from '../app.js';

const TITLE = 'Well done!';

/* Scattered in token colours at percentage positions, so it adapts to any
   size. The Figma confetti is pinned to 1194x834 coordinates. */
const CONFETTI = [
  [10, 14, 'bar', 'var(--persimmon-500)', -12],
  [19, 31, 'dot', 'var(--sunshine-500)', 0],
  [13, 62, 'dot', 'var(--jade-500)', 0],
  [25, 78, 'bar', 'var(--sunshine-500)', -21],
  [80, 13, 'dot', 'var(--plum-500)', 0],
  [89, 36, 'dot', 'var(--persimmon-500)', 0],
  [75, 70, 'bar', 'var(--jade-500)', -42],
  [87, 83, 'dot', 'var(--sky-500)', 0],
  [35, 11, 'dot', 'var(--sunshine-500)', 0],
  [64, 7,  'bar', 'var(--plum-500)', -63],
  [7,  46, 'dot', 'var(--jade-500)', 0],
  [92, 57, 'dot', 'var(--persimmon-500)', 0],
  [32, 84, 'bar', 'var(--sky-500)', -84],
  [69, 86, 'dot', 'var(--sunshine-500)', 0],
];

function confetti() {
  return el('div', { class: 'confetti', 'aria-hidden': 'true' },
    CONFETTI.map(([x, y, kind, color, rot]) => {
      const bit = el('span', { class: kind === 'bar' ? 'bar' : '' });
      bit.style.left = `${x}%`;
      bit.style.top = `${y}%`;
      bit.style.background = color;
      if (rot) bit.style.transform = `rotate(${rot}deg)`;
      return bit;
    }));
}

export async function render(mount, params) {
  const profileId = await storage.getActiveProfileId();
  const profile = profileId ? await storage.getProfile(profileId) : null;
  if (!profile) { go('profiles'); return; }

  const levelId = params.level || profile.levelId || 'A1';

  const toPath = Button({
    label: 'Path',
    iconName: 'home',
    style: 'primary',
    onClick: () => go('path', { level: levelId }),
  });
  toPath.style.width = '280px';
  toPath.style.maxWidth = '100%';

  // The chime belongs to the moment the screen appears.
  audio.playCorrect();

  mount.append(el('div', { class: 'screen', style: 'position: relative' }, [
    confetti(),
    el('div', { class: 'screen__body' }, [
      el('span', { class: 'hero' }, [iconEl('check', 112)]),
      el('div', { class: 'row' }, [
        el('h1', { class: 't-title', text: TITLE }),
        audio.canSpeak() ? RoundButton({
          iconName: 'speaker', size: 'm', style: 'audio',
          ariaLabel: `Read "${TITLE}" aloud`,
          onClick: () => audio.speak(TITLE),
        }) : null,
      ]),
      Avatar({ ...profile.avatar, size: 'l' }),
      toPath,
    ]),
  ]));
}
