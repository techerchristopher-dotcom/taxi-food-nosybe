'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CORPS_MAX, MOT_DE_CONFIRMATION, TITRE_MAX, canalDe, erreurDeSaisie, libelleCanal,
  messageErreur, quand, resume,
} from '../lib/annonce';
import type { AnnonceListee, Canal, Cible, Comptes, Resultat } from '../lib/annonce';

/**
 * 📣 Annonce — une notification push écrite à la main, envoyée à tous les clients.
 *
 * ⚠️ UNE NOTIFICATION NE SE RATTRAPE PAS. Tout l'écran est construit autour de
 * cette phrase :
 *
 * 1. APERÇU D'ABORD. On voit le titre et le message comme ils apparaîtront sur
 *    le téléphone, pas dans un champ de formulaire.
 * 2. LE NOMBRE EXACT, RELU JUSTE AVANT. La confirmation affiche le nombre
 *    d'appareils et de comptes visés, redemandé à la base au moment d'ouvrir la
 *    fenêtre — pas celui d'il y a dix minutes.
 * 3. ON TAPE « ENVOYER ». Un bouton se clique par réflexe ; un mot se tape
 *    exprès. C'est le même geste que pour les remboursements.
 * 4. LE TEST EST À UN TAP. « M'envoyer un test » n'écrit que vers le compte
 *    connecté — sa notification ET son adresse e-mail : on lit son propre
 *    message avant de réveiller l'île.
 * 5. DEUX CANAUX, DEUX APERÇUS, DEUX CHIFFRES. Depuis le 2026-09-25 l'annonce
 *    part aussi par e-mail, parce que le push n'atteint que les téléphones où
 *    l'app est installée — et beaucoup de clients commandent depuis le site.
 *    ⚠️ Les deux nombres ne s'additionnent JAMAIS : les appareils et les
 *    adresses ne désignent pas les mêmes personnes.
 *
 * L'envoi lui-même est fait par la fonction Edge `envoyer-annonce` (elle seule a
 * accès aux jetons) ; la base garde l'historique, y compris les échecs.
 */

type Restaurant = { id: string; name: string; listing_status: string };

