/* ui.js — DOM builders for the Figma components.
   Screens compose these; they never hand-roll component markup. */

import { icon } from './icons.js';

/* ---------------- element helper ---------------- */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* Wrap a handler so it never fires on a control that is disabled right now.
   Native <button disabled> already blocks clicks; this also covers
   aria-disabled and keeps the listener attached when the state changes. */
function guard(handler) {
  if (typeof handler !== 'function') return null;
  return (event) => {
    const t = event.currentTarget;
    if (t && (t.disabled || t.getAttribute('aria-disabled') === 'true')) return;
    return handler(event);
  };
}

export function iconEl(name, size = 32) {
  return el('span', { class: 'icon', html: icon(name, size) });
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ---------------- Button ---------------- */

export function Button({ label, iconName, style = 'primary', disabled = false, onClick, ariaLabel, type = 'button' } = {}) {
  const btn = el('button', {
    class: `btn edge btn--${style}`,
    type,
    disabled: disabled || null,
    'aria-label': ariaLabel || (label ? null : iconName),
    onClick: guard(onClick),
  }, [
    iconName ? iconEl(iconName, 32) : null,
    label ? el('span', { text: label }) : null,
  ]);
  return btn;
}

/* ---------------- Round Button ---------------- */

export function RoundButton({ iconName, size = 'm', style = 'audio', onClick, ariaLabel, disabled = false } = {}) {
  return el('button', {
    class: `round-btn edge round-btn--${size} round-btn--${style}`,
    type: 'button',
    disabled: disabled || null,
    'aria-label': ariaLabel || iconName,
    onClick: guard(onClick),
  }, [iconEl(iconName, size === 'l' ? 56 : 32)]);
}

/* ---------------- Character Card ---------------- */

export function CharacterCard({ word, size = 'l', state = 'default', onClick, ariaLabel } = {}) {
  const classes = ['char-card', 'edge'];
  if (size !== 'l') classes.push(`char-card--${size}`);
  if (state !== 'default') classes.push(`is-${state}`);
  const interactive = typeof onClick === 'function';
  return el(interactive ? 'button' : 'div', {
    class: classes.join(' '),
    type: interactive ? 'button' : null,
    'aria-label': ariaLabel || (word ? `${word}` : null),
    onClick: onClick || null,
  }, [state === 'face-down' ? '?' : (word || '')]);
}

/* ---------------- Pinyin Chip ---------------- */

export function PinyinChip({ pinyin, state = 'default', onClick } = {}) {
  const classes = ['pinyin-chip', 'edge'];
  if (state !== 'default') classes.push(`is-${state}`);
  return el('button', {
    class: classes.join(' '),
    type: 'button',
    onClick: onClick || null,
  }, [pinyin]);
}

/* ---------------- Speaker Card ---------------- */

export function SpeakerCard({ state = 'face-down', onClick, ariaLabel = 'Play word' } = {}) {
  const classes = ['speaker-card', 'edge'];
  if (state !== 'face-down') classes.push(`is-${state}`);
  return el('button', {
    class: classes.join(' '),
    type: 'button',
    'aria-label': ariaLabel,
    onClick: onClick || null,
  }, [
    state === 'face-down' ? el('span', { text: '?' }) : null,
    iconEl('speaker', 64),
  ]);
}

/* ---------------- Avatar ---------------- */

export const AVATAR_ART = ['panda', 'bunny', 'cat'];
export const AVATAR_COLORS = ['persimmon', 'jade', 'sky', 'sunshine', 'plum'];

export function Avatar({ art = 'panda', color = 'persimmon', size = 'l' } = {}) {
  return el('span', {
    class: `avatar avatar--${size}`,
    dataset: { color, art },
  }, [
    el('img', { src: `assets/avatars/${art}.svg`, alt: '', width: 64, height: 64 }),
  ]);
}

/* ---------------- Age chip ---------------- */

export function AgeChip(age) {
  return el('span', { class: 'age-chip' }, [
    el('span', { class: 'age-chip__n', text: String(age) }),
    el('span', { class: 'age-chip__sui', text: '岁' }),
  ]);
}

/* ---------------- Profile Card ---------------- */

export function ProfileCard({ profile, onClick } = {}) {
  return el('button', {
    class: 'profile-card edge',
    type: 'button',
    'aria-label': `${profile.name}, ${profile.age}`,
    onClick: onClick || null,
  }, [
    Avatar({ ...profile.avatar, size: 'l' }),
    el('span', { class: 'profile-card__name', text: profile.name }),
    profile.age ? AgeChip(profile.age) : null,
  ]);
}

export function AddProfileCard({ onClick, label = 'Add' } = {}) {
  return el('button', {
    class: 'profile-card profile-card--add',
    type: 'button',
    'aria-label': 'Add a child',
    onClick: onClick || null,
  }, [
    el('span', { class: 'plus-ring' }, [iconEl('plus', 48)]),
    el('span', { class: 'profile-card__name', text: label }),
  ]);
}

/* ---------------- Station Node ---------------- */

export function StationNode({ number, state = 'locked', kind = 'station', onClick } = {}) {
  const classes = ['station', 'edge', `is-${state}`];
  if (kind === 'check') classes.push('station--check');

  let inner;
  if (state === 'current') inner = kind === 'check' ? iconEl('flag', 48) : el('span', { text: String(number) });
  else if (state === 'completed') inner = iconEl('check', 48);
  else inner = iconEl(kind === 'check' ? 'flag' : 'lock', 40);

  return el('button', {
    class: classes.join(' '),
    type: 'button',
    'aria-label': kind === 'check' ? `Level check, ${state}` : `Station ${number}, ${state}`,
    disabled: state === 'locked' || null,
    onClick: guard(onClick),
  }, [inner]);
}

export function GoBubble() {
  return el('span', { class: 'go-bubble' }, [iconEl('play', 28), el('span', { text: 'Go' })]);
}

/* ---------------- Progress Bar ---------------- */

export function ProgressBar(percent = 0) {
  const fill = el('div', { class: 'progress__fill' });
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  const bar = el('div', {
    class: 'progress',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(Math.round(percent)),
  }, [fill]);
  bar.setProgress = (p) => {
    const v = Math.max(0, Math.min(100, p));
    fill.style.width = `${v}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(v)));
  };
  return bar;
}

/* ---------------- Activity Badge ---------------- */

export function ActivityBadge(activity, label) {
  return el('span', { class: 'activity-badge', dataset: { activity }, text: label });
}

/* ---------------- Feedback Banner ---------------- */

export function FeedbackBanner({ type = 'correct', message } = {}) {
  const isCorrect = type === 'correct';
  return el('div', {
    class: `banner${isCorrect ? '' : ' banner--try-again'}`,
    role: 'status',
  }, [
    el('span', { class: 'banner__icon' }, [iconEl(isCorrect ? 'check' : 'retry', 40)]),
    el('span', { class: 'banner__text', text: message || (isCorrect ? 'Great job!' : 'Try again') }),
  ]);
}

/* ---------------- Grown-up Note ---------------- */

export function GrownUpNote(message = 'Play this one with a grown-up') {
  return el('span', { class: 'grown-up-note' }, [iconEl('grown-up', 28), el('span', { text: message })]);
}

/* ---------------- Dialog ----------------
   In-app modal for grown-up confirmations and the maths gate. Never the
   browser's confirm(), which looks foreign in a kids' app and blocks the
   page. The router closes any open dialog when the screen changes. */

const openDialogs = new Set();

export function openDialog({ title, message, content = null, actions = [], onClose, labelledBy } = {}) {
  const titleId = labelledBy || `dlg-${Math.random().toString(36).slice(2, 8)}`;
  let closed = false;

  const panel = el('div', {
    class: 'dialog',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  }, [
    title ? el('h2', { class: 't-section dialog__title', id: titleId, text: title }) : null,
    message ? el('p', { class: 't-body t-muted dialog__message', text: message }) : null,
    content,
    actions.length ? el('div', { class: 'dialog__actions' }, actions) : null,
  ]);

  const backdrop = el('div', {
    class: 'dialog-backdrop',
    onClick: (e) => { if (e.target === backdrop) close(); },
  }, [panel]);

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (closed) return;
    closed = true;
    openDialogs.delete(close);
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  }

  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  openDialogs.add(close);

  // Focus the first field, else the last action (the confirming one).
  requestAnimationFrame(() => {
    const target = panel.querySelector('input') || panel.querySelector('.dialog__actions > :last-child');
    if (target) target.focus({ preventScroll: true });
  });

  return { close, panel };
}

export function closeAllDialogs() {
  for (const close of [...openDialogs]) close();
}

/* Two-button confirmation. Resolves true on confirm, false otherwise. */
export function confirmDialog({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const finish = (value) => { if (answered) return; answered = true; resolve(value); };
    const dlg = openDialog({
      title,
      message,
      onClose: () => finish(false),
      actions: [
        Button({ label: cancelLabel, style: 'secondary', onClick: () => dlg.close() }),
        Button({ label: confirmLabel, style: 'primary', onClick: () => { finish(true); dlg.close(); } }),
      ],
    });
  });
}

/* ---------------- Toggle ---------------- */

export function Toggle({ checked = false, onChange, ariaLabel } = {}) {
  const btn = el('button', {
    class: `toggle${checked ? ' is-on' : ''}`,
    type: 'button',
    role: 'switch',
    'aria-checked': String(checked),
    'aria-label': ariaLabel || null,
  }, [el('span', { class: 'toggle__knob' })]);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    btn.classList.toggle('is-on', next);
    if (typeof onChange === 'function') onChange(next);
  });
  return btn;
}
