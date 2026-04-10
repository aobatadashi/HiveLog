import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import YardEventRow from '../components/YardEventRow.jsx';

export default function ConsultantClientView({ user }) {
  const { beekeeperId } = useParams();
  const navigate = useNavigate();
  const [yards, setYards] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      // Fetch beekeeper's yards (RLS allows consultant to read)
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

      // Fetch recent yard events across all yards
      const yardIds = yardsWithStats.map((y) => y.id);
      if (yardIds.length > 0) {
        const { data: eventData } = await supabase
          .from('yard_events')
          .select('*, related_yard:yards!yard_events_related_yard_id_fkey(name)')
          .in('yard_id', yardIds)
          .order('created_at', { ascending: false })
          .limit(50);

        setRecentEvents(eventData || []);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load client data');
    }
    setLoading(false);
  }, [beekeeperId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalHives = yards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colony_count || 0), 0);

  // Build yard name lookup for event display
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
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700, color: 'var(--color-accent)' }}>
              {totalHives.toLocaleString()} hives
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>
              across {yards.length} {yards.length === 1 ? 'yard' : 'yards'}
            </p>
          </div>

          {/* Yards list */}
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Yards</h2>
          {yards.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No yards</p>
          ) : (
            yards.map((yard) => (
              <div key={yard.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
    </div>
  );
}
