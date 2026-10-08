/* 01 Welcome — first launch only. Its Start tap is what unlocks iOS audio. */

import { el, Avatar, Button } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { go } from '../app.js';

export async function render(mount) {
  const start = Button({
    label: 'Start',
    iconName: 'play',
    style: 'primary',
    onClick: async () => {
      audio.unlock();                       // deliberately not awaited
      const profiles = await storage.getProfiles();
      go(profiles.length ? 'profiles' : 'new-player');
    },
  });
  start.style.width = '320px';
  start.style.maxWidth = '100%';

  mount.append(el('div', { class: 'screen' }, [
    el('div', { class: 'screen__body' }, [
      el('h1', { class: 'wordmark', text: '小汉字' }),
      el('p', { class: 't-title', text: 'Little Hanzi' }),
      el('div', { class: 'row welcome-friends' }, [
        Avatar({ art: 'panda', color: 'persimmon', size: 'l' }),
        Avatar({ art: 'bunny', color: 'sky', size: 'l' }),
        Avatar({ art: 'cat', color: 'jade', size: 'l' }),
      ]),
      start,
    ]),
  ]));
}
