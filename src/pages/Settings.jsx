import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';

export default function Settings({ user, onSignOut }) {
  const navigate = useNavigate();
  const [yards, setYards] = useState([]);
  const [colonies, setColonies] = useState({});
  const [expandedYard, setExpandedYard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*')
        .order('created_at', { ascending: true });

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
    if (expandedYard === yardId) {
      setExpandedYard(null);
    } else {
      setExpandedYard(yardId);
      fetchColonies(yardId);
    }
  }

  async function handleYardNameChange(yardId, newName) {
    setSaving(yardId);
    const { error: updateError } = await supabase
      .from('yards')
      .update({ name: newName })
      .eq('id', yardId);

    if (updateError) {
      setError('Failed to update yard name');
    } else {
      setYards((prev) =>
        prev.map((y) => (y.id === yardId ? { ...y, name: newName } : y))
      );
    }
    setSaving(null);
  }

  async function handleColonyLabelChange(colonyId, yardId, newLabel) {
    setSaving(colonyId);
    const { error: updateError } = await supabase
      .from('colonies')
      .update({ label: newLabel })
      .eq('id', colonyId);

    if (updateError) {
      setError('Failed to update hive label');
    } else {
      setColonies((prev) => ({
        ...prev,
        [yardId]: prev[yardId].map((c) =>
          c.id === colonyId ? { ...c, label: newLabel } : c
        ),
      }));
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
          {yards.map((yard) => (
            <div key={yard.id} style={{ marginBottom: 'var(--space-md)' }}>
              <div
                className="card"
                style={{ marginBottom: expandedYard === yard.id ? 0 : 'var(--space-md)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 'var(--font-lg)',
                      padding: 'var(--space-sm)',
                      minWidth: '40px',
                      minHeight: '40px',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleYard(yard.id);
                    }}
                  >
                    {expandedYard === yard.id ? '▼' : '▶'}
                  </button>
                  <input
                    type="text"
                    defaultValue={yard.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== yard.name) {
                        handleYardNameChange(yard.id, e.target.value.trim());
                      }
                    }}
                    style={{ flex: 1, border: 'none', fontSize: 'var(--font-lg)', fontWeight: 600, padding: 'var(--space-sm)' }}
                  />
                  {saving === yard.id && <span style={{ color: 'var(--color-text-secondary)' }}>Saving...</span>}
                </div>
              </div>

              {expandedYard === yard.id && (
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
                        {saving === colony.id && <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Saving...</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
