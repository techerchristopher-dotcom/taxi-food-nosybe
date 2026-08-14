'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr, minutesSince, PAYMENT_LABEL, STATUS_LABEL, timeLabel } from '../lib/util';

const POLL_MS = 10000;
const LATE_RECUE_MIN = 10; // reçue depuis > 10 min
const LATE_UNASSIGNED_MIN = 10; // prête (en_livraison) sans livreur depuis > 10 min

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  courier_id: string | null;
  picked_up_at: string | null;
  status_updated_at: string | null;
  payment_method: string;
  restaurants: { name: string } | { name: string }[] | null;
};

type CourierRow = { user_id: string; zone: string | null };

function restoName(r: OrderRow['restaurants']): string {
  const v = Array.isArray(r) ? r[0] : r;
  return v?.name ?? '—';
}

function isLate(o: OrderRow): boolean {
  if (o.status === 'recue') return minutesSince(o.created_at) >= LATE_RECUE_MIN;
  if (o.status === 'en_livraison' && !o.courier_id) {
    return minutesSince(o.status_updated_at ?? o.created_at) >= LATE_UNASSIGNED_MIN;
  }
  return false;
}

export function Realtime() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, c] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, courier_id, picked_up_at, status_updated_at, payment_method, restaurants ( name )')
        .not('status', 'in', '(livree,annulee)')
        .order('created_at', { ascending: true }),
      supabase.from('couriers').select('user_id, zone').eq('is_available', true),
    ]);
    if (o.error) { setErr(o.error.message); return; }
    if (c.error) { setErr(c.error.message); return; }
    setErr(null);
    const orderRows = (o.data ?? []) as unknown as OrderRow[];
    const courierRows = (c.data ?? []) as CourierRow[];
    setOrders(orderRows);
    setCouriers(courierRows);

    // Noms des livreurs (profiles) pour l'affichage.
    const ids = Array.from(
      new Set([...courierRows.map((x) => x.user_id), ...orderRows.map((x) => x.courier_id).filter(Boolean) as string[]]),
    );
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) map[p.id] = p.full_name ?? '—';
      setNames(map);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const byStatus = (s: string) => orders.filter((o) => o.status === s).length;
  const activeCourier = (uid: string) =>
    orders.find((o) => o.courier_id === uid && o.status === 'en_livraison') ?? null;

  return (
    <>
      <div className="stat-row">
        <div className="stat"><div className="label">Commandes actives</div><div className="value">{orders.length}</div></div>
        <div className="stat"><div className="label">Reçues</div><div className="value">{byStatus('recue')}</div></div>
        <div className="stat"><div className="label">En préparation</div><div className="value">{byStatus('confirmee') + byStatus('en_preparation')}</div></div>
        <div className="stat"><div className="label">En livraison</div><div className="value">{byStatus('en_livraison')}</div></div>
        <div className="stat"><div className="label">Livreurs dispo</div><div className="value">{couriers.length}</div></div>
      </div>

      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}

      <div className="grid cols-2">
        <div className="card">
          <h2>Commandes en cours</h2>
          {orders.length === 0 ? (
            <div className="empty">Aucune commande active.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Restaurant</th><th>Statut</th><th>Livreur</th><th>Heure</th><th className="num">Montant</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.order_number}</td>
                    <td>{restoName(o.restaurants)}</td>
                    <td>
                      <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                      {isLate(o) ? <span className="badge-late">RETARD</span> : null}
                    </td>
                    <td>
                      {o.status === 'en_livraison'
                        ? o.courier_id
                          ? `${names[o.courier_id] ?? '—'}${o.picked_up_at ? ' (récupérée)' : ''}`
                          : <span className="muted">à prendre</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td>{timeLabel(o.created_at)}</td>
                    <td className="num">{formatAr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Livreurs disponibles</h2>
          {couriers.length === 0 ? (
            <div className="empty">Aucun livreur disponible.</div>
          ) : (
            <table>
              <thead><tr><th>Livreur</th><th>Course en cours</th></tr></thead>
              <tbody>
                {couriers.map((c) => {
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
            Rafraîchissement auto toutes les {POLL_MS / 1000}s. Paiement : {Object.values(PAYMENT_LABEL).join(' · ')}.
          </p>
        </div>
      </div>
    </>
  );
}
