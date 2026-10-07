/* data.js — loads the level index and per-level word data. Cached in memory. */

const cache = new Map();
let levelsPromise = null;

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

/* [{ id, name, file, available }, …] */
export function getLevels() {
  if (!levelsPromise) {
    levelsPromise = loadJSON('data/levels.json').catch((err) => {
      levelsPromise = null;
      throw err;
    });
  }
  return levelsPromise;
}

export async function getLevelMeta(levelId) {
  const levels = await getLevels();
  return levels.find((l) => l.id === levelId) || null;
}

/* A level is only playable if the index says available AND its data file loads. */
export async function getLevel(levelId) {
  if (cache.has(levelId)) return cache.get(levelId);
  const meta = await getLevelMeta(levelId);
  if (!meta) throw new Error(`Unknown level ${levelId}`);
  if (!meta.available || !meta.file) throw new Error(`Level ${levelId} is not available yet`);
  const level = await loadJSON(meta.file);
  if (!Array.isArray(level.words) || level.words.length === 0) {
    throw new Error(`Level ${levelId} has no words`);
  }
  cache.set(levelId, level);
  return level;
}

export async function getWords(levelId) {
  return (await getLevel(levelId)).words;
}

export async function getWord(levelId, wordId) {
  return (await getWords(levelId)).find((w) => w.id === wordId) || null;
}

/* Map of id -> word, for fast lookup inside activities. */
export async function getWordMap(levelId) {
  const words = await getWords(levelId);
  return new Map(words.map((w) => [w.id, w]));
}
