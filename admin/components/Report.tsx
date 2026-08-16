'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr, todayNosyBe } from '../lib/util';

type DeliveredRow = {
  restaurant_id: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  courier_id: string | null;
  commission_amount: number | null;
  commission_rate: number | null;
};
type Resto = { id: string; name: string; commission_rate: number };
type Settlement = {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  paid_amount: number | null;
  paid_at: string;
};

type Line = {
  restaurantId: string;
  name: string;
  count: number;
  caPlats: number;
  commission: number;
  net: number;
  deliveryFees: number;
  settled: boolean;
};

export function Report() {
  const [start, setStart] = useState(todayNosyBe());
  const [end, setEnd] = useState(todayNosyBe());
  const [rows, setRows] = useState<DeliveredRow[]>([]);
  const [restos, setRestos] = useState<Resto[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [courierNames, setCourierNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const startISO = `${start}T00:00:00+03:00`;
    const endISO = `${end}T23:59:59.999+03:00`;
    const [o, r, s] = await Promise.all([
      supabase
        .from('orders')
        .select('restaurant_id, subtotal, delivery_fee, total, payment_method, courier_id, commission_amount, commission_rate')
        .eq('status', 'livree')
        .gte('delivered_at', startISO)
        .lte('delivered_at', endISO),
      supabase.from('restaurants').select('id, name, commission_rate'),
      supabase
        .from('restaurant_settlements')
        .select('id, restaurant_id, period_start, period_end, amount_due, paid_amount, paid_at')
        .order('paid_at', { ascending: false }),
    ]);
    if (o.error || r.error || s.error) {
      setErr(o.error?.message || r.error?.message || s.error?.message || 'Erreur');
    } else {
      const orderRows = (o.data ?? []) as DeliveredRow[];
      setRows(orderRows);
      setRestos((r.data ?? []) as Resto[]);
      setSettlements((s.data ?? []) as Settlement[]);
      const ids = Array.from(new Set(orderRows.map((x) => x.courier_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) map[p.id] = p.full_name ?? '—';
        setCourierNames(map);
      } else {
        setCourierNames({});
      }
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const rateOf = useCallback(
    (id: string) => restos.find((x) => x.id === id)?.commission_rate ?? 0,
    [restos],
  );

  const lines: Line[] = useMemo(() => {
    const map = new Map<string, Line>();
    for (const row of rows) {
      const commission = row.commission_amount ?? Math.round(row.subtotal * (row.commission_rate ?? rateOf(row.restaurant_id)));
      const cur = map.get(row.restaurant_id) ?? {
        restaurantId: row.restaurant_id,
        name: restos.find((x) => x.id === row.restaurant_id)?.name ?? '—',
        count: 0, caPlats: 0, commission: 0, net: 0, deliveryFees: 0,
        settled: settlements.some((st) => st.restaurant_id === row.restaurant_id && st.period_start === start && st.period_end === end),
      };
      cur.count += 1;
      cur.caPlats += row.subtotal;
      cur.commission += commission;
      cur.net += row.subtotal - commission;
      cur.deliveryFees += row.delivery_fee;
      map.set(row.restaurant_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  }, [rows, restos, settlements, start, end, rateOf]);

  const totals = useMemo(
    () => lines.reduce(
      (t, l) => ({ count: t.count + l.count, caPlats: t.caPlats + l.caPlats, commission: t.commission + l.commission, net: t.net + l.net, deliveryFees: t.deliveryFees + l.deliveryFees }),
      { count: 0, caPlats: 0, commission: 0, net: 0, deliveryFees: 0 },
    ),
    [lines],
  );

  // Livreurs salariés → ils te remettent 100% du cash encaissé. Ta marge = commission + frais
  // de livraison (les salaires sont gérés hors app).
  const margin = totals.commission + totals.deliveryFees;

  const courierCash = useMemo(() => {
    const map = new Map<string, { count: number; cash: number }>();
    for (const row of rows) {
      if (!row.courier_id || row.payment_method !== 'especes') continue;
      const cur = map.get(row.courier_id) ?? { count: 0, cash: 0 };
      cur.count += 1;
      cur.cash += row.total;
      map.set(row.courier_id, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.cash - a.cash);
  }, [rows]);

  async function settle(l: Line) {
    const input = window.prompt(`Montant réellement versé à ${l.name} (net calculé : ${l.net}) :`, String(l.net));
    if (input === null) return;
    const paid = parseInt(input, 10);
    if (Number.isNaN(paid)) return;
    setBusy(l.restaurantId);
    const { error } = await supabase.rpc('record_settlement', {
      p_restaurant_id: l.restaurantId,
      p_period_start: start,
      p_period_end: end,
      p_paid_amount: paid,
    });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    await load();
  }

  function exportCsv() {
    const header = ['Restaurant', 'Nb livrees', 'CA plats', 'Commission', 'Net a reverser', 'Frais livraison'];
    const body = lines.map((l) => [l.name, l.count, l.caPlats, l.commission, l.net, l.deliveryFees].join(';'));
    const totalRow = ['TOTAL', totals.count, totals.caPlats, totals.commission, totals.net, totals.deliveryFees].join(';');
    const csv = [`Periode;${start};${end}`, '', header.join(';'), ...body, '', totalRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-taxifood-${start}_${end}.csv`;
    a.click();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Du</div>
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Au</div>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </div>
        <button className="btn ghost" onClick={() => { setStart(todayNosyBe()); setEnd(todayNosyBe()); }}>Aujourd'hui</button>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={exportCsv} disabled={lines.length === 0}>Exporter CSV</button>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="label">Livraisons</div><div className="value">{totals.count}</div></div>
        <div className="stat"><div className="label">CA plats</div><div className="value">{formatAr(totals.caPlats)}</div></div>
        <div className="stat"><div className="label">Ma commission</div><div className="value">{formatAr(totals.commission)}</div></div>
        <div className="stat"><div className="label">Frais de livraison</div><div className="value">{formatAr(totals.deliveryFees)}</div></div>
        <div className="stat"><div className="label">À reverser (net)</div><div className="value" style={{ color: 'var(--accent)' }}>{formatAr(totals.net)}</div></div>
        <div className="stat"><div className="label">Ma marge (comm. + livraison)</div><div className="value" style={{ color: 'var(--green)' }}>{formatAr(margin)}</div></div>
      </div>

      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}

      <div className="card">
        <h2>Reversement par restaurant</h2>
        {loading ? (
          <div className="empty">Chargement…</div>
        ) : lines.length === 0 ? (
          <div className="empty">Aucune commande livrée sur cette période.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Restaurant</th><th className="num">Livrées</th><th className="num">CA plats</th>
                <th className="num">Commission</th><th className="num">Net à reverser</th><th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.restaurantId}>
                  <td>{l.name}</td>
                  <td className="num">{l.count}</td>
                  <td className="num">{formatAr(l.caPlats)}</td>
                  <td className="num">{formatAr(l.commission)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{formatAr(l.net)}</td>
                  <td className="num">
                    {l.settled ? (
                      <span className="pill livree">Reversé</span>
                    ) : (
                      <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy === l.restaurantId} onClick={() => settle(l)}>
                        Marquer reversé
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Cash à remettre par livreur (espèces)</h2>
        {courierCash.length === 0 ? (
          <div className="empty">Aucune livraison en espèces sur cette période.</div>
        ) : (
          <table>
            <thead><tr><th>Livreur</th><th className="num">Livraisons</th><th className="num">Cash encaissé (à te remettre)</th></tr></thead>
            <tbody>
              {courierCash.map((c) => (
                <tr key={c.id}>
                  <td>{courierNames[c.id] ?? '—'}</td>
                  <td className="num">{c.count}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{formatAr(c.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Livreurs salariés : ils te remettent l'intégralité du cash encaissé. Leur salaire est géré hors application.
        </p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Historique des reversements</h2>
        {settlements.length === 0 ? (
          <div className="empty">Aucun reversement enregistré.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Restaurant</th><th>Période</th><th className="num">Dû</th><th className="num">Versé</th><th>Payé le</th></tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id}>
                  <td>{restos.find((r) => r.id === s.restaurant_id)?.name ?? '—'}</td>
                  <td>{s.period_start === s.period_end ? s.period_start : `${s.period_start} → ${s.period_end}`}</td>
                  <td className="num">{formatAr(s.amount_due)}</td>
                  <td className="num">{formatAr(s.paid_amount)}</td>
                  <td>{new Date(s.paid_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '8px 12px', borderRadius: 8, fontSize: 14,
};
