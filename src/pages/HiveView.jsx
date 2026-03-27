import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import EventRow from '../components/EventRow.jsx';

export default function HiveView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [colony, setColony] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const { data: colonyData, error: colonyError } = await supabase
        .from('colonies')
        .select('*, yards(name)')
        .eq('id', id)
        .single();

      if (colonyError) throw colonyError;
      setColony(colonyData);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('colony_id', id)
        .order('created_at', { ascending: false });

      if (eventError) throw eventError;
      setEvents(eventData || []);
    } catch {
      setError('Failed to load hive data');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="page">
      <div className="page-header">
        <button
          className="back-btn"
          onClick={() => {
            if (colony?.yards?.id) {
              navigate(`/yard/${colony.yard_id}`);
            } else {
              navigate(-1);
            }
          }}
        >
          ←
        </button>
        <h1>{colony?.label || 'Hive'}</h1>
      </div>

      {colony?.yards?.name && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', marginTop: 'calc(-1 * var(--space-md))' }}>
          {colony.yards.name}
        </p>
      )}

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No events logged yet</p>
          <p>Tap "Log Event" to record your first entry</p>
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 'var(--space-md) var(--space-lg)',
        background: 'linear-gradient(transparent, var(--color-bg) 20%)',
        paddingTop: 'var(--space-xl)',
      }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'block', height: '72px', fontSize: 'var(--font-xl)' }}
          onClick={() => navigate(`/log/${id}`)}
        >
          Log Event
        </button>
      </div>
    </div>
  );
}
