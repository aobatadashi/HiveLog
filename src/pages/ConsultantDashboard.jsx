import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { calcLossRate, getLossAlertLevel, getSeasonalExpected, getTrendDirection, getQuarterRange } from '../lib/trends.js';

export default function ConsultantDashboard({ user, consultantId, onSwitchToApp }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  const navigate = useNavigate();

  const fetchClients = useCallback(async () => {
    if (!consultantId) return;
    try {
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

      const beekeeperIds = clientData.map((c) => c.beekeeper_id);
      const { data: yards } = await supabase
        .from('yards')
        .select('id, owner_id, name, hive_count, county, state, colonies(id)')
        .in('owner_id', beekeeperIds)
        .order('name');

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

      // Current quarter losses
      const currentQ = getQuarterRange(0);
      const prevQ = getQuarterRange(1);

      const { data: currentLosses } = await supabase
        .from('yard_events')
        .select('yard_id, count')
        .in('yard_id', yardIds)
        .eq('type', 'loss')
        .gte('created_at', currentQ.start)
        .lte('created_at', currentQ.end);

      const { data: prevLosses } = await supabase
        .from('yard_events')
        .select('yard_id, count')
        .in('yard_id', yardIds)
        .eq('type', 'loss')
        .gte('created_at', prevQ.start)
        .lte('created_at', prevQ.end);

      // Current quarter splits
      const { data: currentSplits } = await supabase
        .from('yard_events')
        .select('yard_id, count')
        .in('yard_id', yardIds)
        .in('type', ['split_local', 'split_in'])
        .gte('created_at', currentQ.start)
        .lte('created_at', currentQ.end);

      // Aggregate by beekeeper
      function sumByBeekeeper(events) {
        const result = {};
        for (const e of (events || [])) {
          const yard = (yards || []).find((y) => y.id === e.yard_id);
          if (yard) {
            result[yard.owner_id] = (result[yard.owner_id] || 0) + (e.count || 0);
          }
        }
        return result;
      }

      const currentLossByBk = sumByBeekeeper(currentLosses);
      const prevLossByBk = sumByBeekeeper(prevLosses);
      const splitsByBk = sumByBeekeeper(currentSplits);

      const enriched = clientData.map((client) => {
        const beekeeperYards = (yards || []).filter((y) => y.owner_id === client.beekeeper_id);
        const totalHives = beekeeperYards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colonies?.length || 0), 0);
        const totalYards = beekeeperYards.length;

        let lastActivity = null;
        for (const y of beekeeperYards) {
          const act = lastActivityByYard[y.id];
          if (act && (!lastActivity || act > lastActivity)) lastActivity = act;
        }

        const interval = client.check_in_interval_days || 14;
        const daysSince = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        let status = 'red';
        if (daysSince <= interval) status = 'green';
        else if (daysSince <= interval * 2) status = 'yellow';

        // Trend calculations
        const qLosses = currentLossByBk[client.beekeeper_id] || 0;
        const pLosses = prevLossByBk[client.beekeeper_id] || 0;
        const qSplits = splitsByBk[client.beekeeper_id] || 0;
        const lossRate = calcLossRate(qLosses, totalHives);
        const prevLossRate = calcLossRate(pLosses, totalHives);
        const { expected, season } = getSeasonalExpected(
          client.expected_winter_loss || 40,
          client.expected_summer_loss || 25,
        );
        const alertLevel = getLossAlertLevel(lossRate, expected);
        const trend = getTrendDirection(lossRate, prevLossRate);

        return {
          ...client,
          totalHives,
          totalYards,
          lastActivity,
          daysSince: daysSince === Infinity ? null : daysSince,
          status,
          lossRate,
          prevLossRate,
          qLosses,
          qSplits,
          expected,
          season,
          alertLevel,
          trend,
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
  const totalLosses = clients.reduce((sum, c) => sum + c.qLosses, 0);
  const alertCount = clients.filter((c) => c.alertLevel !== 'ok').length;

  const displayClients = showAlertsOnly
    ? clients.filter((c) => c.alertLevel !== 'ok').sort((a, b) => b.lossRate - a.lossRate)
    : clients;

  const trendArrow = { up: '▲', down: '▼', flat: '—' };
  const trendColor = { up: 'var(--color-danger, #c62828)', down: 'var(--color-status-green, #2e7d32)', flat: 'var(--color-text-secondary)' };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: 'auto' }}>
          <button
            className="btn btn-primary"
            style={{ minHeight: 44, padding: 'var(--space-sm) var(--space-md)' }}
            onClick={() => navigate('/consultant/schedule')}
          >
            Schedule
          </button>
          {onSwitchToApp && (
            <button
              className="btn btn-secondary"
              style={{ minHeight: 44, padding: 'var(--space-sm) var(--space-md)' }}
              onClick={onSwitchToApp}
            >
              My Yards
            </button>
          )}
        </div>
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
            <p style={{ color: 'var(--color-text-secondary)' }}>losses (Q)</p>
          </div>
        </div>
      )}

      {/* Alert filter */}
      {!loading && alertCount > 0 && (
        <button
          onClick={() => setShowAlertsOnly(!showAlertsOnly)}
          style={{
            width: '100%',
            minHeight: 56,
            marginBottom: 'var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            border: showAlertsOnly ? '3px solid var(--color-danger, #c62828)' : '3px solid var(--color-border)',
            backgroundColor: showAlertsOnly ? '#ffebee' : 'var(--color-surface)',
            color: showAlertsOnly ? 'var(--color-danger, #c62828)' : 'var(--color-text)',
            fontSize: 'var(--font-body)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showAlertsOnly
            ? `Showing ${alertCount} alert${alertCount !== 1 ? 's' : ''} — tap to show all`
            : `${alertCount} client${alertCount !== 1 ? 's' : ''} above expected loss range`}
        </button>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <p>No clients linked yet</p>
          <p>Link beekeepers to this consultant account via the database</p>
        </div>
      ) : (
        displayClients.map((client) => (
          <div
            key={client.id}
            className="card"
            onClick={() => navigate(`/consultant/client/${client.beekeeper_id}`)}
            style={{
              cursor: 'pointer',
              borderLeft: client.alertLevel === 'critical' ? '4px solid var(--color-danger, #c62828)'
                : client.alertLevel === 'warning' ? '4px solid var(--color-warning, #e65100)'
                : undefined,
            }}
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

                {/* Trend row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  marginTop: 'var(--space-xs)',
                  flexWrap: 'wrap',
                }}>
                  {/* Loss rate bar */}
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-sm, 14px)',
                      marginBottom: 2,
                    }}>
                      <span style={{
                        fontWeight: 700,
                        color: client.alertLevel === 'ok' ? 'var(--color-text)' : 'var(--color-danger, #c62828)',
                      }}>
                        {client.lossRate}% loss
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {client.expected}% max
                      </span>
                    </div>
                    <div style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'var(--color-border)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(client.lossRate, 100)}%`,
                        backgroundColor: client.alertLevel === 'ok'
                          ? 'var(--color-status-green, #2e7d32)'
                          : client.alertLevel === 'warning'
                            ? 'var(--color-warning, #e65100)'
                            : 'var(--color-danger, #c62828)',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>

                  {/* Trend arrow */}
                  <span style={{
                    fontSize: 'var(--font-body)',
                    fontWeight: 700,
                    color: trendColor[client.trend],
                  }}>
                    {trendArrow[client.trend]}
                  </span>
                </div>

                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm, 14px)', marginTop: 'var(--space-xs)' }}>
                  {client.daysSince != null ? `${client.daysSince}d ago` : 'No activity'}
                  {client.qLosses > 0 && ` · ${client.qLosses} losses`}
                  {client.qSplits > 0 && ` · ${client.qSplits} splits`}
                </p>

                {client.region && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-sm, 14px)', marginTop: 2 }}>
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
