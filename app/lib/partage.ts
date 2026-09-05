import { Share } from 'react-native';

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
export const SITE = 'https://taxifood.rentanoo.com';

export function lienProduit(productId: string) {
  return `${SITE}/p/${productId}`;
}

export function lienRestaurant(restaurantId: string) {
  return `${SITE}/r/${restaurantId}`;
}

/**
 * Ouvre la feuille de partage du système.
 *
 * ⚠️ L'URL est répétée dans `message` ET passée dans `url`. Ce n'est pas une
 * maladresse : sur iOS, les applications de messagerie ne lisent que `message`
 * et ignorent `url` (elles ne savent pas composer les deux), tandis que les
 * partages « natifs » (AirDrop, Notes) préfèrent `url`. Ne mettre que `url`
 * enverrait un message vide dans WhatsApp — le cas d'usage principal ici.
 */
async function partager(titre: string, texte: string, url: string) {
  try {
    await Share.share({ title: titre, message: `${texte}\n${url}`, url }, { subject: titre });
  } catch (e) {
    // L'utilisateur a fermé la feuille, ou aucune cible n'est disponible.
    // Rien à signaler : ce n'est pas une erreur de l'app.
    console.warn('[partage] abandonné', e);
  }
}

export function partagerProduit(p: { id: string; name: string; restaurantName?: string | null }) {
  const chez = p.restaurantName ? ` chez ${p.restaurantName}` : '';
  return partager(p.name, `${p.name}${chez} — à commander sur Taxi Food 🛵`, lienProduit(p.id));
}

export function partagerRestaurant(r: { id: string; name: string }) {
  return partager(r.name, `${r.name} livre avec Taxi Food 🛵`, lienRestaurant(r.id));
}
