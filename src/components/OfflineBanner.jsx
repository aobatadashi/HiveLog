import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQueueCount, getFailedCount } from '../lib/offlineQueue.js';

export default function OfflineBanner() {
  const navigate = useNavigate();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  const poll = useCallback(async () => {
    let q = 0;
    let f = 0;
    try {
      q = await getQueueCount();
      if (!cancelledRef.current) setQueueCount(q);
    } catch {
      // IndexedDB may be unavailable
    }
    try {
      f = await getFailedCount();
      if (!cancelledRef.current) setFailedCount(f);
    } catch {
      // IndexedDB may be unavailable
    }
    return { q, f };
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      poll(); // immediate re-poll on reconnect
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [poll]);

  useEffect(() => {
    cancelledRef.current = false;

    function schedulePoll(delay) {
      timerRef.current = setTimeout(async () => {
        const { q, f } = await poll();
        if (!cancelledRef.current) {
          const nextDelay = (q === 0 && f === 0) ? 60000 : 30000;
          schedulePoll(nextDelay);
        }
      }, delay);
    }

    poll(); // initial poll
    schedulePoll(30000);

    return () => {
      cancelledRef.current = true;
      clearTimeout(timerRef.current);
    };
  }, [poll]);

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
