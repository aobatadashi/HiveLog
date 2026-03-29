import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheGet } from '../lib/cache.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

const EVENT_TYPES = [
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'treatment', label: 'Treatment', emoji: '💊' },
  { value: 'feed', label: 'Feed', emoji: '🍯' },
  { value: 'split', label: 'Split', emoji: '✂️' },
  { value: 'loss', label: 'Loss', emoji: '💀' },
  { value: 'requeen', label: 'Requeen', emoji: '👑' },
  { value: 'harvest', label: 'Harvest', emoji: '🫙' },
];

export default function LogEvent({ user, onToast }) {
  const { colonyId, yardId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { nextColonyId, nextColonyLabel, colonyLabel, yardName: stateYardName } = location.state || {};
  const [selectedType, setSelectedType] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  // For yard-batch mode, hold the list of active colonies
  const [yardColonies, setYardColonies] = useState([]);
  const [yardName, setYardName] = useState('');
  const [usingCachedColonies, setUsingCachedColonies] = useState(false);

  const isBatchMode = Boolean(yardId);
  // For single-colony mode, get yardId from query param (for "next hive" nav)
  const parentYardId = searchParams.get('yard');

  useEffect(() => {
    if (!isBatchMode) return;
    async function fetchColonies() {
      try {
        const { data: yardData } = await supabase
          .from('yards')
          .select('name')
          .eq('id', yardId)
          .single();

        if (yardData) setYardName(yardData.name);

        const { data, error: fetchError } = await supabase
          .from('colonies')
          .select('id')
          .eq('yard_id', yardId)
          .eq('status', 'active');

        if (fetchError) throw fetchError;
        setYardColonies(data || []);
      } catch {
        // Offline fallback: use cached colony list from YardView
        const cached = await cacheGet('colonies', yardId);
        if (cached && cached.colonies && cached.colonies.length > 0) {
          const active = cached.colonies.filter((c) => c.status === 'active');
          setYardColonies(active);
          if (cached.yard?.name) setYardName(cached.yard.name);
          setUsingCachedColonies(true);
        } else {
          setError('Could not load colonies — open this yard while online first');
        }
      }
    }
    fetchColonies();
  }, [isBatchMode, yardId]);

  async function handleSave() {
    if (!selectedType) return;

    setSaving(true);
    setError('');

    const now = new Date().toISOString();

    if (isBatchMode) {
      // Insert one event per active colony
      const eventsToInsert = yardColonies.map((colony) => ({
        colony_id: colony.id,
        type: selectedType,
        notes: notes.trim() || null,
        logged_by: user.id,
        created_at: now,
      }));

      if (eventsToInsert.length === 0) {
        setError('No active colonies in this yard');
        setSaving(false);
        return;
      }

      try {
        const { error: insertError } = await supabase
          .from('events')
          .insert(eventsToInsert);

        if (insertError) throw insertError;
      } catch {
        // Queue each event individually for offline sync
        for (const evt of eventsToInsert) {
          await addToQueue({ table: 'events', operation: 'insert', data: evt });
        }
      }

      setSaving(false);
      const typeLabel = EVENT_TYPES.find((t) => t.value === selectedType)?.label || selectedType;
      if (onToast) onToast(`Logged ${typeLabel} on ${eventsToInsert.length} colonies`);
      navigate(`/yard/${yardId}`, { replace: true });
    } else {
      // Single colony mode
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

      const typeLabel = EVENT_TYPES.find((t) => t.value === selectedType)?.label || selectedType;

      // If loss event, prompt to mark as deadout via modal
      if (selectedType === 'loss') {
        setSaving(false);
        if (onToast) onToast(`Logged ${typeLabel}`);
        setConfirmModal({
          title: 'Mark Dead Out?',
          message: 'This colony had a loss event. Mark it as dead out?',
          confirmLabel: 'Mark Dead Out',
          danger: true,
          onConfirm: async () => {
            setConfirmModal(null);
            try {
              const { error: updateError } = await supabase
                .from('colonies')
                .update({ status: 'deadout' })
                .eq('id', colonyId);
              if (updateError) throw updateError;
            } catch {
              await addToQueue({
                table: 'colonies',
                operation: 'update',
                data: { id: colonyId, status: 'deadout' },
              });
            }
            navigateAfterSave();
          },
          onCancel: () => {
            setConfirmModal(null);
            navigateAfterSave();
          },
        });
        return;
      }

      setSaving(false);
      if (onToast) onToast(`Logged ${typeLabel}`);

      // If there's a next colony, show success state with Next button
      if (nextColonyId) {
        setSavedSuccess(true);
        return;
      }

      navigateAfterSave();
    }
  }

  function navigateAfterSave() {
    if (nextColonyId) {
      navigate(`/hive/${nextColonyId}`, { replace: true });
    } else if (parentYardId) {
      navigate(`/yard/${parentYardId}`, { replace: true });
    } else {
      navigate(`/hive/${colonyId}`, { replace: true });
    }
  }

  const backPath = isBatchMode
    ? `/yard/${yardId}`
    : `/hive/${colonyId}`;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(backPath, { replace: true })}>
          ←
        </button>
        <h1>{isBatchMode ? 'Log Yard Event' : 'Log Event'}</h1>
      </div>

      {isBatchMode && (
        <p style={{
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-lg)',
          marginTop: 'calc(-1 * var(--space-md))',
          fontSize: 'var(--font-body)',
        }}>
          {yardName ? `${yardName} — ` : ''}{yardColonies.length} active {yardColonies.length === 1 ? 'colony' : 'colonies'}
        </p>
      )}

      {usingCachedColonies && (
        <p style={{
          backgroundColor: '#fff3e0',
          color: '#e65100',
          padding: 'var(--space-sm) var(--space-md)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-md)',
          fontWeight: 600,
          fontSize: 'var(--font-body)',
        }}>
          Using cached colony list
        </p>
      )}

      {!isBatchMode && (colonyLabel || stateYardName) && (
        <p style={{
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-lg)',
          marginTop: 'calc(-1 * var(--space-md))',
          fontSize: 'var(--font-body)',
        }}>
          {colonyLabel}{colonyLabel && stateYardName ? ' · ' : ''}{stateYardName}
        </p>
      )}

      {!savedSuccess && <><div style={{
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
      </div></>}

      {error && <p className="error-msg">{error}</p>}

      {savedSuccess ? (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <p style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, marginBottom: 'var(--space-lg)', color: 'var(--color-status-green)' }}>
            Saved!
          </p>
          {nextColonyId && (
            <button
              className="next-colony-btn"
              onClick={() => navigate(`/hive/${nextColonyId}`, { replace: true })}
            >
              Next: {nextColonyLabel || 'Next Colony'} →
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: 'var(--space-md)' }}
            onClick={() => {
              if (parentYardId) {
                navigate(`/yard/${parentYardId}`, { replace: true });
              } else {
                navigate(`/hive/${colonyId}`, { replace: true });
              }
            }}
          >
            Back to Yard
          </button>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)' }}
          onClick={handleSave}
          disabled={!selectedType || saving}
        >
          {saving ? 'Saving...' : isBatchMode ? `Save for ${yardColonies.length} Colonies` : 'Save'}
        </button>
      )}

      <ConfirmModal
        isOpen={!!confirmModal}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        confirmLabel={confirmModal?.confirmLabel || 'Confirm'}
        cancelLabel="Cancel"
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={confirmModal?.onCancel || (() => {})}
        danger={confirmModal?.danger || false}
      />
    </div>
  );
}
