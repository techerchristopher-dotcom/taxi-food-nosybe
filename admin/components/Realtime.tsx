'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CSSProperties } from 'react';
import { formatAr, minutesSince, PAYMENT_LABEL, STATUS_LABEL, timeLabel } from '../lib/util';

/**
 * Écran de pilotage du service.
 *
 * Il ne sert pas à consulter des statistiques : il sert à AGIR pendant qu'une
 * commande est en cours. D'où trois partis pris.
 *
 * 1. TEMPS RÉEL, pas un rafraîchissement périodique. Une commande qui met dix
 *    secondes à apparaître pendant un coup de feu est une commande qu'on traite
 *    dix secondes trop tard. Le sondage reste en filet de sécurité — une
 *    connexion temps réel peut tomber sans prévenir, et un écran de pilotage
 *    silencieusement figé est pire qu'un écran lent.
 * 2. UN SON à chaque nouvelle commande. Sans lui, il faut fixer l'écran ; avec
 *    lui, on peut faire autre chose. Il ne part qu'après une première
 *    interaction : les navigateurs bloquent le son tant que la page n'a pas été
 *    touchée, et un son « qui ne marche pas » ferait perdre confiance.
 * 3. LES NUMÉROS DIRECTEMENT SUR LA LIGNE. Chercher le téléphone d'un client
 *    ailleurs pendant qu'il attend, c'est la minute qu'on n'a pas.
 */

const fInp: CSSProperties = {
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '6px 10px', borderRadius: 8, fontSize: 13,
};
const btn: CSSProperties = {
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '4px 9px', borderRadius: 7, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
};

const POLL_MS = 20000;          // filet de sécurité derrière le temps réel
const LATE_RECUE_MIN = 10;
const LATE_UNASSIGNED_MIN = 10;

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  courier_id: string | null;
  user_id: string | null;
  picked_up_at: string | null;
  status_updated_at: string | null;
  payment_method: string;
  restaurants: { id: string; name: string; phone: string | null } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  addresses: { zone: string | null; landmark: string | null; phone: string | null; latitude: number | null; longitude: number | null } | null;
};

type CourierRow = { user_id: string; zone: string | null; is_available: boolean };
type RestoRow = { id: string; name: string; is_open: boolean; listing_status: string };

/** PostgREST renvoie un embed to-one comme objet, mais son typage suppose un tableau. */
function un<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function isLate(o: OrderRow): boolean {
  if (o.status === 'recue') return minutesSince(o.created_at) >= LATE_RECUE_MIN;
  if (o.status === 'en_livraison' && !o.courier_id) {
    return minutesSince(o.status_updated_at ?? o.created_at) >= LATE_UNASSIGNED_MIN;
  }
  return false;
}

/** Étapes suivantes proposées, dans l'ordre du parcours réel. */
const SUITE: Record<string, string[]> = {
  recue: ['confirmee', 'annulee'],
  confirmee: ['en_preparation', 'annulee'],
  en_preparation: ['en_livraison', 'annulee'],
  en_livraison: ['livree', 'annulee'],
};

function bip() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => void ctx.close(), 800);
  } catch { /* son indisponible : le reste de l'écran fonctionne */ }
}

