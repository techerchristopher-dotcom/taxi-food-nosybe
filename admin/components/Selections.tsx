'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';
import {
  ETAT_LIBELLE, PLATS_MAX, RESTAURANTS_MAX, TITRE_MAX, VALIDITE_DEFAUT, VALIDITE_MAX, VALIDITE_MIN,
  copierDansLePressePapier, dateNosyBe, erreurDeSaisie, etatSelection, grouperParRestaurant,
  initiales, lienApercu, lienSelection, lienWhatsApp, partagerFacebook, texteAPartager,
} from '../lib/selection';
import type { PlatChoisi, SelectionListee } from '../lib/selection';

/**
 * Publier une SÉLECTION de plats : quelques plats choisis à la main, un lien à
 * coller sur Facebook ou WhatsApp.
 *
 * À ne pas confondre avec « à l'affiche » (`is_featured`) : celui-là appartient
 * au restaurateur et vit dans son espace. Ici, c'est le fondateur qui compose,
 * à travers plusieurs restaurants.
 *
 * Cinq partis pris.
 *
 * 1. MOBILE D'ABORD. Cet écran se tient debout dans un restaurant, sur un
 *    téléphone, entre deux services. Tout est en colonne à 390 px, les zones
 *    tactiles font 44 px, les champs 16 px (en dessous, iOS Safari zoome au
 *    focus et ne redescend jamais). L'écran large ne fait qu'élargir.
 * 2. ON NE PROPOSE QUE DU COMMANDABLE. Un plat indisponible, archivé, annoncé
 *    « bientôt disponible », ou d'un restaurant lui-même « bientôt disponible »
 *    n'apparaît pas dans la liste à cocher. La base les refuserait de toute
 *    façon ; les montrer, ce serait faire cliquer dans le vide.
 * 3. RIEN N'EST GELÉ. La page publique relit le nom, le prix et la photo à
 *    chaque ouverture. Cet écran ne recopie donc jamais un prix ailleurs que
 *    dans le message d'annonce, écrit au moment où on le copie.
 * 4. LE PANIER EST MONO-RESTAURANT (`app/store/cart.ts`, `canAdd`). Les plats
 *    sont donc groupés par restaurant partout : dans la liste à cocher, dans le
 *    récapitulatif, et dans le texte remis au client, qui le dit en une phrase.
 * 5. L'APERÇU EST MONTRÉ AVANT DE PUBLIER. La balise `img` sur
 *    `/s/<id>/apercu.jpg` sert deux fois : elle montre au fondateur ce que
 *    Facebook affichera, et elle fabrique l'image AVANT que le lien ne soit
 *    collé — le premier lecteur ne tombe pas sur une vignette vide.
 */

type Resto = { id: string; name: string; listing_status: string | null };

type Produit = {
  id: string;
  name: string;
  price: number;
  photo_url: string | null;
  restaurant_id: string;
};

type Creee = { id: string; titre: string; plats: PlatChoisi[] };

