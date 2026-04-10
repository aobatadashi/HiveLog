import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheGet } from '../lib/cache.js';
import TreatmentForm from '../components/TreatmentForm.jsx';
import YardPicker from '../components/YardPicker.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const YARD_EVENT_TYPES = [
  { value: 'split_out', label: 'Split', emoji: '✂️', needsCount: true, needsYard: true },
  { value: 'loss', label: 'Loss', emoji: '💀', needsCount: true },
  { value: 'feed', label: 'Feed', emoji: '🍯' },
  { value: 'treatment', label: 'Treatment', emoji: '💊' },
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'addition', label: 'Add Hives', emoji: '📦', needsCount: true },
  { value: 'mite', label: 'Mite Damage', emoji: '🐛', needsOptionalCount: true },
  { value: 'swarm', label: 'Swarm', emoji: '🐝', needsOptionalCount: true },
  { value: 'queenless', label: 'Queenless', emoji: '❌', needsOptionalCount: true },
  { value: 'harvest', label: 'Harvest', emoji: '🫙' },
  { value: 'adjustment', label: 'Correct Count', emoji: '🔢', isAdjustment: true },
];

export default function LogYardEvent({ user, onToast }) {
  const { yardId } = useParams();
  const navigate = useNavigate();

  const [yard, setYard] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showYardPicker, setShowYardPicker] = useState(false);
  const [destYard, setDestYard] = useState(null);
  const [treatmentDetails, setTreatmentDetails] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    async function fetchYard() {
      try {
        const { data, error: fetchError } = await supabase
          .from('yards')
          .select('id, name, hive_count, location_note')
          .eq('id', yardId)
          .single();
        if (fetchError) throw fetchError;
        setYard(data);
      } catch {
        const cached = await cacheGet('colonies', yardId);
        if (cached?.yard) {
          setYard(cached.yard);
        } else {
          setError('Could not load yard data');
        }
      }
    }
    fetchYard();
  }, [yardId]);

  const typeDef = YARD_EVENT_TYPES.find((t) => t.value === selectedType);
  const needsCount = typeDef?.needsCount;
  const needsOptionalCount = typeDef?.needsOptionalCount;
  const needsYard = typeDef?.needsYard;
  const isAdjustment = typeDef?.isAdjustment;
  const countNum = parseInt(count, 10) || 0;

  function getCountError() {
    if (!needsCount && !isAdjustment) return null;
    if (!count) return null;
    if (countNum < 0) return 'Count must be positive';
    if (selectedType === 'loss' && yard && countNum > yard.hive_count) {
      return `Can't lose more than ${yard.hive_count} hives`;
    }
    if (selectedType === 'split_out' && yard && countNum > yard.hive_count) {
      return `Can't split more than ${yard.hive_count} hives`;
    }
    return null;
  }

  function canSave() {
    if (!selectedType || saving) return false;
    if (needsCount && countNum < 1) return false;
    if (isAdjustment && !count) return false;
    if (needsYard && !destYard) return false;
    if (selectedType === 'treatment' && !treatmentDetails.product_name) return false;
    if (getCountError()) return false;
    return true;
  }

  async function handleSave() {
    if (!canSave()) return;

    // Losses confirm before saving
    if (selectedType === 'loss' && !confirmModal) {
      setConfirmModal({
        title: `Log ${countNum} ${countNum === 1 ? 'loss' : 'losses'}?`,
        message: `This will reduce ${yard?.name || 'this yard'} from ${yard?.hive_count || 0} to ${(yard?.hive_count || 0) - countNum} hives.`,
        confirmLabel: 'Log Loss',
        danger: true,
        onConfirm: () => { setConfirmModal(null); doSave(); },
        onCancel: () => setConfirmModal(null),
      });
      return;
    }

    doSave();
  }

  async function doSave() {
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const pairId = (needsYard && destYard) ? crypto.randomUUID() : null;

    // Build the source yard event
    const sourceEvent = {
      id: crypto.randomUUID(),
      yard_id: yardId,
      type: selectedType,
      count: (needsCount || needsOptionalCount) ? (countNum || null) : null,
      related_yard_id: destYard?.id || null,
      pair_id: pairId,
      notes: notes.trim() || null,
      logged_by: user.id,
      created_at: now,
    };

    // For adjustments, store the new count in the count field
    if (isAdjustment) {
      sourceEvent.count = countNum;
    }

    // Calculate hive_count changes
    let sourceCountDelta = 0;
    let destCountDelta = 0;
    let newSourceCount = yard?.hive_count || 0;

    if (selectedType === 'split_out') {
      // Splits: source keeps its bees, destination gains new colonies
      sourceCountDelta = 0;
      destCountDelta = countNum;
    } else if (selectedType === 'loss') {
      sourceCountDelta = -countNum;
      newSourceCount += sourceCountDelta;
    } else if (selectedType === 'addition') {
      sourceCountDelta = countNum;
      newSourceCount += sourceCountDelta;
    } else if (isAdjustment) {
      newSourceCount = countNum;
      sourceCountDelta = countNum - (yard?.hive_count || 0);
    }

    // Build destination yard event for splits
    const destEvent = (needsYard && destYard) ? {
      id: crypto.randomUUID(),
      yard_id: destYard.id,
      type: 'split_in',
      count: countNum,
      related_yard_id: yardId,
      pair_id: pairId,
      notes: notes.trim() || null,
      logged_by: user.id,
      created_at: now,
    } : null;

    try {
      // Insert source event
      const { error: srcErr } = await supabase
        .from('yard_events')
        .insert(sourceEvent);
      if (srcErr) throw srcErr;

      // Update source yard hive_count
      if (sourceCountDelta !== 0 || isAdjustment) {
        const { error: updateErr } = await supabase
          .from('yards')
          .update({ hive_count: Math.max(0, newSourceCount) })
          .eq('id', yardId);
        if (updateErr) throw updateErr;
      }

      // Insert destination event + update destination count for splits
      if (destEvent) {
        const { error: destErr } = await supabase
          .from('yard_events')
          .insert(destEvent);
        if (destErr) throw destErr;

        const newDestCount = (destYard.hive_count || 0) + destCountDelta;
        const { error: destUpdateErr } = await supabase
          .from('yards')
          .update({ hive_count: Math.max(0, newDestCount) })
          .eq('id', destYard.id);
        if (destUpdateErr) throw destUpdateErr;
      }
    } catch {
      // Offline: queue all operations
      await addToQueue({ table: 'yard_events', operation: 'insert', data: sourceEvent });
      if (sourceCountDelta !== 0 || isAdjustment) {
        await addToQueue({
          table: 'yards',
          operation: 'update',
          data: { id: yardId, hive_count: Math.max(0, newSourceCount) },
        });
      }
      if (destEvent) {
        await addToQueue({ table: 'yard_events', operation: 'insert', data: destEvent });
        await addToQueue({
          table: 'yards',
          operation: 'update',
          data: { id: destYard.id, hive_count: Math.max(0, (destYard.hive_count || 0) + destCountDelta) },
        });
      }
    }

    setSaving(false);

    // Toast
    const label = typeDef?.label || selectedType;
    let toastMsg = `Logged ${label}`;
    if (countNum && (needsCount || isAdjustment)) {
      if (isAdjustment) {
        toastMsg = `Count corrected to ${countNum}`;
      } else if (destYard) {
        toastMsg = `${countNum} hives split to ${destYard.name}`;
      } else {
        toastMsg = `Logged ${countNum} ${label.toLowerCase()}`;
      }
    }
    if (onToast) onToast(toastMsg);

    navigate(`/yard/${yardId}`, { replace: true });
  }

  function handleTypeSelect(typeValue) {
    setSelectedType(selectedType === typeValue ? null : typeValue);
    setCount('');
    setDestYard(null);
    setNotes('');
    setTreatmentDetails({});
  }

  return (
    <div className="page" style={{ paddingBottom: '120px' }}>
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(`/yard/${yardId}`, { replace: true })}>
          ←
        </button>
        <h1>Log Yard Event</h1>
      </div>

      {yard && (
        <div style={{
          marginBottom: 'var(--space-lg)',
          marginTop: 'calc(-1 * var(--space-md))',
        }}>
          <p style={{
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            color: 'var(--color-text)',
          }}>
            {yard.name}
          </p>
          <p style={{
            fontSize: 'var(--font-2xl, 28px)',
            fontWeight: 700,
            color: 'var(--color-accent)',
          }}>
            {(yard.hive_count || 0).toLocaleString()} hives
          </p>
        </div>
      )}

      {/* Event type grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
      }}>
        {YARD_EVENT_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => handleTypeSelect(type.value)}
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

      {/* Dynamic inputs based on selected type */}
      {selectedType && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          {/* Count input for types that need it */}
          {(needsCount || isAdjustment) && (
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                {isAdjustment ? 'Set hive count to:' : `How many ${selectedType === 'addition' ? 'to add' : selectedType === 'loss' ? 'lost' : 'hives'}?`}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={isAdjustment ? `Currently ${yard?.hive_count || 0}` : 'e.g., 142'}
                style={{
                  fontSize: 'var(--font-xl)',
                  fontWeight: 700,
                  maxWidth: '200px',
                }}
                autoFocus
              />
              {getCountError() && (
                <p className="error-msg" style={{ marginTop: 'var(--space-sm)' }}>{getCountError()}</p>
              )}
              {/* Preview of new count */}
              {countNum > 0 && !isAdjustment && yard && (needsCount) && (
                selectedType === 'split_out' ? (
                  <div style={{ marginTop: 'var(--space-sm)' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>
                      {yard.name}: stays at {yard.hive_count || 0} hives
                    </p>
                    {destYard && (
                      <p style={{ color: 'var(--color-status-green, #2e7d32)', fontSize: 'var(--font-body)', fontWeight: 600 }}>
                        {destYard.name}: {destYard.hive_count || 0} → {(destYard.hive_count || 0) + countNum} hives
                      </p>
                    )}
                  </div>
                ) : (
                  <p style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-body)',
                    marginTop: 'var(--space-sm)',
                  }}>
                    {yard.hive_count || 0} → {Math.max(0,
                      selectedType === 'loss'
                        ? (yard.hive_count || 0) - countNum
                        : (yard.hive_count || 0) + countNum
                    )} hives
                  </p>
                )
              )}
            </div>
          )}

          {/* Optional count for observation types */}
          {needsOptionalCount && (
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                How many affected? (optional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g., 12"
                style={{ maxWidth: '200px' }}
              />
            </div>
          )}

          {/* Yard picker for splits */}
          {needsYard && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                Move to which yard?
              </label>
              {destYard ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                }}>
                  <span style={{
                    fontSize: 'var(--font-lg)',
                    fontWeight: 600,
                    flex: 1,
                  }}>
                    {destYard.name}
                    {destYard.hive_count > 0 && (
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: 'var(--space-sm)' }}>
                        ({destYard.hive_count} hives)
                      </span>
                    )}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ minHeight: 48 }}
                    onClick={() => setShowYardPicker(true)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    minHeight: 64,
                    fontSize: 'var(--font-lg)',
                    fontWeight: 600,
                  }}
                  onClick={() => setShowYardPicker(true)}
                >
                  Select Destination Yard
                </button>
              )}
            </div>
          )}

          {/* Treatment details */}
          {selectedType === 'treatment' && (
            <TreatmentForm value={treatmentDetails} onChange={setTreatmentDetails} />
          )}

          {/* Notes */}
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations..."
              rows={3}
            />
          </div>
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}

      {/* Fixed save button */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-md) var(--space-lg)',
        background: 'linear-gradient(transparent, var(--color-bg) 20%)',
        paddingTop: 'var(--space-xl)',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)' }}
            onClick={handleSave}
            disabled={!canSave()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Yard picker modal */}
      {showYardPicker && (
        <YardPicker
          excludeYardId={yardId}
          onSelect={(y) => {
            setDestYard(y);
            setShowYardPicker(false);
          }}
          onCancel={() => setShowYardPicker(false)}
        />
      )}

      {/* Confirm modal */}
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
