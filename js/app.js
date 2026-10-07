/* app.js — boot, hash router, screen switching.
   Screens register themselves here; each exports render(mount, params). */

import * as storage from './storage.js';
import * as audio from './audio.js';
import { el, clear } from './ui.js';

const routes = new Map();
let mount = null;
let currentCleanup = null;

export function route(name, renderer) {
  routes.set(name, renderer);
}

export function go(name, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  window.location.hash = query ? `#/${name}?${query}` : `#/${name}`;
}

export function parseHash(hash = window.location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [name, query = ''] = raw.split('?');
  const params = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { name: name || '', params };
}

async function render() {
  const { name, params } = parseHash();

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (err) { console.warn('[router] cleanup failed', err); }
    currentCleanup = null;
  }

  const renderer = routes.get(name) || routes.get(await defaultRoute());
  clear(mount);

  if (!renderer) {
    // No screen is registered for this route yet.
    mount.append(el('div', { class: 'screen' }, [
      el('div', { class: 'screen__body' }, [
        el('p', { class: 't-title t-center', text: 'Nothing here yet' }),
        el('p', { class: 't-body t-center t-muted', text: name ? `No screen for "${name}".` : 'No screen registered.' }),
      ]),
    ]));
    return;
  }

  try {
    currentCleanup = await renderer(mount, params);
  } catch (err) {
    console.error('[router] screen failed', err);
    clear(mount);
    mount.append(el('div', { class: 'screen' }, [
      el('p', { class: 't-title t-center', text: 'Something went wrong' }),
      el('p', { class: 't-body t-center t-muted', text: String(err.message || err) }),
    ]));
  }
}

/* First launch shows Welcome; afterwards the app opens on "Who's playing?". */
async function defaultRoute() {
  const profiles = await storage.getProfiles();
  return profiles.length === 0 ? 'welcome' : 'profiles';
}

export async function start(mountNode) {
  mount = mountNode;

  window.addEventListener('hashchange', render);

  // iOS suspends the AudioContext when the tab goes to the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') audio.resumeIfNeeded();
  });

  if (!window.location.hash) {
    const name = await defaultRoute();
    window.location.replace(`#/${name}`);
  }

  await render();
}
