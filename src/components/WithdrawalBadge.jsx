/**
 * Shows withdrawal period countdown for treatment events.
 * @param {Object} props
 * @param {string} props.treatmentDate - ISO date string of when treatment was applied
 * @param {number} props.withdrawalDays - Number of days in withdrawal period
 * @param {boolean} [props.compact] - Show compact version (icon only for colony cards)
 */
export default function WithdrawalBadge({ treatmentDate, withdrawalDays, compact = false }) {
  if (!treatmentDate || !withdrawalDays || withdrawalDays <= 0) return null;

  const start = new Date(treatmentDate);
  const end = new Date(start.getTime() + withdrawalDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysLeft = Math.ceil((end - now) / (24 * 60 * 60 * 1000));

  if (daysLeft <= 0) {
    if (compact) return null;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        padding: '2px var(--space-sm)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: '#e8f5e9',
        color: 'var(--color-status-green)',
        fontWeight: 600,
        fontSize: '14px',
      }}>
        ✓ Clear
      </span>
    );
  }

  if (compact) {
    return (
      <span
        title={`Withdrawal: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#ffebee',
          color: 'var(--color-status-red)',
          fontSize: '14px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        ⏳
      </span>
    );
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      padding: '2px var(--space-sm)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: '#ffebee',
      color: 'var(--color-status-red)',
      fontWeight: 600,
      fontSize: '14px',
    }}>
      ⏳ {daysLeft}d left
    </span>
  );
}
