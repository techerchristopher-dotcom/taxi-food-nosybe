'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CORPS_MAX, MOT_DE_CONFIRMATION, TITRE_MAX, erreurDeSaisie, messageErreur, quand, resume,
} from '../lib/annonce';
import type { AnnonceListee, Cible, Resultat } from '../lib/annonce';

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
 *    connecté : on lit sa propre notification avant de réveiller l'île.
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

  const [historique, setHistorique] = useState<AnnonceListee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ cible: Cible; r: Resultat } | null>(null);

  // Confirmation d'un envoi à tout le monde.
  const [confirmer, setConfirmer] = useState(false);
  const [compte, setCompte] = useState<{ jetons: number; comptes: number } | null>(null);
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

  const saisie = erreurDeSaisie(titre, corps);
  const route = ouverture === '/' ? null : ouverture;

  /** Écrit l'annonce en base puis demande son envoi. Renvoie le résultat ou lève. */
  async function ecrireEtEnvoyer(cible: Cible): Promise<Resultat> {
    const { data: id, error } = await supabase.rpc('admin_creer_annonce', {
      p_titre: titre.trim(),
      p_corps: corps.trim(),
      p_cible: cible,
      p_route: route,
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
      setInfo('Test parti sur tes appareils. Regarde ton téléphone avant d’envoyer à tout le monde.');
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
    const ligne = (Array.isArray(data) ? data[0] : data) as { jetons: number; comptes: number } | undefined;
    setCompte({ jetons: ligne?.jetons ?? 0, comptes: ligne?.comptes ?? 0 });
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
            <div className="muted">{resultat.r.jetons_vises} appareil(s) visé(s)</div>
            {resultat.r.erreurs && Object.keys(resultat.r.erreurs).length ? (
              <div className="muted">
                {Object.entries(resultat.r.erreurs).map(([k, n]) => `${k} : ${n}`).join(' · ')}
              </div>
            ) : null}
          </div>
          <p className="muted sel-texte-court">
            « Accepté par Expo » n’est pas « reçu » : une app désinstallée est acceptée puis rejetée
            quelques secondes plus tard. Les jetons morts sont supprimés tout seuls.
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

        {/* L'aperçu : ce que la personne verra, pas ce qu'on a tapé. */}
        <div className="sel-label">Sur le téléphone</div>
        <div className="ann-apercu">
          <div className="ann-apercu-app">TAXI FOOD · maintenant</div>
          <div className="ann-apercu-titre">{titre.trim() || 'Titre de l’annonce'}</div>
          <div className="ann-apercu-corps">{corps.trim() || 'Le message qui s’affiche en dessous.'}</div>
        </div>

        {saisie ? <p className="muted sel-texte-court">{saisie}</p> : null}

        <div className="tel-envoi">
          <div className="sel-gestes">
            <button className="btn ghost sel-btn" disabled={envoi || !!saisie} onClick={() => void envoyerTest()}>
              M’envoyer un test
            </button>
            <button className="btn sel-btn" disabled={envoi || !!saisie} onClick={() => void ouvrirConfirmation()}>
              Envoyer à tous les clients
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
                </div>
                <div className="muted sel-detail">{a.corps}</div>
                <div className="muted sel-detail">
                  {quand(a.envoyee_le ?? a.creee_le)} · {a.auteur} · {a.envois_reussis}/{a.jetons_vises} acceptés
                  {a.envois_echoues ? ` · ${a.envois_echoues} échecs` : ''}
                  {a.jetons_supprimes ? ` · ${a.jetons_supprimes} jetons morts retirés` : ''}
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
            <div className="recap">
              <div>
                <strong>{compte?.jetons ?? 0} appareil{(compte?.jetons ?? 0) > 1 ? 's' : ''}</strong>
                {' '}· {compte?.comptes ?? 0} compte{(compte?.comptes ?? 0) > 1 ? 's' : ''} client
              </div>
              <div className="muted">Au tap : {route ? route : 'l’accueil de l’app'}</div>
            </div>
            <div className="warn">
              Une notification ne se reprend pas. Elle part tout de suite, sur tous ces téléphones,
              même la nuit.
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
                {envoi ? 'Envoi…' : `Envoyer à ${compte?.jetons ?? 0} appareils`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
