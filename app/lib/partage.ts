import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

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
export async function partagerFacebook(titre: string, texte: string, url: string) {
  if (Platform.OS === 'web' && estTactile() && typeof navigator?.share === 'function') {
    try {
      await navigator.share({ title: titre, url });
      return;
    } catch (e) {
      // Feuille fermée par l'utilisateur : ce n'est pas une erreur, et ouvrir le
      // partageur derrière serait agressif.
      return;
    }
  }
  await ouvrirPartage(lienFacebook(url));
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
