import { openDB } from 'idb';

const DB_NAME = 'hivelog-offline';
const DB_VERSION = 2;
const STORE_NAME = 'mutations';
const FAILED_STORE = 'failed';

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(FAILED_STORE)) {
        db.createObjectStore(FAILED_STORE, {
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

export async function addToFailed(mutation, errorMessage) {
  const db = await getDB();
  await db.add(FAILED_STORE, {
    table: mutation.table,
    operation: mutation.operation,
    data: mutation.data,
    errorMessage,
    failedAt: Date.now(),
  });
}

export async function getAllFailed() {
  const db = await getDB();
  return db.getAll(FAILED_STORE);
}

export async function removeFromFailed(id) {
  const db = await getDB();
  await db.delete(FAILED_STORE, id);
}

export async function getFailedCount() {
  const db = await getDB();
  return db.count(FAILED_STORE);
}
