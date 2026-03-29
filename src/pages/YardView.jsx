import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheSet, cacheGet } from '../lib/cache.js';
import ColonyCard from '../components/ColonyCard.jsx';

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

      const coloniesWithEvents = (colonyData || []).map((colony) => ({
        ...colony,
        last_event: lastEventByColony[colony.id] || null,
      }));

      setColonies(coloniesWithEvents);
      await cacheSet('colonies', id, { yard: yardData, colonies: coloniesWithEvents });
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
    } catch {
      await addToQueue({ table: 'colonies', operation: 'insert', data: colonyData });
    }

    setNewLabel('');
    setShowAdd(false);
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
    } catch {
      for (const col of coloniesToInsert) {
        await addToQueue({ table: 'colonies', operation: 'insert', data: col });
      }
    }

    setAddingBatch(false);
    setBatchPrefix('');
    setBatchCount('');
    setShowAdd(false);
  }

  function closeModal() {
    setShowAdd(false);
    setBatchMode(false);
    setNewLabel('');
    setBatchPrefix('');
    setBatchCount('');
  }

  const activeCount = colonies.filter((c) => c.status !== 'deadout').length;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <h1>{yard?.name || 'Yard'}</h1>
      </div>

      {yard?.location_note && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', marginTop: 'calc(-1 * var(--space-md))' }}>
          {yard.location_note}
        </p>
      )}

      {/* Yard-wide event logging button */}
      {colonies.length > 0 && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '72px',
              fontSize: 'var(--font-xl)',
            }}
            onClick={() => navigate(`/log-yard/${id}`)}
          >
            Log Event for Yard ({activeCount})
          </button>
          {search && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-sm)' }}>
              Logs for all {activeCount} active colonies, not just search results
            </p>
          )}
        </div>
      )}

      {!loading && colonies.length > 0 && (
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
      )}

      {error && <p className="error-msg">{error}</p>}

      {(() => {
        const q = search.toLowerCase().trim();
        const filtered = q
          ? colonies.filter((c) => c.label.toLowerCase().includes(q))
          : colonies;

        if (loading) {
          return <div className="loading"><div className="spinner" /></div>;
        }
        if (colonies.length === 0) {
          return (
            <div className="empty-state">
              <p>No colonies yet</p>
              <p>Tap + to add your first hive</p>
            </div>
          );
        }
        if (filtered.length === 0) {
          return (
            <div className="empty-state">
              <p>No colonies match &ldquo;{search}&rdquo;</p>
            </div>
          );
        }
        return filtered.map((colony, idx) => {
          const nextColony = filtered[idx + 1] || null;
          return (
            <ColonyCard
              key={colony.id}
              colony={colony}
              onClick={() =>
                navigate(`/hive/${colony.id}`, {
                  state: nextColony
                    ? { nextColonyId: nextColony.id, nextColonyLabel: nextColony.label }
                    : undefined,
                })
              }
            />
          );
        });
      })()}

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
                <div className="btn-row">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
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
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder='e.g., Hive 12'
                    autoFocus
                  />
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
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
    </div>
  );
}
