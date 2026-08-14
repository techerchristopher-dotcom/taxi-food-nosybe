'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';

type Category = { id: string; name: string; icon: string | null; sort_order: number; is_active: boolean };
type Product = {
  id: string; category_id: string | null; name: string; description: string | null;
  price: number; photo_url: string | null; is_available: boolean;
};
type ProductForm = {
  id: string | null; category_id: string; name: string; description: string; price: string; photo_url: string; is_available: boolean;
};

const EMPTY_PROD: ProductForm = { id: null, category_id: '', name: '', description: '', price: '', photo_url: '', is_available: true };

export function MenuManager({ restaurant, onBack }: { restaurant: { id: string; name: string }; onBack: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pform, setPform] = useState<ProductForm | null>(null);
  const [newCat, setNewCat] = useState({ name: '', icon: '', sort_order: '0' });

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('id, name, icon, sort_order, is_active').eq('restaurant_id', restaurant.id).order('sort_order'),
      supabase.from('products').select('id, category_id, name, description, price, photo_url, is_available').eq('restaurant_id', restaurant.id).order('name'),
    ]);
    if (c.error || p.error) { setErr(c.error?.message || p.error?.message || 'Erreur'); return; }
    setErr(null);
    setCats((c.data ?? []) as Category[]);
    setProds((p.data ?? []) as Product[]);
  }, [restaurant.id]);

  useEffect(() => { load(); }, [load]);

  async function call(key: string, rpc: string, args: Record<string, unknown>) {
    setBusy(key); setErr(null);
    const { error } = await supabase.rpc(rpc, args);
    setBusy(null);
    if (error) { setErr(error.message); return false; }
    await load();
    return true;
  }

  const toggleCat = (c: Category) =>
    call('cat' + c.id, 'admin_upsert_category', { p_id: c.id, p_restaurant_id: restaurant.id, p_name: c.name, p_icon: c.icon, p_sort_order: c.sort_order, p_is_active: !c.is_active });

  const addCat = async () => {
    if (!newCat.name.trim()) return;
    const ok = await call('newcat', 'admin_upsert_category', { p_id: null, p_restaurant_id: restaurant.id, p_name: newCat.name, p_icon: newCat.icon, p_sort_order: parseInt(newCat.sort_order || '0', 10), p_is_active: true });
    if (ok) setNewCat({ name: '', icon: '', sort_order: '0' });
  };

  const toggleProd = (p: Product) =>
    call('prod' + p.id, 'admin_upsert_product', { p_id: p.id, p_restaurant_id: restaurant.id, p_category_id: p.category_id, p_name: p.name, p_description: p.description, p_price: p.price, p_photo_url: p.photo_url, p_is_available: !p.is_available });

  const saveProd = async () => {
    if (!pform) return;
    if (!pform.name.trim() || !pform.price) { setErr('Nom et prix obligatoires.'); return; }
    const ok = await call('saveprod', 'admin_upsert_product', {
      p_id: pform.id, p_restaurant_id: restaurant.id, p_category_id: pform.category_id || null,
      p_name: pform.name, p_description: pform.description, p_price: parseInt(pform.price, 10),
      p_photo_url: pform.photo_url, p_is_available: pform.is_available,
    });
    if (ok) setPform(null);
  };

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? 'Sans catégorie';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn ghost" onClick={onBack}>← Restaurants</button>
        <h2 style={{ margin: 0 }}>Menu — {restaurant.name}</h2>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setPform({ ...EMPTY_PROD, category_id: cats[0]?.id ?? '' })}>+ Produit</button>
      </div>
      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>{err}</div> : null}

      {pform ? (
        <div className="card" style={{ marginBottom: 16, maxWidth: 640 }}>
          <h2>{pform.id ? 'Modifier le produit' : 'Nouveau produit'}</h2>
          <div className="grid" style={{ gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ flex: 2 }}><div className="muted" style={lbl}>Nom</div><input style={inp} value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} /></label>
              <label style={{ flex: 1 }}><div className="muted" style={lbl}>Prix (Ar)</div><input style={inp} type="number" value={pform.price} onChange={(e) => setPform({ ...pform, price: e.target.value })} /></label>
            </div>
            <label><div className="muted" style={lbl}>Catégorie</div>
              <select style={inp} value={pform.category_id} onChange={(e) => setPform({ ...pform, category_id: e.target.value })}>
                <option value="">— sans catégorie —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label><div className="muted" style={lbl}>Description (composition)</div><input style={inp} value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} /></label>
            <label><div className="muted" style={lbl}>Photo (URL — laisser vide affiche les initiales)</div><input style={inp} value={pform.photo_url} onChange={(e) => setPform({ ...pform, photo_url: e.target.value })} placeholder="https://…" /></label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={pform.is_available} onChange={(e) => setPform({ ...pform, is_available: e.target.checked })} /> Disponible</label>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={saveProd} disabled={busy === 'saveprod'}>Enregistrer</button>
            <button className="btn ghost" onClick={() => setPform(null)}>Annuler</button>
          </div>
        </div>
      ) : null}

      <div className="grid cols-2">
        <div className="card">
          <h2>Produits</h2>
          {prods.length === 0 ? <div className="empty">Aucun produit.</div> : (
            <table>
              <thead><tr><th>Produit</th><th>Catégorie</th><th className="num">Prix</th><th>Dispo</th><th></th></tr></thead>
              <tbody>
                {prods.map((p) => (
                  <tr key={p.id} style={{ opacity: p.is_available ? 1 : 0.5 }}>
                    <td>{p.name}</td>
                    <td className="muted">{catName(p.category_id)}</td>
                    <td className="num">{formatAr(p.price)}</td>
                    <td>
                      <button className="btn ghost" style={sm} disabled={busy === 'prod' + p.id} onClick={() => toggleProd(p)}>
                        {p.is_available ? 'Oui' : 'Non'}
                      </button>
                    </td>
                    <td className="num"><button className="btn ghost" style={sm} onClick={() => setPform({ id: p.id, category_id: p.category_id ?? '', name: p.name, description: p.description ?? '', price: String(p.price), photo_url: p.photo_url ?? '', is_available: p.is_available })}>Éditer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Catégories</h2>
          {cats.length === 0 ? <div className="empty">Aucune catégorie.</div> : (
            <table>
              <thead><tr><th>Nom</th><th>Active</th></tr></thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                    <td>{c.icon ? `${c.icon} ` : ''}{c.name}</td>
                    <td><button className="btn ghost" style={sm} disabled={busy === 'cat' + c.id} onClick={() => toggleCat(c)}>{c.is_active ? 'Oui' : 'Non'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div className="muted" style={lbl}>Ajouter une catégorie</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Nom" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input style={{ ...inp, width: 60 }} placeholder="🍕" value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} />
              <input style={{ ...inp, width: 60 }} type="number" title="ordre" value={newCat.sort_order} onChange={(e) => setNewCat({ ...newCat, sort_order: e.target.value })} />
              <button className="btn" style={sm} onClick={addCat} disabled={busy === 'newcat' || !newCat.name.trim()}>+</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const inp: React.CSSProperties = { width: '100%', background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '9px 12px', borderRadius: 8, fontSize: 14 };
const sm: React.CSSProperties = { padding: '5px 12px', fontSize: 12 };
const lbl: React.CSSProperties = { fontSize: 12, marginBottom: 4 };
