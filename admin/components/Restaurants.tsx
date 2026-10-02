'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';
import { MenuManager } from './MenuManager';
import { resume, type Resultat } from '../lib/annonce';

/** Compteurs d'intérêt d'un restaurant en négociation (admin_interet_restaurants). */
type Interet = { restaurant_id: string; visites: number; visiteurs: number; alertes: number };
/** Une personne qui attend (ou a regardé) un restaurant — admin_interet_restaurant_detail. */
type Attente = { user_id: string; nom: string; email: string | null; telephone: string | null; kind: 'visite' | 'alerte'; quand: string };

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
  sort_order: number;
  listing_status: 'visible' | 'coming_soon' | 'hidden';
};

type FormState = {
  name: string; cuisine_type: string; delivery_fee: string; commissionPct: string;
  zone: string; is_open: boolean; min_order: string; food_types: string; opens_at: string; closes_at: string;
  sort_order: string;
};

const EMPTY: FormState = {
  name: '', cuisine_type: '', delivery_fee: '2000', commissionPct: '15', zone: '',
  is_open: true, min_order: '0', food_types: '', opens_at: '', closes_at: '', sort_order: '',
};

/** Ce que voit un client, dit avec ses mots : « Fermé » ne dit pas qu'on négocie encore. */
const STATUT: Record<Resto['listing_status'], { libelle: string; pastille: string }> = {
  visible: { libelle: 'Disponible', pastille: 'livree' },
  coming_soon: { libelle: 'En négociation', pastille: 'recue' },
  hidden: { libelle: 'Masqué', pastille: 'sans_objet' },
};

