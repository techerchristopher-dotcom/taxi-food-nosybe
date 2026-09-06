'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  formatAr, formatEur, PAYMENT_STATUS_LABEL, REFUND_STATUS_LABEL, STATUS_LABEL, un,
} from '../lib/util';
import { arRendu, enCentimes, envoiBloque, soldeDe } from '../lib/remboursement';
import type { Solde } from '../lib/remboursement';

/**
 * Rendre l'argent d'un paiement par carte.
 *
 * Cet écran existe parce qu'une commande encaissée puis annulée ne réapparaît
 * nulle part ailleurs : « Temps réel » exclut les `livree` et les `annulee`, et
 * le rapport de clôture ne compte que les `livree`. Le 6 septembre 2026, 3,41 €
 * ont été débités sur TF-96, la commande a été refusée deux minutes plus tard,
 * et aucun écran de l'application n'en portait la trace.
 *
 * Quatre partis pris.
 *
 * 1. LA LISTE PART DES PAIEMENTS, PAS DES COMMANDES. Ce qui rend une commande
 *    remboursable, ce n'est pas `payment_method = 'cb'` — une commande peut
 *    porter « carte » sans qu'un centime ait été pris, et `basculer_en_especes()`
 *    peut la repasser en espèces alors qu'un paiement vivait chez Stripe. Le seul
 *    critère qui tienne est un `payment_intents` réellement `capture`. C'est le
 *    même choix que côté base : voir le trigger `remboursement_sur_annulation`.
 * 2. LE BOUTON N'APPARAÎT QUE S'IL A UN SENS. Rien à rendre, ou une demande déjà
 *    en vol : la ligne dit pourquoi, mais n'offre pas de geste. Un bouton présent
 *    puis refusé par la base apprend à se méfier de l'écran.
 * 3. LE MONTANT EST MODIFIABLE, ET PLAFONNÉ AU RESTE. Un plat manquant n'est pas
 *    une commande annulée. Le plafond affiché est celui que la base impose de
 *    toute façon (`verifier_plafond_remboursement`) : le montrer évite d'aller
 *    chercher le refus.
 * 4. DEUX ÉCRANS AVANT L'ENVOI. L'argent part chez Stripe dès la validation et
 *    ne revient pas. La deuxième étape ne redemande pas de saisie : elle relit à
 *    voix haute ce qui va partir.
 * 5. UNE DEMANDE QUI N'EST PAS PARTIE SE VOIT, ET SE RELANCE ICI. Ajouté après
 *    la revue d'exploitation : l'écran affichait « en attente du verdict de
 *    Stripe » aussi bien pour une demande envoyée que pour une demande dont
 *    l'appel n'avait jamais quitté la base — et il ne proposait alors aucun
 *    geste, le bouton « Rembourser » étant masqué par la demande en vol. Un
 *    remboursement bloqué un soir de service était donc invisible ET sans
 *    recours depuis l'application. C'était exactement l'état de TF-96.
 */

const POLL_MS = 60000;   // un remboursement n'a pas l'urgence d'un service

