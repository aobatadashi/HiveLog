const COLOR_MAP = {
  white: '#f5f5f5',
  yellow: '#fdd835',
  red: '#e53935',
  green: '#43a047',
  blue: '#1e88e5',
};

const COLOR_BORDER = {
  white: '#bdbdbd',
  yellow: '#f9a825',
  red: '#c62828',
  green: '#2e7d32',
  blue: '#1565c0',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QueenInfo({ queen, onEdit, onAdd }) {
  if (!queen) {
    return (
      <button
        className="btn btn-secondary"
        style={{
          width: '100%',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-sm)',
        }}
        onClick={onAdd}
      >
        👑 Add Queen Info
      </button>
    );
  }

  return (
    <button
      className="queen-card"
      onClick={onEdit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        width: '100%',
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 'var(--touch-min)',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.1s ease',
      }}
    >
      {queen.marking_color && (
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: COLOR_MAP[queen.marking_color] || '#ccc',
            border: `3px solid ${COLOR_BORDER[queen.marking_color] || '#999'}`,
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-body)' }}>
          👑 Queen{queen.marking_color ? ` (${queen.marking_color})` : ''}
        </div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>
          {[
            queen.source && `Source: ${queen.source}`,
            queen.introduction_date && `Introduced: ${formatDate(queen.introduction_date)}`,
          ].filter(Boolean).join(' · ') || 'Tap to edit'}
        </div>
      </div>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-lg)' }}>›</span>
    </button>
  );
}
