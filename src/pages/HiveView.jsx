import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheSet, cacheGet } from '../lib/cache.js';
import EventRow from '../components/EventRow.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import QueenInfo from '../components/QueenInfo.jsx';
import QueenModal from '../components/QueenModal.jsx';
import WithdrawalBadge from '../components/WithdrawalBadge.jsx';

const PAGE_SIZE = 50;

const TYPE_LABELS = {
  inspection: 'Inspection',
  treatment: 'Treatment',
  feed: 'Feed',
  split: 'Split',
  loss: 'Loss',
  requeen: 'Requeen',
  harvest: 'Harvest',
  transfer: 'Transfer',
};

export default function HiveView({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { nextColonyId, nextColonyLabel } = location.state || {};
  const [colony, setColony] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [queen, setQueen] = useState(null);
  const [queenModal, setQueenModal] = useState(false);
  const [treatmentDetailsMap, setTreatmentDetailsMap] = useState({});
  const [activeWithdrawal, setActiveWithdrawal] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [yards, setYards] = useState([]);
  const [transferring, setTransferring] = useState(false);

  const fetchEvents = useCallback(async (offset = 0) => {
    const { data, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('colony_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (eventError) throw eventError;
    return data || [];
  }, [id]);

  const fetchData = useCallback(async () => {
    try {
      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('*, yards(name)')
        .eq('id', id)
        .single();

      if (colonyError) throw colonyError;
      setColony(colonyData);

      const data = await fetchEvents(0);
      setEvents(data);
      setHasMore(data.length === PAGE_SIZE);

      // Fetch active queen
      const { data: queenData } = await supabase
        .from('queens')
        .select('*')
        .eq('colony_id', id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      setQueen(queenData || null);

      // Fetch treatment details for treatment events
      const treatmentEventIds = data.filter((e) => e.type === 'treatment').map((e) => e.id);
      const tdMap = {};
      if (treatmentEventIds.length > 0) {
        const { data: tdData } = await supabase
          .from('treatment_details')
          .select('*')
          .in('event_id', treatmentEventIds);
        if (tdData) {
          for (const td of tdData) tdMap[td.event_id] = td;
        }
      }
      setTreatmentDetailsMap(tdMap);

      // Find most recent active withdrawal for header badge
      const now = new Date();
      let latestWithdrawal = null;
      for (const evt of data) {
        const td = tdMap[evt.id];
        if (td && td.withdrawal_period_days > 0) {
          const end = new Date(new Date(evt.created_at).getTime() + td.withdrawal_period_days * 86400000);
          if (end > now && (!latestWithdrawal || end > latestWithdrawal.end)) {
            latestWithdrawal = { date: evt.created_at, days: td.withdrawal_period_days, end };
          }
        }
      }
      setActiveWithdrawal(latestWithdrawal);

      await cacheSet('events', id, { colony: colonyData, events: data, queen: queenData || null, treatmentDetails: tdMap });
    } catch {
      const cached = await cacheGet('events', id);
      if (cached) {
        setColony(cached.colony);
        setEvents(cached.events);
        setQueen(cached.queen || null);
        setTreatmentDetailsMap(cached.treatmentDetails || {});
        setHasMore(false);
      } else {
        setError('Failed to load hive data');
      }
    }
    setLoading(false);
  }, [id, fetchEvents]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchEvents(events.length);
      setEvents((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setError('Failed to load more events');
    }
    setLoadingMore(false);
  }

  function handleToggleStatus() {
    if (!colony) return;
    const newStatus = colony.status === 'deadout' ? 'active' : 'deadout';
    const label = colony.label || 'this colony';
    const msg = newStatus === 'deadout'
      ? `Mark ${label} as dead out?`
      : `Mark ${label} as active?`;

    setConfirmModal({
      title: newStatus === 'deadout' ? 'Mark Dead Out' : 'Reactivate Colony',
      message: msg,
      confirmLabel: newStatus === 'deadout' ? 'Mark Dead Out' : 'Reactivate',
      danger: newStatus === 'deadout',
      onConfirm: async () => {
        setConfirmModal(null);
        setTogglingStatus(true);
        try {
          const { error: updateError } = await supabase
            .from('colonies')
            .update({ status: newStatus })
            .eq('id', id);

          if (updateError) throw updateError;
        } catch {
          await addToQueue({
            table: 'colonies',
            operation: 'update',
            data: { id, status: newStatus },
          });
        }
        setColony((prev) => ({ ...prev, status: newStatus }));
        setTogglingStatus(false);
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  async function handleQueenSave(queenData) {
    const isEditing = Boolean(queen?.id);
    if (isEditing) {
      try {
        const { error: updateError } = await supabase
          .from('queens')
          .update(queenData)
          .eq('id', queen.id);
        if (updateError) throw updateError;
      } catch {
        await addToQueue({ table: 'queens', operation: 'update', data: { id: queen.id, ...queenData } });
      }
      setQueen((prev) => ({ ...prev, ...queenData }));
    } else {
      const newQueen = { colony_id: id, ...queenData };
      try {
        const { data: inserted, error: insertError } = await supabase
          .from('queens')
          .insert(newQueen)
          .select()
          .single();
        if (insertError) throw insertError;
        setQueen(inserted);
      } catch {
        const tempId = crypto.randomUUID();
        const withId = { id: tempId, ...newQueen, created_at: new Date().toISOString() };
        await addToQueue({ table: 'queens', operation: 'insert', data: withId });
        setQueen(withId);
      }
    }
    setQueenModal(false);
  }

  async function handleDeleteEvent(event) {
    try {
      // Delete treatment details first if exists
      if (treatmentDetailsMap[event.id]) {
        await supabase
          .from('treatment_details')
          .delete()
          .eq('event_id', event.id);
      }
      const { error: delErr } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);
      if (delErr) throw delErr;
    } catch {
      await addToQueue({ table: 'events', operation: 'delete', data: { id: event.id } });
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    setTreatmentDetailsMap((prev) => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function openTransferModal() {
    try {
      const { data: yardData } = await supabase
        .from('yards')
        .select('id, name')
        .order('name');
      setYards((yardData || []).filter((y) => y.id !== colony?.yard_id));
    } catch {
      const cached = await cacheGet('yards', 'all');
      if (cached) {
        setYards((cached || []).filter((y) => y.id !== colony?.yard_id));
      }
    }
    setShowTransfer(true);
  }

  async function handleTransfer(destYard) {
    setTransferring(true);
    const originYardName = colony?.yards?.name || 'Unknown';
    const eventData = {
      id: crypto.randomUUID(),
      colony_id: id,
      type: 'transfer',
      notes: `Transferred from ${originYardName} to ${destYard.name}`,
      logged_by: user.id,
    };
    const updateData = { id, yard_id: destYard.id };

    try {
      const { error: updateError } = await supabase
        .from('colonies')
        .update({ yard_id: destYard.id })
        .eq('id', id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase
        .from('events')
        .insert(eventData);
      if (eventError) throw eventError;
    } catch {
      await addToQueue({ table: 'colonies', operation: 'update', data: updateData });
      await addToQueue({ table: 'events', operation: 'insert', data: eventData });
    }

    setTransferring(false);
    setShowTransfer(false);
    navigate(`/yard/${colony?.yard_id || ''}`, { replace: true });
  }

  const isDeadout = colony?.status === 'deadout';

  return (
    <div className="page">
      <div className="page-header">
        <button
          className="back-btn"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <h1>{colony?.label || 'Hive'}</h1>
      </div>

      {colony && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          marginTop: 'calc(-1 * var(--space-md))',
        }}>
          {colony.yards?.name && (
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {colony.yards.name}
            </span>
          )}
          <button
            className="status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontWeight: 700,
              fontSize: 'var(--font-body)',
              cursor: 'pointer',
              minHeight: 'var(--touch-min)',
              backgroundColor: isDeadout ? '#ffebee' : '#e8f5e9',
              color: isDeadout ? 'var(--color-status-red)' : 'var(--color-status-green)',
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.1s ease',
            }}
            onClick={handleToggleStatus}
            disabled={togglingStatus}
          >
            <span style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: isDeadout ? 'var(--color-status-red)' : 'var(--color-status-green)',
              flexShrink: 0,
            }} />
            {togglingStatus ? '...' : isDeadout ? 'Dead Out' : 'Active'}
          </button>
          {activeWithdrawal && (
            <WithdrawalBadge
              treatmentDate={activeWithdrawal.date}
              withdrawalDays={activeWithdrawal.days}
            />
          )}
          <button
            onClick={openTransferModal}
            style={{
              marginLeft: 'auto',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              border: '2px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontWeight: 600,
              fontSize: 'var(--font-body)',
              cursor: 'pointer',
              minHeight: 'var(--touch-min)',
              whiteSpace: 'nowrap',
            }}
          >
            Move
          </button>
        </div>
      )}

      {colony && (
        <QueenInfo
          queen={queen}
          onEdit={() => setQueenModal(true)}
          onAdd={() => setQueenModal(true)}
        />
      )}

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No events logged yet</p>
          <p>Tap "Log Event" to record your first entry</p>
        </div>
      ) : (
        <div>
          {/* Filter chips — only show types that exist in loaded events */}
          {(() => {
            const availableTypes = [...new Set(events.map((e) => e.type))];
            if (availableTypes.length <= 1) return null;
            return (
              <div className="filter-chips">
                <button
                  className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    className={`filter-chip ${filterType === type ? 'active' : ''}`}
                    onClick={() => setFilterType(type)}
                  >
                    {TYPE_LABELS[type] || type}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* TODO: resolve logged_by UUIDs to display names via a profiles table */}
          {(filterType === 'all' ? events : events.filter((e) => e.type === filterType))
            .map((event) => (
              <EventRow
                key={event.id}
                event={event}
                treatmentDetail={treatmentDetailsMap[event.id]}
                loggedByName={event.logged_by ? `user ${event.logged_by.slice(0, 8)}\u2026` : null}
                onDelete={handleDeleteEvent}
              />
            ))}
          {hasMore && filterType === 'all' && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-md)' }}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-md) var(--space-lg)',
        background: 'linear-gradient(transparent, var(--color-bg) 20%)',
        paddingTop: 'var(--space-xl)',
      }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'block', height: '72px', fontSize: 'var(--font-xl)' }}
          onClick={() => navigate(`/log/${id}?yard=${colony?.yard_id || ''}`, {
            state: {
              ...(nextColonyId ? { nextColonyId, nextColonyLabel } : {}),
              ...(location.state?.lastEventType ? { lastEventType: location.state.lastEventType } : {}),
              colonyLabel: colony?.label,
              yardName: colony?.yards?.name,
            },
          })}
        >
          Log Event
        </button>
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
        queen={queen}
        onSave={handleQueenSave}
        onCancel={() => setQueenModal(false)}
      />

      {showTransfer && (
        <div className="modal-overlay" onClick={() => setShowTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Move to Yard</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Select destination yard for {colony?.label}
            </p>
            {yards.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No other yards available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {yards.map((y) => (
                  <button
                    key={y.id}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      minHeight: 56,
                      fontSize: 'var(--font-body)',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                    }}
                    onClick={() => handleTransfer(y)}
                    disabled={transferring}
                  >
                    {y.name}
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-lg)' }}
              onClick={() => setShowTransfer(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
