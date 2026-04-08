import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheGet } from '../lib/cache.js';
import TreatmentForm from '../components/TreatmentForm.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import QueenModal from '../components/QueenModal.jsx';

const EVENT_TYPES = [
  { value: 'inspection', label: 'Inspection', emoji: '🔍' },
  { value: 'treatment', label: 'Treatment', emoji: '💊' },
  { value: 'feed', label: 'Feed', emoji: '🍯' },
  { value: 'split', label: 'Split', emoji: '✂️' },
  { value: 'loss', label: 'Loss', emoji: '💀' },
  { value: 'requeen', label: 'Requeen', emoji: '👑' },
  { value: 'harvest', label: 'Harvest', emoji: '🫙' },
  { value: 'mite', label: 'Mite Check', emoji: '🐛' },
  { value: 'swarm', label: 'Swarm', emoji: '🐝' },
  { value: 'queenless', label: 'Queenless', emoji: '❌' },
];

const EVENT_PLURALS = {
  inspection: 'inspections', treatment: 'treatments', feed: 'feeds',
  split: 'splits', loss: 'losses', requeen: 'requeens', harvest: 'harvests',
  mite: 'mite checks', swarm: 'swarms', queenless: 'queenless',
};

export default function WalkYard({ user, onToast }) {
  const { yardId } = useParams();
  const navigate = useNavigate();
  const [colonies, setColonies] = useState([]);
  const [yardName, setYardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [selectedType, setSelectedType] = useState(() => {
    return localStorage.getItem('hivelog_lastEventType') || null;
  });
  const [notes, setNotes] = useState('');
  const [treatmentDetails, setTreatmentDetails] = useState({
    product_name: '',
    dosage: '',
    application_method: '',
    withdrawal_period_days: '',
    lot_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showTreatmentForm, setShowTreatmentForm] = useState(true);
  const [resumePrompt, setResumePrompt] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [queenModal, setQueenModal] = useState(false);
  const [pendingAdvanceColonyId, setPendingAdvanceColonyId] = useState(null);

  const fetchColonies = useCallback(async () => {
    let colonyCount = 0;
    try {
      const { data: yardData } = await supabase
        .from('yards')
        .select('name')
        .eq('id', yardId)
        .single();
      if (yardData) setYardName(yardData.name);

      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('*')
        .eq('yard_id', yardId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (colonyError) throw colonyError;
      setColonies(colonyData || []);
      setResults((colonyData || []).map((c) => ({ colonyId: c.id, label: c.label, logged: false, skipped: false })));
      colonyCount = (colonyData || []).length;
    } catch {
      const cached = await cacheGet('colonies', yardId);
      if (cached) {
        setYardName(cached.yard?.name || '');
        const active = (cached.colonies || []).filter((c) => c.status !== 'deadout');
        setColonies(active);
        setResults(active.map((c) => ({ colonyId: c.id, label: c.label, logged: false, skipped: false })));
        colonyCount = active.length;
      }
    }
    setLoading(false);

    const savedSession = localStorage.getItem(`hivelog_walkSession_${yardId}`);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const ageHours = (Date.now() - session.timestamp) / 3600000;
        if (session.currentIndex > 0 && session.currentIndex < colonyCount && ageHours < 24) {
          setResumePrompt(session);
        } else {
          localStorage.removeItem(`hivelog_walkSession_${yardId}`);
        }
      } catch {
        localStorage.removeItem(`hivelog_walkSession_${yardId}`);
      }
    }
  }, [yardId]);

  useEffect(() => {
    fetchColonies();
  }, [fetchColonies]);

  async function handleSave() {
    if (!selectedType || saving) return;
    setSaving(true);

    const colony = colonies[currentIndex];
    const eventId = crypto.randomUUID();
    const eventData = {
      id: eventId,
      colony_id: colony.id,
      type: selectedType,
      notes: notes.trim() || null,
      logged_by: user.id,
    };

    const hasTreatmentDetails = selectedType === 'treatment' && treatmentDetails.product_name;

    try {
      const { error: insertError } = await supabase
        .from('events')
        .insert(eventData);
      if (insertError) throw insertError;

      if (hasTreatmentDetails) {
        const { error: detailError } = await supabase
          .from('treatment_details')
          .insert({
            event_id: eventId,
            product_name: treatmentDetails.product_name,
            dosage: treatmentDetails.dosage?.trim() || null,
            application_method: treatmentDetails.application_method || null,
            withdrawal_period_days: treatmentDetails.withdrawal_period_days || null,
            lot_number: treatmentDetails.lot_number?.trim() || null,
          });
        if (detailError) throw detailError;
      }
    } catch {
      await addToQueue({ table: 'events', operation: 'insert', data: eventData });
      if (hasTreatmentDetails) {
        await addToQueue({
          table: 'treatment_details',
          operation: 'insert',
          data: {
            id: crypto.randomUUID(),
            event_id: eventId,
            product_name: treatmentDetails.product_name,
            dosage: treatmentDetails.dosage?.trim() || null,
            application_method: treatmentDetails.application_method || null,
            withdrawal_period_days: treatmentDetails.withdrawal_period_days || null,
            lot_number: treatmentDetails.lot_number?.trim() || null,
          },
        });
      }
    }

    localStorage.setItem('hivelog_lastEventType', selectedType);

    setResults((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], logged: true, type: selectedType };
      return updated;
    });

    setSaving(false);

    // For loss events, prompt to mark as dead out before advancing
    if (selectedType === 'loss') {
      setPendingAdvanceColonyId(colony.id);
      setConfirmModal({
        title: 'Mark Dead Out?',
        message: 'This colony had a loss event. Mark it as dead out?',
        confirmLabel: 'Mark Dead Out',
        danger: true,
        onConfirm: async () => {
          try {
            const { error: updateError } = await supabase
              .from('colonies')
              .update({ status: 'deadout' })
              .eq('id', colony.id);
            if (updateError) throw updateError;
          } catch {
            await addToQueue({
              table: 'colonies',
              operation: 'update',
              data: { id: colony.id, status: 'deadout' },
            });
          }
          setConfirmModal(null);
          setPendingAdvanceColonyId(null);
          advance();
        },
        onCancel: () => {
          setConfirmModal(null);
          setPendingAdvanceColonyId(null);
          advance();
        },
      });
      return;
    }

    // For requeen events, show queen modal before advancing
    if (selectedType === 'requeen') {
      setPendingAdvanceColonyId(colony.id);
      // Mark any existing active queen as replaced
      try {
        const { data: activeQueens } = await supabase
          .from('queens')
          .select('id')
          .eq('colony_id', colony.id)
          .eq('status', 'active');
        if (activeQueens && activeQueens.length > 0) {
          for (const q of activeQueens) {
            try {
              await supabase.from('queens').update({ status: 'replaced' }).eq('id', q.id);
            } catch {
              await addToQueue({ table: 'queens', operation: 'update', data: { id: q.id, status: 'replaced' } });
            }
          }
        }
      } catch {
        // Offline — skip queen replacement
      }
      setQueenModal(true);
      return;
    }

    advance();
  }

  function handleSkip() {
    setResults((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], skipped: true };
      return updated;
    });
    advance();
  }

  function advance() {
    const next = currentIndex + 1;
    if (next >= colonies.length) {
      localStorage.removeItem(`hivelog_walkSession_${yardId}`);
      setFinished(true);
    } else {
      setCurrentIndex(next);
      setNotes('');
      if (selectedType !== 'treatment') {
        setTreatmentDetails({
          product_name: '',
          dosage: '',
          application_method: '',
          withdrawal_period_days: '',
          lot_number: '',
        });
      }
      setShowTreatmentForm(false);

      localStorage.setItem(`hivelog_walkSession_${yardId}`, JSON.stringify({
        currentIndex: next,
        selectedType,
        treatmentDetails: selectedType === 'treatment' ? treatmentDetails : null,
        timestamp: Date.now(),
      }));
    }
  }

  function handleDone() {
    if (currentIndex < colonies.length) {
      localStorage.setItem(`hivelog_walkSession_${yardId}`, JSON.stringify({
        currentIndex,
        selectedType,
        treatmentDetails: selectedType === 'treatment' ? treatmentDetails : null,
        timestamp: Date.now(),
      }));
    }
    setFinished(true);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (colonies.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(`/yard/${yardId}`, { replace: true })}>←</button>
          <h1>Walk Yard</h1>
        </div>
        <div className="empty-state">
          <p>No active colonies in this yard</p>
        </div>
      </div>
    );
  }

  if (resumePrompt && !finished) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate(`/yard/${yardId}`, { replace: true })}>←</button>
          <h1>Walk Yard</h1>
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          <p style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
            Resume Walk?
          </p>
          <p style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>
            You paused at hive {resumePrompt.currentIndex + 1} of {colonies.length}
            {resumePrompt.selectedType && ` (${resumePrompt.selectedType})`}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)', marginBottom: 'var(--space-md)' }}
            onClick={() => {
              setCurrentIndex(resumePrompt.currentIndex);
              if (resumePrompt.selectedType) setSelectedType(resumePrompt.selectedType);
              if (resumePrompt.treatmentDetails) setTreatmentDetails(resumePrompt.treatmentDetails);
              setResumePrompt(null);
            }}
          >
            Resume from Hive {resumePrompt.currentIndex + 1}
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', height: '56px', fontSize: 'var(--font-body)' }}
            onClick={() => {
              localStorage.removeItem(`hivelog_walkSession_${yardId}`);
              setResumePrompt(null);
            }}
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const loggedResults = results.filter((r) => r.logged);
    const skippedCount = results.filter((r) => r.skipped).length;

    // Group logged events by type for accurate breakdown
    const typeCounts = {};
    loggedResults.forEach((r) => {
      const key = r.type || 'event';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });
    const summary = Object.entries(typeCounts)
      .map(([type, count]) => {
        const label = EVENT_TYPES.find((t) => t.value === type)?.label?.toLowerCase() || type;
        const plural = EVENT_PLURALS[type] || `${label}s`;
        return `${count} ${count === 1 ? label : plural}`;
      })
      .join(', ');

    return (
      <div className="page">
        <div className="page-header">
          <h1>Walk Complete</h1>
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          <p style={{ fontSize: 'var(--font-3xl)', fontWeight: 700, color: 'var(--color-status-green)', marginBottom: 'var(--space-lg)' }}>
            Done!
          </p>
          <p style={{ fontSize: 'var(--font-xl)', marginBottom: 'var(--space-md)' }}>
            Logged {summary || '0 events'}
          </p>
          {skippedCount > 0 && (
            <p style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>
              Skipped {skippedCount} {skippedCount === 1 ? 'colony' : 'colonies'}
            </p>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)' }}
            onClick={() => {
              localStorage.removeItem(`hivelog_walkSession_${yardId}`);
              navigate(`/yard/${yardId}`, { replace: true });
            }}
          >
            Back to Yard
          </button>
        </div>
      </div>
    );
  }

  const colony = colonies[currentIndex];

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(`/yard/${yardId}`, { replace: true })}>←</button>
        <h1>Walk Yard</h1>
      </div>

      {/* Progress indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
        padding: 'var(--space-md)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}>
        <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
          {colony.label}
        </span>
        <span style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)' }}>
          Hive {currentIndex + 1} of {colonies.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8,
        backgroundColor: 'var(--color-border)',
        borderRadius: 4,
        marginBottom: 'var(--space-xl)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${((currentIndex) / colonies.length) * 100}%`,
          backgroundColor: 'var(--color-accent)',
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Event type grid */}
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

      {/* Notes */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any observations..."
          rows={2}
        />
      </div>

      {/* Treatment form */}
      {selectedType === 'treatment' && (
        <>
          {currentIndex > 0 && treatmentDetails.product_name && !showTreatmentForm ? (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              border: '2px solid var(--color-accent)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-md)',
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-body)' }}>
                  Same treatment: {treatmentDetails.product_name}
                </span>
                {treatmentDetails.dosage && (
                  <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-sm)' }}>
                    — {treatmentDetails.dosage}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: 'auto', minHeight: 44, padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-body)' }}
                onClick={() => setShowTreatmentForm(true)}
              >
                Change
              </button>
            </div>
          ) : (
            <TreatmentForm value={treatmentDetails} onChange={setTreatmentDetails} />
          )}
        </>
      )}

      {/* Action buttons — fixed to bottom */}
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
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 2, height: '72px', fontSize: 'var(--font-xl)' }}
              onClick={handleSave}
              disabled={!selectedType || saving || (selectedType === 'treatment' && !treatmentDetails.product_name)}
            >
              {saving ? 'Saving...' : 'Save & Next'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, height: '72px', fontSize: 'var(--font-lg)' }}
              onClick={handleSkip}
            >
              Skip
            </button>
          </div>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', height: '56px', fontSize: 'var(--font-body)' }}
            onClick={handleDone}
          >
            Done (finish early)
          </button>
        </div>
      </div>

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

      <QueenModal
        isOpen={queenModal}
        queen={null}
        onSave={async (queenData) => {
          const colonyId = pendingAdvanceColonyId;
          const newQueen = { colony_id: colonyId, ...queenData };
          try {
            const { error: insertError } = await supabase
              .from('queens')
              .insert(newQueen);
            if (insertError) throw insertError;
          } catch {
            const tempId = crypto.randomUUID();
            await addToQueue({ table: 'queens', operation: 'insert', data: { id: tempId, ...newQueen, created_at: new Date().toISOString() } });
          }
          setQueenModal(false);
          setPendingAdvanceColonyId(null);
          if (onToast) onToast('New queen recorded');
          advance();
        }}
        onCancel={() => {
          setQueenModal(false);
          setPendingAdvanceColonyId(null);
          advance();
        }}
      />
    </div>
  );
}
