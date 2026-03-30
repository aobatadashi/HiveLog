import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { exportAllEvents, exportColonyStatus, exportTreatmentLog } from '../lib/csvExport.js';

export default function Settings({ user, onSignOut }) {
  const navigate = useNavigate();
  const [yards, setYards] = useState([]);
  const [colonies, setColonies] = useState({});
  const [expandedYards, setExpandedYards] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (yardError) throw yardError;
      setYards(yardData || []);
    } catch {
      setError('Failed to load settings');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function fetchColonies(yardId) {
    if (colonies[yardId]) return;

    const { data, error: colError } = await supabase
      .from('colonies')
      .select('*')
      .eq('yard_id', yardId)
      .order('created_at', { ascending: true });

    if (!colError) {
      setColonies((prev) => ({ ...prev, [yardId]: data || [] }));
    }
  }

  function toggleYard(yardId) {
    setExpandedYards((prev) => {
      const next = new Set(prev);
      if (next.has(yardId)) {
        next.delete(yardId);
      } else {
        next.add(yardId);
        fetchColonies(yardId);
      }
      return next;
    });
  }

  async function handleYardNameChange(yardId, newName) {
    setSaving(yardId);
    try {
      const { error: updateError } = await supabase
        .from('yards')
        .update({ name: newName })
        .eq('id', yardId);

      if (updateError) {
        if (updateError.code === '23505') {
          setError('A yard with that name already exists');
        } else {
          throw updateError;
        }
      } else {
        setYards((prev) =>
          prev.map((y) => (y.id === yardId ? { ...y, name: newName } : y))
        );
      }
    } catch {
      // Optimistic local update + queue for sync
      setYards((prev) =>
        prev.map((y) => (y.id === yardId ? { ...y, name: newName } : y))
      );
      await addToQueue({ table: 'yards', operation: 'update', data: { id: yardId, name: newName } });
      if (!navigator.onLine) {
        setError('Saved offline — will sync when connected');
      } else {
        setError('Failed to update yard name');
      }
    }
    setSaving(null);
  }

  async function handleLocationNoteChange(yardId, newNote) {
    setSaving(yardId);
    try {
      const { error: updateError } = await supabase
        .from('yards')
        .update({ location_note: newNote || null })
        .eq('id', yardId);
      if (updateError) throw updateError;
      setYards((prev) =>
        prev.map((y) => (y.id === yardId ? { ...y, location_note: newNote || null } : y))
      );
    } catch {
      setYards((prev) =>
        prev.map((y) => (y.id === yardId ? { ...y, location_note: newNote || null } : y))
      );
      await addToQueue({
        table: 'yards',
        operation: 'update',
        data: { id: yardId, location_note: newNote || null },
      });
      if (!navigator.onLine) {
        setError('Saved offline — will sync when connected');
      } else {
        setError('Failed to update location note');
      }
    }
    setSaving(null);
  }

  async function handleColonyLabelChange(colonyId, yardId, newLabel) {
    setSaving(colonyId);
    try {
      const { error: updateError } = await supabase
        .from('colonies')
        .update({ label: newLabel })
        .eq('id', colonyId);

      if (updateError) {
        if (updateError.code === '23505') {
          setError('A colony with that label already exists in this yard');
        } else {
          throw updateError;
        }
      } else {
        setColonies((prev) => ({
          ...prev,
          [yardId]: prev[yardId].map((c) =>
            c.id === colonyId ? { ...c, label: newLabel } : c
          ),
        }));
      }
    } catch {
      // Optimistic local update + queue for sync
      setColonies((prev) => ({
        ...prev,
        [yardId]: prev[yardId].map((c) =>
          c.id === colonyId ? { ...c, label: newLabel } : c
        ),
      }));
      await addToQueue({ table: 'colonies', operation: 'update', data: { id: colonyId, label: newLabel } });
      if (!navigator.onLine) {
        setError('Saved offline — will sync when connected');
      } else {
        setError('Failed to update hive label');
      }
    }
    setSaving(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ←
        </button>
        <h1>Settings</h1>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : yards.length === 0 ? (
        <div className="empty-state">
          <p>No yards to configure</p>
        </div>
      ) : (
        <div>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Yards & Hives</h2>
          {yards.length > 3 && (
            <div className="search-wrap" style={{ marginBottom: 'var(--space-lg)' }}>
              <input
                type="text"
                placeholder="Search yards..."
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
            const q = search.toLowerCase().trim();
            const filtered = q
              ? yards.filter((y) =>
                  y.name.toLowerCase().includes(q) ||
                  (y.location_note && y.location_note.toLowerCase().includes(q))
                )
              : yards;

            if (filtered.length === 0 && q) {
              return (
                <div className="empty-state">
                  <p>No yards match &ldquo;{search}&rdquo;</p>
                </div>
              );
            }

            return filtered.map((yard) => (
            <div key={yard.id} style={{ marginBottom: 'var(--space-md)' }}>
              <div
                className="card"
                style={{ marginBottom: expandedYards.has(yard.id) ? 0 : 'var(--space-md)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 'var(--font-xl)',
                      padding: 'var(--space-md)',
                      minWidth: '56px',
                      minHeight: '56px',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleYard(yard.id);
                    }}
                  >
                    {expandedYards.has(yard.id) ? '▼' : '▶'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      defaultValue={yard.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== yard.name) {
                          handleYardNameChange(yard.id, e.target.value.trim());
                        }
                      }}
                      style={{ width: '100%', border: 'none', fontSize: 'var(--font-lg)', fontWeight: 600, padding: 'var(--space-sm)' }}
                    />
                    <input
                      type="text"
                      defaultValue={yard.location_note || ''}
                      placeholder="Add location note..."
                      onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed !== (yard.location_note || '')) {
                          handleLocationNoteChange(yard.id, trimmed);
                        }
                      }}
                      style={{ width: '100%', border: 'none', fontSize: 'var(--font-body)', padding: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}
                    />
                  </div>
                  {saving === yard.id && <span style={{ color: 'var(--color-text-secondary)' }}>Saving...</span>}
                </div>
              </div>

              {expandedYards.has(yard.id) && (
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-md)',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  {!colonies[yard.id] ? (
                    <div className="loading"><div className="spinner" /></div>
                  ) : colonies[yard.id].length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md)' }}>
                      No colonies in this yard
                    </p>
                  ) : (
                    colonies[yard.id].map((colony) => (
                      <div
                        key={colony.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-md)',
                          padding: 'var(--space-sm) var(--space-md)',
                          minHeight: 'var(--touch-min)',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <input
                          type="text"
                          defaultValue={colony.label}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== colony.label) {
                              handleColonyLabelChange(colony.id, yard.id, e.target.value.trim());
                            }
                          }}
                          style={{ flex: 1, border: 'none', fontSize: 'var(--font-body)', padding: 'var(--space-sm)' }}
                        />
                        {saving === colony.id && <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>Saving...</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ));
          })()}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-2xl)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-xl)' }}>
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Data Export</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--font-body)' }}>
          Download your data as CSV files for compliance reporting or backup.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <button
            className="btn btn-export"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('events');
              setError('');
              try {
                const result = await exportAllEvents();
                if (!result.success) {
                  setError('No events to export');
                } else if (result.offline) {
                  setError('Exported from cached data — may be incomplete');
                }
              } catch {
                setError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'events' ? 'Exporting…' : 'Export All Events'}
          </button>
          <button
            className="btn btn-export"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('colonies');
              setError('');
              try {
                const result = await exportColonyStatus();
                if (!result.success) {
                  setError('No colonies to export');
                } else if (result.offline) {
                  setError('Exported from cached data — may be incomplete');
                }
              } catch {
                setError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'colonies' ? 'Exporting…' : 'Export Colony Status'}
          </button>
          <button
            className="btn btn-export"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('treatments');
              setError('');
              try {
                const result = await exportTreatmentLog();
                if (!result.success) {
                  setError('No treatment records to export');
                } else if (result.offline) {
                  setError('Exported from cached data — may be incomplete');
                }
              } catch {
                setError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'treatments' ? 'Exporting…' : 'Export Treatment Log'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-2xl)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-xl)' }}>
        <button
          className="btn btn-danger"
          style={{ width: '100%' }}
          onClick={onSignOut}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
