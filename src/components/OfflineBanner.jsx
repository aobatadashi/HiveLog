import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQueueCount, getFailedCount } from '../lib/offlineQueue.js';

export default function OfflineBanner() {
  const navigate = useNavigate();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const count = await getQueueCount();
        if (!cancelled) setQueueCount(count);
      } catch {
        // IndexedDB may be unavailable
      }
      try {
        const fCount = await getFailedCount();
        if (!cancelled) setFailedCount(fCount);
      } catch {
        // IndexedDB may be unavailable
      }
    }

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isSyncing = !offline && queueCount > 0;
  const showOffline = offline || queueCount > 0;

  return (
    <>
      {showOffline && (
        <div
          className="offline-banner"
          style={isSyncing ? {
            backgroundColor: 'var(--color-warning)',
            color: '#ffffff',
          } : undefined}
        >
          {offline
            ? queueCount > 0
              ? `You are offline — ${queueCount} pending change${queueCount === 1 ? '' : 's'}`
              : 'You are offline — changes will sync when reconnected'
            : `Syncing ${queueCount} change${queueCount === 1 ? '' : 's'}…`
          }
        </div>
      )}
      {failedCount > 0 && (
        <div
          className="offline-banner"
          style={{
            backgroundColor: 'var(--color-danger, #c62828)',
            color: '#ffffff',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/settings')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/settings'); }}
        >
          {failedCount} change{failedCount === 1 ? '' : 's'} failed to sync — tap to review
        </div>
      )}
    </>
  );
}
