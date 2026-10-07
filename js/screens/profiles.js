/* 02 Who's playing — the app's home. Tapping a profile also unlocks audio. */

import { el, ProfileCard, AddProfileCard, RoundButton } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { go } from '../app.js';

const TITLE = "Who's playing?";

export async function render(mount) {
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
      el('div', { class: 'screen__header-side' }),
      el('div', { class: 'row' }, [
        el('h1', { class: 't-title', text: TITLE }),
        audio.canSpeak() ? RoundButton({
          iconName: 'speaker', size: 'm', style: 'audio',
          ariaLabel: `Read "${TITLE}" aloud`,
          onClick: () => audio.speak(TITLE),
        }) : null,
      ]),
      el('div', { class: 'screen__header-side screen__header-side--end' }),
    ]),
    el('div', { class: 'screen__body' }, [
      el('div', { class: 'row row--wrap', style: 'gap: var(--spacing-xl)' }, cards),
    ]),
  ]));
}
