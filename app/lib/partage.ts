import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { formatAr } from '../theme/tokens';

/**
 * Partage social — produits et restaurants.
 *
 * Le lien partagé est une vraie URL `https://`, jamais le schéma `taxifood://`.
 * C'est le seul choix qui tient la route :
 *
 * - `taxifood://…` collé dans WhatsApp n'est même pas cliquable, et ne fait rien
 *   du tout chez qui n'a pas l'app — c'est-à-dire exactement la personne qu'on
 *   cherche à convertir ;
 * - une URL `https://` est reconnue par toutes les messageries, affiche un aperçu
 *   (photo, nom, prix), s'ouvre DIRECTEMENT dans l'app si elle est installée
 *   (Universal Links iOS / App Links Android), et renvoie vers le store sinon.
 *
 * Côté site, `/p/<id>` et `/r/<id>` sont servis par la fonction Netlify
 * `landing/netlify/functions/partage.mjs`, qui lit Supabase et rend les balises
 * Open Graph. Côté app, ce sont les routes `app/p/[id].tsx` et `app/r/[id].tsx`
 * qui interceptent le lien et redirigent vers l'écran réel.
 *
 * ⚠️ Ce domaine doit rester aligné sur trois autres endroits, sous peine de liens
 * qui tombent silencieusement dans le navigateur au lieu de l'app :
 *   - `app.json` → `ios.associatedDomains` et `android.intentFilters`
 *   - `landing/.well-known/apple-app-site-association`
 *   - `landing/.well-known/assetlinks.json`
 */
export const SITE = 'https://taxifoodnosybe.distripro207.com';

export function lienProduit(productId: string) {
  return `${SITE}/p/${productId}`;
}

export function lienRestaurant(restaurantId: string) {
  return `${SITE}/r/${restaurantId}`;
}

/**
 * Les PLATS DU JOUR d'un restaurant, en une seule publication.
 *
 * Le lien `/j/<restaurant>` lit les plats à l'affiche AU MOMENT où on l'ouvre : le même
 * bouton partage les nouveaux plats demain, et un lien d'hier renvoie vers la page du
 * restaurant quand plus rien n'est à l'affiche. L'aperçu (image qui assemble les photos)
 * est fabriqué par la fonction Edge `apercu-plats-du-jour`, re-servie par
 * `landing/netlify/functions/partage.mjs`.
 */
export function lienPlatsDuJour(restaurantId: string, platIds?: string[]) {
  const base = `${SITE}/j/${restaurantId}`;
  return platIds && platIds.length ? `${base}?v=${empreintePlats(platIds)}` : base;
}

/**
 * Empreinte courte d'une liste de plats — FNV-1a 32 bits en base 36, sur les
 * identifiants TRIÉS (l'ordre d'affichage ne doit pas changer l'adresse).
 *
 * ⚠️ POURQUOI LE LIEN PORTE UNE EMPREINTE (`?v=`). Facebook met en cache, PAR
 * ADRESSE, ce qu'il a lu la première fois : titre, texte, image. Le lien des plats du
 * jour était toujours le même, `/j/<restaurant>` — le 2026-09-16, le partage publiait
 * donc les plats de la VEILLE, alors que la page servait bien les nouveaux. L'empreinte
 * est calculée sur les plats à l'affiche : les plats changent, l'adresse change, et
 * Facebook est obligé de relire la page.
 *
 * ⚠️ MÊME CALCUL, AU CARACTÈRE PRÈS, dans landing/netlify/functions/partage.mjs
 * (`empreintePlats`), qui pose la même adresse dans `og:url`. Si les deux divergent,
 * Facebook suit `og:url` : ça marche encore, mais au prix d'une double lecture.
 */
