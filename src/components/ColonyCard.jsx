import { useNavigate } from 'react-router-dom';
import WithdrawalBadge from './WithdrawalBadge.jsx';

// Status legend (based on configurable inspection interval):
//   grey   = no events ever logged
//   green  = within 1x interval
//   yellow = between 1x and 2x interval
//   red    = beyond 2x interval, or dead out
export function getStatusColor(colony) {
  if (colony.status === 'deadout') return 'red';

  const lastEvent = colony.last_event || colony.last_inspection;
  if (!lastEvent) return 'grey';

  const interval = parseInt(localStorage.getItem('hivelog_inspectionInterval') || '14', 10);
  const daysSince = Math.floor(
    (Date.now() - new Date(lastEvent).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince <= interval) return 'green';
  if (daysSince <= interval * 2) return 'yellow';
  return 'red';
}

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ColonyCard({ colony, onClick, hasQueen, activeWithdrawal }) {
  const navigate = useNavigate();
  const statusColor = getStatusColor(colony);
  const lastEventText = relativeTime(colony.last_event);

  return (
    <div className="card" onClick={onClick || (() => navigate(`/hive/${colony.id}`))}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <span className={`status-dot ${statusColor}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {colony.label}
          </h3>
          {colony.status === 'deadout' ? (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-body)', fontWeight: 600 }}>
              Dead Out
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 2 }}>
              {lastEventText && (
                <span style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)' }}>
                  {lastEventText}
                </span>
              )}
              {hasQueen && (
                <span title="Has active queen" style={{ fontSize: 'var(--font-body)' }}>👑</span>
              )}
              {activeWithdrawal && (
                <WithdrawalBadge
                  treatmentDate={activeWithdrawal.treatmentDate}
                  withdrawalDays={activeWithdrawal.withdrawalDays}
                  compact
                />
              )}
            </div>
          )}
        </div>
        <span style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text-secondary)' }}>
          ›
        </span>
      </div>
    </div>
  );
}
