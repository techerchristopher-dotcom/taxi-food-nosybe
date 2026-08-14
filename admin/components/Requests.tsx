'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type PendingRow = { user_id: string; role: string; created_at: string };
type Profile = { id: string; full_name: string | null; email: string | null };
type Resto = { id: string; name: string };

export function Requests() {
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [restos, setRestos] = useState<Resto[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from('user_roles').select('user_id, role, created_at').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('restaurants').select('id, name').order('name'),
    ]);
    if (p.error || r.error) { setErr(p.error?.message || r.error?.message || 'Erreur'); return; }
    setErr(null);
    const rows = (p.data ?? []) as PendingRow[];
    setPending(rows);
    setRestos((r.data ?? []) as Resto[]);
    const ids = rows.map((x) => x.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      const map: Record<string, Profile> = {};
      for (const pr of (profs ?? []) as Profile[]) map[pr.id] = pr;
      setProfiles(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(row: PendingRow) {
    const key = row.user_id + row.role;
    if (row.role === 'restaurant' && !pick[row.user_id]) {
      setErr('Choisis un restaurant à lier avant de valider.');
      return;
    }
    setBusy(key);
    const { error } = await supabase.rpc('approve_role', {
      p_user_id: row.user_id,
      p_role: row.role,
      p_restaurant_id: row.role === 'restaurant' ? pick[row.user_id] : null,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function reject(row: PendingRow) {
    const key = row.user_id + row.role;
    setBusy(key);
    const { error } = await supabase.rpc('reject_role', { p_user_id: row.user_id, p_role: row.role });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  return (
    <div className="card">
      <h2>Demandes de rôle en attente</h2>
      {err ? <div style={{ color: 'var(--red)', marginBottom: 12 }}>Erreur : {err}</div> : null}
      {pending.length === 0 ? (
        <div className="empty">Aucune demande en attente.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Demandeur</th><th>Rôle</th><th>Restaurant à lier</th><th></th></tr>
          </thead>
          <tbody>
            {pending.map((row) => {
              const key = row.user_id + row.role;
              const prof = profiles[row.user_id];
              return (
                <tr key={key}>
                  <td>
                    <div>{prof?.full_name ?? '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{prof?.email ?? row.user_id.slice(0, 8)}</div>
                  </td>
                  <td><span className={`pill ${row.role === 'restaurant' ? 'confirmee' : 'en_livraison'}`}>{row.role}</span></td>
                  <td>
                    {row.role === 'restaurant' ? (
                      <select
                        value={pick[row.user_id] ?? ''}
                        onChange={(e) => setPick((m) => ({ ...m, [row.user_id]: e.target.value }))}
                        style={selStyle}
                      >
                        <option value="">— choisir —</option>
                        {restos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy === key} onClick={() => approve(row)}>Valider</button>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy === key} onClick={() => reject(row)}>Refuser</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const selStyle: React.CSSProperties = {
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '6px 10px', borderRadius: 8, fontSize: 13,
};