export function empreintePlats(ids: string[]): string {
  let h = 0x811c9dc5;
  for (const c of [...ids].sort().join(',')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Ouvre la feuille de partage du système.
 *
 * ⚠️ L'URL est mise DANS `message`, et `url` n'est volontairement pas rempli.
 * C'est contre-intuitif, et c'est délibéré : quand les deux sont fournis, iOS
 * publie deux éléments distincts et la plupart des applications de destination
 * n'en retiennent qu'un — l'URL. Le texte (« Margherita chez Les Siciliens »)
 * disparaît alors purement et simplement, et le destinataire reçoit un lien nu.
 * Vérifié sur simulateur le 2026-09-05 : avec `url` rempli, la feuille de
 * partage n'affichait que « taxifoodnosybe.distripro207.com », sans le nom du plat.
 *
 * On perd un peu côté AirDrop et Notes, qui auraient préféré `url`. C'est le
 * bon arbitrage : l'usage visé ici, c'est WhatsApp.
 */
async function partager(titre: string, texte: string, url: string) {
  try {
    await Share.share({ title: titre, message: `${texte}\n${url}` }, { subject: titre });
  } catch (e) {
    // L'utilisateur a fermé la feuille, ou aucune cible n'est disponible.
    // Rien à signaler : ce n'est pas une erreur de l'app.
    console.warn('[partage] abandonné', e);
  }
}

export function partagerProduit(p: { id: string; name: string; restaurantName?: string | null }) {
  const chez = p.restaurantName ? ` chez ${p.restaurantName}` : '';
  return partager(p.name, `${p.name}${chez} — à commander sur Taxi Food`, lienProduit(p.id));
}

export function partagerRestaurant(r: { id: string; name: string }) {
  return partager(r.name, `${r.name} livre avec Taxi Food`, lienRestaurant(r.id));
}

// --- Partage explicite : WhatsApp, Facebook, lien copié --------------------
//
// ⚠️ POURQUOI LA FEUILLE SYSTÈME NE SUFFIT PAS. `Share.share` s'appuie sur
// `navigator.share` côté web, et ce dernier N'EXISTE PAS sur un navigateur de
// bureau — vérifié le 2026-09-07 sur taxifood.distripro207.com :
// `typeof navigator.share === 'undefined'`. Le bouton de partage n'y faisait
// donc RIEN, en silence, l'échec étant avalé par le `catch` de `partager()`.
//
// Et c'est précisément là que ça compte : un restaurateur qui pousse son plat
// sur la page Facebook de son établissement le fait depuis un ordinateur, pas
// depuis la feuille de partage d'un téléphone.

/** Le texte qui accompagne un produit partagé. */
export function textePartageProduit(p: { name: string; restaurantName?: string | null }) {
  const chez = p.restaurantName ? ` chez ${p.restaurantName}` : '';
  return `${p.name}${chez} — à commander sur Taxi Food`;
}

/**
 * Le texte des plats du jour : un plat par ligne, avec son prix. Lisible tel quel dans
 * WhatsApp, où il accompagne le lien (Facebook, lui, n'affiche que l'aperçu).
 */
/** « Plats du jour chez La Cabane », mais « Plats du jour de Chez Bidul & Truc » (pas « chez Chez »). */
export function titrePlatsDuJour(restaurantName: string) {
  return `Plats du jour ${/^chez\s/i.test(restaurantName) ? 'de' : 'chez'} ${restaurantName}`;
}

export function textePartagePlatsDuJour(r: {
  restaurantName: string;
  plats: { name: string; price: number }[];
}) {
  const lignes = r.plats.map((p) => `• ${p.name} — ${formatAr(p.price)}`);
  return [`🔥 ${titrePlatsDuJour(r.restaurantName)}`, ...lignes, 'À commander sur Taxi Food 👉'].join('\n');
}

/**
 * WhatsApp. `wa.me` ouvre l'application si elle est installée, et sa version web
 * sinon : un seul lien couvre le téléphone et l'ordinateur.
 */
export function lienWhatsApp(texte: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${texte}\n${url}`)}`;
}

/**
 * Facebook.
 *
 * ⚠️ Le partageur Facebook IGNORE tout texte qu'on lui passe — le paramètre
 * `quote` ne fonctionne plus depuis 2017. Le titre, la description et l'image
 * affichés viennent EXCLUSIVEMENT des balises Open Graph de la page ciblée.
 * C'est pour ça que `/p/<id>` est servi par une fonction Netlify qui lit
 * Supabase et rend ces balises : sans elle, Facebook n'afficherait qu'un lien nu.
 * Ne jamais pointer ici vers `taxifood.distripro207.com/product/<id>`, qui est
 * l'app et n'a aucune balise.
 */
export function lienFacebook(url: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/** Ouvre un lien de partage externe. */
/** Appareil tactile — téléphone ou tablette. */
export function estTactile(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof navigator === 'undefined') return false;
  // ⚠️ L'iPad récent se déclare « Macintosh » : seul le nombre de points de
  // contact le distingue d'un vrai Mac.
  return navigator.maxTouchPoints > 1 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function ouvrirPartage(url: string) {
  if (Platform.OS !== 'web') {
    // Sur l'app installée, le système ouvre WhatsApp ou Facebook par-dessus, et
    // un retour arrière ramène à la fiche. Rien à arbitrer.
    await Linking.openURL(url);
    return;
  }

  // ⚠️ SUR TÉLÉPHONE, MÊME ONGLET.
  // `window.open(_blank)` y empile les onglets, et celui qu'on quitte apparaît
  // VIDE quand on y revient — au point de devoir fermer le site et le rouvrir.
  // Il est en plus souvent bloqué : les navigateurs mobiles n'y voient pas un
  // geste direct, React Native Web passant par des événements pointer.
  if (estTactile()) {
    window.location.href = url;
    return;
  }

  // ⚠️ SUR ORDINATEUR, NOUVEL ONGLET — ET L'ONGLET D'ORIGINE NE BOUGE PAS.
  //
  // On passe par un <a target="_blank"> qu'on déclenche, et NON par
  // `window.open`. Raison précise, et c'est un piège que j'ai payé :
  // `window.open(url, '_blank', 'noopener')` renvoie **null par spécification**,
  // même quand il réussit. Tout repli du genre `if (!fenetre) location.href = url`
  // se déclenche donc À CHAQUE FOIS : le nouvel onglet s'ouvre ET la page
  // d'origine part avec. C'est exactement ce qui a été constaté.
  //
  // Un ancre cliquée n'a pas ce défaut : elle ouvre l'onglet, ne renvoie rien à
  // mal interpréter, et ne touche jamais à la page courante.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Partage vers Facebook.
 *
 * ⚠️ TROIS VOIES ONT ÉTÉ ESSAYÉES SUR MOBILE. Celle-ci est la seule qui aboutit
 * vraiment ; les deux autres sont décrites ici pour qu'on ne les re-tente pas.
 *
 *  1. `facebook.com/sharer/sharer.php` — une relique du web de bureau. Sur
 *     mobile, Facebook renvoie vers son application ou son site allégé, qui ne
 *     le gèrent pas : la page s'ouvre et il n'y a RIEN à partager. Sur
 *     ORDINATEUR il fonctionne parfaitement — d'où un défaut totalement
 *     invisible tant qu'on ne teste que là.
 *
 *  2. Copier le lien puis ouvrir l'application par `fb://` — un seul geste de
 *     notre côté, mais il faut ensuite trouver son composeur et coller. Essayé
 *     le 2026-09-07, ABANDONNÉ à l'usage : on gagne des taps sur le papier, on
 *     en perd en repères.
 *
 *  3. La feuille de partage du système — RETENUE. Elle demande de passer par
 *     « Plus » puis de choisir Facebook, ce qui est plus long qu'on ne
 *     voudrait, mais c'est l'application Facebook elle-même qui prend la main :
 *     le composeur s'ouvre avec le lien, et la publication affiche bien la
 *     photo, le nom et le prix. Vérifié en publiant pour de vrai.
 *
 * ⚠️ On ne passe PAS `text` à `navigator.share`. iOS le colle devant l'URL, et
 * le composeur reçoit alors une phrase contenant un lien plutôt qu'un lien : il
 * ne va pas chercher l'aperçu.
 */
/**
 * Ce qu'il s'est réellement passé : l'écran doit pouvoir le dire. Un « copie » sans
 * message laisserait croire que le bouton n'a rien fait — c'est le défaut signalé
 * le 2026-09-16.
 */
export type IssuePartageFacebook = 'systeme' | 'copie' | 'onglet';

export async function partagerFacebook(titre: string, texte: string, url: string): Promise<IssuePartageFacebook> {
  // ⚠️ L'APPLICATION NATIVE PASSE PAR LA FEUILLE DU SYSTÈME, comme le web mobile.
  //
  // Le defaut a failli partir en revue Apple : la garde ne testait que
  // `Platform.OS === 'web'`, si bien que sur iOS et Android — donc dans le
  // binaire soumis — le bouton retombait sur `sharer.php`, qui n'affiche RIEN a
  // partager sur mobile. Un relecteur y aurait vu une fonction cassee (2.1).
  //
  // Le web de BUREAU est le seul cas ou `sharer.php` fonctionne : c'est la, et
  // la seulement, qu'on l'utilise.
  const surTelephone = Platform.OS !== 'web' || estTactile();

  if (surTelephone) {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator?.share === 'function') {
          await navigator.share({ title: titre, url });
          return 'systeme';
        }
        // ⚠️ NAVIGATEUR MOBILE SANS FEUILLE DE PARTAGE — le navigateur intégré de
        // Facebook ou d'Instagram, certains navigateurs Android. Le code retombait ici
        // sur `sharer.php`, la voie n°1 décrite plus haut comme morte sur téléphone :
        // constaté le 2026-09-16 sur les plats du jour, la page n'affichait qu'un logo
        // Facebook, rien à partager. On copie le lien et l'écran dit quoi en faire :
        // un chemin un peu plus long, mais qui aboutit.
        if (await copierLien(url)) return 'copie';
      } else {
        // Feuille native iOS/Android : Facebook y figure, et c'est l'application
        // elle-même qui prend la main.
        await Share.share({ title: titre, message: url }, { subject: titre });
        return 'systeme';
      }
    } catch (e) {
      // Feuille fermée par l'utilisateur : ce n'est pas une erreur, et ouvrir le
      // partageur derrière serait agressif.
      return 'systeme';
    }
  }
  await ouvrirPartage(lienFacebook(url));
  return 'onglet';
}

/**
 * Le lien partagé, marqué de son CANAL (`utm_source`) — c'est ce qui permet à la
 * mesure d'audience de dire d'où viennent les visites : WhatsApp, un lien copié
 * collé ailleurs, la feuille du système.
 *
 * ⚠️ PAS POUR FACEBOOK. Facebook remplace le lien par `og:url` (sans utm) dans la
 * publication : le marquage serait perdu, et il fabriquerait une adresse de plus
 * à mettre en cache. Facebook se signale de toute façon comme site d'origine.
 *
 * La page de partage ignore la requête (elle ne lit que le chemin) : l'aperçu est
 * identique avec ou sans marquage.
 */
export function avecSource(url: string, source: 'whatsapp' | 'lien' | 'systeme') {
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=${source}&utm_medium=partage`;
}

/** « j », « r », « s », « p » : ce qui est partagé, pour la mesure. */
export function typeDeLien(url: string) {
  return url.match(/\/(j|r|s|p)\//)?.[1] ?? 'autre';
}

/**
 * L'IMAGE d'aperçu du lien partagé, ou null quand il n'y en a pas.
 *
 * ⚠️ POURQUOI CE BOUTON EXISTE. Sur Facebook, une publication qui porte un LIEN
 * affiche une carte d'aperçu rognée, et le composeur la rogne encore. Publier
 * l'IMAGE comme photo, avec le lien dans le texte, rend mieux et se diffuse
 * mieux. Il faut donc pouvoir récupérer l'image.
 *
 * ⚠️ SEULS `/j/` (plats du jour) et `/s/` (sélection) ont une image ASSEMBLÉE
 * (`…/apercu.jpg`, fabriquée par une fonction Edge). `/p/` et `/r/` n'en ont
 * pas : leur `og:image` est la photo du plat ou la couverture du restaurant,
 * telle quelle — il n'y a rien à « enregistrer » de plus que ce que la fiche
 * montre déjà. Cette fonction rend donc null pour eux, et l'écran n'affiche pas
 * le bouton. Voir `landing/netlify/functions/partage.mjs`, même garde.
 *
 * La requête est CONSERVÉE : c'est elle qui porte l'empreinte `?v=` des plats à
 * l'affiche, et l'image en dépend.
 */
export function lienApercuImage(url: string): string | null {
  const m = url.match(/^(https?:\/\/[^/]+)\/(j|s)\/([0-9a-f-]{36})(\?[^#]*)?$/i);
  if (!m) return null;
  const [, base, genre, id, requete] = m;
  return `${base}/${genre}/${id}/apercu.jpg${requete ?? ''}`;
}

/** « taxi-food-plats-du-jour-chez-bidul-truc.jpg » — un nom qu'on retrouve dans ses fichiers. */
export function nomFichierApercu(titre: string): string {
  const propre = titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `taxi-food-${propre || 'apercu'}.jpg`;
}

/** Ce qu'il s'est passé quand on a demandé l'image — l'écran doit pouvoir le dire. */
export type IssueImage = 'galerie' | 'telechargee' | 'ouverte' | 'refus' | 'echec';

/**
 * Les deux modules natifs qui permettent d'enregistrer VRAIMENT dans les photos,
 * chargés PARESSEUSEMENT — et c'est le point le plus important de ce fichier.
 *
 * ⚠️ CE CODE PART AUSSI EN MISE À JOUR À DISTANCE SUR DES BINAIRES QUI N'ONT PAS
 * CES MODULES. Les versions 1.2.1 et 1.2.2 en magasin ont été compilées avant
 * `expo-media-library` et `expo-file-system` : un `import` en tête de fichier y
 * serait évalué au chargement du bundle et ferait tomber l'app au démarrage, pas
 * seulement le bouton. Un `require` dans un `try/catch`, lui, échoue là où il est
 * appelé, et on retombe alors sur le comportement d'avant (ouvrir l'image dans le
 * navigateur, appui long pour l'enregistrer).
 *
 * Ne JAMAIS remonter ces `require` en haut du fichier tant que des binaires sans
 * ces modules reçoivent des mises à jour à distance.
 */
type ModulesGalerie = {
  media: {
    requestPermissionsAsync: (ecritureSeule?: boolean) => Promise<{ granted: boolean }>;
    saveToLibraryAsync: (uri: string) => Promise<void>;
  };
  fs: {
    File: { new (...args: unknown[]): { uri: string; exists: boolean; delete: () => void };
            downloadFileAsync: (url: string, cible: unknown) => Promise<{ uri: string }> };
    Paths: { cache: unknown };
  };
};

function modulesGalerie(): ModulesGalerie | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const media = require('expo-media-library');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('expo-file-system');
    if (typeof media?.saveToLibraryAsync !== 'function') return null;
    if (typeof fs?.File?.downloadFileAsync !== 'function') return null;
    return { media, fs } as ModulesGalerie;
  } catch (e) {
    // Binaire compilé avant ces modules : ce n'est pas une erreur, c'est le repli.
    console.warn('[partage] galerie indisponible sur ce binaire', e);
    return null;
  }
}

/**
 * Enregistre l'image DANS LES PHOTOS du téléphone.
 * `null` = le binaire ne sait pas faire (on retombe sur le navigateur),
 * `refus` = l'autorisation a été refusée, `galerie` = c'est enregistré.
 */
async function enregistrerDansGalerie(urlImage: string, titre: string): Promise<'galerie' | 'refus' | null> {
  const m = modulesGalerie();
  if (!m) return null;
  try {
    // `true` = autorisation d'ÉCRITURE seule : on ne lit jamais les photos du
    // client, on n'en ajoute qu'une. iOS affiche le texte de `app.json`.
    const autorisation = await m.media.requestPermissionsAsync(true);
    if (!autorisation?.granted) return 'refus';

    const cible = new m.fs.File(m.fs.Paths.cache, nomFichierApercu(titre));
    try {
      if (cible.exists) cible.delete();
    } catch { /* un reste d'un partage précédent : sans conséquence */ }
    const fichier = await m.fs.File.downloadFileAsync(urlImage, cible);
    await m.media.saveToLibraryAsync(fichier.uri);
    try {
      cible.delete();
    } catch { /* le cache se videra tout seul */ }
    return 'galerie';
  } catch (e) {
    console.warn('[partage] enregistrement galerie impossible', e);
    return null;
  }
}

/**
 * Récupère l'image d'aperçu.
 *
 * ⚠️ AUCUNE DÉPENDANCE NATIVE AJOUTÉE, et c'est un choix. `expo-file-system`,
 * `expo-sharing` et `expo-media-library` sont absents du projet : en ajouter un
 * est un changement NATIF — donc plus aucune mise à jour à distance possible
 * pour ce bouton, et un build obligatoire avant que quiconque en profite.
 *
 * - **Web** : on lit l'image et on la télécharge sous un nom lisible. Le fichier
 *   est servi par la VITRINE, l'app web vit sur un autre domaine : sans
 *   `access-control-allow-origin` côté vitrine, la lecture est refusée — d'où
 *   le repli, qui ouvre simplement l'image dans un onglet.
 * - **App installée, binaire RÉCENT** : l'image est téléchargée puis ajoutée aux
 *   photos (`expo-media-library`), après une demande d'autorisation.
 * - **App installée, binaire ANCIEN** (1.2.1 / 1.2.2, compilés sans ces modules)
 *   **ou autorisation refusée** : on ouvre l'image dans le navigateur du
 *   téléphone, où un appui long propose « Ajouter aux photos » (iOS) ou
 *   « Télécharger l'image » (Android). C'est le comportement d'avant, et il reste
 *   le filet : le bouton ne doit JAMAIS faire tomber la feuille de partage.
 */
export async function enregistrerApercu(urlImage: string, titre: string): Promise<IssueImage> {
  if (Platform.OS !== 'web') {
    const galerie = await enregistrerDansGalerie(urlImage, titre);
    if (galerie === 'galerie') return 'galerie';
    // Autorisation refusée, ou binaire sans les modules : le navigateur reste la
    // voie de sortie, et l'écran dit quel geste faire.
    try {
      await Linking.openURL(urlImage);
      return galerie === 'refus' ? 'refus' : 'ouverte';
    } catch (e) {
      console.warn('[partage] image non ouverte', e);
      return 'echec';
    }
  }
  try {
    const reponse = await fetch(urlImage);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const blob = await reponse.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = nomFichierApercu(titre);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Laisser le temps au navigateur de lire le blob avant de le libérer.
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    return 'telechargee';
  } catch (e) {
    // Lecture refusée (domaine, réseau) : on ouvre l'image, elle s'enregistre
    // alors d'un appui long ou d'un clic droit.
    console.warn('[partage] telechargement impossible, ouverture', e);
    await ouvrirPartage(urlImage);
    return 'ouverte';
  }
}

/** Copie le lien, et dit si ça a marché — l'écran doit pouvoir le confirmer. */
export async function copierLien(url: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(url);
    return true;
  } catch (e) {
    console.warn('[partage] copie impossible', e);
    return false;
  }
}

/**
 * La feuille système est-elle réellement utilisable ici ?
 *
 * Sur mobile elle l'est toujours. Sur le web elle dépend de `navigator.share`,
 * absent des navigateurs de bureau — d'où ce test, qui évite de proposer un
 * bouton qui ne ferait rien.
 */
export function partageNatifDisponible(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Feuille système (iOS/Android, ou navigateur mobile qui la propose). */
export async function partageSysteme(titre: string, texte: string, url: string) {
  return partager(titre, texte, url);
}
