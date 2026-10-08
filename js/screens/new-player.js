/* 03 New player — name, age and avatar, with a live preview.
   The wireframe (8:194) is authoritative here: the flow board omits age.
   With ?edit=<id> (from the Grown-ups page) the same form edits a player. */

import {
  el, clear, Avatar, AgeChip, Button, RoundButton,
  AVATAR_ART, AVATAR_COLORS,
} from '../ui.js';
import * as audio from '../audio.js';
import * as storage from '../storage.js';
import { setDraftProfile, isParentUnlocked } from '../session.js';
import { go } from '../app.js';

const AGES = [3, 4, 5, 6, 7, 8, 9];

export async function render(mount, params = {}) {
  const editing = params.edit ? await storage.getProfile(params.edit) : null;
  if (params.edit && (!editing || !isParentUnlocked())) { go('profiles'); return; }

  const draft = editing
    ? {
      name: editing.name || '',
      age: AGES.includes(editing.age) ? editing.age : 6,
      avatar: { art: editing.avatar?.art || 'panda', color: editing.avatar?.color || 'persimmon' },
    }
    : { name: '', age: 6, avatar: { art: 'panda', color: 'persimmon' } };

  /* ---- preview ---- */
  const previewAvatar = el('div');
  const previewName = el('div', { class: 'preview__name', text: '' });
  const previewAge = el('div');

  function paintPreview() {
    clear(previewAvatar).append(Avatar({ ...draft.avatar, size: 'xl' }));
    previewName.textContent = draft.name || '…';
    clear(previewAge).append(AgeChip(draft.age));
  }

  /* ---- name ---- */
  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    maxlength: '16',
    placeholder: 'Name',
    autocomplete: 'off',
    autocapitalize: 'words',
    'aria-label': 'Name',
    onInput: (e) => { draft.name = e.target.value; paintPreview(); refreshNext(); },
  });

  /* ---- age ---- */
  const ageButtons = AGES.map((age) => el('button', {
    class: `age-btn edge${age === draft.age ? ' is-selected' : ''}`,
    type: 'button',
    'aria-label': `Age ${age}`,
    'aria-pressed': String(age === draft.age),
    onClick: () => {
      draft.age = age;
      ageButtons.forEach((b, i) => {
        const on = AGES[i] === age;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-pressed', String(on));
      });
      paintPreview();
      audio.playTap();
    },
  }, [String(age)]));

  /* ---- avatar art + colour ---- */
  const artButtons = AVATAR_ART.map((art) => el('button', {
    class: `avatar-pick${art === draft.avatar.art ? ' is-selected' : ''}`,
    type: 'button',
    'aria-label': art,
    'aria-pressed': String(art === draft.avatar.art),
    onClick: () => {
      draft.avatar.art = art;
      repaintPickers();
      paintPreview();
      audio.playTap();
    },
  }, [Avatar({ art, color: draft.avatar.color, size: 'm' })]));

  const colorButtons = AVATAR_COLORS.map((color) => el('button', {
    class: `swatch${color === draft.avatar.color ? ' is-selected' : ''}`,
    type: 'button',
    dataset: { color },
    'aria-label': color,
    'aria-pressed': String(color === draft.avatar.color),
    onClick: () => {
      draft.avatar.color = color;
      repaintPickers();
      paintPreview();
      audio.playTap();
    },
  }));

  function repaintPickers() {
    artButtons.forEach((b, i) => {
      const on = AVATAR_ART[i] === draft.avatar.art;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
      clear(b).append(Avatar({ art: AVATAR_ART[i], color: draft.avatar.color, size: 'm' }));
    });
    colorButtons.forEach((b, i) => {
      const on = AVATAR_COLORS[i] === draft.avatar.color;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  /* ---- next ---- */
  const next = Button({
    label: editing ? 'Save' : 'Next',
    iconName: editing ? 'check' : 'play',
    style: 'primary',
    disabled: true,
    onClick: async () => {
      if (!draft.name.trim()) return;
      if (editing) {
        await storage.updateProfile(editing.id, {
          name: draft.name.trim(),
          age: draft.age,
          avatar: { ...draft.avatar },
        });
        go('parents');
        return;
      }
      setDraftProfile({ ...draft, name: draft.name.trim() });
      go('levels');
    },
  });

  function refreshNext() {
    const ok = draft.name.trim().length > 0;
    next.disabled = !ok;
  }

  paintPreview();
  refreshNext();

  mount.append(el('div', { class: 'screen screen--scroll' }, [
    el('div', { class: 'screen__header' }, [
      el('div', { class: 'screen__header-side' }, [
        RoundButton({
          iconName: 'back', size: 'm', style: 'secondary',
          ariaLabel: 'Back', onClick: () => history.back(),
        }),
      ]),
      el('h1', { class: 't-title', text: editing ? 'Edit player' : 'New player' }),
      el('div', { class: 'screen__header-side screen__header-side--end' }),
    ]),
    el('div', { class: 'screen__body' }, [
      el('div', { class: 'new-player-body' }, [
        el('div', { class: 'preview' }, [previewAvatar, previewName, previewAge]),
        el('div', { class: 'form' }, [
          el('label', { class: 'field-label', text: 'Name', for: 'np-name' }),
          nameInput,
          el('span', { class: 'field-label', text: 'Age' }),
          el('div', { class: 'picker-row' }, ageButtons),
          el('span', { class: 'field-label', text: 'Friend' }),
          el('div', { class: 'picker-row picker-row--friends' }, [
            el('div', { class: 'picker-group' }, artButtons),
            el('span', { class: 'picker-divider' }),
            el('div', { class: 'picker-group' }, colorButtons),
          ]),
          next,
        ]),
      ]),
    ]),
  ]));

  nameInput.id = 'np-name';
  nameInput.value = draft.name;
}
