import { useState } from 'react';
import WithdrawalBadge from './WithdrawalBadge.jsx';

const TYPE_LABELS = {
  inspection: 'Inspection',
  treatment: 'Treatment',
  feed: 'Feed',
  split: 'Split',
  loss: 'Loss',
  requeen: 'Requeen',
  harvest: 'Harvest',
  transfer: 'Transfer',
};

export default function EventRow({ event, treatmentDetail, loggedByName, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
        cursor: onDelete ? 'pointer' : 'default',
      }}
      onClick={() => onDelete && setExpanded(!expanded)}
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
                minHeight: '56px',
                cursor: 'pointer',
                minWidth: 'auto',
              }}
            >
              {expanded ? 'less' : 'more'}
            </button>
          </div>
        )}
        {treatmentDetail && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', alignItems: 'center', marginTop: 'var(--space-xs)' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-body)', color: 'var(--color-text)' }}>
              {treatmentDetail.product_name}
            </span>
            {treatmentDetail.dosage && (
              <span style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)' }}>
                {treatmentDetail.dosage}
              </span>
            )}
            <WithdrawalBadge
              treatmentDate={event.created_at}
              withdrawalDays={treatmentDetail.withdrawal_period_days}
            />
          </div>
        )}
        <p style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
          {date} at {time}
        </p>
        {loggedByName && (
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Logged by {loggedByName}
          </p>
        )}
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
