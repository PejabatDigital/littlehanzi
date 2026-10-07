/* app.js — boot, hash router, screen switching.
   Screens register themselves here; each exports render(mount, params). */

import * as storage from './storage.js';
import * as audio from './audio.js';
import { el, clear } from './ui.js';

import * as welcome from './screens/welcome.js';
import * as profiles from './screens/profiles.js';
import * as newPlayer from './screens/new-player.js';
import * as levels from './screens/levels.js';
import * as path from './screens/path.js';

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

  let renderer = routes.get(name);

  // An unknown or stale hash should land on the home screen AND say so in the
  // URL, so a refresh does not render something the address bar disagrees with.
  if (!renderer) {
    const fallback = await defaultRoute();
    if (name !== fallback && routes.has(fallback)) {
      window.location.replace(`#/${fallback}`);
      return;
    }
    renderer = routes.get(fallback);
  }

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

function registerScreens() {
  route('welcome', welcome.render);
  route('profiles', profiles.render);
  route('new-player', newPlayer.render);
  route('levels', levels.render);
  route('path', path.render);
}

export async function start(mountNode) {
  mount = mountNode;
  registerScreens();

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
