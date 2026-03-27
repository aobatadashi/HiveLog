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
          <p style={{
            fontSize: 'var(--font-body)',
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {event.notes}
          </p>
        )}
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
          {date} at {time}
        </p>
      </div>
    </div>
  );
}
