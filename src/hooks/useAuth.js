import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { cacheClear } from '../lib/cache.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const signInRedirectNeeded = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      // Offline or getSession failed — don't leave user stuck on spinner
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          signInRedirectNeeded.current = true;
        }
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const consumeSignInRedirect = useCallback(() => {
    if (signInRedirectNeeded.current) {
      signInRedirectNeeded.current = false;
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('hivelog_onboarded');
    localStorage.removeItem('hivelog_lastEventType');
    localStorage.removeItem('hivelog_colonySort');
    localStorage.removeItem('hivelog_inspectionInterval');
    await cacheClear();
    window.location.hash = '#/';
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signOut, consumeSignInRedirect };
}
