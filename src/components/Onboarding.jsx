import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { addToQueue } from '../lib/offlineQueue.js';

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [yardName, setYardName] = useState('');
  const [hiveCount, setHiveCount] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdYard, setCreatedYard] = useState(null);

  function skip() {
    localStorage.setItem('hivelog_onboarded', 'true');
    onComplete(null);
  }

  async function handleCreateYard() {
    if (!yardName.trim()) return;
    setSaving(true);

    const hiveCountNum = parseInt(hiveCount, 10) || 0;
    const yardData = {
      owner_id: user.id,
      name: yardName.trim(),
      location_note: location.trim() || null,
      hive_count: hiveCountNum,
    };

    let yard = null;
    try {
      const { data, error } = await supabase
        .from('yards')
        .insert(yardData)
        .select()
        .single();
      if (error) throw error;
      yard = data;
    } catch (err) {
      if (!navigator.onLine) {
        yard = {
          ...yardData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        };
        await addToQueue({ table: 'yards', operation: 'insert', data: yardData });
      } else {
        setSaving(false);
        return;
      }
    }

    setCreatedYard({ ...yard, colony_count: 0, hive_count: hiveCountNum, last_activity: null });
    setSaving(false);
    setStep(3);
  }

  function finish() {
    localStorage.setItem('hivelog_onboarded', 'true');
    onComplete(createdYard);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: 'var(--space-xl) var(--space-lg)',
      textAlign: 'center',
    }}>
      {step === 1 && (
        <>
          <p style={{ fontSize: '64px', marginBottom: 'var(--space-lg)' }}>
            🐝
          </p>
          <h2 style={{ fontSize: 'var(--font-2xl, 28px)', marginBottom: 'var(--space-md)' }}>
            Welcome to HiveLog
          </h2>
          <p style={{
            fontSize: 'var(--font-lg)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-2xl)',
            maxWidth: '400px',
            lineHeight: 1.5,
          }}>
            Track your yards, log splits and losses, and keep a running count of your hives — even offline.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: '320px', height: '72px', fontSize: 'var(--font-xl)' }}
            onClick={() => setStep(2)}
          >
            Get Started
          </button>
          <button
            onClick={skip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-body)',
              marginTop: 'var(--space-lg)',
              cursor: 'pointer',
              minHeight: 44,
              padding: 'var(--space-sm)',
            }}
          >
            Skip for now
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ fontSize: 'var(--font-2xl, 28px)', marginBottom: 'var(--space-sm)' }}>
            Add Your First Yard
          </h2>
          <p style={{
            fontSize: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-xl)',
          }}>
            You can always change this later.
          </p>
          <div style={{ width: '100%', maxWidth: '400px', textAlign: 'left' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                Yard Name
              </label>
              <input
                type="text"
                value={yardName}
                onChange={(e) => setYardName(e.target.value)}
                placeholder="e.g., Archer B Supply, Winfield Farm"
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                Number of Hives
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={hiveCount}
                onChange={(e) => setHiveCount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g., 216"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-xl)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-body)' }}>
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., County Rd 45 behind the red barn"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)' }}
              onClick={handleCreateYard}
              disabled={!yardName.trim() || saving}
            >
              {saving ? 'Creating...' : 'Create Yard'}
            </button>
            <button
              onClick={skip}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-body)',
                marginTop: 'var(--space-lg)',
                cursor: 'pointer',
                minHeight: 44,
                padding: 'var(--space-sm)',
                width: '100%',
                textAlign: 'center',
              }}
            >
              Skip for now
            </button>
          </div>
        </>
      )}

      {step === 3 && createdYard && (
        <>
          <p style={{ fontSize: '64px', marginBottom: 'var(--space-lg)' }}>
            ✅
          </p>
          <h2 style={{ fontSize: 'var(--font-2xl, 28px)', marginBottom: 'var(--space-md)' }}>
            You're all set!
          </h2>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)',
            width: '100%',
            maxWidth: '400px',
            textAlign: 'left',
          }}>
            <h3 style={{ fontSize: 'var(--font-lg)' }}>{createdYard.name}</h3>
            <p style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 700,
              color: 'var(--color-accent)',
              marginTop: 'var(--space-xs)',
            }}>
              {(createdYard.hive_count || 0).toLocaleString()} hives
            </p>
            {createdYard.location_note && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-body)', marginTop: 'var(--space-xs)' }}>
                {createdYard.location_note}
              </p>
            )}
          </div>
          <p style={{
            fontSize: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-xl)',
            maxWidth: '400px',
            lineHeight: 1.5,
          }}>
            Tap your yard to log splits, losses, feeding, and more.
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: '320px', height: '72px', fontSize: 'var(--font-xl)' }}
            onClick={finish}
          >
            Get Started
          </button>
        </>
      )}
    </div>
  );
}
