'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr, todayNosyBe } from '../lib/util';
import {
  additionnerCumuls, bornesPeriode, CUMUL_VIDE, cumulerCommande, ecartCaisse, margeTaxiFood,
} from '../lib/reversement';
import type { CommandeLivree, Cumul, RegleDuCode, ReglesDesCodes } from '../lib/reversement';
import { COLONNES_VERSEMENT, chevauche, libellePeriode, LIBELLE_TELEGRAM, PASTILLE_TELEGRAM } from '../lib/versement';
import type { Versement } from '../lib/versement';
import { DetailCommandes, FenetreVersement, HistoriqueVersements } from './Versements';

type DeliveredRow = CommandeLivree & {
  /** Emballages (boite a pizza...). Reverses au restaurant, commission comprise. */
  packaging_fee: number | null;
  /**
   * Sur quoi portait la remise : « livraison » ou « sous_total ». Fige sur la
   * commande a sa creation — surtout PAS relu depuis `promo_codes`, sinon
   * modifier un code changerait un rapport deja cloture.
   */
  promo_porte_sur: string | null;
  /**
   * Part de la remise offerte par le RESTAURANT (code offert « repas »), figee
   * elle aussi. Le client ne l'a pas payee : elle sort du du au restaurant, pas
   * de notre marge.
   */
  remise_charge_restaurant: number | null;
  payment_method: string;
  courier_id: string | null;
  commission_rate: number | null;
};
type Resto = { id: string; name: string; commission_rate: number };
type Line = Cumul & {
  restaurantId: string;
  name: string;
  /**
   * Un versement déjà enregistré dont la période RECOUVRE celle du rapport —
   * même partiellement. La base refuse d'en enregistrer un second
   * (`admin_enregistrer_versement`) ; l'écran le montre avant qu'on essaie.
   */
  reglement: Versement | null;
};

const COLONNES = 'order_number, restaurant_id, subtotal, packaging_fee, delivery_fee, promo_code, promo_discount, promo_porte_sur, remise_charge_restaurant, total, payment_method, courier_id, commission_amount, commission_rate';

const AUCUNE_REGLE: ReglesDesCodes = new Map();

