'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  formatAr, formatEur, PAYMENT_STATUS_LABEL, REFUND_STATUS_LABEL, STATUS_LABEL, un,
} from '../lib/util';
import { arRendu, enCentimes, soldeDe } from '../lib/remboursement';
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

  // Le sondage ne doit pas rafraichir la liste pendant qu'une boite est ouverte :
  // le « reste remboursable » affiche dans la boite deviendrait faux sous les
  // yeux du gestionnaire, au moment precis ou il valide un montant. Un `ref`
  // plutot qu'un etat : `load()` doit lire la valeur du moment, pas celle de la
  // derniere fermeture rendue.
  const boiteOuverte = useRef(false);

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
    if (!boite) return;
    const montantMinor = enCentimes(boite.montant);
    setEnvoi(true);
    const { error } = await supabase.rpc('admin_demander_remboursement', {
      p_order_id: boite.intent.order_id,
      p_motif: boite.motif.trim(),
      // On envoie toujours le montant, même quand c'est la totalité : laisser la
      // base choisir « le reste » ferait rendre un montant que l'écran n'a pas
      // montré si une autre demande était passée entre-temps.
      p_montant_minor: montantMinor,
    });
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    const numero = un(boite.intent.orders)?.order_number ?? '';
    fermer();
    setErr(null);
    setInfo(`Remboursement de ${formatEur(montantMinor, boite.intent.currency)} demandé sur ${numero} et envoyé à Stripe.`);
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
                        // (index unique partiel). Proposer le bouton ici, ce
                        // serait promettre un geste que le clic refusera.
                        <span className="muted" style={{ fontSize: 12 }}>
                          {formatEur(solde.enVol, i.currency)} en attente du verdict de Stripe
                        </span>
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