export function Annonces() {
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [ouverture, setOuverture] = useState<string>('/');
  const [restos, setRestos] = useState<Restaurant[]>([]);
  // Les deux canaux cochés par défaut : une annonce sert à être vue, et laisser
  // l'e-mail décoché par défaut reviendrait à oublier la moitié des clients.
  const [parNotification, setParNotification] = useState(true);
  const [parEmail, setParEmail] = useState(true);

  const [historique, setHistorique] = useState<AnnonceListee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ cible: Cible; r: Resultat } | null>(null);

  // Confirmation d'un envoi à tout le monde.
  const [confirmer, setConfirmer] = useState(false);
  const [compte, setCompte] = useState<Comptes | null>(null);
  const [motTape, setMotTape] = useState('');

  // ⚠️ Double appui : `setEnvoi(true)` ne désactive le bouton qu'au rendu suivant.
  // Ici, deux appuis = deux notifications sur chaque téléphone de l'île.
  const gestEnCours = useRef(false);

  const charger = useCallback(async () => {
    const [h, r] = await Promise.all([
      supabase.rpc('admin_lister_annonces', { p_limite: 30 }),
      supabase.from('restaurants').select('id, name, listing_status').neq('listing_status', 'hidden').order('rang_catalogue'),
    ]);
    setChargement(false);
    // La liste des restaurants est posée AVANT de traiter l'erreur d'historique :
    // un historique illisible ne doit pas vider le choix d'écran d'ouverture.
    if (!r.error) setRestos((r.data ?? []) as Restaurant[]);
    if (h.error) { setErr(h.error.message); return; }
    setHistorique((h.data ?? []) as AnnonceListee[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const canal = canalDe(parNotification, parEmail);
  const saisie = canal === null
    ? 'Choisis au moins un canal : notification, e-mail, ou les deux.'
    : erreurDeSaisie(titre, corps);
  const route = ouverture === '/' ? null : ouverture;

  /** Écrit l'annonce en base puis demande son envoi. Renvoie le résultat ou lève. */
  async function ecrireEtEnvoyer(cible: Cible): Promise<Resultat> {
    const { data: id, error } = await supabase.rpc('admin_creer_annonce', {
      p_titre: titre.trim(),
      p_corps: corps.trim(),
      p_cible: cible,
      p_route: route,
      p_canal: canal as Canal,
    });
    if (error) throw new Error(error.message);
    if (!id) throw new Error('La base n’a pas renvoyé d’identifiant.');
    const { data, error: envoiError } = await supabase.functions.invoke('envoyer-annonce', {
      body: { annonce_id: id },
    });
    if (envoiError) {
      // L'annonce existe en base, en « préparée » : elle restera dans l'historique
      // sans résultat, et c'est exactement ce qu'on veut voir.
      throw new Error(await lireErreur(envoiError));
    }
    return data as Resultat;
  }

  /** Le corps d'erreur d'une fonction Edge n'est pas dans `error.message`. */
  async function lireErreur(e: unknown): Promise<string> {
    const reponse = (e as { context?: Response })?.context;
    if (reponse && typeof reponse.text === 'function') {
      try {
        return await reponse.text();
      } catch { /* on retombe sur le message générique */ }
    }
    return (e as Error)?.message ?? 'envoi impossible';
  }

  async function envoyerTest() {
    if (gestEnCours.current || saisie) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    setInfo(null);
    try {
      const r = await ecrireEtEnvoyer('moi');
      setResultat({ cible: 'moi', r });
      setInfo(
        parEmail
          ? 'Test parti sur tes appareils et vers ta propre adresse e-mail, à toi seul. Regarde les deux avant d’envoyer à tout le monde.'
          : 'Test parti sur tes appareils. Regarde ton téléphone avant d’envoyer à tout le monde.',
      );
    } catch (e) {
      setErr(messageErreur((e as Error).message));
    } finally {
      gestEnCours.current = false;
      setEnvoi(false);
      await charger();
    }
  }

  /** Ouvre la confirmation, en relisant le nombre d'appareils À CET INSTANT. */
  async function ouvrirConfirmation() {
    setErr(null);
    setInfo(null);
    setMotTape('');
    const { data, error } = await supabase.rpc('admin_cibles_annonce', { p_cible: 'clients' });
    if (error) { setErr(messageErreur(error.message)); return; }
    const ligne = (Array.isArray(data) ? data[0] : data) as Comptes | undefined;
    setCompte({ jetons: ligne?.jetons ?? 0, comptes: ligne?.comptes ?? 0, emails: ligne?.emails ?? 0 });
    setConfirmer(true);
  }

  async function envoyerATous() {
    if (gestEnCours.current || saisie || motTape.trim().toUpperCase() !== MOT_DE_CONFIRMATION) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    try {
      const r = await ecrireEtEnvoyer('clients');
      setConfirmer(false);
      setResultat({ cible: 'clients', r });
      setInfo('C’est parti. Rien ne peut être repris : la suite se lit dans l’historique.');
      setTitre('');
      setCorps('');
      setOuverture('/');
      setParNotification(true);
      setParEmail(true);
    } catch (e) {
      setErr(messageErreur((e as Error).message));
    } finally {
      gestEnCours.current = false;
      setEnvoi(false);
      await charger();
    }
  }

  if (chargement) return <div className="card"><div className="empty">Chargement…</div></div>;

  return (
    <>
      {err ? <div className="card sel-erreur">{err}</div> : null}
      {info ? <div className="card sel-info">{info}</div> : null}

      {resultat ? (
        <div className="card sel-bloc">
          <h2>{resultat.cible === 'moi' ? 'Test envoyé' : 'Annonce envoyée'}</h2>
          <div className="recap">
            <div><strong>{resume(resultat.r)}</strong></div>
            <div className="muted">
              {libelleCanal(resultat.r.canal)} · {resultat.r.jetons_vises} appareil(s) visé(s) ·{' '}
              {resultat.r.emails_vises} adresse(s) visée(s)
            </div>
            {resultat.r.erreurs && Object.keys(resultat.r.erreurs).length ? (
              <div className="muted">
                {Object.entries(resultat.r.erreurs).map(([k, n]) => `${k} : ${n}`).join(' · ')}
              </div>
            ) : null}
          </div>
          <p className="muted sel-texte-court">
            « Accepté par Expo » n’est pas « reçu » : une app désinstallée est acceptée puis rejetée
            quelques secondes plus tard. Les jetons morts sont supprimés tout seuls.
            {resultat.r.canal !== 'push'
              ? ' Côté e-mail, « accepté par le serveur » veut dire que le serveur de messagerie a pris le message en charge — pas qu’il a été lu, ni même qu’il a échappé au dossier indésirable.'
              : ''}
          </p>
          <div className="sel-gestes">
            <button className="btn ghost sel-btn" onClick={() => setResultat(null)}>Fermer</button>
          </div>
        </div>
      ) : null}

      <div className="card sel-bloc tel-carte">
        <h2>📣 Annonce à tous les clients</h2>

        <label className="sel-champ-bloc">
          <span className="sel-label">Titre — ce qui s’affiche en gras sur le téléphone</span>
          <input
            className="sel-champ"
            value={titre}
            maxLength={TITRE_MAX * 2}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Nouveau restaurant : La Plage"
          />
          <span className={`sel-compteur${titre.trim().length > TITRE_MAX ? ' trop' : ''}`}>
            {titre.trim().length} / {TITRE_MAX}
          </span>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Message</span>
          <textarea
            className="sel-champ ann-corps"
            value={corps}
            maxLength={CORPS_MAX * 2}
            rows={3}
            onChange={(e) => setCorps(e.target.value)}
            placeholder="Bistrot & bar à Hell-Ville. Sa carte est dans l’app."
          />
          <span className={`sel-compteur${corps.trim().length > CORPS_MAX ? ' trop' : ''}`}>
            {corps.trim().length} / {CORPS_MAX}
          </span>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Au tap, ouvrir</span>
          <select className="sel-champ" value={ouverture} onChange={(e) => setOuverture(e.target.value)}>
            <option value="/">L’accueil de l’app</option>
            {restos.map((r) => (
              <option key={r.id} value={`/restaurant/${r.id}`}>
                La fiche de {r.name}{r.listing_status === 'coming_soon' ? ' (en négociation)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="sel-champ-bloc">
          <span className="sel-label">Par où l’envoyer</span>
          <label className="ann-canal">
            <input type="checkbox" checked={parNotification} onChange={(e) => setParNotification(e.target.checked)} />
            <span>
              <strong>Notification</strong>
              <em> — seulement les téléphones où l’app est installée</em>
            </span>
          </label>
          <label className="ann-canal">
            <input type="checkbox" checked={parEmail} onChange={(e) => setParEmail(e.target.checked)} />
            <span>
              <strong>E-mail</strong>
              <em> — les clients qui commandent depuis le site, eux aussi</em>
            </span>
          </label>
          <p className="muted sel-texte-court">
            L’e-mail ne part pas aux restaurateurs ni aux livreurs, et jamais à quelqu’un qui s’est
            désinscrit des annonces. Ses e-mails de commande, eux, continuent toujours.
          </p>
        </div>

        {/* Les aperçus : ce que la personne verra, pas ce qu'on a tapé. */}
        {parNotification ? (
          <>
            <div className="sel-label">Sur le téléphone</div>
            <div className="ann-apercu">
              <div className="ann-apercu-app">TAXI FOOD · maintenant</div>
              <div className="ann-apercu-titre">{titre.trim() || 'Titre de l’annonce'}</div>
              <div className="ann-apercu-corps">{corps.trim() || 'Le message qui s’affiche en dessous.'}</div>
            </div>
          </>
        ) : null}

        {parEmail ? (
          <>
            <div className="sel-label">Dans la boîte mail</div>
            <div className="ann-mail">
              <div className="ann-mail-objet">{titre.trim() || 'Titre de l’annonce'}</div>
              <div className="ann-mail-de">Taxi Food &lt;christopher@distripro207.com&gt;</div>
              <div className="ann-mail-corps">
                <div className="ann-mail-logo">TAXI FOOD</div>
                <div className="ann-mail-emo">📣</div>
                <div className="ann-mail-titre">{titre.trim() || 'Titre de l’annonce'}</div>
                <div className="ann-mail-texte">{corps.trim() || 'Le message qui s’affiche en dessous.'}</div>
                <div className="ann-mail-bouton">Voir dans Taxi Food</div>
                {/* ⚠️ Ce pied n'est pas décoratif : sans lui, rien ne part. */}
                <div className="ann-mail-pied">
                  Ne plus recevoir les annonces Taxi Food — les e-mails liés à tes commandes, eux,
                  continueront de t’arriver.
                </div>
              </div>
            </div>
          </>
        ) : null}

        {saisie ? <p className="muted sel-texte-court">{saisie}</p> : null}

        <div className="tel-envoi">
          <div className="sel-gestes">
            <button className="btn ghost sel-btn" disabled={envoi || !!saisie} onClick={() => void envoyerTest()}>
              M’envoyer un test
            </button>
            <button className="btn sel-btn" disabled={envoi || !!saisie} onClick={() => void ouvrirConfirmation()}>
              Envoyer à tous les clients{canal ? ` — ${libelleCanal(canal)}` : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="card sel-bloc">
        <h2>Ce qui a déjà été envoyé</h2>
        {historique.length === 0 ? (
          <div className="empty">Aucune annonce pour l’instant.</div>
        ) : (
          <div className="sel-liste">
            {historique.map((a) => (
              <div className={`sel-fiche${a.statut === 'preparee' ? ' morte' : ''}`} key={a.id}>
                <div className="sel-fiche-haut">
                  <span className="sel-nom">{a.titre}</span>
                  <span className={`pill ${a.statut === 'envoyee' ? 'livree' : a.statut === 'echouee' ? 'annulee' : 'recue'}`}>
                    {a.statut === 'envoyee' ? 'envoyée' : a.statut === 'echouee' ? 'échec' : 'jamais partie'}
                  </span>
                  <span className="pill sans_objet">{a.cible === 'moi' ? 'test' : 'clients'}</span>
                  <span className="pill sans_objet">{libelleCanal(a.canal)}</span>
                </div>
                <div className="muted sel-detail">{a.corps}</div>
                <div className="muted sel-detail">
                  {quand(a.envoyee_le ?? a.creee_le)} · {a.auteur}
                  {a.canal !== 'email' ? ` · ${a.envois_reussis}/${a.jetons_vises} appareils acceptés` : ''}
                  {a.canal !== 'email' && a.envois_echoues ? ` · ${a.envois_echoues} échecs` : ''}
                  {a.canal !== 'email' && a.jetons_supprimes ? ` · ${a.jetons_supprimes} jetons morts retirés` : ''}
                  {a.canal !== 'push' ? ` · ${a.emails_envoyes}/${a.emails_vises} e-mails acceptés` : ''}
                  {a.canal !== 'push' && a.emails_echoues ? ` · ${a.emails_echoues} e-mails en échec` : ''}
                  {a.route ? ` · ouvre ${a.route}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmer ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            <h3>Envoyer à tous les clients ?</h3>
            <div className="ann-apercu">
              <div className="ann-apercu-app">TAXI FOOD · maintenant</div>
              <div className="ann-apercu-titre">{titre.trim()}</div>
              <div className="ann-apercu-corps">{corps.trim()}</div>
            </div>
            {/* ⚠️ Relu à CET instant, pas il y a dix minutes — et les deux
                nombres restent côte à côte, jamais additionnés. */}
            <div className="recap">
              <div>
                <strong>
                  {parNotification ? `${compte?.jetons ?? 0} appareil${(compte?.jetons ?? 0) > 1 ? 's' : ''}` : 'aucune notification'}
                  {' · '}
                  {parEmail ? `${compte?.emails ?? 0} e-mail${(compte?.emails ?? 0) > 1 ? 's' : ''}` : 'aucun e-mail'}
                </strong>
              </div>
              {parNotification ? (
                <div className="muted">
                  {compte?.comptes ?? 0} compte{(compte?.comptes ?? 0) > 1 ? 's' : ''} client avec l’app installée
                </div>
              ) : null}
              <div className="muted">Au tap, ou depuis le bouton de l’e-mail : {route ? route : 'l’accueil de l’app'}</div>
            </div>
            <div className="warn">
              {parNotification && parEmail
                ? 'Ni une notification ni un e-mail ne se reprennent. Ils partent tout de suite, sur tous ces téléphones et dans toutes ces boîtes, même la nuit.'
                : parNotification
                  ? 'Une notification ne se reprend pas. Elle part tout de suite, sur tous ces téléphones, même la nuit.'
                  : 'Un e-mail ne se reprend pas. Il part tout de suite, dans toutes ces boîtes.'}
            </div>
            <label className="sel-champ-bloc">
              <span className="sel-label">Tape {MOT_DE_CONFIRMATION} pour confirmer</span>
              <input className="sel-champ" value={motTape} onChange={(e) => setMotTape(e.target.value)} placeholder={MOT_DE_CONFIRMATION} />
            </label>
            {err ? <p className="sel-erreur-texte">{err}</p> : null}
            <div className="pied">
              <button className="btn ghost sel-btn" disabled={envoi} onClick={() => setConfirmer(false)}>Revenir</button>
              <button
                className="btn sel-btn"
                disabled={envoi || motTape.trim().toUpperCase() !== MOT_DE_CONFIRMATION}
                onClick={() => void envoyerATous()}
              >
                {envoi
                  ? 'Envoi…'
                  : `Envoyer${parNotification ? ` à ${compte?.jetons ?? 0} appareils` : ''}${
                      parNotification && parEmail ? ' et' : ''
                    }${parEmail ? ` à ${compte?.emails ?? 0} e-mails` : ''}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
