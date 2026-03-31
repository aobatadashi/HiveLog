import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { getAllFailed, removeFromFailed } from '../lib/offlineQueue.js';
import { exportAllEvents, exportColonyStatus, exportTreatmentLog } from '../lib/csvExport.js';
import ConfirmModal from '../components/ConfirmModal.jsx';

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
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [failedItems, setFailedItems] = useState([]);
  const [confirmDismiss, setConfirmDismiss] = useState(null);
  const errorTimerRef = useRef(null);

  function showError(msg) {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = setTimeout(() => setError(''), 5000);
  }

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  async function refreshFailedItems() {
    try {
      const items = await getAllFailed();
      setFailedItems(items);
    } catch {
      // IndexedDB may be unavailable
    }
  }

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
      showError('Failed to load settings');
    }
    await refreshFailedItems();
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
          showError('A yard with that name already exists');
        } else {
          throw updateError;
        }
      } else {
        setYards((prev) =>
          prev.map((y) => (y.id === yardId ? { ...y, name: newName } : y))
        );
      }
    } catch {
      setYards((prev) =>
        prev.map((y) => (y.id === yardId ? { ...y, name: newName } : y))
      );
      await addToQueue({ table: 'yards', operation: 'update', data: { id: yardId, name: newName } });
      showError(navigator.onLine ? 'Failed to update yard name' : 'Saved offline — will sync when connected');
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
      showError(navigator.onLine ? 'Failed to update location note' : 'Saved offline — will sync when connected');
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
          showError('A colony with that label already exists in this yard');
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
      setColonies((prev) => ({
        ...prev,
        [yardId]: prev[yardId].map((c) =>
          c.id === colonyId ? { ...c, label: newLabel } : c
        ),
      }));
      await addToQueue({ table: 'colonies', operation: 'update', data: { id: colonyId, label: newLabel } });
      showError(navigator.onLine ? 'Failed to update hive label' : 'Saved offline — will sync when connected');
    }
    setSaving(null);
  }

  async function handleDeleteYard(yardId, yardName) {
    try {
      const { error: deleteError } = await supabase
        .from('yards')
        .delete()
        .eq('id', yardId);

      if (deleteError) throw deleteError;

      setYards((prev) => prev.filter((y) => y.id !== yardId));
      setColonies((prev) => {
        const next = { ...prev };
        delete next[yardId];
        return next;
      });
      setExpandedYards((prev) => {
        const next = new Set(prev);
        next.delete(yardId);
        return next;
      });
    } catch {
      showError(navigator.onLine ? 'Failed to delete yard' : 'Cannot delete while offline');
    }
    setConfirmDelete(null);
  }

  async function handleDeleteColony(colonyId, yardId) {
    try {
      const { error: deleteError } = await supabase
        .from('colonies')
        .delete()
        .eq('id', colonyId);

      if (deleteError) throw deleteError;

      setColonies((prev) => ({
        ...prev,
        [yardId]: prev[yardId].filter((c) => c.id !== colonyId),
      }));
    } catch {
      showError(navigator.onLine ? 'Failed to delete colony' : 'Cannot delete while offline');
    }
    setConfirmDelete(null);
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

      {/* ── Account ── */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h2 style={{ marginBottom: 'var(--space-lg)' }}>Account</h2>
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-xs)' }}>
            Phone number
          </p>
          <p style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>
            {user?.phone || 'Not available'}
          </p>
          <button
            className="btn btn-danger"
            style={{ width: '100%' }}
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Sync Errors ── */}
      {failedItems.length > 0 && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-danger, #c62828)' }}>
            Sync Errors ({failedItems.length})
          </h2>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: 'var(--space-lg)' }}
            onClick={async () => {
              for (const item of failedItems) {
                await addToQueue({ table: item.table, operation: item.operation, data: item.data });
                await removeFromFailed(item.id);
              }
              await refreshFailedItems();
            }}
          >
            Retry All ({failedItems.length})
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {failedItems.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{ padding: 'var(--space-md)' }}
              >
                <div style={{ marginBottom: 'var(--space-sm)' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-body)' }}>
                    {item.operation.toUpperCase()} → {item.table}
                  </span>
                </div>
                <p style={{
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-danger, #c62828)',
                  marginBottom: 'var(--space-md)',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}>
                  {item.errorMessage}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, minHeight: 'var(--touch-min)' }}
                    onClick={async () => {
                      await addToQueue({ table: item.table, operation: item.operation, data: item.data });
                      await removeFromFailed(item.id);
                      await refreshFailedItems();
                    }}
                  >
                    Retry
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1, minHeight: 'var(--touch-min)' }}
                    onClick={() => setConfirmDismiss(item)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Data Export ── */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
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
              try {
                const result = await exportAllEvents();
                if (!result.success) {
                  showError('No events to export');
                } else if (result.offline) {
                  showError('Exported from cached data — may be incomplete');
                }
              } catch {
                showError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'events' ? 'Exporting...' : 'Export All Events'}
          </button>
          <button
            className="btn btn-export"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('colonies');
              try {
                const result = await exportColonyStatus();
                if (!result.success) {
                  showError('No colonies to export');
                } else if (result.offline) {
                  showError('Exported from cached data — may be incomplete');
                }
              } catch {
                showError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'colonies' ? 'Exporting...' : 'Export Colony Status'}
          </button>
          <button
            className="btn btn-export"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting('treatments');
              try {
                const result = await exportTreatmentLog();
                if (!result.success) {
                  showError('No treatment records to export');
                } else if (result.offline) {
                  showError('Exported from cached data — may be incomplete');
                }
              } catch {
                showError('Export failed');
              }
              setExporting(null);
            }}
          >
            {exporting === 'treatments' ? 'Exporting...' : 'Export Treatment Log'}
          </button>
        </div>
      </div>

      {/* ── Yards & Hives Management ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-xl)' }}>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : yards.length === 0 ? (
          <div className="empty-state">
            <p>No yards to configure</p>
          </div>
        ) : (
          <div>
            <h2 style={{ marginBottom: 'var(--space-sm)' }}>Yards & Hives</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--font-body)' }}>
              Tap any underlined field to rename. Tap the trash icon to delete.
            </p>
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
                      aria-label={expandedYards.has(yard.id) ? 'Collapse yard' : 'Expand yard'}
                    >
                      {expandedYards.has(yard.id) ? '▼' : '▶'}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        type="text"
                        defaultValue={yard.name}
                        className="editable-input editable-input-name"
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== yard.name) {
                            handleYardNameChange(yard.id, e.target.value.trim());
                          }
                        }}
                      />
                      <input
                        type="text"
                        defaultValue={yard.location_note || ''}
                        placeholder="Add location note..."
                        className="editable-input editable-input-secondary"
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed !== (yard.location_note || '')) {
                            handleLocationNoteChange(yard.id, trimmed);
                          }
                        }}
                      />
                    </div>
                    {saving === yard.id && <span style={{ color: 'var(--color-text-secondary)' }}>Saving...</span>}
                    <button
                      className="btn-delete-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({ type: 'yard', id: yard.id, name: yard.name });
                      }}
                      aria-label={`Delete ${yard.name}`}
                    >
                      🗑
                    </button>
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
                            className="editable-input"
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value !== colony.label) {
                                handleColonyLabelChange(colony.id, yard.id, e.target.value.trim());
                              }
                            }}
                          />
                          {saving === colony.id && <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>Saving...</span>}
                          <button
                            className="btn-delete-sm"
                            onClick={() => setConfirmDelete({ type: 'colony', id: colony.id, yardId: yard.id, name: colony.label })}
                            aria-label={`Delete ${colony.label}`}
                          >
                            🗑
                          </button>
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
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete {confirmDelete.type === 'yard' ? 'Yard' : 'Colony'}?</h2>
            <p style={{ fontSize: 'var(--font-body)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
              {confirmDelete.type === 'yard'
                ? <>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This will permanently remove the yard, all its colonies, and all event history.</>
                : <>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This will permanently remove the colony and all its event history.</>
              }
            </p>
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-body)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>
              This action cannot be undone.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (confirmDelete.type === 'yard') {
                    handleDeleteYard(confirmDelete.id, confirmDelete.name);
                  } else {
                    handleDeleteColony(confirmDelete.id, confirmDelete.yardId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!confirmDismiss}
        title="Discard Change?"
        message="This will permanently discard this failed change. The data will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep"
        danger
        onConfirm={async () => {
          await removeFromFailed(confirmDismiss.id);
          setConfirmDismiss(null);
          await refreshFailedItems();
        }}
        onCancel={() => setConfirmDismiss(null)}
      />
    </div>
  );
}
