import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * D'OÙ VIENT LE CLIENT — l'étiquette du groupe Facebook, portée jusqu'à sa commande.
 *
 * ── Le problème qu'on résout ─────────────────────────────────────────────────
 * La page des plats du jour est publiée à la main dans une vingtaine de groupes
 * Facebook. Sans marquage, on publie à l'aveugle : impossible de savoir lequel
 * amène des clients, donc impossible d'arrêter les autres. Chaque groupe a
 * désormais son lien, `…/jour?g=<slug>`, et cette étiquette doit survivre
 * jusqu'à la commande — sinon on saura seulement qui ouvre une page, ce qui ne
 * décide de rien.
 *
 * ── Où l'étiquette est capturée, et pourquoi PAS ici ─────────────────────────
 * Elle est lue et rangée par `public/index.html`, le gabarit de l'app WEB, au
 * tout premier instant de la page. C'est le seul endroit qui voit l'adresse
 * d'arrivée : dès la première navigation du routeur, le `?g=` a disparu de la
 * barre. Ce fichier-ci ne fait que la RELIRE.
 *
 * ── Sept jours, pas davantage ────────────────────────────────────────────────
 * Quelqu'un qui clique le lundi et commande le jeudi vient bien de ce groupe.
 * Le même, trois semaines plus tard, non : il serait devenu client de toute
 * façon, et lui attribuer la commande gonflerait un groupe indûment. La date de
 * capture est donc rangée avec l'étiquette, et une étiquette périmée est ignorée.
 *
 * ── Ce que cette étiquette ne fait PAS ───────────────────────────────────────
 * ⚠️ Elle n'entre dans AUCUN calcul d'argent. Ni prix, ni remise, ni frais de
 * livraison, ni commission. `create_order` ne la connaît même pas : elle se pose
 * APRÈS, par `enregistrer_provenance_commande`, sur une commande déjà créée et
 * déjà chiffrée en base. C'est délibéré — rien de ce que le client contrôle ne
 * doit pouvoir peser sur un montant.
 *
 * ⚠️ Et elle ne peut pas être détournée pour réécrire l'histoire : la base
 * n'accepte l'écriture que sur SA propre commande, une seule fois, et seulement
 * dans l'heure qui suit sa création.
 *
 * ⚠️ NATIF : inerte. Un lien de groupe Facebook ouvre l'app installée par lien
 * universel, sans passer par le web ; le cas n'existe pas aujourd'hui et on ne
 * le devine pas. Sur iOS et Android cette fonction ne fait rien.
 */

const CLE = 'tf_provenance';
const SEPT_JOURS = 7 * 24 * 60 * 60 * 1000;
/** Même règle, au caractère près, qu'en base et que dans landing/js/mesure.js. */
const ETIQUETTE_OK = /^[a-z0-9][a-z0-9-]{0,23}$/;

/** L'étiquette encore valable, ou null. Ne lève jamais. */
export function provenanceCourante(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return null;
    const { g, t } = JSON.parse(brut) as { g?: string; t?: number };
    if (!g || !ETIQUETTE_OK.test(g)) return null;
    if (typeof t !== 'number' || Date.now() - t > SEPT_JOURS) return null;
    return g;
  } catch {
    // Navigation privée, stockage bloqué, JSON abîmé : on s'en passe.
    return null;
  }
}

/**
 * Pose la provenance sur une commande qui vient d'être créée.
 *
 * ⚠️ NE BLOQUE RIEN ET NE REMONTE RIEN. Appelée sans `await` depuis l'écran de
 * validation : une mesure qui ferait échouer — ou seulement ralentir — le passage
 * d'une commande serait un très mauvais échange. En cas d'échec, il manque une
 * ligne dans un tableau de bord, et c'est tout.
 */
export async function enregistrerProvenance(orderId: string): Promise<void> {
  const g = provenanceCourante();
  if (!g || !orderId) return;
  try {
    await supabase.rpc('enregistrer_provenance_commande', {
      p_order_id: orderId,
      p_etiquette: g,
    });
  } catch {
    // Silencieux, volontairement.
  }
}