type OrderEmbed = {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  created_at: string;
  cancellation_reason: string | null;
  restaurants: { name: string } | { name: string }[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type IntentRow = {
  id: string;
  order_id: string;
  provider_intent_id: string | null;
  status: string;
  amount_minor: number;
  currency: string;
  amount_ar: number;
  fx_rate: number;
  captured_at: string | null;
  orders: OrderEmbed | OrderEmbed[] | null;
};

type RefundRow = {
  id: string;
  payment_intent_id: string;
  order_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  amount_ar: number;
  motif: string;
  origine: string;
  provider_refund_id: string | null;
  erreur: string | null;
  created_at: string;
  effectue_le: string | null;
};

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ` +
         `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Remboursements() {
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [tout, setTout] = useState(false);
  const [recherche, setRecherche] = useState('');

  // Boîte de dialogue : `null` = fermée. `etape` porte les deux temps du geste.
  const [boite, setBoite] = useState<{
    intent: IntentRow; solde: Solde; montant: string; motif: string;
    etape: 'saisie' | 'confirmation';
  } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [relance, setRelance] = useState(false);

  // Le sondage ne doit pas rafraichir la liste pendant qu'une boite est ouverte :
  // le « reste remboursable » affiche dans la boite deviendrait faux sous les
  // yeux du gestionnaire, au moment precis ou il valide un montant. Un `ref`
  // plutot qu'un etat : `load()` doit lire la valeur du moment, pas celle de la
  // derniere fermeture rendue.
  const boiteOuverte = useRef(false);

  // ⚠️ Double-clic. `setEnvoi(true)` ne désactive le bouton qu'au rendu suivant :
  // deux clics assez rapprochés partent tous les deux. La base refuserait bien le
  // second (index unique partiel `payment_refunds_une_demande_en_vol`), mais le
  // gestionnaire verrait alors un message d'erreur Postgres après un geste
  // parfaitement normal — et apprendrait à se méfier d'un écran qui n'a rien fait
  // de mal. Un verrou synchrone coûte deux lignes.
  const gestEnCours = useRef(false);

  const load = useCallback(async (force = false) => {
    if (!force && boiteOuverte.current) return;
    const [i, r] = await Promise.all([
      supabase
        .from('payment_intents')
        .select('id, order_id, provider_intent_id, status, amount_minor, currency, amount_ar, fx_rate, captured_at, orders!inner ( order_number, status, payment_status, payment_method, total, created_at, cancellation_reason, restaurants ( name ), profiles ( full_name ) )')
        // `capture` = l'argent est chez Stripe ; `rembourse` = il en est reparti,
        // mais la ligne doit rester visible, c'est la preuve du mouvement.
        .in('status', ['capture', 'rembourse'])
        .order('captured_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('payment_refunds')
        .select('id, payment_intent_id, order_id, status, amount_minor, currency, amount_ar, motif, origine, provider_refund_id, erreur, created_at, effectue_le')
        .order('created_at', { ascending: false }),
    ]);
    setChargement(false);
    if (i.error) { setErr(i.error.message); return; }
    if (r.error) { setErr(r.error.message); return; }
    setErr(null);
    setIntents((i.data ?? []) as unknown as IntentRow[]);
    setRefunds((r.data ?? []) as RefundRow[]);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  function fermer() {
    boiteOuverte.current = false;
    setBoite(null);
  }

  function ouvrir(intent: IntentRow, solde: Solde) {
    setInfo(null);
    boiteOuverte.current = true;
    setBoite({
      intent, solde, etape: 'saisie',
      // Par défaut tout ce qui reste : le cas courant est la commande refusée,
      // pas le geste commercial partiel.
      montant: (solde.reste / 100).toFixed(2),
      motif: '',
    });
  }

  async function envoyer() {
    if (!boite || gestEnCours.current) return;
    const montantMinor = enCentimes(boite.montant);
    gestEnCours.current = true;
    setEnvoi(true);
    const { error } = await supabase.rpc('admin_demander_remboursement', {
      p_order_id: boite.intent.order_id,
      p_motif: boite.motif.trim(),
      // On envoie toujours le montant, même quand c'est la totalité : laisser la
      // base choisir « le reste » ferait rendre un montant que l'écran n'a pas
      // montré si une autre demande était passée entre-temps.
      p_montant_minor: montantMinor,
    });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    const numero = un(boite.intent.orders)?.order_number ?? '';
    fermer();
    setErr(null);
    setInfo(`Remboursement de ${formatEur(montantMinor, boite.intent.currency)} demandé sur ${numero} et envoyé à Stripe.`);
    await load(true);
  }

  /**
   * Rejoue les envois restés en file.
   *
   * ⚠️ CE N'EST PAS UN SECOND REMBOURSEMENT. La RPC ne crée aucune demande :
   * elle reprend celles qui sont déjà écrites en base et rappelle la fonction
   * Edge. Trois barrières empêchent qu'un euro parte deux fois — la clé
   * d'idempotence Stripe portée par la demande, le refus de la base d'attacher
   * un second `re_...`, et la fonction Edge qui répond « déjà traité » sans
   * appeler Stripe. C'est ce qui autorise à cliquer sans compter.
   */
  async function relancer() {
    if (gestEnCours.current) return;
    gestEnCours.current = true;
    setRelance(true);
    setInfo(null);
    const { data, error } = await supabase.rpc('relancer_remboursements_en_attente');
    gestEnCours.current = false;
    setRelance(false);
    if (error) { setErr(error.message); return; }
    setErr(null);
    const n = Number(data ?? 0);
    setInfo(n === 0
      ? 'Aucun envoi à rejouer : soit tout est parti, soit la demande n’a pas de paiement Stripe à rembourser (regarde le motif d’erreur sur la ligne).'
      : `${n} envoi${n > 1 ? 's' : ''} rejoué${n > 1 ? 's' : ''} chez Stripe. Le verdict arrive en quelques secondes — recharge dans un instant.`);
    await load(true);
  }

  // Totaux : lus sur les mêmes lignes que la liste, jamais recalculés ailleurs.
  const encaisse = intents.reduce((s, i) => s + i.amount_minor, 0);
  const rendu = refunds.filter((r) => r.status === 'effectue').reduce((s, r) => s + r.amount_minor, 0);
  const enVol = refunds.filter((r) => r.status === 'demande').reduce((s, r) => s + r.amount_minor, 0);

  const q = recherche.trim().toLowerCase();
  const lignes = intents
    .map((i) => ({ i, solde: soldeDe(i, refunds) }))
    // Une demande en vol n'a plus rien de « remboursable », mais la masquer
    // ferait disparaitre de l'ecran le seul endroit ou son verdict se lit.
    .filter(({ solde }) => (tout || solde.reste > 0 || solde.enCours))
    .filter(({ i }) => !q || (un(i.orders)?.order_number ?? '').toLowerCase().includes(q));

  // Les demandes dont l'appel n'est jamais parti. Elles n'attendent pas Stripe :
  // elles attendent qu'on les relance. Sans ordonnanceur sur ce projet, personne
  // ne le fera à notre place.
  const bloquees = refunds.filter((r) => envoiBloque(r));
  const bloqueesMinor = bloquees.reduce((s, r) => s + r.amount_minor, 0);

  const boiteMontant = boite ? enCentimes(boite.montant) : Number.NaN;
  const boiteMotif = boite ? boite.motif.trim() : '';
  const boiteErreur = !boite ? null
    : Number.isNaN(boiteMontant) ? 'Montant illisible.'
    : boiteMontant <= 0 ? 'Le montant doit être supérieur à zéro.'
    : boiteMontant > boite.solde.reste
      ? `Au-delà du remboursable : il reste ${formatEur(boite.solde.reste, boite.intent.currency)}.`
    : boiteMotif.length === 0 ? 'Le motif est obligatoire.'
    : null;

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Encaissé par carte</div>
          <div className="value" style={{ fontSize: 20 }}>{formatEur(encaisse)}</div>
        </div>
        <div className="stat">
          <div className="label">Déjà rendu</div>
          <div className="value" style={{ fontSize: 20 }}>{formatEur(rendu)}</div>
        </div>
        <div className="stat">
          <div className="label">En attente de Stripe</div>
          <div className="value" style={{ fontSize: 20 }}>{formatEur(enVol)}</div>
        </div>
        <div className="stat">
          <div className="label">Paiements encaissés</div>
          <div className="value">{intents.length}</div>
        </div>
      </div>

      {err ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}
      {info ? <div className="card" style={{ marginBottom: 16, color: 'var(--green)' }}>{info}</div> : null}

      {bloquees.length ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--red)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <strong style={{ color: 'var(--red)' }}>
                {bloquees.length} remboursement{bloquees.length > 1 ? 's' : ''} ({formatEur(bloqueesMinor)}) n
                {bloquees.length > 1 ? '’ont' : '’a'} pas été envoyé{bloquees.length > 1 ? 's' : ''} à Stripe.
              </strong>
              <div className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
                La demande est bien enregistrée, mais l’appel n’a pas abouti — Stripe injoignable,
                coupure réseau, ou erreur signalée sur la ligne. <strong>Ces clients n’ont pas encore
                été remboursés</strong>, et rien ne réessaiera tout seul. Relancer est sans risque :
                un remboursement déjà parti n’est jamais renvoyé deux fois.
              </div>
            </div>
            <button className="btn" disabled={relance} onClick={() => void relancer()}>
              {relance ? 'Relance…' : 'Relancer les envois'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Paiements par carte encaissés</h2>
          <input
            placeholder="N° commande…" value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="champ" style={{ width: 160, fontSize: 13, padding: '6px 10px' }}
          />
          <label className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={tout} onChange={(e) => setTout(e.target.checked)} style={{ marginRight: 6 }} />
            Montrer aussi les paiements soldés
          </label>
        </div>

        {chargement ? (
          <div className="empty">Chargement…</div>
        ) : lignes.length === 0 ? (
          <div className="empty">
            {tout ? 'Aucun paiement par carte encaissé.' : 'Rien à rembourser.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Restaurant</th><th>Client</th><th>Commande</th>
                <th className="num">Encaissé</th><th className="num">Rendu</th>
                <th className="num">Remboursable</th><th>Agir</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ i, solde }) => {
                const o = un(i.orders);
                const siens = refunds.filter((r) => r.payment_intent_id === i.id);
                return (
                  <tr key={i.id}>
                    <td>
                      {o?.order_number ?? '—'}
                      <div className="muted" style={{ fontSize: 11 }}>{dateLabel(i.captured_at)}</div>
                    </td>
                    <td>{un(o?.restaurants ?? null)?.name ?? '—'}</td>
                    <td>{un(o?.profiles ?? null)?.full_name ?? '—'}</td>
                    <td>
                      <span className={`pill ${o?.status ?? 'recue'}`}>{STATUS_LABEL[o?.status ?? ''] ?? o?.status}</span>
                      <span className={`pill ${o?.payment_status === 'rembourse' ? 'rembourse' : 'paye'}`} style={{ marginLeft: 6 }}>
                        {PAYMENT_STATUS_LABEL[o?.payment_status ?? ''] ?? o?.payment_status}
                      </span>
                      {o?.cancellation_reason
                        ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{o.cancellation_reason}</div>
                        : null}
                    </td>
                    <td className="num">
                      {formatEur(i.amount_minor, i.currency)}
                      <div className="muted" style={{ fontSize: 11 }}>{formatAr(i.amount_ar)}</div>
                    </td>
                    <td className="num">
                      {solde.rendu > 0 ? formatEur(solde.rendu, i.currency) : <span className="muted">—</span>}
                      {siens.length ? (
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          {siens.map((r) => (
                            <div key={r.id} className="muted" style={{ marginTop: 2 }}>
                              <span className={`pill ${r.status}`}>{REFUND_STATUS_LABEL[r.status] ?? r.status}</span>{' '}
                              {formatEur(r.amount_minor, r.currency)} · {dateLabel(r.created_at)}
                              <div style={{ fontSize: 11 }}>{r.motif}{r.origine === 'automatique' ? ' (automatique)' : ''}</div>
                              {r.erreur ? <div style={{ color: 'var(--red)' }}>{r.erreur}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">
                      {solde.reste > 0
                        ? formatEur(solde.reste, i.currency)
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {/* L'ordre compte : un paiement dont TOUT est en vol a bien
                          un reste nul, mais il n'est pas rembourse pour autant.
                          Annoncer « integralement rembourse » avant le verdict de
                          Stripe, ce serait affirmer que le client a son argent. */}
                      {solde.enCours ? (
                        // La base n'autorise qu'une demande en vol par paiement
                        // (index unique partiel). Proposer « Rembourser » ici, ce
                        // serait promettre un geste que le clic refusera. Mais
                        // « en attente du verdict de Stripe » n'était vrai que
                        // pour une demande RÉELLEMENT partie : celle dont l'appel
                        // a échoué n'attend personne, elle attend qu'on la relance.
                        siens.some((r) => envoiBloque(r)) ? (
                          <>
                            <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 6 }}>
                              {formatEur(solde.enVol, i.currency)} <strong>jamais parti chez Stripe</strong> —
                              le client n’a rien reçu.
                            </div>
                            <button className="btn" style={{ fontSize: 13, padding: '7px 13px' }}
                                    disabled={relance} onClick={() => void relancer()}>
                              {relance ? 'Relance…' : 'Relancer l’envoi'}
                            </button>
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {formatEur(solde.enVol, i.currency)} envoyé à Stripe, verdict attendu
                          </span>
                        )
                      ) : solde.reste <= 0 ? (
                        <span className="muted" style={{ fontSize: 12 }}>Intégralement remboursé</span>
                      ) : (
                        <button className="btn" style={{ fontSize: 13, padding: '7px 13px' }}
                                onClick={() => ouvrir(i, solde)}>
                          Rembourser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          Seuls les paiements réellement encaissés chez Stripe figurent ici : une commande
          « carte » dont le client n&apos;a jamais confirmé n&apos;a rien à rendre. Une demande reste
          « demandé » tant que Stripe n&apos;a pas confirmé, et tant qu&apos;elle y est, aucun autre
          remboursement n&apos;est possible sur le même paiement. Une commande annulée dont le
          paiement était encaissé demande son remboursement toute seule — la ligne apparaît
          alors ici en « automatique », sans qu&apos;on ait à cliquer.
          {' '}<strong>Si l&apos;envoi n&apos;a pas abouti</strong> (Stripe injoignable, coupure), la demande
          reste enregistrée mais l&apos;argent n&apos;est pas parti : la ligne le dit en rouge et
          propose « Relancer l&apos;envoi ». Rien ne réessaie tout seul — c&apos;est le geste à faire.
        </p>
      </div>

      {boite ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            {(() => {
              const i = boite.intent;
              const o = un(i.orders);
              const montant = Number.isNaN(boiteMontant) ? 0 : boiteMontant;
              const total = montant === i.amount_minor;

              if (boite.etape === 'confirmation') {
                return (
                  <>
                    <h3>Confirmer le remboursement</h3>
                    <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                      Dernière étape. Relis, puis valide.
                    </p>
                    <div style={{
                      background: 'var(--panel-2)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: 14, margin: '14px 0', fontSize: 14, lineHeight: 1.7,
                    }}>
                      <div>Commande <strong>{o?.order_number}</strong> — {un(o?.restaurants ?? null)?.name ?? '—'}</div>
                      <div>
                        Montant rendu : <strong style={{ color: 'var(--primary)', fontSize: 18 }}>
                          {formatEur(montant, i.currency)}
                        </strong>{' '}
                        <span className="muted">({formatAr(arRendu(i, montant))})</span>
                      </div>
                      <div>{total ? 'Remboursement total.' : `Remboursement partiel — il restera ${formatEur(boite.solde.reste - montant, i.currency)} remboursable.`}</div>
                      <div className="muted" style={{ marginTop: 6 }}>Motif : {boiteMotif}</div>
                    </div>
                    <div className="warn">
                      L&apos;argent part chez Stripe dès la validation et <strong>ne revient pas</strong>.
                      Le client verra le crédit sous 5 à 10 jours ouvrés.
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                      <button className="btn ghost" disabled={envoi}
                              onClick={() => setBoite({ ...boite, etape: 'saisie' })}>
                        Revenir
                      </button>
                      <button className="btn" disabled={envoi || boiteErreur !== null} onClick={() => void envoyer()}>
                        {envoi ? 'Envoi…' : `Rembourser ${formatEur(montant, i.currency)}`}
                      </button>
                    </div>
                  </>
                );
              }

              return (
                <>
                  <h3>Rembourser {o?.order_number}</h3>
                  <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                    {un(o?.restaurants ?? null)?.name ?? '—'} · {un(o?.profiles ?? null)?.full_name ?? 'client inconnu'}
                    {' · '}commande de {formatAr(o?.total ?? 0)}
                  </p>

                  <table style={{ margin: '14px 0' }}>
                    <tbody>
                      <tr>
                        <td>Encaissé par Stripe</td>
                        <td className="num">
                          {formatEur(i.amount_minor, i.currency)}
                          <span className="muted"> · {formatAr(i.amount_ar)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>Déjà remboursé</td>
                        <td className="num">
                          {boite.solde.rendu > 0 ? formatEur(boite.solde.rendu, i.currency) : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Reste remboursable</strong></td>
                        <td className="num"><strong>{formatEur(boite.solde.reste, i.currency)}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
                    Montant à rendre, en euros
                  </label>
                  <input
                    className="champ" inputMode="decimal" value={boite.montant} autoFocus
                    onChange={(e) => setBoite({ ...boite, montant: e.target.value })}
                  />
                  <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.5 }}>
                    Soit {formatAr(arRendu(i, Number.isNaN(boiteMontant) ? 0 : boiteMontant))} au taux
                    figé du paiement ({Number(i.fx_rate).toLocaleString('fr-FR')} Ar pour 1 €).
                    Par défaut, la totalité de ce qui reste — à baisser pour un plat manquant.
                  </p>

                  <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', margin: '16px 0 5px' }}>
                    Motif (obligatoire, conservé avec le remboursement)
                  </label>
                  <textarea
                    className="champ" rows={2} value={boite.motif}
                    placeholder="Ex. : restaurant fermé, plat indisponible…"
                    onChange={(e) => setBoite({ ...boite, motif: e.target.value })}
                  />

                  <div className="warn" style={{ marginTop: 16 }}>
                    ⚠️ <strong>Stripe ne rend pas ses frais</strong> sur la transaction d&apos;origine :
                    0,25 € fixes + 1,5 % à 3,15 % selon la carte du client restent prélevés, même
                    remboursement intégral. Sur une commande de 3,41 €, cela fait environ 0,30 €
                    perdus. Le montant rendu au client, lui, est bien celui qui a été débité.
                  </div>

                  {boiteErreur ? (
                    <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 0 }}>{boiteErreur}</p>
                  ) : null}

                  <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
                    <button className="btn ghost" onClick={fermer}>Annuler</button>
                    <button className="btn" disabled={boiteErreur !== null}
                            onClick={() => setBoite({ ...boite, etape: 'confirmation' })}>
                      Continuer
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </>
  );
}
