import { useNavigate } from 'react-router-dom';

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function getHiveDisplay(yard) {
  const bulk = yard.hive_count || 0;
  const colonies = yard.colony_count || 0;
  if (bulk > 0 && colonies === 0) {
    return `${bulk.toLocaleString()} ${bulk === 1 ? 'hive' : 'hives'}`;
  }
  if (colonies > 0 && bulk === 0) {
    return `${colonies.toLocaleString()} ${colonies === 1 ? 'colony' : 'colonies'}`;
  }
  if (bulk > 0 && colonies > 0) {
    return `${bulk.toLocaleString()} hives (${colonies} tracked)`;
  }
  return 'No hives yet';
}

export default function YardCard({ yard, onDelete }) {
  const navigate = useNavigate();

  const lastActivity = yard.last_activity
    ? new Date(yard.last_activity).toLocaleDateString()
    : 'No activity';

  const activityIsToday = isToday(yard.last_activity);

  return (
    <div className="card" onClick={() => navigate(`/yard/${yard.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {yard.name}
          </h3>
          <p style={{
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginTop: 'var(--space-xs)',
          }}>
            {getHiveDisplay(yard)}
          </p>
          {(yard.county || yard.state) && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
              {[yard.county && `${yard.county} County`, yard.state].filter(Boolean).join(', ')}
            </p>
          )}
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
            {lastActivity}
            {activityIsToday && <span className="badge-today">Today</span>}
          </p>
          {yard.location_note && (
            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-body)',
              marginTop: 'var(--space-xs)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {yard.location_note}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginLeft: 'var(--space-md)' }}>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(yard); }}
              style={{
                background: 'none',
                border: '2px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-danger, #c62828)',
                fontSize: 'var(--font-body)',
                fontWeight: 700,
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-label={`Delete ${yard.name}`}
            >
              ✕
            </button>
          )}
          <span style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text-secondary)' }}>
            ›
          </span>
        </div>
      </div>
    </div>
  );
}