export function Report() {
  const [start, setStart] = useState(todayNosyBe());
  const [end, setEnd] = useState(todayNosyBe());
  const [rows, setRows] = useState<DeliveredRow[]>([]);
  const [restos, setRestos] = useState<Resto[]>([]);
  const [settlements, setSettlements] = useState<Versement[]>([]);
  /** Restaurant → a-t-il un groupe Telegram ? Absent de la carte = inconnu. */
  const [canaux, setCanaux] = useState<Record<string, boolean>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [aVerser, setAVerser] = useState<Line | null>(null);
  const [regles, setRegles] = useState<ReglesDesCodes>(AUCUNE_REGLE);
  const [courierNames, setCourierNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { debut, finExclue } = bornesPeriode(start, end);
    const [o, oSansDate, r, s] = await Promise.all([
      supabase
        .from('orders')
        .select(COLONNES)
        .eq('status', 'livree')
        .gte('delivered_at', debut)
        .lt('delivered_at', finExclue),
      // `record_settlement` date une commande par `coalesce(delivered_at,
      // created_at)`. Une commande passee en « livree » par le pilotage
      // (`admin_set_order_status`) n'a pas de `delivered_at` : sans cette
      // seconde lecture, la base la devrait au restaurant et le rapport ne la
      // montrerait pas — « Marquer reverse » proposerait moins que le du enregistre.
      supabase
        .from('orders')
        .select(COLONNES)
        .eq('status', 'livree')
        .is('delivered_at', null)
        .gte('created_at', debut)
        .lt('created_at', finExclue),
      // Voir Restaurants.tsx : la commission n'est plus lisible en direct.
      supabase.rpc('admin_lister_restaurants'),
      supabase
        .from('restaurant_settlements')
        .select(COLONNES_VERSEMENT)
        .order('paid_at', { ascending: false }),
    ]);
    // Seulement pour prévenir AVANT de confirmer qu'aucun message ne partira.
    // Lecture tolérante : si ce canal devient illisible (table privée à venir,
    // voir « Fuite connue »), l'écran dit « inconnu » et la base tranche.
    const c = await supabase.from('restaurants').select('id, telegram_chat_id');
    if (!c.error) {
      const m: Record<string, boolean> = {};
      for (const x of (c.data ?? []) as { id: string; telegram_chat_id: string | null }[]) {
        m[x.id] = !!(x.telegram_chat_id && x.telegram_chat_id.trim());
      }
      setCanaux(m);
    }
    if (o.error || oSansDate.error || r.error || s.error) {
      setErr(o.error?.message || oSansDate.error?.message || r.error?.message || s.error?.message || 'Erreur');
    } else {
      const orderRows = [...(o.data ?? []), ...(oSansDate.data ?? [])] as DeliveredRow[];
      // La règle de chaque code appliqué (qui paie, sur quoi). Elle ne sert pas
      // au calcul — les montants figés sur la commande priment — mais à le
      // contredire : une part « offerte par le restaurant » faussée ne se voit
      // dans aucun total, seulement face au code qui l'a produite. Lien par
      // `promo_code` (= `code_normalise`, unique) plutôt que par
      // `promo_redemptions`, qu'une annulation peut effacer.
      const codes = Array.from(new Set(orderRows.map((x) => x.promo_code).filter(Boolean) as string[]));
      const pc = codes.length
        ? await supabase.from('promo_codes').select('code_normalise, pris_en_charge_par, porte_sur').in('code_normalise', codes)
        : { data: [], error: null };
      if (pc.error) {
        // Sans ces règles, les contrôles par commande crieraient « code
        // introuvable » partout, ou pire, se tairaient : on n'affiche rien.
        setErr(`Règles des codes promo illisibles : ${pc.error.message}`);
        setLoading(false);
        return;
      }
      const map = new Map<string, RegleDuCode>();
      for (const x of (pc.data ?? []) as (RegleDuCode & { code_normalise: string })[]) {
        map.set(x.code_normalise, { pris_en_charge_par: x.pris_en_charge_par, porte_sur: x.porte_sur });
      }
      setRegles(map);
      setRows(orderRows);
      setRestos((r.data ?? []) as Resto[]);
      setSettlements((s.data ?? []) as unknown as Versement[]);
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

  // Le taux ACTUEL du restaurant, comme le calcul de secours de
  // `record_settlement` : il ne sert qu'aux commandes sans commission memorisee.
  const rateOf = useCallback(
    (id: string) => restos.find((x) => x.id === id)?.commission_rate ?? 0,
    [restos],
  );

  const lines: Line[] = useMemo(() => {
    const map = new Map<string, Line>();
    for (const row of rows) {
      // Toute l'arithmetique vit dans `lib/reversement.ts` : c'est elle qui decide
      // d'un virement, elle doit s'eprouver sans React et rester alignee sur
      // `record_settlement`. Une remise ne s'y soustrait pas au meme endroit selon
      // qui la paie — livraison ou plats offerts par Taxi Food : notre marge ;
      // repas offert par le restaurant : son du.
      const cur = map.get(row.restaurant_id) ?? {
        ...CUMUL_VIDE,
        restaurantId: row.restaurant_id,
        name: restos.find((x) => x.id === row.restaurant_id)?.name ?? '—',
        reglement: settlements.find((st) => st.restaurant_id === row.restaurant_id
          && chevauche(st.period_start, st.period_end, start, end)) ?? null,
      };
      map.set(row.restaurant_id, { ...cur, ...cumulerCommande(cur, row, rateOf(row.restaurant_id), regles) });
    }
    return Array.from(map.values()).sort((a, b) => b.net - a.net);
  }, [rows, restos, settlements, start, end, rateOf, regles]);

  const totals = useMemo(() => lines.reduce<Cumul>((t, l) => additionnerCumuls(t, l), CUMUL_VIDE), [lines]);

  // Livreurs salariés → ils te remettent 100 % du cash encaissé (salaires hors app).
  //
  // Ta marge = commission + livraison facturée − remises que Taxi Food finance
  // (sur la livraison, et sur les plats quand le code n'est pas offert par le
  // restaurant). Un repas offert par le restaurant n'y figure pas : il sort de
  // son reversement. Le compte se boucle exactement :
  //     encaissé − net à reverser = marge
  const margin = margeTaxiFood(totals);
  // Garde-fou d'affichage : si l'égalité ci-dessus se rompt un jour, on préfère
  // le voir à l'écran qu'imprimer un rapport faux en silence. La marge n'est
  // jamais calculée par différence : voir `ecartCaisse` pour ce que l'écart
  // détecte, et ce qu'il ne peut pas voir.
  const ecart = ecartCaisse(totals);

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

  function exportCsv() {
    const header = ['Restaurant', 'Nb livrees', 'Encaisse client', 'CA plats', 'Emballages', 'Commission', 'Offert par le restaurant', 'Net a reverser', 'Livraison brute', 'Remise livraison', 'Livraison nette', 'Remise plats payee par Taxi Food'];
    const body = lines.map((l) => [l.name, l.count, l.encaisse, l.caPlats, l.emballages, l.commission, l.offertRestaurant, l.net, l.deliveryBrut, l.remiseLivraison, l.deliveryFees, l.remisePlats].join(';'));
    const totalRow = ['TOTAL', totals.count, totals.encaisse, totals.caPlats, totals.emballages, totals.commission, totals.offertRestaurant, totals.net, totals.deliveryBrut, totals.remiseLivraison, totals.deliveryFees, totals.remisePlats].join(';');
    const csv = [`Periode;${start};${end}`, '', header.join(';'), ...body, '', totalRow].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-taxifood-${start}_${end}.csv`;
    a.click();
  }

  // La colonne n'apparaît que si un restaurant a offert quelque chose sur la
  // période : une colonne de zéros n'apprend rien et élargit le tableau.
  const avecOffert = totals.offertRestaurant > 0;

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

      {/* Trois chiffres, et un seul est vraiment le tien : la marge. L'ancien
          bandeau alignait sept cases de meme poids — on ne savait plus laquelle
          lire. Le detail du calcul est juste en dessous, pas ici. */}
      <div className="stat-row">
        <div className="stat"><div className="label">Livraisons</div><div className="value">{totals.count}</div></div>
        <div className="stat"><div className="label">Encaissé auprès des clients</div><div className="value">{formatAr(totals.encaisse)}</div></div>
        <div className="stat"><div className="label">À reverser aux restaurants</div><div className="value" style={{ color: 'var(--accent)' }}>{formatAr(totals.net)}</div></div>
        <div className="stat"><div className="label">MA MARGE</div><div className="value" style={{ color: 'var(--green)' }}>{formatAr(margin)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>D'où vient ce chiffre</h2>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <table style={{ flex: '1 1 320px' }}>
            <thead><tr><th>Ce qui revient au restaurant</th><th className="num"></th></tr></thead>
            <tbody>
              <tr><td>CA plats</td><td className="num">{formatAr(totals.caPlats)}</td></tr>
              <tr><td>+ Emballages <span className="muted">(boîtes à pizza…)</span></td><td className="num">{formatAr(totals.emballages)}</td></tr>
              <tr><td>− Ma commission</td><td className="num">−{formatAr(totals.commission)}</td></tr>
              <tr><td>− Offert par le restaurant <span className="muted">(codes offerts, à sa charge)</span></td><td className="num">−{formatAr(totals.offertRestaurant)}</td></tr>
              <tr><td style={{ fontWeight: 700 }}>= Net à reverser</td><td className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatAr(totals.net)}</td></tr>
            </tbody>
          </table>

          <table style={{ flex: '1 1 320px' }}>
            <thead><tr><th>Ce qui te reste</th><th className="num"></th></tr></thead>
            <tbody>
              <tr><td>Ma commission</td><td className="num">{formatAr(totals.commission)}</td></tr>
              <tr><td>+ Livraison facturée</td><td className="num">{formatAr(totals.deliveryBrut)}</td></tr>
              <tr><td>− Remises sur la livraison <span className="muted">(payées par toi)</span></td><td className="num">−{formatAr(totals.remiseLivraison)}</td></tr>
              <tr><td>− Remises sur les plats <span className="muted">(payées par toi)</span></td><td className="num">−{formatAr(totals.remisePlats)}</td></tr>
              <tr><td style={{ fontWeight: 700 }}>= Ma marge</td><td className="num" style={{ fontWeight: 700, color: 'var(--green)' }}>{formatAr(margin)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Livraison réellement encaissée : {formatAr(totals.deliveryFees)}
          {totals.remiseLivraison > 0 ? ` (${formatAr(totals.deliveryBrut)} facturés, ${formatAr(totals.remiseLivraison)} offerts en codes promo)` : ''}.
          {avecOffert
            ? ` Les repas offerts par un restaurant (${formatAr(totals.offertRestaurant)}) sortent de son reversement, pas de ta marge ; ta commission ne porte pas sur cette part.`
            : ''}
        </div>
        {ecart !== 0 ? (
          <div style={{ marginTop: 10, color: 'var(--red)', fontWeight: 600 }}>
            ⚠️ Écart de {formatAr(ecart)} : encaissé − reversé ne retombe pas sur la marge. À signaler, ce rapport est à vérifier.
          </div>
        ) : null}
        {totals.incoherentes > 0 ? (
          <div style={{ marginTop: 10, color: 'var(--red)', fontWeight: 600 }}>
            ⚠️ {totals.incoherentes} commande{totals.incoherentes > 1 ? 's' : ''} à vérifier : le dû proposé peut être faux,
            et l&apos;écart ci-dessus ne le montrerait pas. Ne reverse pas avant d&apos;avoir vérifié.
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontWeight: 400 }}>
              {totals.aVerifier.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        ) : null}
      </div>

      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}

      <div className="card">
        <h2>Reversement par restaurant</h2>
        {loading ? (
          <div className="empty">Chargement…</div>
        ) : lines.length === 0 ? (
          <div className="empty">Aucune commande livrée sur cette période.</div>
        ) : (
          <div className="vers-lignes">
            {lines.map((l) => {
              const reg = l.reglement;
              const exact = reg && reg.period_start === start && reg.period_end === end;
              return (
                <div key={l.restaurantId} className="vers-ligne">
                  <div className="vers-ligne-tete">
                    <strong>{l.name}</strong>
                    <span className="vers-ligne-net">{formatAr(l.net)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {l.count} livrée{l.count > 1 ? 's' : ''} · plats {formatAr(l.caPlats)}
                    {l.emballages > 0 ? ` · emballages ${formatAr(l.emballages)}` : ''}
                    {' '}· commission −{formatAr(l.commission)}
                    {l.offertRestaurant > 0 ? ` · offert −${formatAr(l.offertRestaurant)}` : ''}
                  </div>
                  {reg ? (
                    <div className="vers-regle">
                      <span className="pill livree">{exact ? 'Reversé' : 'Déjà reversé en partie'}</span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {' '}{libellePeriode(reg.period_start, reg.period_end)}
                        {reg.reference_versement ? ` · réf. ${reg.reference_versement}` : ''}
                      </span>
                      {' '}<span className={`pill ${PASTILLE_TELEGRAM[reg.telegram_statut]}`}>{LIBELLE_TELEGRAM[reg.telegram_statut]}</span>
                    </div>
                  ) : null}
                  <div className="gestes" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn ghost petit" onClick={() => setOuvert(ouvert === l.restaurantId ? null : l.restaurantId)}>
                      {ouvert === l.restaurantId ? 'Masquer les commandes' : `Voir les ${l.count} commande${l.count > 1 ? 's' : ''}`}
                    </button>
                    {!reg ? (
                      <button className="btn petit" onClick={() => setAVerser(l)}>Marquer reversé</button>
                    ) : null}
                  </div>
                  {ouvert === l.restaurantId ? (
                    <DetailCommandes restaurantId={l.restaurantId} debut={start} fin={end} netRapport={l.net} />
                  ) : null}
                </div>
              );
            })}
          </div>
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

      <HistoriqueVersements versements={settlements} restos={restos} onRecharger={() => void load()} />

      {aVerser ? (
        <FenetreVersement
          ligne={aVerser}
          debut={start}
          fin={end}
          canal={aVerser.restaurantId in canaux ? canaux[aVerser.restaurantId] : null}
          onFermer={(recharger) => { setAVerser(null); if (recharger) void load(); }}
        />
      ) : null}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)',
  padding: '8px 12px', borderRadius: 8, fontSize: 14,
};
