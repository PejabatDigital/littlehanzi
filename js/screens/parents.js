/* Grown-ups — behind the maths gate on "Who's playing?".
   Players (edit, level, reset, delete), sound effects, feedback, about.
   Reached only after the gate; a cold or bookmarked visit goes home. */

import { el, Avatar, AgeChip, Button, RoundButton, Toggle, confirmDialog, iconEl } from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { isParentUnlocked } from '../session.js';
import { go } from '../app.js';

const FEEDBACK_EMAIL = 'hello@pejabatdigital.com';

function section(title, children) {
  return el('section', { class: 'gp-section' }, [
    el('h2', { class: 'gp-section__title', text: title }),
    ...children,
  ]);
}

function smallButton(label, onClick, { iconName = null, style = 'secondary' } = {}) {
  const btn = Button({ label, iconName, style, onClick });
  btn.classList.add('btn--sm');
  return btn;
}

function playerRow(profile, rerender) {
  const name = profile.name || 'this player';
  return el('div', { class: 'gp-player' }, [
    el('div', { class: 'gp-player__who' }, [
      Avatar({ ...profile.avatar, size: 's' }),
      el('div', { class: 'gp-player__meta' }, [
        el('span', { class: 'gp-player__name', text: profile.name }),
        el('div', { class: 'row gp-player__chips' }, [
          profile.age ? AgeChip(profile.age) : null,
          el('span', { class: 'level-chip level-chip--sm', text: profile.levelId || 'A1' }),
        ]),
      ]),
    ]),
    el('div', { class: 'gp-player__actions' }, [
      smallButton('Edit', () => go('new-player', { edit: profile.id })),
      smallButton('Level', () => go('levels', { for: profile.id })),
      smallButton('Reset', async () => {
        const ok = await confirmDialog({
          title: `Reset ${name}'s progress?`,
          message: 'Every station and word score goes back to the start, on all levels. Their name, friend and level stay.',
          confirmLabel: 'Reset',
        });
        if (!ok) return;
        await storage.resetProgress(profile.id);
        rerender();
      }, { iconName: 'retry' }),
      smallButton('Delete', async () => {
        const ok = await confirmDialog({
          title: `Delete ${name}?`,
          message: 'This removes the player and all their progress from this device. It cannot be undone.',
          confirmLabel: 'Delete',
        });
        if (!ok) return;
        await storage.deleteProfile(profile.id);
        rerender();
      }),
    ]),
  ]);
}

export async function render(mount) {
  if (!isParentUnlocked()) { go('profiles'); return; }

  const profiles = await storage.getProfiles();
  const settings = await storage.getSettings();
  const rerender = () => go('parents');

  const players = profiles.length
    ? el('div', { class: 'gp-players' }, profiles.map((p) => playerRow(p, rerender)))
    : el('p', { class: 't-body t-muted', text: 'No players yet. Add one from the home screen.' });

  const sound = el('div', { class: 'gp-row' }, [
    el('div', { class: 'gp-row__text' }, [
      el('span', { class: 'gp-row__label', text: 'Sound effects' }),
      el('span', { class: 't-small t-muted', text: 'Chimes and taps. Word audio always plays.' }),
    ]),
    Toggle({
      checked: settings.sfx,
      ariaLabel: 'Sound effects',
      onChange: async (on) => {
        audio.setSfxEnabled(on);
        await storage.saveSettings({ sfx: on });
        if (on) audio.playTap();
      },
    }),
  ]);

  const subject = encodeURIComponent('Little Hanzi feedback');
  const feedback = el('div', { class: 'gp-stack' }, [
    el('p', { class: 't-body t-muted', text: 'Found a bug, or have an idea for the kids? We would love to hear it.' }),
    el('a', {
      class: 'btn edge btn--secondary btn--sm gp-mail',
      href: `mailto:${FEEDBACK_EMAIL}?subject=${subject}`,
    }, [el('span', { text: 'Email us' })]),
    el('span', { class: 't-small t-muted', text: FEEDBACK_EMAIL }),
  ]);

  const about = el('div', { class: 'gp-stack' }, [
    el('p', { class: 't-body' }, [
      el('span', { class: 'hanzi', text: '小汉字 ' }),
      'Little Hanzi',
    ]),
    el('p', { class: 't-small t-muted', text: 'Progress is saved in this browser on this device only. Clearing browser data will remove it.' }),
    el('p', { class: 't-small t-muted', text: 'Made by Kasah Kod.' }),
  ]);

  mount.append(el('div', { class: 'screen screen--scroll' }, [
    el('div', { class: 'screen__header' }, [
      el('div', { class: 'screen__header-side' }, [
        RoundButton({
          iconName: 'back', size: 'm', style: 'secondary',
          ariaLabel: 'Back to players',
          onClick: () => go('profiles'),
        }),
      ]),
      el('h1', { class: 't-title gp-title' }, [iconEl('grown-up', 36), el('span', { text: 'Grown-ups' })]),
      el('div', { class: 'screen__header-side screen__header-side--end' }, [el('span', { class: 'header-spacer', 'aria-hidden': 'true' })]),
    ]),
    el('div', { class: 'gp' }, [
      section('Players', [players]),
      section('Sound', [sound]),
      section('Feedback', [feedback]),
      section('About', [about]),
    ]),
  ]));
}
