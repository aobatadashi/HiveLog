import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheSet, cacheGet } from '../lib/cache.js';
import YardCard from '../components/YardCard.jsx';
import Onboarding from '../components/Onboarding.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function Home({ user }) {
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newHiveCount, setNewHiveCount] = useState('');
  const [search, setSearch] = useState('');
  const [filterAttention, setFilterAttention] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const navigate = useNavigate();

  const fetchYards = useCallback(async () => {
    // Stale-while-revalidate: show cached data immediately if available
    let hadCache = false;
    try {
      const cached = await cacheGet('yards', 'all');
      if (cached) {
        setYards(cached);
        setLoading(false);
        hadCache = true;
      }
    } catch {
      // Cache read failed — continue to network fetch
    }

    try {
      // Single query: yards with embedded colony IDs for counting
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*, colonies(id)')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (yardError) throw yardError;

      // One query for recent colony events + one for yard events
      const lastActivityByYard = {};
      if ((yardData || []).length > 0) {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEvents } = await supabase
          .from('events')
          .select('colony_id, created_at, colonies!inner(yard_id)')
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(1000);

        for (const evt of (recentEvents || [])) {
          const yardId = evt.colonies?.yard_id;
          if (yardId && !lastActivityByYard[yardId]) {
            lastActivityByYard[yardId] = evt.created_at;
          }
        }

        // Also check yard-level events for bulk yards
        const { data: recentYardEvents } = await supabase
          .from('yard_events')
          .select('yard_id, created_at')
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(1000);

        for (const evt of (recentYardEvents || [])) {
          const existing = lastActivityByYard[evt.yard_id];
          if (!existing || evt.created_at > existing) {
            lastActivityByYard[evt.yard_id] = evt.created_at;
          }
        }
      }

      const yardsWithStats = (yardData || []).map((yard) => ({
        ...yard,
        colony_count: yard.colonies?.length || 0,
        last_activity: lastActivityByYard[yard.id] || null,
      }));

      setYards(yardsWithStats);
      await cacheSet('yards', 'all', yardsWithStats);
    } catch {
      if (!hadCache) {
        // Only show error if we have nothing to display
        const cached = await cacheGet('yards', 'all');
        if (cached) {
          setYards(cached);
        } else {
          setError('Failed to load yards');
        }
      }
      // If hadCache is true, silently keep stale data
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchYards();
  }, [fetchYards]);

  async function handleAddYard(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    const hiveCount = parseInt(newHiveCount, 10) || 0;
    const yardData = {
      owner_id: user.id,
      name: newName.trim(),
      location_note: newLocation.trim() || null,
      hive_count: hiveCount,
    };

    let createdId = null;
    try {
      const { data, error: insertError } = await supabase
        .from('yards')
        .insert(yardData)
        .select()
        .single();

      if (insertError) throw insertError;

      createdId = data.id;
      setYards((prev) => [{ ...data, colony_count: 0, last_activity: null, hive_count: data.hive_count || 0 }, ...prev]);
    } catch (err) {
      if (err?.code === '23505') {
        setError('A yard with that name already exists');
        return;
      }
      // If offline, queue for later sync
      if (!navigator.onLine) {
        await addToQueue({ table: 'yards', operation: 'insert', data: yardData });
      } else {
        setError(err?.message || 'Failed to create yard');
        return;
      }
      const optimisticYard = {
        ...yardData,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        colony_count: 0,
        hive_count: hiveCount,
        last_activity: null,
      };
      createdId = optimisticYard.id;
      setYards((prev) => {
        const updated = [optimisticYard, ...prev];
        cacheSet('yards', 'all', updated);
        return updated;
      });
    }

    setNewName('');
    setNewLocation('');
    setNewHiveCount('');
    setShowAdd(false);
    if (createdId) navigate(`/yard/${createdId}`);
  }

  function handleDeleteYard(yard) {
    setConfirmModal({
      title: 'Delete Yard?',
      message: `This will permanently delete "${yard.name}" and all its colonies, events, and yard log entries.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const { error: delErr } = await supabase
            .from('yards')
            .delete()
            .eq('id', yard.id);
          if (delErr) throw delErr;
        } catch {
          await addToQueue({ table: 'yards', operation: 'delete', data: { id: yard.id } });
        }
        setYards((prev) => {
          const updated = prev.filter((y) => y.id !== yard.id);
          cacheSet('yards', 'all', updated);
          return updated;
        });
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  const totalHives = yards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colony_count || 0), 0);
  const totalYards = yards.length;
  const now = Date.now();
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const attentionYards = yards.filter(
    (y) => !y.last_activity || (now - new Date(y.last_activity).getTime()) > fourteenDays
  );
  const needsAttention = attentionYards.length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Yards</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/settings')}

        >
          Settings
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {!loading && yards.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
          fontSize: 'var(--font-body)',
          fontWeight: 600,
        }}>
          <span>{totalHives.toLocaleString()} {totalHives === 1 ? 'hive' : 'hives'}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>&middot;</span>
          <span>{totalYards} {totalYards === 1 ? 'yard' : 'yards'}</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>&middot;</span>
          {filterAttention ? (
            <button
              onClick={() => setFilterAttention(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                minHeight: '44px',
                cursor: 'pointer',
                fontSize: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--color-warning)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
              }}
              aria-label="Clear attention filter"
            >
              Showing {needsAttention} {needsAttention === 1 ? 'needs' : 'needing'} attention
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--color-warning)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                lineHeight: 1,
              }}>×</span>
            </button>
          ) : (
            <button
              onClick={() => setFilterAttention(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                minHeight: '44px',
                cursor: 'pointer',
                fontSize: 'var(--font-body)',
                fontWeight: 600,
                color: needsAttention > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              aria-label="Filter yards needing attention"
            >
              {needsAttention} {needsAttention === 1 ? 'needs' : 'need'} attention
            </button>
          )}
        </div>
      )}

      {!loading && yards.length > 0 && (
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Search yards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      )}

      {(() => {
        if (loading) {
          return <div className="loading"><div className="spinner" /></div>;
        }
        if (yards.length === 0) {
          const onboarded = localStorage.getItem('hivelog_onboarded');
          if (!onboarded) {
            return (
              <Onboarding
                user={user}
                onComplete={(createdYard) => {
                  if (createdYard) {
                    setYards([createdYard]);
                    navigate(`/yard/${createdYard.id}`);
                  }
                }}
              />
            );
          }
          return (
            <div className="empty-state">
              <p>No yards yet</p>
              <p>Tap + to add your first yard</p>
            </div>
          );
        }

        let filtered = yards;
        if (filterAttention) {
          filtered = filtered.filter(
            (y) => !y.last_activity || (now - new Date(y.last_activity).getTime()) > fourteenDays
          );
        }
        const q = search.toLowerCase().trim();
        if (q) {
          filtered = filtered.filter((y) =>
            y.name.toLowerCase().includes(q) ||
            (y.location_note && y.location_note.toLowerCase().includes(q))
          );
        }

        if (filtered.length === 0) {
          return (
            <div className="empty-state">
              <p>
                {filterAttention && q
                  ? <>No attention-needed yards match &ldquo;{search}&rdquo;</>
                  : filterAttention
                    ? 'No yards need attention right now'
                    : <>No yards match &ldquo;{search}&rdquo;</>
                }
              </p>
            </div>
          );
        }
        return filtered.map((yard) => <YardCard key={yard.id} yard={yard} onDelete={handleDeleteYard} />);
      })()}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add yard">
        +
      </button>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Yard</h2>
            <form onSubmit={handleAddYard}>
              <div className="form-group">
                <label>Yard Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Archer B Supply, Winfield Farm"
                  autoFocus
                />
                <span className="form-hint">Give your yard a name you'll recognize</span>
              </div>
              <div className="form-group">
                <label>Number of Hives</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newHiveCount}
                  onChange={(e) => setNewHiveCount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g., 216"
                />
                <span className="form-hint">How many hives are in this yard right now?</span>
              </div>
              <div className="form-group">
                <label>Location (optional)</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g., County Rd 45 behind the red barn"
                />
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
                  Add
                </button>
              </div>
            </form>
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
