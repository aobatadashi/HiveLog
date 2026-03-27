import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import ColonyCard from '../components/ColonyCard.jsx';

export default function YardView({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [yard, setYard] = useState(null);
  const [colonies, setColonies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');

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

      const coloniesWithInspection = await Promise.all(
        (colonyData || []).map(async (colony) => {
          const { data: lastInsp } = await supabase
            .from('events')
            .select('created_at')
            .eq('colony_id', colony.id)
            .eq('type', 'inspection')
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...colony,
            last_inspection: lastInsp?.[0]?.created_at || null,
          };
        })
      );

      setColonies(coloniesWithInspection);
    } catch {
      setError('Failed to load yard data');
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

      setColonies((prev) => [...prev, { ...data, last_inspection: null }]);
    } catch {
      await addToQueue({ table: 'colonies', operation: 'insert', data: colonyData });
    }

    setNewLabel('');
    setShowAdd(false);
  }

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

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : colonies.length === 0 ? (
        <div className="empty-state">
          <p>No colonies yet</p>
          <p>Tap + to add your first hive</p>
        </div>
      ) : (
        colonies.map((colony) => <ColonyCard key={colony.id} colony={colony} />)
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add colony">
        +
      </button>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Colony</h2>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newLabel.trim()}>
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
