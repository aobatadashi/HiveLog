import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheSet, cacheGet } from '../lib/cache.js';
import ColonyCard, { getStatusColor } from '../components/ColonyCard.jsx';
import YardEventRow from '../components/YardEventRow.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function YardView({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const [yard, setYard] = useState(null);
  const [colonies, setColonies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // Single add
  const [newLabel, setNewLabel] = useState('');
  // Batch add
  const [batchMode, setBatchMode] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchCount, setBatchCount] = useState('');
  const [addingBatch, setAddingBatch] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('hivelog_colonySort') || 'label');
  const [queenSet, setQueenSet] = useState(new Set());
  const [withdrawalMap, setWithdrawalMap] = useState({});
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showBatchTransfer, setShowBatchTransfer] = useState(false);
  const [batchYards, setBatchYards] = useState([]);
  const [batchTransferring, setBatchTransferring] = useState(false);
  const [showEditYard, setShowEditYard] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editHiveCount, setEditHiveCount] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [yardEvents, setYardEvents] = useState([]);
  const [yardEventsExpanded, setYardEventsExpanded] = useState(false);
  const [yardEventsHasMore, setYardEventsHasMore] = useState(false);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);

  function setSearch(value) {
    if (value) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*')
        .eq('id', id)
        .single();

      if (yardError) throw yardError;
      setYard(yardData);

      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('*')
        .eq('yard_id', id)
        .order('created_at', { ascending: true });

      if (colonyError) throw colonyError;

      // Single query: fetch the most recent event (any type) per colony in this yard
      const colonyIds = (colonyData || []).map((c) => c.id);
      const lastEventByColony = {};

      if (colonyIds.length > 0) {
        const { data: events } = await supabase
          .from('events')
          .select('colony_id, created_at')
          .in('colony_id', colonyIds)
          .order('created_at', { ascending: false })
          .limit(colonyIds.length * 2);

        for (const evt of (events || [])) {
          if (!lastEventByColony[evt.colony_id]) {
            lastEventByColony[evt.colony_id] = evt.created_at;
          }
        }
      }

      // Fetch active queens for colonies in this yard
      const activeQueenColonyIds = new Set();
      if (colonyIds.length > 0) {
        const { data: queenData } = await supabase
          .from('queens')
          .select('colony_id')
          .eq('status', 'active')
          .in('colony_id', colonyIds);
        for (const q of (queenData || [])) {
          activeQueenColonyIds.add(q.colony_id);
        }
      }
      setQueenSet(activeQueenColonyIds);

      // Fetch active withdrawals for colonies in this yard
      const wdMap = {};
      if (colonyIds.length > 0) {
        const { data: treatmentEvents } = await supabase
          .from('events')
          .select('id, colony_id, created_at')
          .eq('type', 'treatment')
          .in('colony_id', colonyIds)
          .order('created_at', { ascending: false });

        if (treatmentEvents && treatmentEvents.length > 0) {
          const treatmentIds = treatmentEvents.map((e) => e.id);
          const { data: tdData } = await supabase
            .from('treatment_details')
            .select('event_id, withdrawal_period_days')
            .in('event_id', treatmentIds);

          const tdByEvent = {};
          for (const td of (tdData || [])) {
            tdByEvent[td.event_id] = td;
          }

          const now = new Date();
          for (const evt of treatmentEvents) {
            const td = tdByEvent[evt.id];
            if (td && td.withdrawal_period_days > 0) {
              const end = new Date(new Date(evt.created_at).getTime() + td.withdrawal_period_days * 86400000);
              if (end > now && !wdMap[evt.colony_id]) {
                const daysLeft = Math.ceil((end - now) / 86400000);
                wdMap[evt.colony_id] = { treatmentDate: evt.created_at, withdrawalDays: td.withdrawal_period_days, daysLeft };
              }
            }
          }
        }
      }
      setWithdrawalMap(wdMap);

      const coloniesWithEvents = (colonyData || []).map((colony) => ({
        ...colony,
        last_event: lastEventByColony[colony.id] || null,
      }));

      setColonies(coloniesWithEvents);
      await cacheSet('colonies', id, { yard: yardData, colonies: coloniesWithEvents });

      // Fetch yard-level events
      const PAGE_SIZE = 20;
      const { data: yardEventData } = await supabase
        .from('yard_events')
        .select('*, related_yard:yards!yard_events_related_yard_id_fkey(name)')
        .eq('yard_id', id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);

      const events = yardEventData || [];
      setYardEventsHasMore(events.length > PAGE_SIZE);
      setYardEvents(events.slice(0, PAGE_SIZE));
    } catch {
      const cached = await cacheGet('colonies', id);
      if (cached) {
        setYard(cached.yard);
        setColonies(cached.colonies);
      } else {
        setError('Failed to load yard data');
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddColony(e) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const colonyData = {
      yard_id: id,
      label: newLabel.trim(),
      status: 'active',
    };

    try {
      const { data, error: insertError } = await supabase
        .from('colonies')
        .insert(colonyData)
        .select()
        .single();

      if (insertError) throw insertError;

      setColonies((prev) => [...prev, { ...data, last_event: null }]);
    } catch (err) {
      if (err?.code === '23505') {
        setError('A colony with that label already exists in this yard');
        return;
      }
      if (!navigator.onLine) {
        await addToQueue({ table: 'colonies', operation: 'insert', data: colonyData });
        const optimisticColony = {
          ...colonyData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          last_event: null,
        };
        setColonies((prev) => {
          const updated = [...prev, optimisticColony];
          cacheSet('colonies', id, { yard, colonies: updated });
          return updated;
        });
      } else {
        setError(err?.message || 'Failed to add colony');
        return;
      }
    }

    setNewLabel('');
    setShowAdd(false);
    setError('');
  }

  async function handleBatchAdd(e) {
    e.preventDefault();
    const count = parseInt(batchCount, 10);
    if (!batchPrefix.trim() || !count || count < 1 || count > 200) return;

    setAddingBatch(true);
    const padLen = String(count).length < 3 ? 3 : String(count).length;

    const coloniesToInsert = [];
    for (let i = 1; i <= count; i++) {
      coloniesToInsert.push({
        yard_id: id,
        label: `${batchPrefix.trim()}${String(i).padStart(padLen, '0')}`,
        status: 'active',
      });
    }

    try {
      const { data, error: insertError } = await supabase
        .from('colonies')
        .insert(coloniesToInsert)
        .select();

      if (insertError) throw insertError;

      const newColonies = (data || []).map((c) => ({ ...c, last_event: null }));
      setColonies((prev) => [...prev, ...newColonies]);
    } catch (err) {
      if (!navigator.onLine) {
        for (const col of coloniesToInsert) {
          await addToQueue({ table: 'colonies', operation: 'insert', data: col });
        }
        const optimisticColonies = coloniesToInsert.map((col) => ({
          ...col,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          last_event: null,
        }));
        setColonies((prev) => {
          const updated = [...prev, ...optimisticColonies];
          cacheSet('colonies', id, { yard, colonies: updated });
          return updated;
        });
      } else {
        setError(err?.message || 'Failed to add colonies');
        setAddingBatch(false);
        return;
      }
    }

    setAddingBatch(false);
    setBatchPrefix('');
    setBatchCount('');
    setShowAdd(false);
    setError('');
  }

  function closeModal() {
    setShowAdd(false);
    setBatchMode(false);
    setNewLabel('');
    setBatchPrefix('');
    setBatchCount('');
  }

  async function loadMoreYardEvents() {
    if (loadingMoreEvents || yardEvents.length === 0) return;
    setLoadingMoreEvents(true);
    const PAGE_SIZE = 20;
    const lastEvent = yardEvents[yardEvents.length - 1];
    try {
      const { data } = await supabase
        .from('yard_events')
        .select('*, related_yard:yards!yard_events_related_yard_id_fkey(name)')
        .eq('yard_id', id)
        .lt('created_at', lastEvent.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);

      const events = data || [];
      setYardEventsHasMore(events.length > PAGE_SIZE);
      setYardEvents((prev) => [...prev, ...events.slice(0, PAGE_SIZE)]);
    } catch {
      // Silently fail — user can retry
    }
    setLoadingMoreEvents(false);
  }

  function openEditYard() {
    setEditName(yard?.name || '');
    setEditLocation(yard?.location_note || '');
    setEditHiveCount(String(yard?.hive_count || 0));
    setShowEditYard(true);
  }

  async function handleSaveYard(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    const updates = {
      name: editName.trim(),
      location_note: editLocation.trim() || null,
      hive_count: parseInt(editHiveCount, 10) || 0,
    };
    try {
      const { error: updateError } = await supabase
        .from('yards')
        .update(updates)
        .eq('id', id);
      if (updateError) throw updateError;
    } catch (err) {
      if (err?.code === '23505') {
        setError('A yard with that name already exists');
        setEditSaving(false);
        return;
      }
      await addToQueue({ table: 'yards', operation: 'update', data: { id, ...updates } });
    }
    setYard((prev) => ({ ...prev, ...updates }));
    setShowEditYard(false);
    setEditSaving(false);
  }

  function handleDeleteYard() {
    setShowEditYard(false);
    setConfirmModal({
      title: 'Delete Yard?',
      message: `This will permanently delete "${yard?.name}" and all its colonies, events, and yard log entries. This cannot be undone.`,
      confirmLabel: 'Delete Yard',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const { error: deleteError } = await supabase
            .from('yards')
            .delete()
            .eq('id', id);
          if (deleteError) throw deleteError;
        } catch {
          await addToQueue({ table: 'yards', operation: 'delete', data: { id } });
        }
        navigate('/', { replace: true });
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  async function handleDeleteYardEvent(event) {
    // Calculate count reversal
    let countDelta = 0;
    const c = event.count || 0;
    if (event.type === 'split_out' || event.type === 'transfer_out' || event.type === 'loss') {
      countDelta = c; // add back
    } else if (event.type === 'split_in' || event.type === 'transfer_in' || event.type === 'addition') {
      countDelta = -c; // remove
    }

    try {
      const { error: delErr } = await supabase
        .from('yard_events')
        .delete()
        .eq('id', event.id);
      if (delErr) throw delErr;

      // Delete paired event if exists
      if (event.pair_id) {
        await supabase
          .from('yard_events')
          .delete()
          .eq('pair_id', event.pair_id)
          .neq('id', event.id);
      }

      // Reverse the hive count change
      if (countDelta !== 0 && yard) {
        const newCount = Math.max(0, (yard.hive_count || 0) + countDelta);
        const { error: updateErr } = await supabase
          .from('yards')
          .update({ hive_count: newCount })
          .eq('id', id);
        if (updateErr) throw updateErr;
        setYard((prev) => ({ ...prev, hive_count: newCount }));
      }

      // Also reverse the paired yard's count
      if (event.pair_id && event.related_yard_id && countDelta !== 0) {
        const pairedDelta = -countDelta;
        const { data: relatedYard } = await supabase
          .from('yards')
          .select('hive_count')
          .eq('id', event.related_yard_id)
          .single();
        if (relatedYard) {
          await supabase
            .from('yards')
            .update({ hive_count: Math.max(0, (relatedYard.hive_count || 0) + pairedDelta) })
            .eq('id', event.related_yard_id);
        }
      }
    } catch {
      await addToQueue({ table: 'yard_events', operation: 'delete', data: { id: event.id } });
      if (countDelta !== 0 && yard) {
        const newCount = Math.max(0, (yard.hive_count || 0) + countDelta);
        await addToQueue({ table: 'yards', operation: 'update', data: { id, hive_count: newCount } });
        setYard((prev) => ({ ...prev, hive_count: newCount }));
      }
    }

    setYardEvents((prev) => prev.filter((e) => e.id !== event.id));
  }

  function handleSelectAll(visibleColonies) {
    if (selected.size === visibleColonies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleColonies.map((c) => c.id)));
    }
  }

  async function openBatchTransferModal() {
    try {
      const { data: yardData } = await supabase
        .from('yards')
        .select('id, name')
        .order('name');
      setBatchYards((yardData || []).filter((y) => y.id !== id));
    } catch {
      const cached = await cacheGet('yards', 'all');
      if (cached) {
        setBatchYards((cached || []).filter((y) => y.id !== id));
      }
    }
    setShowBatchTransfer(true);
  }

  async function handleBatchTransfer(destYard) {
    setBatchTransferring(true);
    const originName = yard?.name || 'Unknown';
    const colonyIds = [...selected];

    for (const colonyId of colonyIds) {
      const eventData = {
        id: crypto.randomUUID(),
        colony_id: colonyId,
        type: 'transfer',
        notes: `Transferred from ${originName} to ${destYard.name}`,
        logged_by: user.id,
      };
      const updateData = { id: colonyId, yard_id: destYard.id };

      try {
        const { error: updateError } = await supabase
          .from('colonies')
          .update({ yard_id: destYard.id })
          .eq('id', colonyId);
        if (updateError) throw updateError;

        const { error: eventError } = await supabase
          .from('events')
          .insert(eventData);
        if (eventError) throw eventError;
      } catch {
        await addToQueue({ table: 'colonies', operation: 'update', data: updateData });
        await addToQueue({ table: 'events', operation: 'insert', data: eventData });
      }
    }

    setBatchTransferring(false);
    setShowBatchTransfer(false);
    setSelectMode(false);
    setSelected(new Set());
    fetchData();
  }

  const activeCount = colonies.filter((c) => c.status !== 'deadout').length;

  const STATUS_ORDER = { red: 0, yellow: 1, green: 2, grey: 3 };
  const filteredColonies = useMemo(() => {
    let result = colonies;
    if (filter === 'active') {
      result = result.filter((c) => c.status !== 'deadout');
    } else if (filter === 'attention') {
      result = result.filter((c) => {
        if (c.status === 'deadout') return false;
        const color = getStatusColor(c);
        return color === 'yellow' || color === 'red';
      });
    } else if (filter === 'deadout') {
      result = result.filter((c) => c.status === 'deadout');
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((c) => c.label.toLowerCase().includes(q));
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'label') {
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'activity') {
        if (!a.last_event && !b.last_event) return 0;
        if (!a.last_event) return 1;
        if (!b.last_event) return -1;
        return new Date(b.last_event) - new Date(a.last_event);
      }
      if (sortBy === 'status') {
        const aOrder = a.status === 'deadout' ? -1 : (STATUS_ORDER[getStatusColor(a)] ?? 4);
        const bOrder = b.status === 'deadout' ? -1 : (STATUS_ORDER[getStatusColor(b)] ?? 4);
        return aOrder - bOrder;
      }
      return 0;
    });

    return result;
  }, [colonies, filter, search, sortBy]);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <h1>{yard?.name || 'Yard'}</h1>
        {yard && (
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', minHeight: 44, padding: 'var(--space-sm) var(--space-md)' }}
            onClick={openEditYard}
          >
            Edit
          </button>
        )}
      </div>

      {yard?.location_note && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)', marginTop: 'calc(-1 * var(--space-md))' }}>
          {yard.location_note}
        </p>
      )}

      {/* Hive count display for bulk yards */}
      {yard && (yard.hive_count > 0) && (
        <p style={{
          fontSize: 'var(--font-2xl, 28px)',
          fontWeight: 700,
          color: 'var(--color-accent)',
          marginBottom: 'var(--space-lg)',
        }}>
          {yard.hive_count.toLocaleString()} hives
        </p>
      )}

      {/* Yard-level event logging — always available */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button
          className="btn btn-primary"
          style={{
            width: '100%',
            height: '72px',
            fontSize: 'var(--font-lg)',
            marginBottom: 'var(--space-sm)',
          }}
          onClick={() => navigate(`/yard-log/${id}`)}
        >
          Log Yard Event
        </button>
      </div>

      {/* Yard event history */}
      {yardEvents.length > 0 && (
        <div style={{
          marginBottom: 'var(--space-lg)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-md) var(--space-lg)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-sm)',
          }}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>Yard Log</h3>
            {yardEvents.length > 5 && (
              <button
                onClick={() => setYardEventsExpanded(!yardEventsExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent)',
                  fontSize: 'var(--font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                  padding: 'var(--space-sm)',
                }}
              >
                {yardEventsExpanded ? 'Show less' : `Show all (${yardEvents.length}${yardEventsHasMore ? '+' : ''})`}
              </button>
            )}
          </div>

          {/* Net change summary */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayEvents = yardEvents.filter((e) => new Date(e.created_at) >= today);
            if (todayEvents.length === 0) return null;

            const changes = [];
            let net = 0;
            for (const e of todayEvents) {
              const c = e.count || 0;
              if (e.type === 'split_in' || e.type === 'transfer_in' || e.type === 'addition') {
                net += c;
                if (c > 0) changes.push(`+${c} ${e.type === 'split_in' ? 'splits in' : e.type === 'transfer_in' ? 'moved in' : 'added'}`);
              } else if (e.type === 'split_out' || e.type === 'transfer_out' || e.type === 'loss') {
                net -= c;
                if (c > 0) changes.push(`-${c} ${e.type === 'loss' ? 'losses' : e.type === 'split_out' ? 'splits out' : 'moved out'}`);
              }
            }
            if (changes.length === 0) return null;

            return (
              <p style={{
                fontSize: 'var(--font-body)',
                color: net >= 0 ? 'var(--color-status-green, #2e7d32)' : 'var(--color-danger, #c62828)',
                fontWeight: 600,
                marginBottom: 'var(--space-sm)',
              }}>
                Today: {changes.join(', ')}
              </p>
            );
          })()}

          {(yardEventsExpanded ? yardEvents : yardEvents.slice(0, 5)).map((event) => (
            <YardEventRow key={event.id} event={event} onDelete={handleDeleteYardEvent} />
          ))}

          {yardEventsExpanded && yardEventsHasMore && (
            <button
              className="btn btn-secondary"
              style={{
                width: '100%',
                marginTop: 'var(--space-md)',
                minHeight: 48,
              }}
              onClick={loadMoreYardEvents}
              disabled={loadingMoreEvents}
            >
              {loadingMoreEvents ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      )}

      {/* Colony-level event logging buttons */}
      {colonies.length > 0 && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button
              className="btn btn-primary"
              style={{
                flex: 1,
                height: '72px',
                fontSize: 'var(--font-lg)',
              }}
              onClick={() => navigate(`/log-yard/${id}`)}
            >
              Log All ({activeCount})
            </button>
            <button
              className="btn btn-secondary"
              style={{
                flex: 1,
                height: '72px',
                fontSize: 'var(--font-lg)',
              }}
              onClick={() => navigate(`/walk/${id}`)}
            >
              Walk Yard
            </button>
          </div>
          {search && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-sm)' }}>
              Logs for all {activeCount} active colonies, not just search results
            </p>
          )}
          {!selectMode ? (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-sm)', height: '56px', fontSize: 'var(--font-body)' }}
              onClick={() => setSelectMode(true)}
            >
              Select Hives to Move
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)' }}
                onClick={() => {
                  setSelectMode(false);
                  setSelected(new Set());
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)' }}
                onClick={() => handleSelectAll(filteredColonies)}
              >
                {selected.size === filteredColonies.length ? 'Deselect All' : `Select All (${filteredColonies.length})`}
              </button>
              {selected.size > 0 && (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)', backgroundColor: 'var(--color-status-green)', border: 'none' }}
                  onClick={openBatchTransferModal}
                >
                  Move ({selected.size})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && colonies.length > 0 && (
        <>
          <div className="search-wrap">
            <input
              type="text"
              placeholder="Search colonies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>

          {/* Filter chips */}
          {(() => {
            const allCount = colonies.length;
            const activeCount2 = colonies.filter((c) => c.status !== 'deadout').length;
            const needsAttentionCount = colonies.filter((c) => {
              if (c.status === 'deadout') return false;
              const color = getStatusColor(c);
              return color === 'yellow' || color === 'red';
            }).length;
            const deadOutCount = colonies.filter((c) => c.status === 'deadout').length;

            const chips = [
              { key: 'all', label: `All ${allCount}` },
              { key: 'active', label: `Active ${activeCount2}` },
              { key: 'attention', label: `Attention ${needsAttentionCount}` },
              { key: 'deadout', label: `Dead ${deadOutCount}` },
            ];

            return (
              <div style={{
                display: 'flex',
                gap: 'var(--space-sm)',
                overflowX: 'auto',
                paddingBottom: 'var(--space-sm)',
                marginBottom: 'var(--space-md)',
                WebkitOverflowScrolling: 'touch',
              }}>
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setFilter(chip.key)}
                    style={{
                      minHeight: 56,
                      padding: 'var(--space-sm) var(--space-lg)',
                      borderRadius: 'var(--radius-md)',
                      border: filter === chip.key
                        ? '2px solid var(--color-accent)'
                        : '2px solid var(--color-border)',
                      backgroundColor: filter === chip.key
                        ? 'var(--color-accent)'
                        : 'var(--color-surface)',
                      color: filter === chip.key
                        ? 'var(--color-accent-text)'
                        : 'var(--color-text)',
                      fontSize: 'var(--font-body)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Sort buttons */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-lg)',
          }}>
            {[
              { key: 'label', label: 'Label' },
              { key: 'activity', label: 'Last Activity' },
              { key: 'status', label: 'Status' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setSortBy(opt.key);
                  localStorage.setItem('hivelog_colonySort', opt.key);
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-sm)',
                  border: sortBy === opt.key
                    ? '2px solid var(--color-accent)'
                    : '2px solid var(--color-border)',
                  backgroundColor: sortBy === opt.key
                    ? 'var(--color-accent)'
                    : 'var(--color-surface)',
                  color: sortBy === opt.key
                    ? 'var(--color-accent-text)'
                    : 'var(--color-text)',
                  fontSize: 'var(--font-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : colonies.length === 0 ? (
        <div className="empty-state">
          <p>No colonies yet</p>
          <p>Tap + to add your first hive</p>
        </div>
      ) : filteredColonies.length === 0 ? (
        <div className="empty-state">
          <p>No colonies match{search ? ` "${search}"` : ' this filter'}</p>
        </div>
      ) : (
        filteredColonies.map((colony, idx) => {
          const nextColony = filteredColonies[idx + 1] || null;
          return (
            <div
              key={colony.id}
              onClick={() => {
                if (selectMode) {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(colony.id)) next.delete(colony.id);
                    else next.add(colony.id);
                    return next;
                  });
                } else {
                  navigate(`/hive/${colony.id}`, {
                    state: nextColony
                      ? { nextColonyId: nextColony.id, nextColonyLabel: nextColony.label }
                      : undefined,
                  });
                }
              }}
              style={selectMode ? {
                position: 'relative',
                border: selected.has(colony.id) ? '3px solid var(--color-accent)' : '3px solid transparent',
                borderRadius: 'var(--radius-md)',
                transition: 'border-color 0.1s',
              } : undefined}
            >
              {selectMode && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '3px solid var(--color-accent)',
                  backgroundColor: selected.has(colony.id) ? 'var(--color-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}>
                  {selected.has(colony.id) && (
                    <span style={{ color: 'var(--color-accent-text)', fontWeight: 700, fontSize: 16 }}>✓</span>
                  )}
                </div>
              )}
              <ColonyCard
                colony={colony}
                hasQueen={queenSet.has(colony.id)}
                activeWithdrawal={withdrawalMap[colony.id] || null}
                onClick={selectMode ? undefined : () =>
                  navigate(`/hive/${colony.id}`, {
                    state: nextColony
                      ? { nextColonyId: nextColony.id, nextColonyLabel: nextColony.label }
                      : undefined,
                  })
                }
              />
            </div>
          );
        })
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add colony">
        +
      </button>

      {showAdd && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Colony</h2>

            {/* Batch toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
            }}>
              <span style={{ fontWeight: 600 }}>Batch Add</span>
              <button
                type="button"
                onClick={() => {
                  const next = !batchMode;
                  setBatchMode(next);
                  if (next) setBatchCount('48');
                }}
                style={{
                  width: 56,
                  height: 32,
                  borderRadius: 16,
                  border: 'none',
                  backgroundColor: batchMode ? 'var(--color-accent)' : 'var(--color-border)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  minHeight: 'auto',
                  minWidth: 'auto',
                  padding: 0,
                }}
              >
                <span style={{
                  display: 'block',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  position: 'absolute',
                  top: 3,
                  left: batchMode ? 27 : 3,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>

            {batchMode ? (
              <form onSubmit={handleBatchAdd}>
                <div className="form-group">
                  <label>Prefix</label>
                  <input
                    type="text"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    placeholder='e.g., H-'
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Count (1–200)</label>
                  <input
                    type="number"
                    value={batchCount}
                    onChange={(e) => setBatchCount(e.target.value)}
                    placeholder="48"
                    min="1"
                    max="200"
                    inputMode="numeric"
                  />
                </div>
                {batchPrefix && batchCount && parseInt(batchCount, 10) > 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Will create: {batchPrefix.trim()}001 … {batchPrefix.trim()}{String(Math.min(parseInt(batchCount, 10), 200)).padStart(3, '0')}
                  </p>
                )}
                {error && <p className="error-msg">{error}</p>}
                <div className="btn-row">
                  <button type="button" className="btn btn-secondary" onClick={() => { closeModal(); setError(''); }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!batchPrefix.trim() || !batchCount || parseInt(batchCount, 10) < 1 || addingBatch}
                  >
                    {addingBatch ? 'Adding...' : `Add ${batchCount || 0}`}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddColony}>
                <div className="form-group">
                  <label>Hive Label</label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => { setNewLabel(e.target.value); setError(''); }}
                    placeholder='e.g., Hive 12'
                    autoFocus
                  />
                </div>
                {error && <p className="error-msg">{error}</p>}
                <div className="btn-row">
                  <button type="button" className="btn btn-secondary" onClick={() => { closeModal(); setError(''); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!newLabel.trim()}>
                    Add
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showBatchTransfer && (
        <div className="modal-overlay" onClick={() => setShowBatchTransfer(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Move {selected.size} {selected.size === 1 ? 'Hive' : 'Hives'}</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Select destination yard
            </p>
            {batchYards.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No other yards available</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {batchYards.map((y) => (
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
                    onClick={() => handleBatchTransfer(y)}
                    disabled={batchTransferring}
                  >
                    {batchTransferring ? 'Moving...' : y.name}
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'var(--space-lg)' }}
              onClick={() => setShowBatchTransfer(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Yard Modal */}
      {showEditYard && (
        <div className="modal-overlay" onClick={() => setShowEditYard(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Yard</h2>
            <form onSubmit={handleSaveYard}>
              <div className="form-group">
                <label>Yard Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., Archer B Supply"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Number of Hives</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editHiveCount}
                  onChange={(e) => setEditHiveCount(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              <div className="form-group">
                <label>Location (optional)</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g., County Rd 45"
                />
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditYard(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!editName.trim() || editSaving}>
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
            <button
              className="btn btn-danger"
              style={{ width: '100%', marginTop: 'var(--space-lg)' }}
              onClick={handleDeleteYard}
            >
              Delete Yard
            </button>
          </div>
        </div>
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
