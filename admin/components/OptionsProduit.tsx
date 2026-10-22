'use client';

/**
 * Suppléments et accompagnements (2026-10-22).
 *
 * Avant : aucun écran — les groupes d'options et les options ne se modifiaient qu'en
 * SQL, par migration. Deux blocs ici :
 *   - `SupplementsResto` : un interrupteur par NOM d'option, pour tout le restaurant
 *     (« plus de frites » = un geste, sur tous les plats) — même geste que le
 *     restaurateur dans ses Réglages ;
 *   - `OptionsProduit` : les groupes et options d'UN plat, entièrement modifiables
 *     (nom, prix, emballage, disponibilité, ordre, groupe obligatoire, min / max),
 *     ajout et suppression.
 *
 * Toutes les écritures passent par des RPC `is_admin()` tracées dans `admin_actions`.
 * Supprimer une option ne casse aucune commande passée : elles gardent leur copie.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';

type Option = {
  id: string; name: string; price_delta: number; is_available: boolean; sort_order: number; packaging_fee: number | null;
};
type Groupe = {
  id: string; name: string; min_select: number; max_select: number; required: boolean; sort_order: number;
  product_options: Option[];
};

const inp: React.CSSProperties = { width: '100%', background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontSize: 14 };
const sm: React.CSSProperties = { padding: '5px 12px', fontSize: 12 };
const lbl: React.CSSProperties = { fontSize: 12, marginBottom: 4 };

function messageOption(m: string): string {
  if (m.includes('option:nom_groupe_trop_court')) return 'Nom du groupe : au moins 2 caractères.';
  if (m.includes('option:max_inferieur_au_min')) return 'Le maximum doit être au moins égal au minimum.';
  if (m.includes('option:nom_vide')) return 'Nom de l’option obligatoire.';
  if (m.includes('option:prix_negatif')) return 'Le prix ne peut pas être négatif.';
  if (m.includes('option:emballage_negatif')) return 'L’emballage ne peut pas être négatif.';
  return m;
}

const entier = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

// ─────────────────────────────────────────────── Tout le restaurant, par nom

type Supplement = { cle: string; nom: string; ids: string[]; dispo: number; prix: Set<number>; plats: Set<string> };

export function SupplementsResto({ restaurantId, version }: { restaurantId: string; version: number }) {
  const [liste, setListe] = useState<Supplement[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_option_groups')
      .select('product_id, products!inner ( restaurant_id, is_archived ), product_options ( id, name, price_delta, is_available )')
      .eq('products.restaurant_id', restaurantId)
      .eq('products.is_archived', false);
    if (error) { setErr(error.message); return; }
    const m = new Map<string, Supplement>();
    for (const g of (data ?? []) as unknown as { product_id: string; product_options: Option[] | null }[]) {
      for (const o of g.product_options ?? []) {
        const nom = o.name.trim().replace(/\s+/g, ' ');
        const cle = nom.toLowerCase();
        const e = m.get(cle) ?? { cle, nom, ids: [], dispo: 0, prix: new Set<number>(), plats: new Set<string>() };
        e.ids.push(o.id); if (o.is_available) e.dispo += 1; e.prix.add(o.price_delta ?? 0); e.plats.add(g.product_id);
        m.set(cle, e);
      }
    }
    const max = (s: Supplement) => Math.max(...s.prix);
    setListe([...m.values()].sort((a, b) => (max(b) > 0 ? 1 : 0) - (max(a) > 0 ? 1 : 0) || a.nom.localeCompare(b.nom, 'fr')));
    setErr(null);
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load, version]);

  async function basculer(s: Supplement, dispo: boolean) {
    setBusy(s.cle); setErr(null);
    const { error } = await supabase.rpc('admin_set_options_available', { p_restaurant_id: restaurantId, p_option_ids: s.ids, p_available: dispo });
    setBusy(null);
    if (error) setErr(messageOption(error.message)); else await load();
  }

  if (!liste.length) return null;
  const coupes = liste.filter((s) => s.dispo < s.ids.length).length;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Suppléments du restaurant</h2>
        <span className="muted" style={{ fontSize: 13 }}>{liste.length} · {coupes ? `${coupes} coupé${coupes > 1 ? 's' : ''}` : 'tous disponibles'}</span>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" style={sm} onClick={() => setOuvert(!ouvert)}>{ouvert ? 'Replier' : 'Afficher'}</button>
      </div>
      {err ? <p style={{ color: 'var(--red)' }}>{err}</p> : null}
      {ouvert ? (
        <>
          <p className="muted" style={{ fontSize: 13 }}>
            Un interrupteur par nom : il agit sur tous les plats qui proposent ce choix. Pour changer un prix ou un nom,
            ouvre le plat (« Éditer ») et son bloc « Suppléments et choix ».
          </p>
          <table className="cartes">
            <thead><tr><th>Supplément</th><th className="num">Prix</th><th className="num">Plats</th><th>Disponible</th></tr></thead>
            <tbody>
              {liste.map((s) => {
                const tout = s.dispo === s.ids.length;
                const prix = [...s.prix].sort((a, b) => a - b);
                const mx = prix[prix.length - 1] ?? 0;
                return (
                  <tr key={s.cle} style={{ opacity: tout ? 1 : 0.6 }}>
                    <td data-label="Supplément">{s.nom}</td>
                    <td data-label="Prix" className="num">{mx <= 0 ? 'inclus' : prix.length > 1 && prix[0] !== mx ? `+${formatAr(prix[0])} à +${formatAr(mx)}` : `+${formatAr(mx)}`}</td>
                    <td data-label="Plats" className="num">{s.plats.size}</td>
                    <td data-label="Disponible">
                      <button className="btn ghost" style={sm} disabled={busy === s.cle} onClick={() => void basculer(s, !tout)}>
                        {tout ? 'Oui — couper' : s.dispo === 0 ? 'Non — rallumer' : `Partiel (${s.dispo}/${s.ids.length}) — rallumer`}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────── Un plat : groupes et options

type GroupeForm = { name: string; min: string; max: string; required: boolean; sort: string };
type OptionForm = { name: string; price: string; packaging: string; available: boolean; sort: string };

export function OptionsProduit({ productId, onChange }: { productId: string; onChange?: () => void }) {
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [gEdit, setGEdit] = useState<Record<string, GroupeForm>>({});
  const [oEdit, setOEdit] = useState<Record<string, OptionForm>>({});
  const [nouveauGroupe, setNouveauGroupe] = useState<GroupeForm | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_option_groups')
      .select('id, name, min_select, max_select, required, sort_order, product_options ( id, name, price_delta, is_available, sort_order, packaging_fee )')
      .eq('product_id', productId)
      .order('sort_order');
    if (error) { setErr(error.message); return; }
    setGroupes(((data ?? []) as Groupe[]).map((g) => ({ ...g, product_options: [...(g.product_options ?? [])].sort((a, b) => a.sort_order - b.sort_order) })));
    setGEdit({}); setOEdit({}); setErr(null);
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  async function rpc(key: string, nom: string, args: Record<string, unknown>, confirmer?: string) {
    if (confirmer && !window.confirm(confirmer)) return;
    setBusy(key); setErr(null);
    const { error } = await supabase.rpc(nom, args);
    setBusy(null);
    if (error) { setErr(messageOption(error.message)); return; }
    await load();
    onChange?.();
  }

  const gForm = (g: Groupe): GroupeForm => gEdit[g.id] ?? { name: g.name, min: String(g.min_select), max: String(g.max_select), required: g.required, sort: String(g.sort_order) };
  const oForm = (o: Option): OptionForm => oEdit[o.id] ?? { name: o.name, price: String(o.price_delta ?? 0), packaging: String(o.packaging_fee ?? 0), available: o.is_available, sort: String(o.sort_order) };
  const nouvelleCle = (gid: string) => `new-${gid}`;
  const oNouveau = (gid: string): OptionForm => oEdit[nouvelleCle(gid)] ?? { name: '', price: '0', packaging: '0', available: true, sort: '0' };

  function champsGroupe(f: GroupeForm, set: (f: GroupeForm) => void) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '2 1 180px' }}><div className="muted" style={lbl}>Nom du groupe</div><input style={inp} value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} placeholder="ex. Accompagnement" /></label>
        <label style={{ width: 70 }}><div className="muted" style={lbl}>Min</div><input style={inp} inputMode="numeric" value={f.min} onChange={(e) => set({ ...f, min: e.target.value })} /></label>
        <label style={{ width: 70 }}><div className="muted" style={lbl}>Max</div><input style={inp} inputMode="numeric" value={f.max} onChange={(e) => set({ ...f, max: e.target.value })} /></label>
        <label style={{ width: 70 }}><div className="muted" style={lbl}>Ordre</div><input style={inp} inputMode="numeric" value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value })} /></label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={f.required} onChange={(e) => set({ ...f, required: e.target.checked })} /> Obligatoire</label>
      </div>
    );
  }

  function champsOption(f: OptionForm, set: (f: OptionForm) => void) {
    return (
      <>
        <input style={{ ...inp, flex: '2 1 150px' }} value={f.name} placeholder="Nom (ex. Frites)" onChange={(e) => set({ ...f, name: e.target.value })} />
        <label style={{ width: 110 }}><div className="muted" style={lbl}>Prix + (Ar)</div><input style={inp} inputMode="numeric" value={f.price} onChange={(e) => set({ ...f, price: e.target.value })} /></label>
        <label style={{ width: 100 }}><div className="muted" style={lbl}>Emballage</div><input style={inp} inputMode="numeric" value={f.packaging} onChange={(e) => set({ ...f, packaging: e.target.value })} /></label>
        <label style={{ width: 64 }}><div className="muted" style={lbl}>Ordre</div><input style={inp} inputMode="numeric" value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value })} /></label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}><input type="checkbox" checked={f.available} onChange={(e) => set({ ...f, available: e.target.checked })} /> Dispo</label>
      </>
    );
  }

  return (
    <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <h3 style={{ margin: '0 0 6px' }}>Suppléments et choix</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        « Prix + » s’ajoute au prix du plat (0 = inclus). « Obligatoire » force le client à choisir au moins le minimum.
        Supprimer ne touche pas aux commandes déjà passées.
      </p>
      {err ? <p style={{ color: 'var(--red)', fontWeight: 600 }}>{err}</p> : null}

      {groupes.length === 0 ? <div className="empty">Aucun choix sur ce plat.</div> : null}

      {groupes.map((g) => {
        const f = gForm(g);
        const modifie = !!gEdit[g.id];
        const nv = oNouveau(g.id);
        return (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            {champsGroupe(f, (x) => setGEdit((e) => ({ ...e, [g.id]: x })))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn" style={sm} disabled={!modifie || busy === 'g' + g.id}
                onClick={() => void rpc('g' + g.id, 'admin_upsert_option_group', { p_id: g.id, p_product_id: productId, p_name: f.name, p_min_select: entier(f.min), p_max_select: entier(f.max), p_required: f.required, p_sort_order: entier(f.sort) })}>
                Enregistrer le groupe
              </button>
              <button className="btn ghost" style={{ ...sm, color: 'var(--red)' }} disabled={busy === 'gd' + g.id}
                onClick={() => void rpc('gd' + g.id, 'admin_delete_option_group', { p_id: g.id }, `Supprimer le groupe « ${g.name} » et ses ${g.product_options.length} option(s) ?`)}>
                Supprimer le groupe
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              {g.product_options.map((o) => {
                const of = oForm(o);
                const om = !!oEdit[o.id];
                return (
                  <div key={o.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '6px 0', borderTop: '1px dashed var(--border)', opacity: of.available ? 1 : 0.6 }}>
                    {champsOption(of, (x) => setOEdit((e) => ({ ...e, [o.id]: x })))}
                    <button className="btn" style={sm} disabled={!om || busy === 'o' + o.id}
                      onClick={() => void rpc('o' + o.id, 'admin_upsert_option', { p_id: o.id, p_group_id: g.id, p_name: of.name, p_price_delta: entier(of.price), p_is_available: of.available, p_sort_order: entier(of.sort), p_packaging_fee: entier(of.packaging) })}>
                      Enregistrer
                    </button>
                    <button className="btn ghost" style={{ ...sm, color: 'var(--red)' }} disabled={busy === 'od' + o.id}
                      onClick={() => void rpc('od' + o.id, 'admin_delete_option', { p_id: o.id }, `Supprimer « ${o.name} » ?`)}>
                      ✕
                    </button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '8px 0 0', borderTop: '1px dashed var(--border)' }}>
                {champsOption(nv, (x) => setOEdit((e) => ({ ...e, [nouvelleCle(g.id)]: x })))}
                <button className="btn" style={sm} disabled={!nv.name.trim() || busy === 'on' + g.id}
                  onClick={() => void rpc('on' + g.id, 'admin_upsert_option', { p_id: null, p_group_id: g.id, p_name: nv.name, p_price_delta: entier(nv.price), p_is_available: nv.available, p_sort_order: entier(nv.sort), p_packaging_fee: entier(nv.packaging) })}>
                  + Ajouter l’option
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {nouveauGroupe ? (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 12 }}>
          {champsGroupe(nouveauGroupe, setNouveauGroupe)}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" style={sm} disabled={nouveauGroupe.name.trim().length < 2 || busy === 'gn'}
              onClick={async () => { await rpc('gn', 'admin_upsert_option_group', { p_id: null, p_product_id: productId, p_name: nouveauGroupe.name, p_min_select: entier(nouveauGroupe.min), p_max_select: entier(nouveauGroupe.max), p_required: nouveauGroupe.required, p_sort_order: entier(nouveauGroupe.sort) }); setNouveauGroupe(null); }}>
              Créer le groupe
            </button>
            <button className="btn ghost" style={sm} onClick={() => setNouveauGroupe(null)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost" style={sm} onClick={() => setNouveauGroupe({ name: '', min: '0', max: '1', required: false, sort: String((groupes.length + 1) * 10) })}>
          + Nouveau groupe de choix
        </button>
      )}
    </div>
  );
}
