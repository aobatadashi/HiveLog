import { useState } from 'react';

const MARKING_COLORS = [
  { value: 'white', bg: '#f5f5f5', border: '#bdbdbd' },
  { value: 'yellow', bg: '#fdd835', border: '#f9a825' },
  { value: 'red', bg: '#e53935', border: '#c62828' },
  { value: 'green', bg: '#43a047', border: '#2e7d32' },
  { value: 'blue', bg: '#1e88e5', border: '#1565c0' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'lost', label: 'Lost' },
];

export default function QueenModal({ isOpen, queen, onSave, onCancel }) {
  const [markingColor, setMarkingColor] = useState(queen?.marking_color || null);
  const [source, setSource] = useState(queen?.source || '');
  const [introductionDate, setIntroductionDate] = useState(queen?.introduction_date || '');
  const [notes, setNotes] = useState(queen?.notes || '');
  const [status, setStatus] = useState(queen?.status || 'active');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const isEditing = Boolean(queen?.id);

  async function handleSave() {
    setSaving(true);
    await onSave({
      marking_color: markingColor,
      source: source.trim() || null,
      introduction_date: introductionDate || null,
      notes: notes.trim() || null,
      status,
    });
    setSaving(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2>{isEditing ? 'Edit Queen' : 'Add Queen'}</h2>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
            Marking Color
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
            {MARKING_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setMarkingColor(markingColor === c.value ? null : c.value)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: c.bg,
                  border: markingColor === c.value
                    ? `4px solid var(--color-accent)`
                    : `3px solid ${c.border}`,
                  cursor: 'pointer',
                  boxShadow: markingColor === c.value ? '0 0 0 2px var(--color-accent)' : 'none',
                  transition: 'all 0.1s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
                aria-label={c.value}
              />
            ))}
          </div>
          {markingColor && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
              {markingColor.charAt(0).toUpperCase() + markingColor.slice(1)}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
            Source
          </label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Bought, Raised, Gifted"
          />
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
            Introduction Date
          </label>
          <input
            type="date"
            value={introductionDate}
            onChange={(e) => setIntroductionDate(e.target.value)}
            style={{ fontSize: 'var(--font-body)' }}
          />
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Queen notes..."
            rows={2}
          />
        </div>

        {isEditing && (
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
              Status
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`btn ${status === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, minHeight: 'var(--touch-min)' }}
                  onClick={() => setStatus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="btn-row">
          <button
            className="btn btn-secondary"
            style={{ minHeight: '64px' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ minHeight: '64px' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Queen'}
          </button>
        </div>
      </div>
    </div>
  );
}
