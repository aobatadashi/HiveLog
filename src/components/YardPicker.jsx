import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { cacheGet } from '../lib/cache.js';

export default function YardPicker({ excludeYardId, onSelect, onCancel, onCreateYard }) {
  const [yards, setYards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchYards() {
      try {
        const { data, error } = await supabase
          .from('yards')
          .select('id, name, hive_count')
          .order('name');
        if (error) throw error;
        setYards((data || []).filter((y) => y.id !== excludeYardId));
      } catch {
        const cached = await cacheGet('yards', 'all');
        if (cached) {
          setYards((cached || []).filter((y) => y.id !== excludeYardId));
        }
      }
      setLoading(false);
    }
    fetchYards();
  }, [excludeYardId]);

  const filtered = search.trim()
    ? yards.filter((y) => y.name.toLowerCase().includes(search.toLowerCase().trim()))
    : yards;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Select Destination Yard</h2>

        {yards.length > 5 && (
          <div className="search-wrap" style={{ marginBottom: 'var(--space-md)' }}>
            <input
              type="text"
              placeholder="Search yards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            {search ? 'No matching yards' : 'No other yards available'}
          </p>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            maxHeight: '50vh',
            overflowY: 'auto',
          }}>
            {filtered.map((y) => (
              <button
                key={y.id}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  minHeight: 64,
                  fontSize: 'var(--font-body)',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                }}
                onClick={() => onSelect(y)}
              >
                <span style={{ flex: 1, fontWeight: 600 }}>{y.name}</span>
                {(y.hive_count > 0) && (
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)' }}>
                    {y.hive_count} hives
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {onCreateYard && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-md)', minHeight: 56 }}
            onClick={onCreateYard}
          >
            + Create New Yard
          </button>
        )}

        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: 'var(--space-sm)' }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
