'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr, todayNosyBe } from '../lib/util';
import {
  additionnerCumuls, bornesPeriode, CUMUL_VIDE, cumulerCommande, ecartCaisse, margeTaxiFood,
} from '../lib/reversement';
import type { CommandeLivree, Cumul, RegleDuCode, ReglesDesCodes } from '../lib/reversement';
import { COLONNES_VERSEMENT, chevauche, libellePeriode, LIBELLE_TELEGRAM, PASTILLE_TELEGRAM } from '../lib/versement';
import type { Rattachement, Versement } from '../lib/versement';
import { DetailCommandes, FenetreVersement, HistoriqueVersements } from './Versements';
import { CodeMarchandCarte } from './CodeMarchand';

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
   * même partiellement. Purement informatif depuis le 2026-09-23 : ce n'est
   * plus lui qui décide si on peut reverser, mais `resteAReverser`.
   */
  reglement: Versement | null;
  /**
   * Ce qui reste VRAIMENT à payer : les commandes de la période qu'aucun
   * reversement ne rattache (`settlement_orders`). C'est ce montant, et lui
   * seul, que « Marquer reversé » propose.
   */
  resteAReverser: Cumul;
  /** Ce qui a déjà été payé sur cette période, commande par commande. */
  dejaReverse: Cumul;
};

const COLONNES = 'id, order_number, restaurant_id, subtotal, packaging_fee, delivery_fee, promo_code, promo_discount, promo_porte_sur, remise_charge_restaurant, total, payment_method, courier_id, commission_amount, commission_rate';

const AUCUNE_REGLE: ReglesDesCodes = new Map();

