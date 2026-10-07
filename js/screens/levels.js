/* 04 Pick a level — A1 open, A2–A9 locked until their data exists. */

import { el, iconEl, Button, RoundButton } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { getLevels, getWords } from '../data.js';
import { getDraftProfile, clearDraftProfile } from '../session.js';
import { go } from '../app.js';

const TITLE = 'Pick a level';

export async function render(mount) {
  const levels = await getLevels();
  const draft = getDraftProfile();
  const activeId = await storage.getActiveProfileId();
  const active = activeId ? await storage.getProfile(activeId) : null;

  // No draft and no active profile means the page was opened cold — go home.
  if (!draft && !active) { go('profiles'); return; }

  let selected = (draft ? 'A1' : active.levelId) || 'A1';

  // Word counts come from the data files, so a new level needs no code change.
  const counts = new Map();
  await Promise.all(levels.filter((l) => l.available).map(async (l) => {
    try { counts.set(l.id, (await getWords(l.id)).length); } catch (_) { /* leave blank */ }
  }));

  const cards = levels.map((level) => {
    const available = Boolean(level.available) && counts.has(level.id);
    const card = el('button', {
      class: `level-card edge${available ? ' is-available' : ''}${available && level.id === selected ? ' is-selected' : ''}`,
      type: 'button',
      disabled: !available || null,
      'aria-label': available ? `${level.id}, ${counts.get(level.id)} words` : `${level.id}, locked`,
      'aria-pressed': String(available && level.id === selected),
      onClick: available ? () => {
        selected = level.id;
        cards.forEach((c) => {
          const on = c.dataset.level === selected;
          c.classList.toggle('is-selected', on);
          c.setAttribute('aria-pressed', String(on));
        });
        audio.playTap();
      } : null,
    }, available ? [
      el('span', { class: 'level-card__id', text: level.id }),
      el('span', { class: 'level-card__count' }, [
        el('span', { class: 'level-card__count-n', text: String(counts.get(level.id)) }),
        el('span', { class: 'level-card__count-zi', text: '字' }),
      ]),
    ] : [
      iconEl('lock', 32),
      el('span', { text: level.id }),
    ]);
    card.dataset.level = level.id;
    return card;
  });

  const start = Button({
    label: 'Start',
    iconName: 'play',
    style: 'primary',
    onClick: async () => {
      audio.unlock();                       // deliberately not awaited
      if (draft) {
        const profile = await storage.createProfile({ ...draft, levelId: selected });
        clearDraftProfile();
        await storage.setActiveProfileId(profile.id);
      } else if (active.levelId !== selected) {
        await storage.updateProfile(active.id, { levelId: selected });
      }
      go('path', { level: selected });
    },
  });
  start.style.width = '320px';
  start.style.maxWidth = '100%';

  mount.append(el('div', { class: 'screen screen--scroll' }, [
    el('div', { class: 'screen__header' }, [
      el('div', { class: 'screen__header-side' }, [
        RoundButton({
          iconName: 'back', size: 'm', style: 'secondary',
          ariaLabel: 'Back', onClick: () => history.back(),
        }),
      ]),
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
      el('div', { class: 'levels-grid' }, cards),
      start,
    ]),
  ]));
}
