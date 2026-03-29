import { useState } from 'react';

const TYPE_LABELS = {
  inspection: 'Inspection',
  treatment: 'Treatment',
  feed: 'Feed',
  split: 'Split',
  loss: 'Loss',
  requeen: 'Requeen',
  harvest: 'Harvest',
};

export default function EventRow({ event }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(event.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const time = new Date(event.created_at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        padding: 'var(--space-md) 0',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-md)',
      }}
    >
      <span className={`event-badge ${event.type}`}>
        {TYPE_LABELS[event.type] || event.type}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {event.notes && (
          <div>
            <p style={{
              fontSize: 'var(--font-body)',
              color: 'var(--color-text)',
              ...(expanded
                ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
                : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
            }}>
              {event.notes}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: 'var(--font-body)',
                fontWeight: 600,
                padding: 'var(--space-sm) 0',
                minHeight: '44px',
                cursor: 'pointer',
                minWidth: 'auto',
              }}
            >
              {expanded ? 'less' : 'more'}
            </button>
          </div>
        )}
        <p style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
          {date} at {time}
        </p>
      </div>
    </div>
  );
}