export function Report() {
  const [start, setStart] = useState(todayNosyBe());
  const [end, setEnd] = useState(todayNosyBe());
  const [rows, setRows] = useState<DeliveredRow[]>([]);
  const [restos, setRestos] = useState<Resto[]>([]);
  const [settlements, setSettlements] = useState<Versement[]>([]);
  /**
   * Commande → le reversement qui l'a déjà payée. Lu dans `settlement_orders`
   * par `admin_commandes_deja_reversees` (la table n'a aucune politique RLS :
   * elle n'est lisible que par une RPC `is_admin()`).
   */
  const [rattachements, setRattachements] = useState<Map<string, Rattachement>>(new Map());
  /**
   * Restaurant → code marchand Orange Money (null = non renseigné). `null` pour
   * toute la carte = lecture impossible : chaque carte dit alors « illisible ».
   */
  const [codes, setCodes] = useState<Record<string, string | null> | null>(null);
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
    const [o, oSansDate, r, s, rat] = await Promise.all([
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
      // Quelles commandes de la période sont DÉJÀ payées. Même règle de date
      // que le calcul (`coalesce(delivered_at, created_at)`, jour local), donc
      // la commande sans `delivered_at` y figure comme les autres.
      supabase.rpc('admin_commandes_deja_reversees', { p_period_start: start, p_period_end: end }),
    ]);
    // Seulement pour prévenir AVANT de confirmer qu'aucun message ne partira.
    // Lecture tolérante : si ce canal devient illisible (table privée à venir,
    // voir « Fuite connue »), l'écran dit « inconnu » et la base tranche.
    // Le code marchand : lecture À PART du canal Telegram, pour qu'une fermeture
    // future de `telegram_chat_id` ne fasse pas disparaître le code avec lui.
    const cm = await supabase.from('restaurants').select('id, code_marchand');
    if (cm.error) {
      setCodes(null);
    } else {
      const m: Record<string, string | null> = {};
      for (const x of (cm.data ?? []) as { id: string; code_marchand: string | null }[]) m[x.id] = x.code_marchand;
      setCodes(m);
    }
    const c = await supabase.from('restaurants').select('id, telegram_chat_id');
    if (!c.error) {
      const m: Record<string, boolean> = {};
      for (const x of (c.data ?? []) as { id: string; telegram_chat_id: string | null }[]) {
        m[x.id] = !!(x.telegram_chat_id && x.telegram_chat_id.trim());
      }
      setCanaux(m);
    }
    if (o.error || oSansDate.error || r.error || s.error || rat.error) {
      setErr(o.error?.message || oSansDate.error?.message || r.error?.message || s.error?.message
        || rat.error?.message || 'Erreur');
    } else {
      // Sans cette carte, l'écran proposerait de repayer des commandes déjà
      // payées : c'est le manque du 2026-09-23. Une lecture ratée est une
      // erreur bloquante ci-dessus, jamais une carte vide silencieuse.
      const parCommande = new Map<string, Rattachement>();
      for (const x of ((rat.data ?? []) as unknown as Rattachement[])) parCommande.set(x.order_id, x);
      setRattachements(parCommande);
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
        resteAReverser: CUMUL_VIDE,
        dejaReverse: CUMUL_VIDE,
      };
      const taux = rateOf(row.restaurant_id);
      // La MÊME commande alimente deux comptes : le cumul de la période (ce que
      // le rapport décrit) et l'un des deux sous-cumuls (ce qui reste à payer,
      // ce qui l'est déjà). Une commande rattachée à un reversement ne peut
      // plus entrer dans un nouveau versement — la base le refuse, l'écran doit
      // donc cesser de le proposer.
      const payee = !!(row.id && rattachements.has(row.id));
      map.set(row.restaurant_id, {
        ...cur,
        ...cumulerCommande(cur, row, taux, regles),
        resteAReverser: payee ? cur.resteAReverser : cumulerCommande(cur.resteAReverser, row, taux, regles),
        dejaReverse: payee ? cumulerCommande(cur.dejaReverse, row, taux, regles) : cur.dejaReverse,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.resteAReverser.net - a.resteAReverser.net);
  }, [rows, restos, settlements, start, end, rateOf, regles, rattachements]);

  const totals = useMemo(() => lines.reduce<Cumul>((t, l) => additionnerCumuls(t, l), CUMUL_VIDE), [lines]);
  // Les deux moitiés du « à reverser » : ce qui est parti, ce qui reste. Le
  // rapport continue de décrire toute la période (c'est son objet) ; il dit en
  // plus ce qu'il reste réellement à payer.
  const totalDejaReverse = useMemo(
    () => lines.reduce((s, l) => s + l.dejaReverse.net, 0), [lines]);
  const totalResteAReverser = useMemo(
    () => lines.reduce((s, l) => s + l.resteAReverser.net, 0), [lines]);

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
        <div className="stat">
          <div className="label">À reverser aux restaurants</div>
          <div className="value" style={{ color: 'var(--accent)' }}>{formatAr(totals.net)}</div>
          {totalDejaReverse > 0 ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              dont {formatAr(totalDejaReverse)} déjà reversés · reste {formatAr(totalResteAReverser)}
            </div>
          ) : null}
        </div>
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
              const reste = l.resteAReverser;
              const deja = l.dejaReverse;
              return (
                <div key={l.restaurantId} className="vers-ligne">
                  <div className="vers-ligne-tete">
                    <strong>{l.name}</strong>
                    {/* Le gros chiffre est ce qu'on va PAYER, jamais le total de
                        la période : les commandes déjà reversées en sont sorties. */}
                    <span className="vers-ligne-net">{formatAr(reste.net)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {l.count} livrée{l.count > 1 ? 's' : ''} · plats {formatAr(l.caPlats)}
                    {l.emballages > 0 ? ` · emballages ${formatAr(l.emballages)}` : ''}
                    {' '}· commission −{formatAr(l.commission)}
                    {l.offertRestaurant > 0 ? ` · offert −${formatAr(l.offertRestaurant)}` : ''}
                  </div>
                  {deja.count > 0 ? (
                    <div className="vers-partage">
                      <span className="pill reverse">{deja.count} déjà reversée{deja.count > 1 ? 's' : ''} · {formatAr(deja.net)}</span>
                      {reste.count > 0
                        ? <span className="pill a-reverser">{reste.count} à reverser · {formatAr(reste.net)}</span>
                        : <span className="muted" style={{ fontSize: 12 }}>Tout est reversé sur cette période.</span>}
                    </div>
                  ) : null}
                  <CodeMarchandCarte
                    restaurantId={l.restaurantId}
                    code={codes ? (codes[l.restaurantId] ?? null) : undefined}
                    onChange={(nouveau) => setCodes((m) => ({ ...(m ?? {}), [l.restaurantId]: nouveau }))}
                  />
                  {reg ? (
                    <div className="vers-regle">
                      <span className="muted" style={{ fontSize: 12 }}>
                        Dernier versement {libellePeriode(reg.period_start, reg.period_end)}
                        {reg.reference_versement ? ` · réf. ${reg.reference_versement}` : ''}
                      </span>
                      {' '}<span className={`pill ${PASTILLE_TELEGRAM[reg.telegram_statut]}`}>{LIBELLE_TELEGRAM[reg.telegram_statut]}</span>
                    </div>
                  ) : null}
                  <div className="gestes" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button className="btn ghost petit" onClick={() => setOuvert(ouvert === l.restaurantId ? null : l.restaurantId)}>
                      {ouvert === l.restaurantId ? 'Masquer les commandes' : `Voir les ${l.count} commande${l.count > 1 ? 's' : ''}`}
                    </button>
                    {/* Le geste est ouvert dès qu'il reste UNE commande non
                        reversée — plus « aucun versement sur une période qui
                        chevauche », qui interdisait de solder une période ou de
                        rattraper une commande livrée en retard. */}
                    {reste.count > 0 ? (
                      <button className="btn petit" onClick={() => setAVerser(l)}>
                        Marquer reversé{deja.count > 0 ? ` (${reste.count} restante${reste.count > 1 ? 's' : ''})` : ''}
                      </button>
                    ) : null}
                  </div>
                  {ouvert === l.restaurantId ? (
                    <DetailCommandes restaurantId={l.restaurantId} debut={start} fin={end} netRapport={reste.net} />
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
          // ⚠️ Ce que la fenêtre confronte à la base, ce sont les commandes qui
          // RESTENT à payer — pas le total de la période. Les incohérences
          // signalées sont celles de ces commandes-là : alerter sur une
          // commande déjà payée ne servirait qu'à bloquer un versement juste.
          ligne={{
            restaurantId: aVerser.restaurantId,
            name: aVerser.name,
            net: aVerser.resteAReverser.net,
            incoherentes: aVerser.resteAReverser.incoherentes,
            aVerifier: aVerser.resteAReverser.aVerifier,
          }}
          debut={start}
          fin={end}
          canal={aVerser.restaurantId in canaux ? canaux[aVerser.restaurantId] : null}
          codeMarchand={codes ? (codes[aVerser.restaurantId] ?? null) : undefined}
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
