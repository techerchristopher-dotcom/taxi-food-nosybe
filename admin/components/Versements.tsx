'use client';

/**
 * Les trois morceaux du versement dans le Rapport de clôture :
 *   - DetailCommandes : les commandes qu'un versement paie, lues dans la base ;
 *   - FenetreVersement : « Marquer reversé », référence Orange Money obligatoire,
 *     puis message Telegram au restaurant ;
 *   - HistoriqueVersements : « vous m'avez payé quand ? », par restaurant.
 *
 * Écrit pour un téléphone : des cartes, pas des tableaux larges.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr, PAYMENT_LABEL, PAYMENT_STATUS_LABEL, STATUS_LABEL, un } from '../lib/util';
import {
  COLONNES_VERSEMENT, LIBELLE_TELEGRAM, PASTILLE_TELEGRAM, dateHeureNosyBe, dateNosyBe,
  libelleReverse, libellePeriode, lireErreurFonction, peutRenvoyer, referenceValide, totauxListe,
} from '../lib/versement';
import { COLONNES_FICHE } from '../lib/versement';
import type { ChangementAdmin, CommandeFiche, CommandeReversee, FicheLue, StatutTelegram, Versement } from '../lib/versement';
import { CodeMarchandFenetre } from './CodeMarchand';

export { COLONNES_VERSEMENT };

/** Ce que la fonction Edge a répondu, en clair. */
export type ResultatMessage = { statut: StatutTelegram | 'envoye_non_enregistre' | 'inconnu'; erreur?: string };

/** Demande l'envoi du message d'un versement. Ne ment jamais sur le résultat. */
export async function envoyerMessage(settlementId: string): Promise<ResultatMessage> {
  const { data, error } = await supabase.functions.invoke('notifier-versement', {
    body: { settlement_id: settlementId },
  });
  if (error) {
    const e = await lireErreurFonction(error);
    return { statut: (e.statut as ResultatMessage['statut']) ?? 'inconnu', erreur: e.erreur };
  }
  const d = data as { statut?: string; erreur?: string } | null;
  return { statut: (d?.statut as ResultatMessage['statut']) ?? 'inconnu', erreur: d?.erreur };
}

function phraseResultat(r: ResultatMessage): { ton: 'ok' | 'ko' | 'neutre'; texte: string } {
  switch (r.statut) {
    case 'envoye': return { ton: 'ok', texte: 'Message Telegram envoyé — confirmé par Telegram.' };
    case 'sans_canal': return { ton: 'neutre', texte: 'Ce restaurant n’a pas de groupe Telegram : aucun message n’est parti. Préviens-le autrement.' };
    case 'en_cours': return { ton: 'neutre', texte: 'Un envoi est déjà en cours. Recharge dans une minute.' };
    case 'envoye_non_enregistre': return { ton: 'ko', texte: 'Telegram a accepté le message, mais la base ne l’a pas enregistré. Regarde le groupe avant de renvoyer.' };
    case 'echec': return { ton: 'ko', texte: `Message NON envoyé. ${r.erreur ?? ''}` };
    default: return { ton: 'ko', texte: `Envoi non confirmé : ${r.erreur ?? 'réponse inattendue'}. Le versement, lui, est bien enregistré.` };
  }
}

function Resultat({ r }: { r: ResultatMessage }) {
  const p = phraseResultat(r);
  const couleur = p.ton === 'ok' ? 'var(--green)' : p.ton === 'ko' ? 'var(--red)' : 'var(--muted)';
  return <p style={{ color: couleur, fontWeight: 600, margin: '10px 0 0' }}>{p.texte}</p>;
}

// ───────────────────────────────────────────────────────── Détail des commandes

type EtatDetail =
  | { etat: 'chargement' }
  | { etat: 'erreur'; message: string }
  | { etat: 'pret'; commandes: CommandeReversee[] };

