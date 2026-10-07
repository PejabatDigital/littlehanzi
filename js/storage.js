/* storage.js — the ONLY module that touches localStorage.
   The API is async on purpose: it can move to Cloudflare D1/KV later
   without changing a single caller. */

const NS = 'lh:v1';
const K_PROFILES = `${NS}:profiles`;
const K_ACTIVE = `${NS}:active`;
const K_PROGRESS = (profileId) => `${NS}:progress:${profileId}`;

let memoryFallback = null; // used if localStorage throws (private mode, blocked)

function backing() {
  if (memoryFallback) return memoryFallback;
  try {
    const probe = `${NS}:probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (err) {
    console.warn('[storage] localStorage unavailable, using in-memory store', err);
    const map = new Map();
    memoryFallback = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
    return memoryFallback;
  }
}

function readJSON(key, fallback) {
  try {
    const raw = backing().getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] could not read ${key}`, err);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    backing().setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] could not write ${key}`, err);
    return false;
  }
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- word stats ---------------- */

export function emptyWordStat() {
  return { seen: 0, correct: 0, wrong: 0, streak: 0, difficult: false, lastWrongAt: null };
}

function emptyLevelProgress() {
  return { completedStations: [], unlockedStation: 1, passed: false, words: {} };
}

/* ---------------- profiles ---------------- */

export async function getProfiles() {
  const list = readJSON(K_PROFILES, []);
  return Array.isArray(list) ? list : [];
}

export async function createProfile({ name, age, avatar, levelId = 'A1' }) {
  const profiles = await getProfiles();
  const profile = {
    id: newId(),
    name: String(name || '').trim(),
    age: Number(age) || null,
    avatar: { art: avatar?.art || 'panda', color: avatar?.color || 'persimmon' },
    levelId,
    createdAt: new Date().toISOString(),
  };
  profiles.push(profile);
  writeJSON(K_PROFILES, profiles);
  writeJSON(K_PROGRESS(profile.id), { [levelId]: emptyLevelProgress() });
  return profile;
}

export async function getProfile(profileId) {
  const profiles = await getProfiles();
  return profiles.find((p) => p.id === profileId) || null;
}

export async function updateProfile(profileId, patch) {
  const profiles = await getProfiles();
  const i = profiles.findIndex((p) => p.id === profileId);
  if (i === -1) return null;
  profiles[i] = { ...profiles[i], ...patch, id: profiles[i].id };
  writeJSON(K_PROFILES, profiles);
  return profiles[i];
}

export async function deleteProfile(profileId) {
  const profiles = await getProfiles();
  writeJSON(K_PROFILES, profiles.filter((p) => p.id !== profileId));
  try { backing().removeItem(K_PROGRESS(profileId)); } catch (_) { /* ignore */ }
  if (readJSON(K_ACTIVE, null) === profileId) writeJSON(K_ACTIVE, null);
}

export async function getActiveProfileId() {
  return readJSON(K_ACTIVE, null);
}

export async function setActiveProfileId(profileId) {
  writeJSON(K_ACTIVE, profileId);
}

/* ---------------- progress ---------------- */

export async function getProgress(profileId, levelId) {
  const all = readJSON(K_PROGRESS(profileId), {});
  const level = all[levelId];
  if (!level) return emptyLevelProgress();
  return {
    completedStations: Array.isArray(level.completedStations) ? level.completedStations : [],
    unlockedStation: Number(level.unlockedStation) || 1,
    passed: Boolean(level.passed),
    words: level.words && typeof level.words === 'object' ? level.words : {},
  };
}

export async function saveProgress(profileId, levelId, progress) {
  const all = readJSON(K_PROGRESS(profileId), {});
  all[levelId] = progress;
  writeJSON(K_PROGRESS(profileId), all);
  return progress;
}

export async function getWordStat(profileId, levelId, wordId) {
  const progress = await getProgress(profileId, levelId);
  return progress.words[wordId] ? { ...progress.words[wordId] } : emptyWordStat();
}

/* Apply a patch function to one word's stats and persist. */
export async function updateWordStat(profileId, levelId, wordId, patchFn) {
  const progress = await getProgress(profileId, levelId);
  const before = progress.words[wordId] || emptyWordStat();
  progress.words[wordId] = patchFn({ ...before });
  await saveProgress(profileId, levelId, progress);
  return progress.words[wordId];
}

/* Escape hatch for tests only. */
export async function _clearAll() {
  const profiles = await getProfiles();
  for (const p of profiles) {
    try { backing().removeItem(K_PROGRESS(p.id)); } catch (_) { /* ignore */ }
  }
  writeJSON(K_PROFILES, []);
  writeJSON(K_ACTIVE, null);
}
