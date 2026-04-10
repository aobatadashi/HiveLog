import { useState } from 'react';

const TYPE_CONFIG = {
  split_out:    { label: 'Split Out', badge: 'split' },
  split_in:     { label: 'Split In', badge: 'split' },
  split_local:  { label: 'Splits', badge: 'split' },
  transfer_out: { label: 'Moved Out', badge: 'transfer' },
  transfer_in:  { label: 'Moved In', badge: 'transfer' },
  move_out:     { label: 'Moved Out', badge: 'transfer' },
  loss:         { label: 'Loss', badge: 'loss' },
  addition:     { label: 'Added', badge: 'addition' },
  adjustment:   { label: 'Correction', badge: 'adjustment' },
  inspection:   { label: 'Inspection', badge: 'inspection' },
  treatment:    { label: 'Treatment', badge: 'treatment' },
  feed:         { label: 'Feed', badge: 'feed' },
  harvest:      { label: 'Harvest', badge: 'harvest' },
  mite:         { label: 'Mite Damage', badge: 'mite' },
  swarm:        { label: 'Swarm', badge: 'swarm' },
  queenless:    { label: 'Queenless', badge: 'queenless' },
};

function getDescription(event) {
  const { type, count, related_yard } = event;
  const yardName = related_yard?.name;

  switch (type) {
    case 'split_out':
      return `Split ${count || '?'} → ${yardName || 'another yard'}`;
    case 'split_in':
      return `Received ${count || '?'} splits ← ${yardName || 'another yard'}`;
    case 'split_local':
      return `Set up ${count || '?'} splits`;
    case 'transfer_out':
    case 'move_out':
      return `Moved ${count || '?'} → ${yardName || 'another yard'}`;
    case 'transfer_in':
      return `Received ${count || '?'} ← ${yardName || 'another yard'}`;
    case 'loss':
      return `${count || '?'} ${count === 1 ? 'hive' : 'hives'} lost`;
    case 'addition':
      return `${count || '?'} ${count === 1 ? 'hive' : 'hives'} added`;
    case 'adjustment':
      return `Count set to ${count ?? '?'}`;
    case 'mite':
    case 'swarm':
    case 'queenless':
      return count ? `${count} ${count === 1 ? 'hive' : 'hives'} affected` : 'Yard-wide';
    default:
      return 'Entire yard';
  }
}

export default function YardEventRow({ event, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const config = TYPE_CONFIG[event.type] || { label: event.type, badge: event.type };

  const date = new Date(event.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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
        cursor: onDelete ? 'pointer' : 'default',
      }}
      onClick={() => onDelete && setExpanded(!expanded)}
    >
      <span className={`event-badge ${config.badge}`}>
        {config.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 'var(--font-body)',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}>
          {getDescription(event)}
        </p>
        {event.notes && (
          <p style={{
            fontSize: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--space-xs)',
            ...(expanded
              ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
              : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
          }}>
            {event.notes}
          </p>
        )}
        <p style={{
          fontSize: 'var(--font-body)',
          color: 'var(--color-text-secondary)',
          marginTop: 'var(--space-xs)',
        }}>
          {date} at {time}
        </p>
        {expanded && onDelete && (
          <div style={{ marginTop: 'var(--space-sm)' }}>
            {!confirming ? (
              <button
                className="btn btn-danger"
                style={{ minHeight: 48, fontSize: 'var(--font-body)', padding: 'var(--space-sm) var(--space-lg)' }}
                onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              >
                Delete
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  className="btn btn-danger"
                  style={{ minHeight: 48, fontSize: 'var(--font-body)', flex: 1 }}
                  onClick={(e) => { e.stopPropagation(); onDelete(event); }}
                >
                  Confirm Delete
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ minHeight: 48, fontSize: 'var(--font-body)', flex: 1 }}
                  onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
