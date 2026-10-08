/* audio.js — Web Audio playback. iOS Safari is the reason this module exists.
   Rules: one AudioContext, unlocked on a real user tap, buffers decoded up front. */

let ctx = null;
let unlocked = false;
const buffers = new Map();   // url -> AudioBuffer
const pending = new Map();   // url -> Promise<AudioBuffer>
let current = null;          // the source currently playing
let sfxEnabled = true;       // Grown-ups page toggle; word audio ignores it

const DECODE_TIMEOUT_MS = 4000;
const PRELOAD_TIMEOUT_MS = 8000;

function context() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      ctx = new Ctx();
    } catch (err) {
      console.warn('[audio] no AudioContext available', err);
      return null;
    }
  }
  return ctx;
}

export function isUnlocked() {
  return unlocked && ctx && ctx.state === 'running';
}

/* Never let a hung audio promise stall the UI. resume() can sit unresolved
   when the browser will not allow playback at all. */
function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), ms)),
  ]);
}

/* MUST be called from inside a user gesture handler (tap on Start or a profile).
   The silent buffer is started synchronously, before any await, because iOS
   only honours it while the gesture is still on the stack. Callers must not
   depend on the result to navigate. */
export async function unlock() {
  const c = context();
  if (!c) return false;

  try {
    const silent = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = silent;
    src.connect(c.destination);
    src.start(0);
  } catch (err) {
    console.warn('[audio] silent buffer failed', err);
  }

  if (c.state === 'suspended') await withTimeout(c.resume(), 1000);
  unlocked = c.state === 'running';
  return unlocked;
}

/* iOS suspends the context when the tab goes to the background. */
export async function resumeIfNeeded() {
  const c = context();
  if (!c) return false;
  if (c.state === 'suspended') await withTimeout(c.resume(), 1000);
  return c.state === 'running';
}

async function load(url) {
  if (buffers.has(url)) return buffers.get(url);
  if (pending.has(url)) return pending.get(url);

  const c = context();
  if (!c) throw new Error('No AudioContext');

  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
    const bytes = await res.arrayBuffer();
    // Safari still wants the callback form of decodeAudioData. Neither callback
    // is guaranteed to fire (a bad file, or no output device), so it is capped
    // — an un-decodable word must never hang the station.
    const buf = await new Promise((resolve, reject) => {
      const bail = setTimeout(() => reject(new Error(`decode timed out: ${url}`)), DECODE_TIMEOUT_MS);
      const ok = (b) => { clearTimeout(bail); resolve(b); };
      const fail = (e) => { clearTimeout(bail); reject(e); };
      const maybe = c.decodeAudioData(bytes, ok, fail);
      if (maybe && typeof maybe.then === 'function') maybe.then(ok, fail);
    });
    buffers.set(url, buf);
    pending.delete(url);
    return buf;
  })();

  pending.set(url, p);
  return p;
}

/* Preload a station's audio. Returns the urls that failed, so a caller can
   decide whether to carry on (we do — a missing file must not block play).
   Bounded overall as well as per file: a station must always start. */
export async function preload(urls, { timeoutMs = PRELOAD_TIMEOUT_MS } = {}) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return [];
  const failed = [];

  const all = Promise.all(unique.map((u) => load(u).catch((err) => {
    console.warn('[audio] preload failed', u, err);
    failed.push(u);
  })));

  const finished = await Promise.race([
    all.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  if (!finished) {
    console.warn('[audio] preload timed out; starting anyway');
    return unique.filter((u) => !buffers.has(u));
  }
  return failed;
}

export function stop() {
  if (current) {
    try { current.stop(0); } catch (_) { /* already stopped */ }
    current = null;
  }
}

/* Play a word's audio. Resolves when playback ends (or immediately on failure). */
export async function play(url, { interrupt = true } = {}) {
  if (!url) return false;
  const c = context();
  if (!c) return false;
  await resumeIfNeeded();
  if (interrupt) stop();

  let buf;
  try {
    buf = await load(url);
  } catch (err) {
    console.warn('[audio] could not play', url, err);
    return false;
  }

  return new Promise((resolve) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.onended = () => {
      if (current === src) current = null;
      resolve(true);
    };
    current = src;
    src.start(0);
  });
}

/* ---------------- feedback sounds (synthesised, no files) ---------------- */

export function setSfxEnabled(on) { sfxEnabled = Boolean(on); }
export function isSfxEnabled() { return sfxEnabled; }

function tone({ freq, start, duration, peak = 0.18, type = 'sine' }) {
  if (!sfxEnabled) return;
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  gain.gain.setValueAtTime(0.0001, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, c.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.02);
}

/* Soft two-note rising chime. Never a fanfare. */
export async function playCorrect() {
  await resumeIfNeeded();
  tone({ freq: 659.25, start: 0,    duration: 0.16 });  // E5
  tone({ freq: 987.77, start: 0.11, duration: 0.22 });  // B5
}

/* Gentle low "boop". Never a buzzer. */
export async function playTryAgain() {
  await resumeIfNeeded();
  tone({ freq: 311.13, start: 0,    duration: 0.14, peak: 0.14, type: 'triangle' });
  tone({ freq: 246.94, start: 0.09, duration: 0.20, peak: 0.12, type: 'triangle' });
}

/* Quiet click for neutral taps (card flips). */
export async function playTap() {
  await resumeIfNeeded();
  tone({ freq: 880, start: 0, duration: 0.05, peak: 0.07, type: 'triangle' });
}

/* ---------------- spoken prompts ----------------
   Screen titles have a speaker button in the design, but there is no
   recorded prompt audio yet. Web Speech reads them aloud where it exists;
   where it does not, callers hide the button rather than show a dead one. */

export function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

export function speak(text, { lang = 'en-GB', rate = 0.9 } = {}) {
  if (!canSpeak() || !text) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return true;
  } catch (err) {
    console.warn('[audio] speak failed', err);
    return false;
  }
}
