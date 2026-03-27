import { openDB } from 'idb';

const DB_NAME = 'hivelog-offline';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });
}

export async function addToQueue(mutation) {
  const db = await getDB();
  await db.add(STORE_NAME, {
    ...mutation,
    timestamp: Date.now(),
  });
}

export async function getAllQueued() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function removeFromQueue(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearQueue() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function getQueueCount() {
  const db = await getDB();
  return db.count(STORE_NAME);
}
