import { useNavigate } from 'react-router-dom';

// Status legend:
//   grey   = no events ever logged
//   green  = any event within 30 days
//   yellow = most recent event 31–60 days ago
//   red    = most recent event >60 days ago, or dead out
function getStatusColor(colony) {
  if (colony.status === 'deadout') return 'red';

  const lastEvent = colony.last_event || colony.last_inspection;
  if (!lastEvent) return 'grey';

  const daysSince = Math.floor(
    (Date.now() - new Date(lastEvent).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince <= 30) return 'green';
  if (daysSince <= 60) return 'yellow';
  return 'red';
}

export default function ColonyCard({ colony, onClick }) {
  const navigate = useNavigate();
  const statusColor = getStatusColor(colony);

  return (
    <div className="card" onClick={onClick || (() => navigate(`/hive/${colony.id}`))}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <span className={`status-dot ${statusColor}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {colony.label}
          </h3>
          {colony.status === 'deadout' && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-body)', fontWeight: 600 }}>
              Dead Out
            </p>
          )}
        </div>
        <span style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text-secondary)' }}>
          ›
        </span>
      </div>
    </div>
  );
}