/** Lit les commandes d'un versement dans la base (même source que l'enregistrement). */
export function useCommandesAReverser(restaurantId: string, debut: string, fin: string, cle = 0): EtatDetail {
  const [e, setE] = useState<EtatDetail>({ etat: 'chargement' });
  useEffect(() => {
    let vivant = true;
    setE({ etat: 'chargement' });
    supabase
      .rpc('admin_commandes_a_reverser', { p_restaurant_id: restaurantId, p_period_start: debut, p_period_end: fin })
      .then(({ data, error }) => {
        if (!vivant) return;
        if (error) setE({ etat: 'erreur', message: error.message });
        else setE({ etat: 'pret', commandes: (data ?? []) as CommandeReversee[] });
      });
    return () => { vivant = false; };
  }, [restaurantId, debut, fin, cle]);
  return e;
}

export function DetailCommandes({ restaurantId, debut, fin, netRapport }: {
  restaurantId: string; debut: string; fin: string; netRapport: number;
}) {
  const e = useCommandesAReverser(restaurantId, debut, fin);
  if (e.etat === 'chargement') return <div className="empty">Chargement des commandes…</div>;
  if (e.etat === 'erreur') return <p style={{ color: 'var(--red)' }}>Détail illisible : {e.message}</p>;
  return <ListeCommandes commandes={e.commandes} netRapport={netRapport} />;
}

/**
 * Le détail des commandes d'une période. Chaque ligne dit maintenant si elle a
 * DÉJÀ été payée : c'est le manque signalé le 2026-09-23 — huit commandes
 * s'affichaient ensemble sans que rien ne distingue les réglées des autres, et
 * le risque était de payer deux fois.
 *
 * `netRapport` est ce que le rapport annonce comme RESTANT à reverser : on le
 * confronte donc à la somme des seules commandes non reversées.
 */
