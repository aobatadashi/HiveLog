import { useNavigate } from 'react-router-dom';

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export default function YardCard({ yard }) {
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
            {yard.colony_count || 0} {yard.colony_count === 1 ? 'colony' : 'colonies'} · {lastActivity}
            {activityIsToday && <span className="badge-today">Today</span>}
          </p>
          {yard.location_note && (
            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: '16px',
              marginTop: 'var(--space-xs)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {yard.location_note}
            </p>
          )}
        </div>
        <span style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text-secondary)', marginLeft: 'var(--space-md)' }}>
          ›
        </span>
      </div>
    </div>
  );
}