export function Realtime() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [restos, setRestos] = useState<RestoRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [jour, setJour] = useState<{ n: number; ca: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fResto, setFResto] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [son, setSon] = useState(true);

  // Sert à ne sonner que pour une commande RÉELLEMENT nouvelle, pas au premier
  // chargement — sinon l'écran carillonne à chaque ouverture.
  const connues = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const [o, c, r, j] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, courier_id, user_id, picked_up_at, status_updated_at, payment_method, restaurants ( id, name, phone ), profiles ( full_name, phone ), addresses ( zone, landmark, phone, latitude, longitude )')
        .not('status', 'in', '(livree,annulee)')
        .order('created_at', { ascending: true }),
      // Tous les livreurs, pas seulement les disponibles : l'assignation
      // manuelle sert justement quand l'etat declare ne colle plus au terrain.
      supabase.from('couriers').select('user_id, zone, is_available'),
      supabase.from('restaurants').select('id, name, is_open, listing_status').order('name'),
      supabase.from('orders').select('total, status').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);
    if (o.error) { setErr(o.error.message); return; }
    setErr(null);
    const rows = (o.data ?? []) as unknown as OrderRow[];

    if (connues.current === null) {
      connues.current = new Set(rows.map((x) => x.id));
    } else {
      const nouvelles = rows.filter((x) => !connues.current!.has(x.id));
      if (nouvelles.length && son) bip();
      for (const x of rows) connues.current.add(x.id);
    }

    setOrders(rows);
    setCouriers((c.data ?? []) as CourierRow[]);
    setRestos((r.data ?? []) as RestoRow[]);

    const dj = (j.data ?? []) as { total: number; status: string }[];
    const livrees = dj.filter((x) => x.status !== 'annulee');
    setJour({ n: livrees.length, ca: livrees.reduce((s, x) => s + (x.total ?? 0), 0) });

    const ids = Array.from(new Set([
      ...((c.data ?? []) as CourierRow[]).map((x) => x.user_id),
      ...rows.map((x) => x.courier_id).filter(Boolean) as string[],
    ]));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) map[p.id] = p.full_name ?? '—';
      setNames(map);
    }
  }, [son]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const canal = supabase
      .channel('pilotage-commandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe((st) => setLive(st === 'SUBSCRIBED'));
    return () => { clearInterval(t); void supabase.removeChannel(canal); };
  }, [load]);

  async function changerStatut(o: OrderRow, statut: string) {
    let motif: string | null = null;
    if (statut === 'annulee') {
      motif = window.prompt(`Annuler la commande ${o.order_number} — motif ?`);
      if (!motif?.trim()) return;
    } else if (!window.confirm(`Passer ${o.order_number} en « ${STATUS_LABEL[statut] ?? statut} » ?`)) {
      return;
    }
    setBusy(o.id);
    const { error } = await supabase.rpc('admin_set_order_status', {
      p_order_id: o.id, p_new_status: statut, p_reason: motif,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function assigner(o: OrderRow, courierId: string) {
    setBusy(o.id);
    const { error } = await supabase.rpc('admin_assign_courier', {
      p_order_id: o.id, p_courier_id: courierId || null,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  async function basculerResto(r: RestoRow) {
    if (!window.confirm(`${r.is_open ? 'Fermer' : 'Ouvrir'} « ${r.name} » ?`)) return;
    setBusy(r.id);
    const { error } = await supabase.rpc('admin_set_restaurant_open', {
      p_restaurant_id: r.id, p_is_open: !r.is_open,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  const dispos = couriers.filter((c) => c.is_available);
  const byStatus = (s: string) => orders.filter((o) => o.status === s).length;
  const activeCourier = (uid: string) =>
    orders.find((o) => o.courier_id === uid && o.status === 'en_livraison') ?? null;

  const noms = Array.from(new Set(orders.map((o) => un(o.restaurants)?.name ?? '—'))).sort();
  const filtered = orders.filter((o) =>
    (!fResto || un(o.restaurants)?.name === fResto) &&
    (!fStatus || o.status === fStatus) &&
    (!fSearch || o.order_number.toLowerCase().includes(fSearch.toLowerCase())));

  return (
    <>
      <div className="stat-row">
        <div className="stat"><div className="label">Commandes actives</div><div className="value">{orders.length}</div></div>
        <div className="stat"><div className="label">Reçues</div><div className="value">{byStatus('recue')}</div></div>
        <div className="stat"><div className="label">En préparation</div><div className="value">{byStatus('confirmee') + byStatus('en_preparation')}</div></div>
        <div className="stat"><div className="label">En livraison</div><div className="value">{byStatus('en_livraison')}</div></div>
        <div className="stat"><div className="label">Livreurs dispo</div><div className="value">{dispos.length}</div></div>
        <div className="stat"><div className="label">Aujourd&apos;hui</div><div className="value">{jour?.n ?? '—'}</div></div>
        <div className="stat"><div className="label">CA du jour</div><div className="value" style={{ fontSize: 18 }}>{jour ? formatAr(jour.ca) : '—'}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '0 0 14px', fontSize: 12 }}>
        <span className="muted">
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 6,
            background: live ? 'var(--green, #2fbf71)' : 'var(--red, #e04b4b)',
          }} />
          {live ? 'Temps réel actif' : `Temps réel interrompu — rafraîchissement toutes les ${POLL_MS / 1000}s`}
        </span>
        <label className="muted" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={son} onChange={(e) => setSon(e.target.checked)} style={{ marginRight: 6 }} />
          Son à chaque nouvelle commande
        </label>
      </div>

      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Commandes en cours</h2>
          <input placeholder="N° commande…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} style={fInp} />
          <select value={fResto} onChange={(e) => setFResto(e.target.value)} style={fInp}>
            <option value="">Tous restaurants</option>
            {noms.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={fInp}>
            <option value="">Tous statuts</option>
            {['recue', 'confirmee', 'en_preparation', 'en_livraison'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">Aucune commande.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Restaurant</th><th>Client</th><th>Statut</th><th>Livreur</th>
                <th>Heure</th><th className="num">Montant</th><th>Agir</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const r = un(o.restaurants);
                const c = un(o.profiles);
                const a = un(o.addresses);
                const telClient = c?.phone || a?.phone || null;
                return (
                  <tr key={o.id}>
                    <td>{o.order_number}</td>
                    <td>
                      {r?.name ?? '—'}
                      {r?.phone
                        ? <a href={`tel:${r.phone}`} style={{ ...btn, marginLeft: 6, textDecoration: 'none', display: 'inline-block' }}>📞 resto</a>
                        : <span className="muted" style={{ marginLeft: 6, fontSize: 11 }} title="Le restaurant n'a pas saisi son numéro dans ses réglages">n° absent</span>}
                    </td>
                    <td>
                      {c?.full_name ?? '—'}
                      {telClient
                        ? <a href={`tel:${telClient}`} style={{ ...btn, marginLeft: 6, textDecoration: 'none', display: 'inline-block' }}>📞 client</a>
                        : null}
                      {a?.latitude != null && a?.longitude != null
                        ? <a href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer"
                             style={{ ...btn, marginLeft: 6, textDecoration: 'none', display: 'inline-block' }}>📍</a>
                        : <span className="badge-late" style={{ marginLeft: 6 }}>SANS GPS</span>}
                      {a?.landmark ? <div className="muted" style={{ fontSize: 11 }}>{a.landmark}</div> : null}
                    </td>
                    <td>
                      <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                      {isLate(o) ? <span className="badge-late">RETARD</span> : null}
                    </td>
                    <td>
                      {/* Assignable des que la commande est prete a partir. Avant, le
                          plat n'est pas fait : assigner n'aurait aucun sens. */}
                      {o.status === 'en_livraison' ? (
                        <>
                          <select
                            value={o.courier_id ?? ''}
                            disabled={busy === o.id}
                            onChange={(e) => void assigner(o, e.target.value)}
                            style={{ ...fInp, fontSize: 12, padding: '3px 6px', maxWidth: 150 }}
                          >
                            <option value="">— à prendre —</option>
                            {couriers.map((c) => (
                              <option key={c.user_id} value={c.user_id}>
                                {names[c.user_id] ?? c.user_id.slice(0, 8)}{c.is_available ? '' : ' (indispo.)'}
                              </option>
                            ))}
                          </select>
                          {o.picked_up_at ? <div className="muted" style={{ fontSize: 11 }}>récupérée</div> : null}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{timeLabel(o.created_at)}</td>
                    <td className="num">{formatAr(o.total)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {(SUITE[o.status] ?? []).map((s) => (
                          <button key={s} onClick={() => void changerStatut(o, s)} disabled={busy === o.id}
                                  style={{ ...btn, ...(s === 'annulee' ? { color: 'var(--red)' } : {}) }}>
                            {STATUS_LABEL[s] ?? s}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Restaurants — ouverture</h2>
          <table>
            <thead><tr><th>Restaurant</th><th>État</th><th>Catalogue</th><th></th></tr></thead>
            <tbody>
              {restos.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><span className={`pill ${r.is_open ? 'en_livraison' : 'annulee'}`}>{r.is_open ? 'Ouvert' : 'Fermé'}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {r.listing_status === 'hidden' ? 'masqué'
                      : r.listing_status === 'coming_soon' ? 'bientôt disponible' : 'visible'}
                  </td>
                  <td>
                    <button onClick={() => void basculerResto(r)} disabled={busy === r.id} style={btn}>
                      {r.is_open ? 'Fermer' : 'Ouvrir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            ⚠️ « Masqué » et « bientôt disponible » ne se règlent pas ici : ils changent ce que
            voient les clients dans l&apos;app, pas seulement l&apos;ouverture du jour.
          </p>
        </div>

        <div className="card">
          <h2>Livreurs disponibles</h2>
          {dispos.length === 0 ? (
            <div className="empty">Aucun livreur disponible.</div>
          ) : (
            <table>
              <thead><tr><th>Livreur</th><th>Course en cours</th></tr></thead>
              <tbody>
                {dispos.map((c) => {
                  const cur = activeCourier(c.user_id);
                  return (
                    <tr key={c.user_id}>
                      <td><span className="dot-avail" />{names[c.user_id] ?? '—'}</td>
                      <td>{cur ? `#${cur.order_number}` : <span className="muted">libre</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Paiement : {Object.values(PAYMENT_LABEL).join(' · ')}. Toute action passée depuis cet
            écran est journalisée (qui, quoi, quand). Un livreur peut être assigné à la main
            depuis la colonne « Livreur » d&apos;une commande en livraison, même s&apos;il s&apos;est
            déclaré indisponible — c&apos;est précisément à ça que sert le rattrapage.
          </p>
        </div>
      </div>
    </>
  );
}
