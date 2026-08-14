'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';
import { MenuManager } from './MenuManager';

type Resto = {
  id: string;
  name: string;
  cuisine_type: string | null;
  delivery_fee: number;
  min_order: number;
  commission_rate: number;
  zone_served: string | null;
  is_open: boolean;
  food_types: string[] | null;
  opens_at: string | null;
  closes_at: string | null;
};

type FormState = {
  name: string; cuisine_type: string; delivery_fee: string; commissionPct: string;
  zone: string; is_open: boolean; min_order: string; food_types: string; opens_at: string; closes_at: string;
};

const EMPTY: FormState = {
  name: '', cuisine_type: '', delivery_fee: '5000', commissionPct: '15', zone: '',
  is_open: true, min_order: '0', food_types: '', opens_at: '', closes_at: '',
};

export function Restaurants() {
  const [list, setList] = useState<Resto[]>([]);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Resto | null>(null);
  const [menuFor, setMenuFor] = useState<Resto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, cuisine_type, delivery_fee, min_order, commission_rate, zone_served, is_open, food_types, opens_at, closes_at')
      .order('name');
    if (error) { setErr(error.message); return; }
    setList((data ?? []) as Resto[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setErr(null); setMode('form');
  }
  function openEdit(r: Resto) {
    setEditing(r);
    setForm({
      name: r.name, cuisine_type: r.cuisine_type ?? '', delivery_fee: String(r.delivery_fee),
      commissionPct: String(Math.round(r.commission_rate * 10000) / 100), zone: r.zone_served ?? '',
      is_open: r.is_open, min_order: String(r.min_order), food_types: (r.food_types ?? []).join(', '),
      opens_at: r.opens_at?.slice(0, 5) ?? '', closes_at: r.closes_at?.slice(0, 5) ?? '',
    });
    setErr(null); setMode('form');
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    const foodTypes = form.food_types.split(',').map((s) => s.trim()).filter(Boolean);
    const args = {
      p_name: form.name,
      p_cuisine_type: form.cuisine_type,
      p_delivery_fee: parseInt(form.delivery_fee || '0', 10),
      p_commission_rate: (parseFloat(form.commissionPct || '0') || 0) / 100,
      p_zone: form.zone,
      p_is_open: form.is_open,
      p_min_order: parseInt(form.min_order || '0', 10),
      p_food_types: foodTypes,
      p_opens_at: form.opens_at,
      p_closes_at: form.closes_at,
    };
    const { error } = editing
      ? await supabase.rpc('admin_update_restaurant', { p_id: editing.id, ...args })
      : await supabase.rpc('admin_create_restaurant', args);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMode('list');
    await load();
  }

  if (menuFor) {
    return <MenuManager restaurant={menuFor} onBack={() => { setMenuFor(null); load(); }} />;
  }

  if (mode === 'form') {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>{editing ? `Modifier ${editing.name}` : 'Créer un restaurant'}</h2>
        {err ? <div style={{ color: 'var(--red)', marginBottom: 12 }}>{err}</div> : null}
        <div className="grid" style={{ gap: 12 }}>
          <Field label="Nom"><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Type de cuisine"><input style={inp} value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="Pizzeria, Snack…" /></Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Frais de livraison (Ar)"><input style={inp} type="number" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} /></Field>
            <Field label="Commission (%)"><input style={inp} type="number" step="0.5" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} /></Field>
            <Field label="Min. commande (Ar)"><input style={inp} type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} /></Field>
          </div>
          <Field label="Zone desservie"><input style={inp} value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Hell-Ville…" /></Field>
          <Field label="Types de plats (filtre accueil, séparés par des virgules)"><input style={inp} value={form.food_types} onChange={(e) => setForm({ ...form, food_types: e.target.value })} placeholder="Pizza, Tacos, Burger" /></Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Ouvre à"><input style={inp} type="time" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} /></Field>
            <Field label="Ferme à"><input style={inp} type="time" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} /></Field>
            <Field label="Ouvert ?"><label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}><input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} /> {form.is_open ? 'Ouvert' : 'Fermé'}</label></Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn" onClick={submit} disabled={busy || !form.name.trim()}>{editing ? 'Enregistrer' : 'Créer'}</button>
          <button className="btn ghost" onClick={() => setMode('list')} disabled={busy}>Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Restaurants</h2>
        <button className="btn" onClick={openCreate}>+ Créer un restaurant</button>
      </div>
      {err ? <div style={{ color: 'var(--red)', margin: '10px 0' }}>{err}</div> : null}
      {list.length === 0 ? (
        <div className="empty">Aucun restaurant.</div>
      ) : (
        <table>
          <thead><tr><th>Nom</th><th>État</th><th className="num">Commission</th><th className="num">Livraison</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.name}<div className="muted" style={{ fontSize: 12 }}>{r.cuisine_type ?? ''}{r.zone_served ? ` · ${r.zone_served}` : ''}</div></td>
                <td>{r.is_open ? <span className="pill livree">Ouvert</span> : <span className="pill annulee">Fermé</span>}</td>
                <td className="num">{Math.round(r.commission_rate * 10000) / 100}%</td>
                <td className="num">{formatAr(r.delivery_fee)}</td>
                <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" style={sm} onClick={() => setMenuFor(r)}>Menu</button>
                  <button className="btn ghost" style={sm} onClick={() => openEdit(r)}>Éditer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { width: '100%', background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '9px 12px', borderRadius: 8, fontSize: 14 };
const sm: React.CSSProperties = { padding: '6px 12px', fontSize: 12 };
