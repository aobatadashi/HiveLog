import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';

const EVENT_TYPES = [
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'treatment', label: 'Treatment', emoji: '💊' },
  { value: 'feed', label: 'Feed', emoji: '🍯' },
  { value: 'split', label: 'Split', emoji: '✂️' },
  { value: 'loss', label: 'Loss', emoji: '💀' },
  { value: 'requeen', label: 'Requeen', emoji: '👑' },
  { value: 'harvest', label: 'Harvest', emoji: '🫙' },
];

export default function LogEvent({ user }) {
  const { colonyId } = useParams();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!selectedType) return;

    setSaving(true);
    setError('');

    const eventData = {
      colony_id: colonyId,
      type: selectedType,
      notes: notes.trim() || null,
      logged_by: user.id,
    };

    try {
      const { error: insertError } = await supabase
        .from('events')
        .insert(eventData);

      if (insertError) throw insertError;
    } catch {
      await addToQueue({ table: 'events', operation: 'insert', data: eventData });
    }

    setSaving(false);
    navigate(`/hive/${colonyId}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(`/hive/${colonyId}`)}>
          ←
        </button>
        <h1>Log Event</h1>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
      }}>
        {EVENT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              minHeight: '100px',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              border: selectedType === type.value
                ? '3px solid var(--color-accent)'
                : '3px solid var(--color-border)',
              backgroundColor: selectedType === type.value
                ? 'var(--color-accent)'
                : 'var(--color-surface)',
              color: selectedType === type.value
                ? 'var(--color-accent-text)'
                : 'var(--color-text)',
              fontSize: 'var(--font-lg)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.1s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: '32px' }}>{type.emoji}</span>
            {type.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any observations..."
          rows={3}
        />
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button
        className="btn btn-primary"
        style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)' }}
        onClick={handleSave}
        disabled={!selectedType || saving}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
