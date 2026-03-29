import { openDB } from 'idb';

const DB_NAME = 'hivelog-cache';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    },
  });
}

/**
 * Cache data under a compound key (store:key).
 * @param {string} store - logical store name (e.g. 'yards', 'colonies', 'events')
 * @param {string} key - identifier (e.g. 'all', yardId, colonyId)
 * @param {*} data - JSON-serializable data to cache
 */
export async function cacheSet(store, key, data) {
  try {
    const db = await getDB();
    await db.put('data', data, `${store}:${key}`);
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Retrieve cached data.
 * @param {string} store
 * @param {string} key
 * @returns {Promise<*|undefined>}
 */
export async function cacheGet(store, key) {
  try {
    const db = await getDB();
    return await db.get('data', `${store}:${key}`);
  } catch {
    return undefined;
  }
}
