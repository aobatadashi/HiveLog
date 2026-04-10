import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';

export default function ConsultantSchedule({ user, consultantId, onToast }) {
  const [clients, setClients] = useState([]);
  const [nudgeHistory, setNudgeHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    if (!consultantId) return;
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('consultant_clients')
        .select('*')
        .eq('consultant_id', consultantId);
      if (clientError) throw clientError;
      if (!clientData || clientData.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const beekeeperIds = clientData.map((c) => c.beekeeper_id);

      // Get yards for last activity
      const { data: yards } = await supabase
        .from('yards')
        .select('id, owner_id')
        .in('owner_id', beekeeperIds);

      const yardIds = (yards || []).map((y) => y.id);
      const lastActivityByBk = {};

      if (yardIds.length > 0) {
        const { data: recentEvents } = await supabase
          .from('yard_events')
          .select('yard_id, created_at')
          .in('yard_id', yardIds)
          .order('created_at', { ascending: false })
          .limit(1000);

        for (const evt of (recentEvents || [])) {
          const yard = (yards || []).find((y) => y.id === evt.yard_id);
          if (yard && (!lastActivityByBk[yard.owner_id] || evt.created_at > lastActivityByBk[yard.owner_id])) {
            lastActivityByBk[yard.owner_id] = evt.created_at;
          }
        }
      }

      // Get nudge history
      const { data: nudges } = await supabase
        .from('nudges')
        .select('*')
        .eq('consultant_id', consultantId)
        .order('sent_at', { ascending: false })
        .limit(500);

      const nudgesByBk = {};
      for (const n of (nudges || [])) {
        if (!nudgesByBk[n.beekeeper_id]) nudgesByBk[n.beekeeper_id] = [];
        nudgesByBk[n.beekeeper_id].push(n);
      }
      setNudgeHistory(nudgesByBk);

      // Check for responses: if beekeeper logged activity after the most recent nudge
      // Mark that nudge as responded
      for (const bkId of beekeeperIds) {
        const bkNudges = nudgesByBk[bkId];
        const lastAct = lastActivityByBk[bkId];
        if (bkNudges && bkNudges.length > 0 && lastAct) {
          const latestNudge = bkNudges[0];
          if (!latestNudge.responded_at && lastAct > latestNudge.sent_at) {
            // Auto-mark as responded
            await supabase
              .from('nudges')
              .update({ responded_at: lastAct })
              .eq('id', latestNudge.id);
            latestNudge.responded_at = lastAct;
          }
        }
      }

      // Build client list sorted by days since last log (most overdue first)
      const enriched = clientData.map((client) => {
        const lastAct = lastActivityByBk[client.beekeeper_id];
        const interval = client.check_in_interval_days || 14;
        const daysSince = lastAct
          ? Math.floor((Date.now() - new Date(lastAct).getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        let status = 'red';
        if (daysSince <= interval) status = 'green';
        else if (daysSince <= interval + 2) status = 'yellow';

        const bkNudges = nudgesByBk[client.beekeeper_id] || [];
        const lastNudge = bkNudges[0] || null;
        const respondedCount = bkNudges.filter((n) => n.responded_at).length;
        const totalNudges = bkNudges.length;

        return {
          ...client,
          lastActivity: lastAct,
          daysSince: daysSince === Infinity ? null : daysSince,
          status,
          interval,
          lastNudge,
          respondedCount,
          totalNudges,
        };
      });

      enriched.sort((a, b) => {
        const aD = a.daysSince ?? 9999;
        const bD = b.daysSince ?? 9999;
        return bD - aD;
      });

      setClients(enriched);
    } catch (err) {
      setError(err?.message || 'Failed to load schedule data');
    }
    setLoading(false);
  }, [consultantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSendNudge(client) {
    setSending(client.beekeeper_id);
    try {
      const { error: insertError } = await supabase
        .from('nudges')
        .insert({
          consultant_id: consultantId,
          beekeeper_id: client.beekeeper_id,
          auto: false,
        });
      if (insertError) throw insertError;
      if (onToast) onToast('Reminder sent');
      fetchData();
    } catch (err) {
      setError(err?.message || 'Failed to send reminder');
    }
    setSending(null);
  }

  function formatAgo(dateStr) {
    if (!dateStr) return 'Never';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  const overdueCount = clients.filter((c) => c.status === 'red').length;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/consultant')}>
          ←
        </button>
        <h1>Schedule</h1>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {/* Summary */}
      {!loading && clients.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md) var(--space-lg)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-xl)',
          fontSize: 'var(--font-body)',
          fontWeight: 600,
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: 'var(--font-2xl, 28px)',
              fontWeight: 700,
              color: overdueCount > 0 ? 'var(--color-danger, #c62828)' : 'var(--color-status-green, #2e7d32)',
            }}>
              {overdueCount}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>overdue</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-2xl, 28px)', fontWeight: 700 }}>
              {clients.length}
            </p>
            <p style={{ color: 'var(--color-text-secondary)' }}>total clients</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <p>No clients linked yet</p>
        </div>
      ) : (
        clients.map((client) => (
          <div key={client.id} className="card" style={{
            borderLeft: client.status === 'red' ? '4px solid var(--color-danger, #c62828)'
              : client.status === 'yellow' ? '4px solid var(--color-warning, #e65100)'
              : '4px solid var(--color-status-green, #2e7d32)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
              <span className={`status-dot ${client.status}`} style={{ marginTop: 4 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Beekeeper {client.beekeeper_id.slice(0, 8)}
                </h3>
                <p style={{
                  fontSize: 'var(--font-body)',
                  fontWeight: 600,
                  color: client.status === 'red' ? 'var(--color-danger, #c62828)' : 'var(--color-text)',
                  marginTop: 'var(--space-xs)',
                }}>
                  {client.daysSince != null
                    ? `Last log: ${formatAgo(client.lastActivity)} (${client.interval}d interval)`
                    : `No activity (${client.interval}d interval)`}
                </p>

                {/* Nudge history */}
                {client.totalNudges > 0 && (
                  <p style={{
                    fontSize: 'var(--font-sm, 14px)',
                    color: 'var(--color-text-secondary)',
                    marginTop: 'var(--space-xs)',
                  }}>
                    {client.totalNudges} reminder{client.totalNudges !== 1 ? 's' : ''} sent
                    {client.respondedCount > 0 && ` · ${client.respondedCount} responded`}
                    {client.lastNudge && ` · Last: ${formatAgo(client.lastNudge.sent_at)}`}
                    {client.lastNudge?.responded_at && ' (responded)'}
                  </p>
                )}

                {/* Send reminder button */}
                {client.status !== 'green' && (
                  <button
                    className="btn btn-primary"
                    style={{
                      marginTop: 'var(--space-sm)',
                      minHeight: 48,
                      fontSize: 'var(--font-body)',
                      width: '100%',
                    }}
                    onClick={(e) => { e.stopPropagation(); handleSendNudge(client); }}
                    disabled={sending === client.beekeeper_id}
                  >
                    {sending === client.beekeeper_id ? 'Sending...' : 'Send Reminder'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
