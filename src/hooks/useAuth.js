import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { cacheClear } from '../lib/cache.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConsultant, setIsConsultant] = useState(false);
  const [consultantId, setConsultantId] = useState(null);
  const signInRedirectNeeded = useRef(false);

  async function checkConsultantRole(userId) {
    if (!userId) {
      setIsConsultant(false);
      setConsultantId(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('consultants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      setIsConsultant(!!data);
      setConsultantId(data?.id || null);
    } catch {
      setIsConsultant(false);
      setConsultantId(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      checkConsultantRole(u?.id);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          signInRedirectNeeded.current = true;
        }
        const u = session?.user ?? null;
        setUser(u);
        checkConsultantRole(u?.id);
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
    setIsConsultant(false);
    setConsultantId(null);
  }, []);

  return { user, loading, isConsultant, consultantId, signOut, consumeSignInRedirect };
}
