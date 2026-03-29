import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';
import { cacheSet, cacheGet } from '../lib/cache.js';
import YardCard from '../components/YardCard.jsx';

export default function Home({ user }) {
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchYards = useCallback(async () => {
    try {
      // Single query: yards with embedded colony IDs for counting
      const { data: yardData, error: yardError } = await supabase
        .from('yards')
        .select('*, colonies(id)')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (yardError) throw yardError;

      // Fetch last activity per yard by paginating through recent events.
      // Supabase caps at 1000 rows per request, so we page until all yards
      // are covered or we run out of events.
      const lastActivityByYard = {};
      const yardCount = (yardData || []).length;

      if (yardCount > 0) {
        const PAGE = 1000;
        let offset = 0;
        const maxPages = 20; // Safety cap: 20K events max
        for (let page = 0; page < maxPages; page++) {
          const { data: recentEvents } = await supabase
            .from('events')
            .select('colony_id, created_at, colonies!inner(yard_id)')
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE - 1);

          if (!recentEvents || recentEvents.length === 0) break;

          for (const evt of recentEvents) {
            const yardId = evt.colonies?.yard_id;
            if (yardId && !lastActivityByYard[yardId]) {
              lastActivityByYard[yardId] = evt.created_at;
            }
          }

          // Stop if all yards are covered or we got fewer rows than requested
          if (Object.keys(lastActivityByYard).length >= yardCount) break;
          if (recentEvents.length < PAGE) break;
          offset += PAGE;
        }
      }

      const yardsWithStats = (yardData || []).map((yard) => ({
        ...yard,
        colony_count: yard.colonies?.length || 0,
        last_activity: lastActivityByYard[yard.id] || null,
      }));

      setYards(yardsWithStats);
      await cacheSet('yards', 'all', yardsWithStats);
    } catch {
      // Try to load from cache
      const cached = await cacheGet('yards', 'all');
      if (cached) {
        setYards(cached);
      } else {
        setError('Failed to load yards');
      }
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
    } catch (err) {
      if (err?.code === '23505') {
        setError('A yard with that name already exists');
        return;
      }
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

        >
          Settings
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {!loading && yards.length > 0 && (
        <div className="search-wrap">
          <input
            type="text"
            placeholder="Search yards…"
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

        if (loading) {
          return <div className="loading"><div className="spinner" /></div>;
        }
        if (yards.length === 0) {
          return (
            <div className="empty-state">
              <p>No yards yet</p>
              <p>Tap + to add your first yard</p>
            </div>
          );
        }
        if (filtered.length === 0) {
          return (
            <div className="empty-state">
              <p>No yards match &ldquo;{search}&rdquo;</p>
            </div>
          );
        }
        return filtered.map((yard) => <YardCard key={yard.id} yard={yard} />);
      })()}

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
