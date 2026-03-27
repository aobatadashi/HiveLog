import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import YardCard from '../components/YardCard.jsx';

export default function Home({ user }) {
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const navigate = useNavigate();

  const fetchYards = useCallback(async () => {
    try {
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*')
        .order('created_at', { ascending: false });

      if (yardError) throw yardError;

      const yardsWithStats = await Promise.all(
        (yardData || []).map(async (yard) => {
          const { count } = await supabase
            .from('colonies')
            .select('*', { count: 'exact', head: true })
            .eq('yard_id', yard.id);

          const { data: lastEvent } = await supabase
            .from('events')
            .select('created_at, colonies!inner(yard_id)')
            .eq('colonies.yard_id', yard.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...yard,
            colony_count: count || 0,
            last_activity: lastEvent?.[0]?.created_at || null,
          };
        })
      );

      setYards(yardsWithStats);
    } catch {
      setError('Failed to load yards');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchYards();
  }, [fetchYards]);

  async function handleAddYard(e) {
    e.preventDefault();
    if (!newName.trim()) return;

    const yardData = {
      owner_id: user.id,
      name: newName.trim(),
      location_note: newLocation.trim() || null,
    };

    try {
      const { data, error: insertError } = await supabase
        .from('yards')
        .insert(yardData)
        .select()
        .single();

      if (insertError) throw insertError;

      setYards((prev) => [{ ...data, colony_count: 0, last_activity: null }, ...prev]);
    } catch {
      await addToQueue({ table: 'yards', operation: 'insert', data: yardData });
    }

    setNewName('');
    setNewLocation('');
    setShowAdd(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Yards</h1>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/settings')}
          style={{ minWidth: 'auto', padding: 'var(--space-sm) var(--space-md)' }}
        >
          Settings
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : yards.length === 0 ? (
        <div className="empty-state">
          <p>No yards yet</p>
          <p>Tap + to add your first yard</p>
        </div>
      ) : (
        yards.map((yard) => <YardCard key={yard.id} yard={yard} />)
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add yard">
        +
      </button>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Yard</h2>
            <form onSubmit={handleAddYard}>
              <div className="form-group">
                <label>Yard Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., North Field"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Location Note (optional)</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g., Behind the barn"
                />
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>
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
