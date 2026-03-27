import { supabase } from '../supabaseClient.js';
import { getAllQueued, removeFromQueue } from './offlineQueue.js';

export async function drainQueue() {
  const items = await getAllQueued();

  if (items.length === 0) return 0;

  let synced = 0;

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
        break;
      }

      await removeFromQueue(item.id);
      synced++;
    } catch {
      break;
    }
  }

  return synced;
}

export function setupOnlineSync(onSyncComplete) {
  const handler = async () => {
    const count = await drainQueue();
    if (count > 0 && onSyncComplete) {
      onSyncComplete(count);
    }
  };

  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