export function Restaurants() {
  const [list, setList] = useState<Resto[]>([]);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Resto | null>(null);
  const [menuFor, setMenuFor] = useState<Resto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [interet, setInteret] = useState<Record<string, Interet>>({});
  const [info, setInfo] = useState<string | null>(null);
  /** ✨ Fin de la mise en avant « Nouveau » par restaurant (null = jamais mis en avant). */
  const [nouveaux, setNouveaux] = useState<Record<string, string | null>>({});
  /** Liste ouverte : qui attend ce restaurant. */
  const [attentes, setAttentes] = useState<{ resto: Resto; lignes: Attente[] } | null>(null);

  const load = useCallback(async () => {
    // ⚠️ PAS de lecture directe de `restaurants` ICI. Depuis la migration
    // 20260917091000, `commission_rate` et `telegram_chat_id` ne sont plus
    // lisibles par `anon` NI par `authenticated` : n'importe quel client
    // connecte lisait le taux negocie avec chaque restaurant. La commission
    // revient par cette fonction, qui la rend au seul administrateur.
    // Memes colonnes, memes noms, deja triees par nom.
    const { data, error } = await supabase.rpc('admin_lister_restaurants');
    if (error) { setErr(error.message); return; }
    setList((data ?? []) as Resto[]);
    // Qui regarde les restaurants en négociation, et qui veut être prévenu.
    // « Nouveau » : colonnes publiques, lues à part pour ne pas toucher à la signature
    // d'admin_lister_restaurants (un changement de retour impose DROP + recréation).
    const { data: nv } = await supabase.from('restaurants').select('id, nouveau_jusqu_au');
    setNouveaux(Object.fromEntries(((nv ?? []) as { id: string; nouveau_jusqu_au: string | null }[])
      .map((x) => [x.id, x.nouveau_jusqu_au])));
    const { data: ints } = await supabase.rpc('admin_interet_restaurants');
    const map: Record<string, Interet> = {};
    for (const i of (ints ?? []) as Interet[]) map[i.restaurant_id] = i;
    setInteret(map);
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
      sort_order: String(r.sort_order),
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
    const { data, error } = editing
      ? await supabase.rpc('admin_update_restaurant', { p_id: editing.id, ...args })
      : await supabase.rpc('admin_create_restaurant', args);
    if (error) { setBusy(false); setErr(error.message); return; }

    // ⚠️ Le rang passe par SA PROPRE fonction, pas par un paramètre de plus sur
    // admin_update_restaurant : changer la signature de celle-ci créerait une
    // surcharge, et PostgREST répondrait PGRST203 sur cet écran. Champ laissé
    // vide = rang inchangé.
    const rang = form.sort_order.trim();
    const id = editing?.id ?? (data as { id?: string } | null)?.id;
    if (rang !== '' && id && (!editing || Number(rang) !== editing.sort_order)) {
      const { error: e2 } = await supabase.rpc('admin_ordonner_restaurant', {
        p_restaurant_id: id,
        p_sort_order: parseInt(rang, 10),
      });
      if (e2) { setBusy(false); setErr(`Restaurant enregistré, mais le rang a été refusé : ${e2.message}`); return; }
    }
    setBusy(false);
    setMode('list');
    await load();
  }

  /**
   * Passage d'un restaurant d'un statut de catalogue à l'autre. L'ouverture
   * (« En négociation » → « Disponible ») prévient ceux qui l'ont demandé : la
   * base écrit l'annonce, l'écran l'envoie par le même chemin que l'onglet
   * Annonces — jamais deux fois, la fonction Edge refuse un second envoi.
   */
  /** Prolonger (+jours) ou arrêter (null) la mise en avant « Nouveau » d'un restaurant. */
  async function reglerNouveau(r: Resto, jours: number | null) {
    const actuel = nouveaux[r.id];
    const depart = actuel && new Date(actuel) > new Date() ? new Date(actuel) : new Date();
    const jusqu = jours === null ? null : new Date(depart.getTime() + jours * 86_400_000).toISOString();
    const { error } = await supabase.rpc('admin_set_nouveau', { p_id: r.id, p_jusqu_au: jusqu });
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function changerStatut(r: Resto, statut: Resto['listing_status']) {
    if (statut === r.listing_status) return;
    const attendus = interet[r.id]?.alertes ?? 0;
    const question = statut === 'visible' && r.listing_status === 'coming_soon'
      ? `Ouvrir « ${r.name} » aux commandes ?${attendus ? ` ${attendus} client${attendus > 1 ? 's' : ''} seront prévenus (notification + e-mail).` : ' Personne n’a demandé à être prévenu.'}`
      : `Passer « ${r.name} » en « ${STATUT[statut].libelle} » ?`;
    if (!window.confirm(question)) return;
    setErr(null);
    setInfo(null);
    setBusy(true);
    try {
      const { data: annonceId, error } = await supabase.rpc('admin_set_listing_status', { p_id: r.id, p_status: statut });
      if (error) throw new Error(error.message);
      await load();
      if (annonceId) {
        const { data, error: envoiError } = await supabase.functions.invoke('envoyer-annonce', {
          body: { annonce_id: annonceId },
        });
        if (envoiError) throw new Error(`Restaurant ouvert, mais l’annonce n’est pas partie : ${envoiError.message}`);
        setInfo(`« ${r.name} » est ouvert. ${resume(data as Resultat)}`);
      } else {
        setInfo(`« ${r.name} » : statut mis à jour.`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function voirAttentes(r: Resto) {
    setErr(null);
    const { data, error } = await supabase.rpc('admin_interet_restaurant_detail', { p_restaurant_id: r.id });
    if (error) { setErr(error.message); return; }
    setAttentes({ resto: r, lignes: (data ?? []) as Attente[] });
  }

  if (attentes) {
    const alertes = attentes.lignes.filter((l) => l.kind === 'alerte');
    const visites = attentes.lignes.filter((l) => l.kind === 'visite' && !alertes.some((a) => a.user_id === l.user_id));
    const ligne = (l: Attente) => (
      <tr key={`${l.kind}-${l.user_id}`}>
        <td>{l.nom}</td>
        <td>{l.email ?? '—'}</td>
        <td>{l.telephone ?? '—'}</td>
        <td className="muted">{new Date(l.quand).toLocaleDateString('fr-FR')}</td>
      </tr>
    );
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button className="btn ghost" style={sm} onClick={() => setAttentes(null)}>← Restaurants</button>
          <h3 style={{ margin: 0 }}>{attentes.resto.name} — qui attend l’ouverture</h3>
        </div>
        <h4>{alertes.length} veulent être prévenus</h4>
        {alertes.length === 0 ? <div className="empty">Personne n’a encore demandé à être prévenu.</div> : (
          <table><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Depuis</th></tr></thead><tbody>{alertes.map(ligne)}</tbody></table>
        )}
        <h4 style={{ marginTop: 20 }}>{visites.length} ont seulement consulté la fiche</h4>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Ils ne seront pas prévenus : ils n’ont rien demandé. Ils comptent dans l’intérêt, c’est tout.</div>
        {visites.length === 0 ? <div className="empty">Aucune visite.</div> : (
          <table><thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Dernière visite</th></tr></thead><tbody>{visites.map(ligne)}</tbody></table>
        )}
      </div>
    );
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
          <div className="rangee">
            {/* ⚠️ Ce champ est le SOCLE, pas le prix final : depuis le 2026-09-24
                la livraison vaut ce montant jusqu'à 3 km, puis 1 000 Ar par
                kilomètre entamé (colonnes `livraison_km_inclus`,
                `livraison_prix_par_km`, `livraison_coef_route` sur
                `restaurants`, modifiables par `admin_set_tarif_livraison`). */}
            <Field label="Livraison — socle jusqu'à 3 km (Ar)"><input style={inp} type="number" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} /></Field>
            <Field label="Commission (%)"><input style={inp} type="number" step="0.5" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} /></Field>
            <Field label="Min. commande (Ar)"><input style={inp} type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} /></Field>
          </div>
          <Field label="Rang dans le catalogue (10, 20, 30… — plus petit = plus haut)">
            <input style={inp} type="number" inputMode="numeric" min={0} max={99999} value={form.sort_order}
                   onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="ex. 35 pour passer entre 30 et 40" />
          </Field>
          <div className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            Les restaurants disponibles passent toujours avant ceux en négociation, quel que soit leur rang :
            le rang ne classe qu'à l'intérieur de chaque groupe.
          </div>
          <Field label="Zone desservie"><input style={inp} value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Hell-Ville…" /></Field>
          <Field label="Types de plats (filtre accueil, séparés par des virgules)"><input style={inp} value={form.food_types} onChange={(e) => setForm({ ...form, food_types: e.target.value })} placeholder="Pizza, Tacos, Burger" /></Field>
          <div className="rangee">
            <Field label="Ouvre à"><input style={inp} type="time" value={form.opens_at} onChange={(e) => setForm({ ...form, opens_at: e.target.value })} /></Field>
            <Field label="Ferme à"><input style={inp} type="time" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} /></Field>
            <Field label="Interrupteur manuel"><label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}><input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} /> {form.is_open ? 'Ouvert' : 'Fermé'}</label></Field>
          </div>
          {/* ⚠️ Cette case n'est PAS l'ouverture du restaurant : en ouverture
              automatique, ce sont ses horaires qui décident et `is_open` n'est
              même pas lu. Le dire ici évite de croire qu'on vient de fermer un
              restaurant qui reste ouvert pour ses clients. */}
          <div className="muted" style={{ fontSize: 12, marginTop: -6 }}>
            ⚠️ L&apos;interrupteur manuel ne décide que si l&apos;ouverture automatique du restaurant
            est arrêtée ; sinon ce sont ses horaires qui décident. Pour ouvrir ou fermer
            réellement un restaurant, passer par l&apos;onglet <strong>Temps réel</strong>.
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
      {info ? <div style={{ color: 'var(--green, #2e7d32)', margin: '10px 0' }}>{info}</div> : null}
      {list.length === 0 ? (
        <div className="empty">Aucun restaurant.</div>
      ) : (
        <table>
          {/* Dans l'ordre EXACT du catalogue client : admin_lister_restaurants trie sur rang_catalogue. */}
          <thead><tr><th className="num">Rang</th><th>Nom</th><th>Catalogue</th><th>Interrupteur</th><th className="num">Commission</th><th className="num">Livraison</th><th></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.sort_order}</td>
                <td>{r.name}<div className="muted" style={{ fontSize: 12 }}>{r.cuisine_type ?? ''}{r.zone_served ? ` · ${r.zone_served}` : ''}</div></td>
                <td>
                  <select
                    value={r.listing_status}
                    disabled={busy}
                    onChange={(e) => changerStatut(r, e.target.value as Resto['listing_status'])}
                    className={`pill ${STATUT[r.listing_status]?.pastille ?? 'sans_objet'}`}
                    style={{ border: 'none', cursor: 'pointer' }}
                    title="Changer le statut catalogue"
                  >
                    {(Object.keys(STATUT) as Resto['listing_status'][]).map((s) => (
                      <option key={s} value={s}>{STATUT[s].libelle}</option>
                    ))}
                  </select>
                  {r.listing_status === 'visible' ? (() => {
                    const fin = nouveaux[r.id];
                    const actif = !!fin && new Date(fin) > new Date();
                    return (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {actif ? <span>✨ Nouveau jusqu'au <b>{new Date(fin!).toLocaleDateString('fr-FR')}</b></span> : null}
                        <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => reglerNouveau(r, actif ? 7 : 14)}>
                          {actif ? '+7 j' : 'Mettre en avant 14 j'}
                        </button>
                        {actif ? (
                          <button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => reglerNouveau(r, null)}>Arrêter</button>
                        ) : null}
                      </div>
                    );
                  })() : null}
                  {r.listing_status === 'coming_soon' && interet[r.id] ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }} title="Visites de la fiche · personnes distinctes · demandes « Me prévenir »">
                      {interet[r.id].visiteurs} ont consulté · <b>{interet[r.id].alertes}</b> veulent être prévenus
                      {' '}<button className="btn ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => voirAttentes(r)}>Voir</button>
                    </div>
                  ) : null}
                </td>
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
