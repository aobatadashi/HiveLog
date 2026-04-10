import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';

export default function ConsultantDashboard({ user, consultantId, onSwitchToApp }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchClients = useCallback(async () => {
    if (!consultantId) return;
    try {
      // Get all linked beekeepers
      const { data: clientData, error: clientError } = await supabase
        .from('consultant_clients')
        .select('*')
        .eq('consultant_id', consultantId)
        .order('created_at', { ascending: false });

      if (clientError) throw clientError;

      if (!clientData || clientData.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Get yard data for each beekeeper
      const beekeeperIds = clientData.map((c) => c.beekeeper_id);
      const { data: yards } = await supabase
        .from('yards')
        .select('id, owner_id, name, hive_count, county, state, colonies(id)')
        .in('owner_id', beekeeperIds)
        .order('name');

      // Get recent activity per yard
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const yardIds = (yards || []).map((y) => y.id);
      const lastActivityByYard = {};

      if (yardIds.length > 0) {
        const { data: recentYardEvents } = await supabase
          .from('yard_events')
          .select('yard_id, created_at')
          .in('yard_id', yardIds)
          .gte('created_at', ninetyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(1000);

        for (const evt of (recentYardEvents || [])) {
          if (!lastActivityByYard[evt.yard_id]) {
            lastActivityByYard[evt.yard_id] = evt.created_at;
          }
        }
      }

      // Get loss count this quarter
      const quarterStart = new Date();
      quarterStart.setMonth(quarterStart.getMonth() - 3);
      const { data: recentLosses } = await supabase
        .from('yard_events')
        .select('yard_id, count')
        .in('yard_id', yardIds)
        .eq('type', 'loss')
        .gte('created_at', quarterStart.toISOString());

      const lossByBeekeeper = {};
      for (const loss of (recentLosses || [])) {
        const yard = (yards || []).find((y) => y.id === loss.yard_id);
        if (yard) {
          lossByBeekeeper[yard.owner_id] = (lossByBeekeeper[yard.owner_id] || 0) + (loss.count || 0);
        }
      }

      // Build enriched client list
      const enriched = clientData.map((client) => {
        const beekeeperYards = (yards || []).filter((y) => y.owner_id === client.beekeeper_id);
        const totalHives = beekeeperYards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colonies?.length || 0), 0);
        const totalYards = beekeeperYards.length;

        let lastActivity = null;
        for (const y of beekeeperYards) {
          const act = lastActivityByYard[y.id];
          if (act && (!lastActivity || act > lastActivity)) {
            lastActivity = act;
          }
        }

        const interval = client.check_in_interval_days || 14;
        const daysSince = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        let status = 'red';
        if (daysSince <= interval) status = 'green';
        else if (daysSince <= interval * 2) status = 'yellow';

        return {
          ...client,
          totalHives,
          totalYards,
          lastActivity,
          daysSince: daysSince === Infinity ? null : daysSince,
          status,
          lossesThisQuarter: lossByBeekeeper[client.beekeeper_id] || 0,
          yards: beekeeperYards,
        };
      });

      setClients(enriched);
    } catch (err) {
      setError(err?.message || 'Failed to load client data');
    }
    setLoading(false);
  }, [consultantId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const totalHives = clients.reduce((sum, c) => sum + c.totalHives, 0);
  const totalLosses = clients.reduce((sum, c) => sum + c.lossesThisQuarter, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        {onSwitchToApp && (
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', minHeight: 44, padding: 'var(--space-sm) var(--space-md)' }}
            onClick={onSwitchToApp}
          >
            My Yards
          </button>
        )}
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Stats banner */}
      {!loading && clients.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-lg)',
          fontSize: 'var(--font-body)',
          fontWeight: 600,
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700, color: 'var(--color-accent)' }}>
              {totalHives.toLocaleString()}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>total hives</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700 }}>
              {clients.length}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>clients</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700, color: totalLosses > 0 ? 'var(--color-danger, #c62828)' : 'var(--color-text)' }}>
              {totalLosses}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>losses (90d)</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <p>No clients linked yet</p>
          <p>Link beekeepers to this consultant account via the database</p>
        </div>
      ) : (
        clients.map((client) => (
          <div
            key={client.id}
            className="card"
            onClick={() => navigate(`/consultant/client/${client.beekeeper_id}`)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span className={`status-dot ${client.status}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Beekeeper {client.beekeeper_id.slice(0, 8)}
                </h3>
                <p style={{
                  fontSize: 'var(--font-lg)',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  marginTop: 'var(--space-xs)',
                }}>
                  {client.totalHives.toLocaleString()} hives · {client.totalYards} {client.totalYards === 1 ? 'yard' : 'yards'}
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
                  {client.daysSince != null ? `Last activity ${client.daysSince}d ago` : 'No activity'}
                  {client.lossesThisQuarter > 0 && (
                    <span style={{ color: 'var(--color-danger, #c62828)', marginLeft: 'var(--space-md)' }}>
                      {client.lossesThisQuarter} losses
                    </span>
                  )}
                </p>
                {client.region && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
                    {client.region}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 'var(--font-xl)', color: 'var(--color-text-secondary)' }}>›</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
