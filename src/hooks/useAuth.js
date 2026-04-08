import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';
import { cacheClear } from '../lib/cache.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === 'SIGNED_IN') {
          window.location.hash = '#/';
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('hivelog_onboarded');
    localStorage.removeItem('hivelog_lastEventType');
    localStorage.removeItem('hivelog_colonySort');
    await cacheClear();
    window.location.hash = '#/';
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signOut };
}
