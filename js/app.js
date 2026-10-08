/* app.js — boot, hash router, screen switching.
   Screens register themselves here; each exports render(mount, params). */

import * as storage from './storage.js';
import * as audio from './audio.js';
import { el, clear, closeAllDialogs } from './ui.js';

import * as welcome from './screens/welcome.js';
import * as profiles from './screens/profiles.js';
import * as newPlayer from './screens/new-player.js';
import * as levels from './screens/levels.js';
import * as path from './screens/path.js';
import * as station from './screens/station.js';
import * as done from './screens/done.js';
import * as parents from './screens/parents.js';

const routes = new Map();
let mount = null;
let currentCleanup = null;
/* Screens render asynchronously (storage, data, audio preload). Two hash
   changes in quick succession must never interleave, or both append and the
   older screen stays wired to events. Renders are therefore serialised: if
   one is asked for while another is running, it is queued and runs after,
   reading the hash fresh so we always settle on the latest route. */
let rendering = false;
let renderPending = false;

export function route(name, renderer) {
  routes.set(name, renderer);
}

export function go(name, params = {}) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const next = query ? `#/${name}?${query}` : `#/${name}`;
  if (window.location.hash === next) { render(); return; }
  window.location.hash = next;
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

function runCleanup(fn) {
  if (typeof fn !== 'function') return;
  try { fn(); } catch (err) { console.warn('[router] cleanup failed', err); }
}

function errorScreen(message) {
  return el('div', { class: 'screen' }, [
    el('div', { class: 'screen__body' }, [
      el('p', { class: 't-title t-center', text: 'Something went wrong' }),
      el('p', { class: 't-body t-center t-muted', text: message }),
    ]),
  ]);
}

async function renderOnce() {
  const { name, params } = parseHash();

  runCleanup(currentCleanup);
  currentCleanup = null;
  closeAllDialogs();

  let renderer = routes.get(name);

  // An unknown or stale hash should land on the home screen AND say so in the
  // URL, so a refresh does not render something the address bar disagrees with.
  if (!renderer) {
    const fallback = await defaultRoute();
    if (name !== fallback && routes.has(fallback)) {
      window.location.replace(`#/${fallback}`);
      renderPending = true;
      return;
    }
    renderer = routes.get(fallback);
  }

  if (!renderer) {
    clear(mount);
    mount.append(el('div', { class: 'screen' }, [
      el('div', { class: 'screen__body' }, [
        el('p', { class: 't-title t-center', text: 'Nothing here yet' }),
        el('p', { class: 't-body t-center t-muted', text: name ? `No screen for "${name}".` : 'No screen registered.' }),
      ]),
    ]));
    return;
  }

  // Build off-document, then swap in, so a half-built screen is never visible.
  const host = document.createElement('div');
  let cleanup = null;
  try {
    cleanup = await renderer(host, params);
  } catch (err) {
    console.error('[router] screen failed', err);
    clear(mount);
    mount.append(errorScreen(String(err.message || err)));
    return;
  }

  // A screen that redirected (set the hash itself) renders nothing.
  if (renderPending && !host.firstChild) { runCleanup(cleanup); return; }

  clear(mount);
  while (host.firstChild) mount.append(host.firstChild);
  currentCleanup = cleanup;
}

async function render() {
  if (rendering) { renderPending = true; return; }
  rendering = true;
  try {
    do {
      renderPending = false;
      await renderOnce();
    } while (renderPending);
  } finally {
    rendering = false;
  }
}

/* First launch shows Welcome; afterwards the app opens on "Who's playing?". */
async function defaultRoute() {
  // Named 'saved' because 'profiles' is the screen module imported above.
  const saved = await storage.getProfiles();
  return saved.length === 0 ? 'welcome' : 'profiles';
}

function registerScreens() {
  route('welcome', welcome.render);
  route('profiles', profiles.render);
  route('new-player', newPlayer.render);
  route('levels', levels.render);
  route('path', path.render);
  route('station', station.render);
  route('done', done.render);
  route('parents', parents.render);
}

export async function start(mountNode) {
  mount = mountNode;
  registerScreens();

  // Device settings apply before the first sound can play.
  try { audio.setSfxEnabled((await storage.getSettings()).sfx); } catch (_) { /* keep default */ }

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
