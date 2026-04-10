import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import YardEventRow from '../components/YardEventRow.jsx';
import { calcLossRate, getSeasonalExpected, getQuarterRange } from '../lib/trends.js';

export default function ConsultantClientView({ user, consultantId }) {
  const { beekeeperId } = useParams();
  const navigate = useNavigate();
  const [yards, setYards] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [clientSettings, setClientSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSettings, setEditingSettings] = useState(false);
  const [editRegion, setEditRegion] = useState('');
  const [editWinterLoss, setEditWinterLoss] = useState('');
  const [editSummerLoss, setEditSummerLoss] = useState('');
  const [editInterval, setEditInterval] = useState('');
  const [saving, setSaving] = useState(false);
  const [qLosses, setQLosses] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      // Fetch client settings
      if (consultantId) {
        const { data: cc } = await supabase
          .from('consultant_clients')
          .select('*')
          .eq('consultant_id', consultantId)
          .eq('beekeeper_id', beekeeperId)
          .maybeSingle();
        setClientSettings(cc);
      }

      // Fetch beekeeper's yards
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*, colonies(id)')
        .eq('owner_id', beekeeperId)
        .order('name');

      if (yardError) throw yardError;

      const yardsWithStats = (yardData || []).map((y) => ({
        ...y,
        colony_count: y.colonies?.length || 0,
      }));
      setYards(yardsWithStats);

      // Fetch recent yard events
      const yardIds = yardsWithStats.map((y) => y.id);
      if (yardIds.length > 0) {
        const { data: eventData } = await supabase
          .from('yard_events')
          .select('*, related_yard:yards!yard_events_related_yard_id_fkey(name)')
          .in('yard_id', yardIds)
          .order('created_at', { ascending: false })
          .limit(50);

        setRecentEvents(eventData || []);

        // Current quarter losses
        const currentQ = getQuarterRange(0);
        const { data: losses } = await supabase
          .from('yard_events')
          .select('count')
          .in('yard_id', yardIds)
          .eq('type', 'loss')
          .gte('created_at', currentQ.start)
          .lte('created_at', currentQ.end);

        setQLosses((losses || []).reduce((sum, e) => sum + (e.count || 0), 0));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load client data');
    }
    setLoading(false);
  }, [beekeeperId, consultantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openEditSettings() {
    setEditRegion(clientSettings?.region || '');
    setEditWinterLoss(String(clientSettings?.expected_winter_loss ?? 40));
    setEditSummerLoss(String(clientSettings?.expected_summer_loss ?? 25));
    setEditInterval(String(clientSettings?.check_in_interval_days ?? 14));
    setEditingSettings(true);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!clientSettings?.id) return;
    setSaving(true);
    const updates = {
      region: editRegion.trim() || null,
      expected_winter_loss: parseFloat(editWinterLoss) || 40,
      expected_summer_loss: parseFloat(editSummerLoss) || 25,
      check_in_interval_days: parseInt(editInterval, 10) || 14,
    };
    try {
      const { error: updateError } = await supabase
        .from('consultant_clients')
        .update(updates)
        .eq('id', clientSettings.id);
      if (updateError) throw updateError;
      setClientSettings((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      setError(err?.message || 'Failed to save settings');
    }
    setSaving(false);
    setEditingSettings(false);
  }

  const totalHives = yards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colony_count || 0), 0);
  const { expected, season } = getSeasonalExpected(
    clientSettings?.expected_winter_loss,
    clientSettings?.expected_summer_loss,
  );
  const lossRate = calcLossRate(qLosses, totalHives);

  const yardNameMap = {};
  for (const y of yards) yardNameMap[y.id] = y.name;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/consultant')}>
          ←
        </button>
        <h1>Client Detail</h1>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary */}
          <div style={{
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
              <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700, color: 'var(--color-accent)' }}>
                {totalHives.toLocaleString()} hives
              </p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>
                across {yards.length} {yards.length === 1 ? 'yard' : 'yards'}
              </p>
            </div>

            {/* Loss rate */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--font-body)',
              marginBottom: 4,
            }}>
              <span style={{ fontWeight: 700, color: lossRate > expected ? 'var(--color-danger, #c62828)' : 'var(--color-text)' }}>
                {lossRate}% loss rate ({season})
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {expected}% expected max
              </span>
            </div>
            <div style={{
              height: 10,
              borderRadius: 5,
              backgroundColor: 'var(--color-border)',
              overflow: 'hidden',
              marginBottom: 'var(--space-sm)',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(lossRate, 100)}%`,
                backgroundColor: lossRate <= expected ? 'var(--color-status-green, #2e7d32)' : 'var(--color-danger, #c62828)',
                borderRadius: 5,
              }} />
            </div>
            <p style={{ fontSize: 'var(--font-sm, 14px)', color: 'var(--color-text-secondary)' }}>
              {qLosses} losses this quarter · {totalHives} total hives
            </p>
          </div>

          {/* Client settings */}
          <div style={{
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3>Client Settings</h3>
              <button
                className="btn btn-secondary"
                style={{ minHeight: 44, padding: 'var(--space-sm) var(--space-md)' }}
                onClick={openEditSettings}
              >
                Edit
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)' }}>
              <p>Region: {clientSettings?.region || '—'}</p>
              <p>Expected winter loss: {clientSettings?.expected_winter_loss ?? 40}%</p>
              <p>Expected summer loss: {clientSettings?.expected_summer_loss ?? 25}%</p>
              <p>Check-in interval: {clientSettings?.check_in_interval_days ?? 14} days</p>
            </div>
          </div>

          {/* Yards list */}
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Yards</h2>
          {yards.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No yards</p>
          ) : (
            yards.map((yard) => (
              <div key={yard.id} className="card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3>{yard.name}</h3>
                  <p style={{
                    fontSize: 'var(--font-lg)',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginTop: 'var(--space-xs)',
                  }}>
                    {Math.max(yard.hive_count || 0, yard.colony_count || 0).toLocaleString()} hives
                  </p>
                  {(yard.county || yard.state) && (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
                      {[yard.county && `${yard.county} County`, yard.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Recent activity */}
          {recentEvents.length > 0 && (
            <div style={{ marginTop: 'var(--space-xl)' }}>
              <h2 style={{ marginBottom: 'var(--space-md)' }}>Recent Activity</h2>
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
                padding: 'var(--space-md) var(--space-lg)',
              }}>
                {recentEvents.map((event) => (
                  <div key={event.id}>
                    <p style={{
                      fontSize: 'var(--font-sm, 14px)',
                      color: 'var(--color-accent)',
                      fontWeight: 600,
                      marginTop: 'var(--space-sm)',
                    }}>
                      {yardNameMap[event.yard_id] || 'Unknown yard'}
                    </p>
                    <YardEventRow event={event} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit settings modal */}
      {editingSettings && (
        <div className="modal-overlay" onClick={() => setEditingSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Client Settings</h2>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Region</label>
                <input
                  type="text"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  placeholder="e.g., North Florida"
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Winter Loss %</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editWinterLoss}
                    onChange={(e) => setEditWinterLoss(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Summer Loss %</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={editSummerLoss}
                    onChange={(e) => setEditSummerLoss(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Check-in Interval (days)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editInterval}
                  onChange={(e) => setEditInterval(e.target.value)}
                  min="1"
                />
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