function ListeCommandes({ commandes, netRapport }: { commandes: CommandeReversee[]; netRapport: number }) {
  const t = totauxListe(commandes);
  // Une commande dépliée à la fois : sur un téléphone, deux détails ouverts
  // font perdre la ligne qu'on était venu vérifier.
  const [deplie, setDeplie] = useState<string | null>(null);
  return (
    <div className="vers-detail">
      {commandes.length === 0 ? <div className="empty">Aucune commande retenue.</div> : null}
      {commandes.map((c) => {
        const ouvert = deplie === c.order_id;
        return (
          <div key={c.order_id} className={`vers-cmd${ouvert ? ' ouvert' : ''}${c.deja_reverse ? ' payee' : ''}`}>
            <button
              type="button"
              className="vers-cmd-bouton"
              aria-expanded={ouvert}
              onClick={() => setDeplie(ouvert ? null : c.order_id)}
            >
              <span className="vers-cmd-tete">
                <strong>{c.order_number ?? 'Sans numéro'}</strong>
                <span className="muted">{dateHeureNosyBe(c.livree_le)} <span className="vers-chevron" aria-hidden>{ouvert ? '▴' : '▾'}</span></span>
              </span>
              <span className="vers-cmd-etat">
                {c.deja_reverse
                  ? <span className="pill reverse">{libelleReverse(c)}</span>
                  : <span className="pill a-reverser">À reverser</span>}
              </span>
              <span className="vers-cmd-chiffres">
                <span>Montant <b>{formatAr(c.montant)}</b></span>
                <span>Commission <b>−{formatAr(c.commission)}</b></span>
                {c.offert > 0 ? <span>Offert <b>−{formatAr(c.offert)}</b></span> : null}
                <span className="vers-net">Net <b>{formatAr(c.net)}</b></span>
              </span>
            </button>
            {ouvert ? <FicheCommande reversee={c} /> : null}
          </div>
        );
      })}
      {t.nbDeja > 0 ? (
        <div className="vers-total paye">
          <span>{t.nbDeja} déjà reversée{t.nbDeja > 1 ? 's' : ''}</span>
          <strong>{formatAr(t.dejaReverse)}</strong>
        </div>
      ) : null}
      <div className="vers-total">
        <span>{t.nbAReverser} à reverser</span>
        <strong>{formatAr(t.aReverser)}</strong>
      </div>
      {t.aReverser !== netRapport ? (
        <p style={{ color: 'var(--red)', fontWeight: 600 }}>
          ⚠️ La base retient {formatAr(t.aReverser)}, le rapport affiche {formatAr(netRapport)}. Ne reverse pas avant d’avoir compris l’écart.
        </p>
      ) : null}
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
        Montant = plats + emballage. Net = montant − commission − part offerte par le restaurant.
        Une commande déjà reversée ne peut plus entrer dans un autre versement (la base l’interdit).
        Touche une commande pour son détail complet.
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────── Fiche d'une commande

type EtatFiche =
  | { etat: 'chargement' }
  | { etat: 'erreur'; message: string }
  | { etat: 'pret'; fiche: FicheLue };

/** Lit tout ce qu'il faut savoir d'une commande. Lecture seule, RLS admin existantes. */
function useFicheCommande(orderId: string): EtatFiche {
  const [e, setE] = useState<EtatFiche>({ etat: 'chargement' });
  useEffect(() => {
    let vivant = true;
    setE({ etat: 'chargement' });
    lireFicheCommande(orderId).then((r) => { if (vivant) setE(r); });
    return () => { vivant = false; };
  }, [orderId]);
  return e;
}

async function lireFicheCommande(orderId: string): Promise<EtatFiche> {
  const { data, error } = await supabase
    .from('orders')
    .select(COLONNES_FICHE)
    .eq('id', orderId)
    .maybeSingle();
  if (error) return { etat: 'erreur', message: error.message };
  if (!data) return { etat: 'erreur', message: 'commande introuvable (ou illisible pour ce compte)' };
  const o = data as unknown as CommandeFiche;
  // Le livreur est un compte auth, pas une clé étrangère vers `profiles` : lu à part.
  // Le journal admin donne les changements de statut faits depuis l'admin — les
  // seuls horodatés au-delà de créée / récupérée / livrée.
  const [liv, journal] = await Promise.all([
    o.courier_id
      ? supabase.from('profiles').select('full_name, phone').eq('id', o.courier_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('admin_actions').select('avant, apres, created_at')
      .eq('order_id', orderId).eq('action', 'statut_commande').order('created_at'),
  ]);
  return {
    etat: 'pret',
    fiche: {
      commande: o,
      livreur: (liv.data as { full_name: string | null; phone: string | null } | null) ?? null,
      changementsAdmin: journal.error ? null : ((journal.data ?? []) as ChangementAdmin[]),
    },
  };
}

function FicheCommande({ reversee }: { reversee: CommandeReversee }) {
  const e = useFicheCommande(reversee.order_id);
  if (e.etat === 'chargement') return <div className="vers-fiche muted">Lecture de la commande…</div>;
  if (e.etat === 'erreur') return <div className="vers-fiche" style={{ color: 'var(--red)' }}>Commande illisible : {e.message}</div>;
  return <FicheContenu fiche={e.fiche} reversee={reversee} />;
}

export function FicheContenu({ fiche, reversee }: { fiche: FicheLue; reversee: CommandeReversee }) {
  const o = fiche.commande;
  const a = un(o.addresses);
  const client = un(o.profiles);
  const items = o.order_items ?? [];
  // Commande par téléphone : le vrai client est sur le libellé d'adresse
  // « ☎ <nom> », pas sur le profil (celui de l'admin qui l'a saisie).
  const parTelephone = !!a?.label?.startsWith('☎ ');
  const nomClient = parTelephone ? a!.label!.slice(2) : (client?.full_name ?? '—');
  const telClient = a?.phone || client?.phone || null;
  const remise = o.promo_discount ?? 0;
  const emballage = o.packaging_fee ?? 0;
  const taux = o.commission_rate;

  const heures: { libelle: string; iso: string | null }[] = [
    { libelle: 'Créée', iso: o.created_at },
    { libelle: 'Récupérée par le livreur', iso: o.picked_up_at },
    { libelle: 'Livrée', iso: o.delivered_at },
  ];

  return (
    <div className="vers-fiche">
      <section>
        <h4>Plats</h4>
        {items.length === 0 ? <div className="muted">Aucune ligne de plat.</div> : null}
        {items.map((it) => (
          <div key={it.id} className="fiche-plat">
            <div className="fiche-ligne">
              <span><b>{it.quantity} ×</b> {it.product_name_snapshot}</span>
              <span className="fiche-prix">{formatAr(it.quantity * it.unit_price)}</span>
            </div>
            {(it.order_item_options ?? []).map((op, i) => (
              <div key={i} className="fiche-option">
                + {op.option_name_snapshot}{op.quantity > 1 ? ` ×${op.quantity}` : ''}
                {op.price_delta_snapshot ? ` (${op.price_delta_snapshot > 0 ? '+' : ''}${formatAr(op.price_delta_snapshot)})` : ''}
              </div>
            ))}
            {it.quantity > 1 ? <div className="fiche-option">{formatAr(it.unit_price)} l’unité, options comprises</div> : null}
            {it.comment ? <div className="fiche-option">« {it.comment} »</div> : null}
          </div>
        ))}
      </section>

      <section>
        <h4>Ce que le client a payé</h4>
        <div className="fiche-ligne"><span>Plats</span><span>{formatAr(o.subtotal)}</span></div>
        {emballage > 0 ? <div className="fiche-ligne"><span>Emballage</span><span>{formatAr(emballage)}</span></div> : null}
        <div className="fiche-ligne"><span>Livraison</span><span>{formatAr(o.delivery_fee)}</span></div>
        {o.promo_code || remise > 0 ? (
          <div className="fiche-ligne">
            <span>
              Code {o.promo_code ?? '—'}
              <span className="muted">
                {o.promo_porte_sur === 'livraison' ? ' · sur la livraison' : o.promo_porte_sur === 'sous_total' ? ' · sur les plats' : ''}
                {(o.remise_charge_restaurant ?? 0) > 0 ? ` · dont ${formatAr(o.remise_charge_restaurant)} offerts par le restaurant` : ''}
              </span>
            </span>
            <span>−{formatAr(remise)}</span>
          </div>
        ) : null}
        <div className="fiche-ligne fiche-total"><span>Total payé</span><span>{formatAr(o.total)}</span></div>
        <div className="muted" style={{ fontSize: 13 }}>
          {PAYMENT_LABEL[o.payment_method] ?? o.payment_method}
          {o.payment_status ? ` · ${PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}` : ''}
        </div>
      </section>

      <section>
        <h4>Client et livraison</h4>
        <div>{parTelephone ? '☎ ' : ''}<b>{nomClient}</b>{parTelephone ? <span className="muted"> (commande par téléphone)</span> : null}</div>
        {telClient ? <div><a className="fiche-tel" href={`tel:${telClient}`}>{telClient}</a></div> : <div className="muted">Pas de téléphone</div>}
        {a ? (
          <div className="muted" style={{ marginTop: 4 }}>
            {a.zone ?? 'Zone inconnue'}
            {a.landmark ? <div>Repère : {a.landmark}</div> : null}
            {a.instructions ? <div>Consignes : {a.instructions}</div> : null}
          </div>
        ) : <div className="muted">Adresse supprimée depuis.</div>}
        <div style={{ marginTop: 6 }}>
          Livreur : <b>{fiche.livreur?.full_name ?? (o.courier_id ? 'nom inconnu' : 'aucun')}</b>
          {fiche.livreur?.phone ? <> · <a className="fiche-tel" href={`tel:${fiche.livreur.phone}`}>{fiche.livreur.phone}</a></> : null}
        </div>
      </section>

      <section>
        <h4>Heures</h4>
        {heures.map((h) => (
          <div key={h.libelle} className="fiche-ligne">
            <span>{h.libelle}</span>
            <span className={h.iso ? '' : 'muted'}>{h.iso ? dateHeureNosyBe(h.iso) : 'non enregistrée'}</span>
          </div>
        ))}
        {(fiche.changementsAdmin ?? []).map((c, i) => (
          <div key={i} className="fiche-ligne">
            <span>Passée « {STATUS_LABEL[c.apres ?? ''] ?? c.apres} » depuis l’admin</span>
            <span>{dateHeureNosyBe(c.created_at)}</span>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          L’acceptation et la mise en préparation par le restaurant ne sont pas horodatées en base.
        </div>
      </section>

      <section>
        <h4>Reversement</h4>
        <div className="fiche-ligne"><span>Montant (plats + emballage)</span><span>{formatAr(reversee.montant)}</span></div>
        <div className="fiche-ligne">
          <span>Commission{taux !== null && taux !== undefined ? ` (${arrondirTaux(taux)} %, figé sur la commande)` : ' (taux non figé : taux actuel)'}</span>
          <span>−{formatAr(reversee.commission)}</span>
        </div>
        {reversee.offert > 0 ? <div className="fiche-ligne"><span>Offert par le restaurant</span><span>−{formatAr(reversee.offert)}</span></div> : null}
        <div className="fiche-ligne fiche-total"><span>Net au restaurant</span><span style={{ color: 'var(--accent)' }}>{formatAr(reversee.net)}</span></div>
      </section>
    </div>
  );
}

/** 0.1 → « 10 », 0.075 → « 7,5 ». */
function arrondirTaux(t: number): string {
  return (Math.round(t * 1000) / 10).toLocaleString('fr-FR');
}

// ──────────────────────────────────────────────────────── Fenêtre « Marquer reversé »

export type LigneAVerser = {
  restaurantId: string;
  name: string;
  net: number;
  incoherentes: number;
  aVerifier: string[];
};

export function FenetreVersement({ ligne, debut, fin, canal, codeMarchand, onFermer }: {
  ligne: LigneAVerser;
  debut: string;
  fin: string;
  /** Code marchand Orange Money : null = non renseigné, undefined = illisible. */
  codeMarchand: string | null | undefined;
  /** true / false : le restaurant a (ou non) un groupe Telegram ; null : inconnu. */
  canal: boolean | null;
  /** `recharger` : un versement a été enregistré, le rapport doit se relire. */
  onFermer: (recharger: boolean) => void;
}) {
  const detail = useCommandesAReverser(ligne.restaurantId, debut, fin);
  const toutes = detail.etat === 'pret' ? detail.commandes : [];
  // ⚠️ Seules les commandes NON ENCORE RATTACHÉES à un reversement entrent dans
  // ce versement : c'est exactement ce que `admin_enregistrer_versement`
  // enregistrera. Une commande déjà payée reste visible dans « Voir les
  // commandes », mais jamais dans le montant ni dans le message au restaurant.
  const commandes = useMemo(() => toutes.filter((c) => !c.deja_reverse), [toutes]);
  const dejaPayees = useMemo(() => toutes.filter((c) => c.deja_reverse), [toutes]);
  const dejaMontant = dejaPayees.reduce((s, c) => s + c.net, 0);
  const du = commandes.reduce((s, c) => s + c.net, 0);
  const numeros = useMemo(() => commandes.map((c) => c.order_number ?? '?'), [commandes]);

  const [reference, setReference] = useState('');
  const [montant, setMontant] = useState<string>('');
  const [verifie, setVerifie] = useState(false);
  const [voirListe, setVoirListe] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fait, setFait] = useState<{ id: string; resultat: ResultatMessage | null } | null>(null);
  const geste = useRef(false);

  // Le montant proposé est le dû de la base, dès qu'il est connu.
  useEffect(() => { if (detail.etat === 'pret') setMontant(String(du)); }, [detail.etat, du]);

  const paye = parseInt(montant, 10);
  const montantOk = Number.isFinite(paye) && paye > 0;
  const refOk = referenceValide(reference);
  const ecartRapport = detail.etat === 'pret' && du !== ligne.net;
  const doitVerifier = ligne.incoherentes > 0 || ecartRapport;

  // Aperçu du message, par la fonction de la base qui l'écrira : même texte.
  useEffect(() => {
    if (detail.etat !== 'pret' || commandes.length === 0 || !montantOk) { setApercu(null); return; }
    const t = setTimeout(() => {
      supabase.rpc('texte_message_versement', {
        p_montant: paye, p_nb: commandes.length, p_debut: debut, p_fin: fin,
        p_numeros: numeros, p_reference: refOk ? reference.trim().replace(/\s+/g, ' ') : '…',
      }).then(({ data }) => setApercu(typeof data === 'string' ? data : null));
    }, 250);
    return () => clearTimeout(t);
  }, [detail.etat, commandes.length, paye, montantOk, debut, fin, numeros, reference, refOk]);

  const peutConfirmer = detail.etat === 'pret' && commandes.length > 0 && refOk && montantOk
    && (!doitVerifier || verifie) && !envoi && !fait;

  async function confirmer() {
    if (geste.current || !peutConfirmer) return;
    geste.current = true;
    setEnvoi(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_enregistrer_versement', {
      p_restaurant_id: ligne.restaurantId,
      p_period_start: debut,
      p_period_end: fin,
      p_paid_amount: paye,
      p_reference: reference,
      p_du_attendu: du,
    });
    if (error) {
      setErr(error.message);
      setEnvoi(false);
      geste.current = false;
      return;
    }
    const v = data as Versement;
    setFait({ id: v.id, resultat: null });
    if (v.telegram_statut === 'sans_canal') {
      setFait({ id: v.id, resultat: { statut: 'sans_canal' } });
    } else {
      const r = await envoyerMessage(v.id);
      setFait({ id: v.id, resultat: r });
    }
    setEnvoi(false);
  }

  async function renvoyer() {
    if (!fait || envoi) return;
    setEnvoi(true);
    const r = await envoyerMessage(fait.id);
    setFait({ id: fait.id, resultat: r });
    setEnvoi(false);
  }

  return (
    <div className="voile" role="dialog" aria-modal="true">
      <div className="boite">
        <h3>Reverser à {ligne.name}</h3>

        {detail.etat === 'chargement' ? <div className="empty">Lecture des commandes…</div> : null}
        {detail.etat === 'erreur' ? <p style={{ color: 'var(--red)' }}>Commandes illisibles : {detail.message}</p> : null}

        {detail.etat === 'pret' ? (
          <>
            <div className="recap">
              <div className="vers-montant">{formatAr(du)}</div>
              <div>
                {commandes.length} commande{commandes.length > 1 ? 's' : ''} · du {libellePeriode(debut, fin)}
              </div>
              {dejaPayees.length > 0 ? (
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {dejaPayees.length} commande{dejaPayees.length > 1 ? 's' : ''} de cette période ({formatAr(dejaMontant)})
                  {dejaPayees.length > 1 ? ' ont' : ' a'} déjà été reversée{dejaPayees.length > 1 ? 's' : ''} : exclue{dejaPayees.length > 1 ? 's' : ''} de ce versement.
                </div>
              ) : null}
              <button type="button" className="btn ghost petit" style={{ marginTop: 8 }} onClick={() => setVoirListe((x) => !x)}>
                {voirListe ? 'Masquer les commandes' : 'Voir les commandes'}
              </button>
            </div>
            {voirListe ? <ListeCommandes commandes={toutes} netRapport={ligne.net} /> : null}

            {doitVerifier ? (
              <div className="warn" style={{ marginTop: 12 }}>
                {ecartRapport ? <div>La base retient {formatAr(du)}, le rapport affichait {formatAr(ligne.net)}.</div> : null}
                {ligne.incoherentes > 0 ? (
                  <>
                    <div>{ligne.incoherentes} commande{ligne.incoherentes > 1 ? 's' : ''} à vérifier, le dû peut être faux :</div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{ligne.aVerifier.map((a) => <li key={a}>{a}</li>)}</ul>
                  </>
                ) : null}
                <label className="choix">
                  <input type="checkbox" checked={verifie} onChange={(e) => setVerifie(e.target.checked)} />
                  J’ai vérifié, j’enregistre quand même
                </label>
              </div>
            ) : null}

            {!fait ? (
              <>
                {/* Juste au-dessus de la référence : c'est en payant qu'on en a besoin. */}
                <CodeMarchandFenetre code={codeMarchand} />
                <label className="sel-champ-bloc" style={{ marginTop: 14 }}>
                  <span className="sel-label">Référence du versement (ID de transaction Orange Money) — obligatoire</span>
                  <input
                    className="sel-champ"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="ex. PP230922.1234.A12345"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {reference && !refOk ? <span className="sel-erreur-texte">Entre 4 et 64 caractères.</span> : null}
                </label>
                <label className="sel-champ-bloc">
                  <span className="sel-label">Montant réellement versé (Ar)</span>
                  <input className="sel-champ" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ''))} />
                  {montantOk && paye !== du ? (
                    <span className="sel-erreur-texte">Différent du dû ({formatAr(du)}) : c’est ce montant que le restaurant lira.</span>
                  ) : null}
                </label>

                <div className="sel-label">
                  {canal === false
                    ? 'Ce restaurant n’a pas de groupe Telegram : le versement sera enregistré, aucun message ne partira.'
                    : 'Message qui partira sur le groupe Telegram du restaurant :'}
                </div>
                {canal !== false && apercu ? <pre className="vers-apercu">{apercu}</pre> : null}
              </>
            ) : null}
          </>
        ) : null}

        {err ? <p className="sel-erreur-texte" style={{ fontSize: 14, marginTop: 10 }}>{err}</p> : null}

        {fait ? (
          <>
            <p style={{ color: 'var(--green)', fontWeight: 700, margin: '14px 0 0' }}>✅ Versement enregistré.</p>
            {fait.resultat ? <Resultat r={fait.resultat} /> : <p className="muted">Envoi du message Telegram…</p>}
          </>
        ) : null}

        <div className="pied" style={{ marginTop: 16 }}>
          {fait ? (
            <>
              {fait.resultat && fait.resultat.statut !== 'envoye' && fait.resultat.statut !== 'sans_canal' && fait.resultat.statut !== 'envoye_non_enregistre' ? (
                <button className="btn ghost sel-btn" disabled={envoi} onClick={() => void renvoyer()}>
                  {envoi ? 'Envoi…' : 'Renvoyer le message'}
                </button>
              ) : null}
              <button className="btn sel-btn" disabled={envoi} onClick={() => onFermer(true)}>Fermer</button>
            </>
          ) : (
            <>
              <button className="btn ghost sel-btn" disabled={envoi} onClick={() => onFermer(false)}>Annuler</button>
              <button className="btn sel-btn" disabled={!peutConfirmer} onClick={() => void confirmer()}>
                {envoi ? 'Enregistrement…' : montantOk ? `Confirmer le versement de ${formatAr(paye)}` : 'Confirmer le versement'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── Historique

export function HistoriqueVersements({ versements, restos, onRecharger }: {
  versements: Versement[];
  restos: { id: string; name: string }[];
  onRecharger: () => void;
}) {
  const [filtre, setFiltre] = useState<string>('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [retours, setRetours] = useState<Record<string, ResultatMessage>>({});
  const [essai, setEssai] = useState<{ envoi: boolean; texte?: string; ok?: boolean }>({ envoi: false });

  const nom = (id: string) => restos.find((r) => r.id === id)?.name ?? '—';
  const avecVersement = restos.filter((r) => versements.some((v) => v.restaurant_id === r.id));
  const liste = filtre ? versements.filter((v) => v.restaurant_id === filtre) : versements;

  async function renvoyer(v: Versement) {
    if (enCours) return;
    setEnCours(v.id);
    const r = await envoyerMessage(v.id);
    setRetours((x) => ({ ...x, [v.id]: r }));
    setEnCours(null);
    onRecharger();
  }

  async function envoyerEssai() {
    setEssai({ envoi: true });
    const { data, error } = await supabase.functions.invoke('notifier-versement', { body: { essai: true } });
    if (error) {
      const e = await lireErreurFonction(error);
      setEssai({ envoi: false, ok: false, texte: `Essai NON envoyé : ${e.erreur}` });
    } else {
      const d = data as { statut?: string };
      setEssai(d?.statut === 'envoye'
        ? { envoi: false, ok: true, texte: 'Essai envoyé sur TON canal admin (confirmé par Telegram). Aucun restaurant ne l’a reçu.' }
        : { envoi: false, ok: false, texte: 'Essai non confirmé par Telegram.' });
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Historique des versements</h2>
      <div className="rangee" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>
          <span className="sel-label">Restaurant</span>
          <select className="sel-champ" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="">Tous les restaurants</option>
            {avecVersement.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <button className="btn ghost sel-btn" disabled={essai.envoi} onClick={() => void envoyerEssai()}>
          {essai.envoi ? 'Essai…' : 'Essai du message sur mon canal'}
        </button>
      </div>
      {essai.texte ? <p style={{ color: essai.ok ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{essai.texte}</p> : null}

      {liste.length === 0 ? (
        <div className="empty">Aucun versement enregistré.</div>
      ) : (
        <table className="cartes">
          <thead>
            <tr><th>Payé le</th><th>Restaurant</th><th>Période</th><th className="num">Montant</th><th>Référence</th><th>Message Telegram</th></tr>
          </thead>
          <tbody>
            {liste.map((v) => {
              const retour = retours[v.id];
              return (
                <tr key={v.id}>
                  <td data-label="Payé le">{dateNosyBe(v.paid_at)}</td>
                  <td data-label="Restaurant"><strong>{nom(v.restaurant_id)}</strong></td>
                  <td data-label="Période">
                    {libellePeriode(v.period_start, v.period_end)}
                    {v.nb_commandes ? <span className="muted"> · {v.nb_commandes} cmd</span> : null}
                  </td>
                  <td data-label="Montant" className="num">
                    <strong>{formatAr(v.paid_amount ?? v.amount_due)}</strong>
                    {v.paid_amount !== null && v.paid_amount !== v.amount_due
                      ? <div className="muted" style={{ fontSize: 12 }}>dû {formatAr(v.amount_due)}</div> : null}
                  </td>
                  <td data-label="Référence" style={{ overflowWrap: 'anywhere' }}>{v.reference_versement ?? <span className="muted">—</span>}</td>
                  <td data-label="Message Telegram">
                    <span className={`pill ${PASTILLE_TELEGRAM[v.telegram_statut]}`}>{LIBELLE_TELEGRAM[v.telegram_statut]}</span>
                    {v.telegram_statut === 'envoye' && v.telegram_envoye_at
                      ? <span className="muted" style={{ fontSize: 12 }}> {dateHeureNosyBe(v.telegram_envoye_at)}</span> : null}
                    {v.telegram_statut === 'echec' && v.telegram_erreur
                      ? <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{v.telegram_erreur}</div> : null}
                    {retour ? <Resultat r={retour} /> : null}
                    {peutRenvoyer(v) ? (
                      <div style={{ marginTop: 6 }}>
                        <button className="btn ghost petit" disabled={enCours !== null} onClick={() => void renvoyer(v)}>
                          {enCours === v.id ? 'Envoi…' : v.telegram_statut === 'en_attente' ? 'Envoyer le message' : 'Renvoyer le message'}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