export function Selections() {
  const [restos, setRestos] = useState<Resto[]>([]);
  const [restosChoisis, setRestosChoisis] = useState<string[]>([]);
  const [catalogue, setCatalogue] = useState<Produit[]>([]);
  const [choisis, setChoisis] = useState<PlatChoisi[]>([]);
  const [titre, setTitre] = useState('');
  const [validite, setValidite] = useState(String(VALIDITE_DEFAUT));

  const [selections, setSelections] = useState<SelectionListee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [chargementPlats, setChargementPlats] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [creee, setCreee] = useState<Creee | null>(null);
  const [copie, setCopie] = useState<'lien' | 'texte' | null>(null);
  const [apercuEssai, setApercuEssai] = useState(0);
  const [apercuEchoue, setApercuEchoue] = useState(false);
  const [aDesactiver, setADesactiver] = useState<SelectionListee | null>(null);

  // ⚠️ Double clic : `setEnvoi(true)` ne désactive le bouton qu'au rendu suivant.
  // Deux clics rapprochés publieraient deux sélections identiques, chacune avec
  // son lien. Même verrou synchrone que dans CodesOfferts.tsx.
  const gestEnCours = useRef(false);
  // La dernière demande de catalogue gagne : décocher puis recocher un
  // restaurant plus vite que le réseau ne répond, sinon, ressuscite l'ancienne liste.
  const seqPlats = useRef(0);

  const charger = useCallback(async () => {
    const [r, s] = await Promise.all([
      supabase.from('restaurants').select('id, name, listing_status').order('name'),
      supabase.rpc('admin_lister_selections', { p_limite: 50 }),
    ]);
    setChargement(false);
    if (r.error) { setErr(r.error.message); return; }
    if (s.error) { setErr(s.error.message); return; }
    setRestos((r.data ?? []) as Resto[]);
    setSelections((s.data ?? []) as SelectionListee[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  // Le catalogue des restaurants cochés. Les filtres sont posés côté base :
  // inutile de rapatrier une carte entière pour en jeter la moitié ici.
  useEffect(() => {
    if (restosChoisis.length === 0) {
      setCatalogue([]);
      setChargementPlats(false);
      return;
    }
    const seq = ++seqPlats.current;
    setChargementPlats(true);
    void (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, photo_url, restaurant_id')
        .in('restaurant_id', restosChoisis)
        .eq('is_available', true)
        .eq('is_archived', false)
        .eq('listing_status', 'visible')
        .order('name');
      if (seq !== seqPlats.current) return;
      setChargementPlats(false);
      if (error) { setErr(error.message); return; }
      setCatalogue((data ?? []) as Produit[]);
    })();
  }, [restosChoisis]);

  const nomDuResto = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of restos) m.set(r.id, r.name);
    return m;
  }, [restos]);

  /**
   * Seuls les restaurants « visible » sont proposés.
   *
   * ⚠️ Ce n'est pas une préférence d'affichage, c'est la règle de la base :
   * `selection_plat_commandable` exige `r.listing_status = 'visible'`, et
   * `admin_creer_selection` refuse la sélection entière en nommant le plat
   * fautif. « bientôt disponible » ne prend pas de commande ; « hidden » est
   * retiré de l'accueil, et la base a tranché qu'il ne se met pas non plus en
   * avant. Les proposer ici, ce serait faire cocher douze plats pour rien.
   */
  const restosProposables = useMemo(
    () => restos.filter((r) => (r.listing_status ?? 'visible') === 'visible'),
    [restos],
  );

  const platsDisponibles = useMemo<PlatChoisi[]>(
    () => catalogue.map((p) => ({
      id: p.id,
      nom: p.name,
      prix: p.price,
      photoUrl: p.photo_url,
      restaurantId: p.restaurant_id,
      restaurantNom: nomDuResto.get(p.restaurant_id) ?? 'Restaurant',
    })),
    [catalogue, nomDuResto],
  );

  const groupesDisponibles = useMemo(
    () => grouperParRestaurant(platsDisponibles),
    [platsDisponibles],
  );
  const groupesChoisis = useMemo(() => grouperParRestaurant(choisis), [choisis]);

  const validiteNb = /^\d+$/.test(validite.trim()) ? Number.parseInt(validite.trim(), 10) : Number.NaN;
  const erreurFormulaire = erreurDeSaisie(titre, choisis, validiteNb);
  const titreTropLong = titre.replace(/^ +| +$/g, '').length > TITRE_MAX;

  // ⚠️ Rien de tout ceci ne passe par une fonction de mise à jour : `reactStrictMode`
  // est actif, et React y appelle ces fonctions DEUX fois. Un `setErr` glissé
  // dedans s'exécuterait deux fois, un compteur incrémenté compterait double.
  // Ce sont des gestionnaires de clic : l'état du rendu courant suffit.
  function basculerResto(id: string) {
    setErr(null);
    if (restosChoisis.includes(id)) {
      // Retirer le restaurant retire ses plats : les garder publierait des plats
      // que l'écran ne montre plus, sans aucun moyen de les décocher.
      setRestosChoisis(restosChoisis.filter((x) => x !== id));
      setChoisis(choisis.filter((x) => x.restaurantId !== id));
      return;
    }
    if (restosChoisis.length >= RESTAURANTS_MAX) {
      setErr(`${RESTAURANTS_MAX} restaurants au maximum dans une sélection. Décoche-en un d’abord.`);
      return;
    }
    setRestosChoisis([...restosChoisis, id]);
  }

  function basculerPlat(plat: PlatChoisi) {
    setErr(null);
    if (choisis.some((x) => x.id === plat.id)) {
      setChoisis(choisis.filter((x) => x.id !== plat.id));
      return;
    }
    if (choisis.length >= PLATS_MAX) {
      setErr(`${PLATS_MAX} plats au maximum. Au-delà, personne ne lit jusqu’en bas.`);
      return;
    }
    // L'ordre des clics devient l'ordre d'affichage : c'est le `rang` en base.
    setChoisis([...choisis, plat]);
  }

  async function creer() {
    if (gestEnCours.current || erreurFormulaire) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    setInfo(null);
    const titrePropre = titre.replace(/^ +| +$/g, '');
    const { data, error } = await supabase.rpc('admin_creer_selection', {
      p_titre: titrePropre,
      p_product_ids: choisis.map((p) => p.id),
      p_validite_jours: validiteNb,
    });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    const id = typeof data === 'string' ? data : String(data ?? '');
    if (!id) {
      // La base a répondu sans identifiant : on ne sait pas si la sélection existe.
      // Dire « créée » serait un mensonge, dire « échec » aussi — on renvoie à la liste.
      setErr('La base n’a pas renvoyé de lien. Regarde la liste ci-dessous : si la sélection y est, elle est bien créée. Sinon, recommence.');
      await charger();
      return;
    }
    setApercuEssai(0);
    setApercuEchoue(false);
    setCreee({ id, titre: titrePropre, plats: choisis });
    await charger();
  }

  async function desactiver(s: SelectionListee) {
    if (gestEnCours.current) return;
    gestEnCours.current = true;
    setEnvoi(true);
    const { error } = await supabase.rpc('admin_desactiver_selection', { p_selection_id: s.id });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    setADesactiver(null);
    setErr(null);
    setInfo(`« ${s.titre} » est désactivée : le lien déjà partagé n’affiche plus rien.`);
    if (creee?.id === s.id) setCreee(null);
    await charger();
  }

  async function copierTexte(quoi: 'lien' | 'texte', contenu: string) {
    const ok = await copierDansLePressePapier(contenu);
    if (!ok) {
      setErr('Le navigateur refuse le presse-papiers. Sélectionne le texte à la main, il est affiché juste au-dessus.');
      return;
    }
    setErr(null);
    setCopie(quoi);
    setTimeout(() => setCopie((c) => (c === quoi ? null : c)), 2500);
  }

  function recommencer() {
    setCreee(null);
    setChoisis([]);
    setRestosChoisis([]);
    setTitre('');
    setValidite(String(VALIDITE_DEFAUT));
    setInfo(null);
    setErr(null);
  }

  const lien = creee ? lienSelection(creee.id) : '';
  const message = creee ? texteAPartager(creee.titre, creee.plats, lien) : '';

  if (chargement) return <div className="card"><div className="empty">Chargement…</div></div>;

  return (
    <>
      {err && !aDesactiver ? <div className="card sel-erreur">Erreur : {err}</div> : null}
      {info ? <div className="card sel-info">{info}</div> : null}

      {/* ————— Ce qui vient d'être publié ————— */}
      {creee ? (
        <div className="card sel-bloc">
          <h2>Ta sélection est en ligne</h2>

          <p className="sel-texte-court">
            Voici ce que verront les gens quand tu colleras le lien. Regarde l’image : c’est elle qui
            s’affichera dans la publication.
          </p>

          {/* L'aperçu n'est pas décoratif : l'afficher ici fabrique l'image avant
              que le lien ne parte, et montre au fondateur ce qu'il publie.
              `next/image` n'a rien à faire là — le fichier est assemblé par une
              fonction Edge, hors de tout pipeline de build. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={apercuEssai}
            className="sel-apercu"
            src={lienApercu(creee.id)}
            alt={`Aperçu de la sélection « ${creee.titre} »`}
            onError={() => setApercuEchoue(true)}
            onLoad={() => setApercuEchoue(false)}
          />
          {apercuEchoue ? (
            <div className="warn sel-bloc">
              L’image n’est pas encore prête. Elle se fabrique à la première ouverture ; laisse quelques
              secondes puis réessaie.
              <div className="sel-gestes">
                <button className="btn ghost sel-btn" onClick={() => { setApercuEchoue(false); setApercuEssai((n) => n + 1); }}>
                  Réessayer
                </button>
              </div>
            </div>
          ) : null}

          <div className="sel-label">Le lien à partager</div>
          <div className="sel-lien">{lien}</div>

          <div className="sel-gestes">
            <button className="btn sel-btn" onClick={() => void copierTexte('lien', lien)}>
              {copie === 'lien' ? 'Lien copié' : 'Copier le lien'}
            </button>
            {/* Un vrai lien : un `window.open` déclenché après un appel réseau
                perd le geste de l'utilisateur et se fait bloquer. */}
            <a className="btn ghost sel-btn" href={lienWhatsApp(message)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            {/* Bouton et non lien : sur téléphone, `sharer.php` ouvre une page
                sans rien à partager — c'est la feuille du système qui prend la
                main. Le choix se fait dans `partagerFacebook`. */}
            <button className="btn ghost sel-btn" onClick={() => void partagerFacebook(creee.titre, lien)}>
              Facebook
            </button>
          </div>

          <div className="sel-label">Le message prêt à coller</div>
          <pre className="sel-message">{message}</pre>
          <div className="sel-gestes">
            <button className="btn ghost sel-btn" onClick={() => void copierTexte('texte', message)}>
              {copie === 'texte' ? 'Message copié' : 'Copier le message'}
            </button>
          </div>
          <p className="muted sel-texte-court">
            Ce message part avec WhatsApp. Facebook, lui, ignore tout texte qu’on lui passe : il n’affiche
            que le titre, l’image et la description de la page. Pour l’accompagner d’un mot, écris-le
            toi-même dans le composeur Facebook.
          </p>

          <div className="sel-gestes">
            <button className="btn ghost sel-btn" onClick={recommencer}>Faire une autre sélection</button>
          </div>
        </div>
      ) : null}

      {/* ————— La composition ————— */}
      <div className="card sel-bloc">
        <h2>Composer une sélection</h2>

        <div className="sel-etape">
          <div className="sel-etape-titre">
            <span>1. Les restaurants</span>
            <span className="muted">{restosChoisis.length} / {RESTAURANTS_MAX}</span>
          </div>
          {restos.length > restosProposables.length ? (
            <p className="muted sel-texte-court">
              {restos.length - restosProposables.length} restaurant
              {restos.length - restosProposables.length > 1 ? 's ne sont pas proposés' : ' n’est pas proposé'} :
              ils ne sont pas visibles dans l’app, leurs plats ne se commandent pas.
            </p>
          ) : null}
          {restosProposables.length === 0 ? (
            <div className="empty">Aucun restaurant visible en ce moment.</div>
          ) : (
            <div className="sel-liste">
              {restosProposables.map((r) => {
                const coche = restosChoisis.includes(r.id);
                return (
                  <label className={`sel-rangee${coche ? ' choisi' : ''}`} key={r.id}>
                    <input
                      className="sel-case"
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculerResto(r.id)}
                    />
                    <span className="sel-corps">
                      <span className="sel-nom">{r.name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="sel-etape">
          <div className="sel-etape-titre">
            <span>2. Les plats</span>
            <span className="muted">{choisis.length} / {PLATS_MAX}</span>
          </div>
          {restosChoisis.length === 0 ? (
            <div className="empty">Choisis d’abord un restaurant.</div>
          ) : chargementPlats ? (
            <div className="empty">Chargement des cartes…</div>
          ) : groupesDisponibles.length === 0 ? (
            <div className="empty">Aucun plat commandable dans ces cartes.</div>
          ) : (
            groupesDisponibles.map((g) => (
              <div className="sel-groupe" key={g.restaurantId}>
                <div className="sel-groupe-titre">{g.restaurantNom}</div>
                <div className="sel-liste">
                  {g.plats.map((p) => {
                    const coche = choisis.some((x) => x.id === p.id);
                    return (
                      <label className={`sel-rangee${coche ? ' choisi' : ''}`} key={p.id}>
                        <input
                          className="sel-case"
                          type="checkbox"
                          checked={coche}
                          onChange={() => basculerPlat(p)}
                        />
                        {p.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="sel-vignette" src={p.photoUrl} alt="" loading="lazy" />
                        ) : (
                          /* ADR-007 : pas de visuel approximatif. Sans photo du plat
                             réellement servi, des initiales — comme dans l'app. */
                          <span className="sel-vignette sel-initiales">{initiales(p.nom)}</span>
                        )}
                        <span className="sel-corps">
                          <span className="sel-nom">{p.nom}</span>
                          <span className="muted sel-detail">{formatAr(p.prix)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sel-etape">
          <div className="sel-etape-titre"><span>3. Le titre et la durée</span></div>
          <label className="sel-champ-bloc">
            <span className="sel-label">Titre — ce que les gens lisent en premier</span>
            {/* `maxLength` volontairement au-delà des 80 caractères permis : on
                laisse dépasser pour que le compteur passe au rouge et dise
                pourquoi, plutôt que d'arrêter la frappe sans explication. */}
            <input
              className="sel-champ"
              value={titre}
              maxLength={TITRE_MAX * 2}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Les plats du jour à Nosy Be"
            />
            <span className={`sel-compteur${titreTropLong ? ' trop' : ''}`}>
              {titre.replace(/^ +| +$/g, '').length} / {TITRE_MAX}
            </span>
          </label>
          <label className="sel-champ-bloc">
            <span className="sel-label">Durée en jours</span>
            {/* `inputMode` numérique : sur téléphone, le clavier s'ouvre sur les
                chiffres. `type="number"` seul ne suffit pas sur iOS. */}
            <input
              className="sel-champ sel-court"
              type="number"
              inputMode="numeric"
              min={VALIDITE_MIN}
              max={VALIDITE_MAX}
              value={validite}
              onChange={(e) => setValidite(e.target.value)}
            />
            <span className="muted sel-detail">
              Passé ce délai, le lien n’affiche plus rien. De {VALIDITE_MIN} à {VALIDITE_MAX} jours.
            </span>
          </label>
        </div>

        {choisis.length > 0 ? (
          <div className="recap">
            {groupesChoisis.map((g) => (
              <div key={g.restaurantId}>
                <strong>{g.restaurantNom}</strong>
                {' — '}
                {g.plats.map((p) => p.nom).join(', ')}
              </div>
            ))}
            {groupesChoisis.length > 1 ? (
              <div className="muted">
                Une commande part chez un seul restaurant : qui veut des plats des deux passe deux commandes.
                La page le dit aux clients.
              </div>
            ) : null}
          </div>
        ) : null}

        {erreurFormulaire ? <p className="muted sel-texte-court">{erreurFormulaire}</p> : null}

        <div className="sel-gestes">
          <button className="btn sel-btn" disabled={envoi || erreurFormulaire !== null} onClick={() => void creer()}>
            {envoi ? 'Publication…' : 'Créer la sélection'}
          </button>
        </div>
      </div>

      {/* ————— Ce qui est déjà publié ————— */}
      <div className="card sel-bloc">
        <h2>Les sélections publiées</h2>
        {selections.length === 0 ? (
          <div className="empty">Aucune sélection pour l’instant.</div>
        ) : (
          <div className="sel-liste">
            {selections.map((s) => {
              const etat = etatSelection(s);
              return (
                <div className={`sel-fiche${etat === 'active' ? '' : ' morte'}`} key={s.id}>
                  <div className="sel-fiche-haut">
                    <span className="sel-nom">{s.titre}</span>
                    <span className={`pill sel-${etat}`}>{ETAT_LIBELLE[etat]}</span>
                  </div>
                  <div className="muted sel-detail">
                    {s.nb_plats} plat{s.nb_plats > 1 ? 's' : ''} · {(s.restaurants ?? []).join(', ') || '—'}
                  </div>
                  <div className="muted sel-detail">
                    Créée le {dateNosyBe(s.cree_le)} · {etat === 'expiree' ? 'expirée' : 'expire'} le {dateNosyBe(s.expire_le)}
                  </div>
                  <div className="sel-gestes">
                    <a className="btn ghost sel-btn" href={lienSelection(s.id)} target="_blank" rel="noopener noreferrer">
                      Ouvrir la page
                    </a>
                    {etat === 'active' ? (
                      <button className="btn ghost danger sel-btn" disabled={envoi} onClick={() => { setErr(null); setADesactiver(s); }}>
                        Désactiver
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="muted sel-texte-court">
          La page relit les plats à chaque ouverture : un prix corrigé ce matin s’affiche corrigé. Un plat
          retiré de la carte disparaît de la sélection tout seul.
        </p>
      </div>

      {aDesactiver ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            <h3>Désactiver cette sélection ?</h3>
            <div className="recap">
              <div><strong>{aDesactiver.titre}</strong></div>
              <div>{aDesactiver.nb_plats} plat{aDesactiver.nb_plats > 1 ? 's' : ''} · {(aDesactiver.restaurants ?? []).join(', ') || '—'}</div>
              <div className="muted">Expire le {dateNosyBe(aDesactiver.expire_le)}</div>
            </div>
            <div className="warn">
              Le lien est peut-être déjà publié. Après ça, il n’affiche plus rien — pas une ancienne
              version, rien du tout. On ne peut pas revenir en arrière depuis cet écran.
            </div>
            {err ? <p className="sel-erreur-texte">{err}</p> : null}
            <div className="pied">
              <button className="btn ghost sel-btn" disabled={envoi} onClick={() => setADesactiver(null)}>Revenir</button>
              <button className="btn sel-btn" disabled={envoi} onClick={() => void desactiver(aDesactiver)}>
                {envoi ? 'Désactivation…' : 'Désactiver'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
