import { supabase } from '../supabaseClient.js';
import { getAllQueued, removeFromQueue, addToFailed } from './offlineQueue.js';

let retryDelay = 1000;
const MAX_RETRY_DELAY = 60000;

function resetBackoff() {
  retryDelay = 1000;
}

function increaseBackoff() {
  retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
}

export async function drainQueue() {
  const items = await getAllQueued();

  if (items.length === 0) return { synced: 0, failed: [] };

  let synced = 0;
  const failed = [];

  for (const item of items) {
    try {
      const { table, operation, data } = item;
      let result;

      if (operation === 'insert') {
        result = await supabase.from(table).insert(data);
      } else if (operation === 'update') {
        const { id, ...rest } = data;
        result = await supabase.from(table).update(rest).eq('id', id);
      } else if (operation === 'delete') {
        result = await supabase.from(table).delete().eq('id', data.id);
      }

      if (result && result.error) {
        const status = result.status || 0;
        const isPermanent = status >= 400 && status < 500
          && status !== 408 && status !== 429;
        if (isPermanent) {
          await addToFailed(item, result.error.message);
          await removeFromQueue(item.id);
          failed.push({ table, operation, error: result.error.message });
          continue;
        }
        // Transient error — stop and retry with backoff
        increaseBackoff();
        break;
      }

      await removeFromQueue(item.id);
      synced++;
      resetBackoff();
    } catch {
      // Network-level failure — stop and retry with backoff
      increaseBackoff();
      break;
    }
  }

  return { synced, failed };
}

export function setupOnlineSync(onSyncComplete, onSyncFailed) {
  let retryTimer = null;

  const handler = async () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    const { synced, failed } = await drainQueue();

    if (synced > 0 && onSyncComplete) {
      onSyncComplete(synced);
    }
    if (failed.length > 0 && onSyncFailed) {
      onSyncFailed(failed);
    }

    // Schedule retry if there are still items in queue (transient failure)
    const remaining = await getAllQueued();
    if (remaining.length > 0) {
      retryTimer = setTimeout(handler, retryDelay);
    }
  };

  window.addEventListener('online', handler);

  // Periodic fallback: drain queue every 60s when online
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      const { synced, failed } = await drainQueue();
      if (synced > 0 && onSyncComplete) onSyncComplete(synced);
      if (failed.length > 0 && onSyncFailed) onSyncFailed(failed);
    }
  }, 60000);

  return () => {
    window.removeEventListener('online', handler);
    clearInterval(interval);
    if (retryTimer) clearTimeout(retryTimer);
  };
}
