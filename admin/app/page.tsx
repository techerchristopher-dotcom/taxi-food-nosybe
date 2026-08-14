'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Realtime } from '../components/Realtime';
import { Report } from '../components/Report';
import { Requests } from '../components/Requests';
import { Restaurants } from '../components/Restaurants';

type Tab = 'realtime' | 'report' | 'requests' | 'restaurants';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('realtime');

  const checkAdmin = useCallback(async (s: Session | null) => {
    if (!s) {
      setIsAdmin(null);
      return;
    }
    const { data, error } = await supabase.rpc('is_admin');
    setIsAdmin(!error && data === true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await checkAdmin(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      await checkAdmin(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [checkAdmin]);

  async function login() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="center">
        <div className="muted">Chargement…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="center">
        <div className="brand">
          <span className="dot" />
          <h1>Taxi Food — Admin</h1>
        </div>
        <p className="muted">Espace de pilotage réservé à l'administrateur.</p>
        <button className="btn" onClick={login}>Continuer avec Google</button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="center">
        <h1>Accès refusé</h1>
        <p className="muted">
          Ce compte ({session.user.email}) n'a pas le rôle administrateur.
        </p>
        <button className="btn ghost" onClick={logout}>Se déconnecter</button>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="dot" />
          <h1>Taxi Food — Admin</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="who">{session.user.email}</span>
          <button className="btn ghost" onClick={logout}>Déconnexion</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'realtime' ? 'active' : ''}`} onClick={() => setTab('realtime')}>
          Temps réel
        </button>
        <button className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>
          Rapport de clôture
        </button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          Demandes de rôle
        </button>
        <button className={`tab ${tab === 'restaurants' ? 'active' : ''}`} onClick={() => setTab('restaurants')}>
          Restaurants & menus
        </button>
      </div>

      {tab === 'realtime' && <Realtime />}
      {tab === 'report' && <Report />}
      {tab === 'requests' && <Requests />}
      {tab === 'restaurants' && <Restaurants />}
    </div>
  );
}
