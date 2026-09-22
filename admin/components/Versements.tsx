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
import { formatAr } from '../lib/util';
import {
  COLONNES_VERSEMENT, LIBELLE_TELEGRAM, PASTILLE_TELEGRAM, dateHeureNosyBe, dateNosyBe,
  libellePeriode, lireErreurFonction, peutRenvoyer, referenceValide,
} from '../lib/versement';
import type { CommandeReversee, StatutTelegram, Versement } from '../lib/versement';

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

function ListeCommandes({ commandes, netRapport }: { commandes: CommandeReversee[]; netRapport: number }) {
  const total = commandes.reduce((s, c) => s + c.net, 0);
  return (
    <div className="vers-detail">
      {commandes.length === 0 ? <div className="empty">Aucune commande retenue.</div> : null}
      {commandes.map((c) => (
        <div key={c.order_id} className="vers-cmd">
          <div className="vers-cmd-tete">
            <strong>{c.order_number ?? 'Sans numéro'}</strong>
            <span className="muted">{dateHeureNosyBe(c.livree_le)}</span>
          </div>
          <div className="vers-cmd-chiffres">
            <span>Montant <b>{formatAr(c.montant)}</b></span>
            <span>Commission <b>−{formatAr(c.commission)}</b></span>
            {c.offert > 0 ? <span>Offert <b>−{formatAr(c.offert)}</b></span> : null}
            <span className="vers-net">Net <b>{formatAr(c.net)}</b></span>
          </div>
        </div>
      ))}
      <div className="vers-total">
        <span>{commandes.length} commande{commandes.length > 1 ? 's' : ''}</span>
        <strong>{formatAr(total)}</strong>
      </div>
      {total !== netRapport ? (
        <p style={{ color: 'var(--red)', fontWeight: 600 }}>
          ⚠️ La base retient {formatAr(total)}, le rapport affiche {formatAr(netRapport)}. Ne reverse pas avant d’avoir compris l’écart.
        </p>
      ) : null}
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
        Montant = plats + emballage. Net = montant − commission − part offerte par le restaurant.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────── Fenêtre « Marquer reversé »

export type LigneAVerser = {
  restaurantId: string;
  name: string;
  net: number;
  incoherentes: number;
  aVerifier: string[];
};

export function FenetreVersement({ ligne, debut, fin, canal, onFermer }: {
  ligne: LigneAVerser;
  debut: string;
  fin: string;
  /** true / false : le restaurant a (ou non) un groupe Telegram ; null : inconnu. */
  canal: boolean | null;
  /** `recharger` : un versement a été enregistré, le rapport doit se relire. */
  onFermer: (recharger: boolean) => void;
}) {
  const detail = useCommandesAReverser(ligne.restaurantId, debut, fin);
  const commandes = detail.etat === 'pret' ? detail.commandes : [];
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
              <button type="button" className="btn ghost petit" style={{ marginTop: 8 }} onClick={() => setVoirListe((x) => !x)}>
                {voirListe ? 'Masquer les commandes' : 'Voir les commandes'}
              </button>
            </div>
            {voirListe ? <ListeCommandes commandes={commandes} netRapport={ligne.net} /> : null}

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
