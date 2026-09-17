import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Un client doit avoir la DERNIÈRE version dès le premier lancement.
 *
 * Constaté le 2026-09-17 : installation fraîche depuis l'App Store → ancien écran ;
 * fermer, rouvrir → bonne version. C'est le réglage par défaut d'`expo-updates`
 * (`fallbackToCacheTimeout` = 0) : le premier lancement affiche le paquet JavaScript
 * EMBARQUÉ dans le binaire, télécharge la mise à jour en arrière-plan, et ne l'applique
 * qu'au lancement suivant. Un nouveau client découvre donc l'app telle qu'elle était le
 * jour du build — parfois des semaines de correctifs en retard.
 *
 * Ici, pendant l'écran de lancement : vérifier → télécharger → recharger, avec un
 * DÉLAI MAXIMAL. Trois règles, chacune pour une raison :
 *
 * 1. JAMAIS BLOQUER. La liaison de Nosy Be est lente et parfois coupée. Passé le délai,
 *    on ouvre l'app telle quelle ; le téléchargement continue en arrière-plan et
 *    `expo-updates` appliquera la mise à jour au lancement suivant, comme avant.
 * 2. JAMAIS RECHARGER APRÈS COUP. Si le téléchargement finit après le délai, on ne
 *    recharge PAS : le client est déjà dans l'app, peut-être en train de remplir son
 *    panier. Le drapeau `abandonne` y veille.
 * 3. JAMAIS BOUCLER. On note l'identifiant de la mise à jour pour laquelle on a
 *    rechargé. Si, après rechargement, la même mise à jour est encore annoncée (elle a
 *    été rejetée, le système est revenu au paquet embarqué…), on ne recharge plus.
 *
 * Tout est dans des try/catch : une vérification ratée n'est jamais une raison de ne
 * pas ouvrir l'app. Rien ne se passe sur le web (le site se met à jour au
 * déploiement) ni en développement (`expo-updates` y lève).
 */

const CLE_DERNIER_RECHARGEMENT = 'tf_maj_rechargee_pour';

/** Délai total accordé au démarrage : vérification + téléchargement. */
export const DELAI_MAJ_DEMARRAGE_MS = 5000;

function actif(): boolean {
  try {
    return Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;
  } catch {
    return false;
  }
}

/** Identifiant de la mise à jour annoncée par le serveur, ou null. */
function idAnnonce(manifest: unknown): string | null {
  const id = (manifest as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : null;
}

/**
 * Vérifie, télécharge et recharge si une mise à jour est prête dans le délai.
 * Se résout TOUJOURS (jamais de rejet), au plus tard après `delaiMs` — sauf quand elle
 * recharge, auquel cas l'app redémarre sur le nouveau paquet.
 */
export async function miseAJourAuDemarrage(delaiMs = DELAI_MAJ_DEMARRAGE_MS): Promise<void> {
  if (!actif()) return;

  let abandonne = false;
  let minuterie: ReturnType<typeof setTimeout> | undefined;

  const travail = (async () => {
    try {
      const verif = await Updates.checkForUpdateAsync();
      if (abandonne || !verif.isAvailable) return;

      const id = idAnnonce(verif.manifest);
      // Règle 3 : déjà rechargé pour CETTE mise à jour, et elle est encore annoncée.
      const deja = await AsyncStorage.getItem(CLE_DERNIER_RECHARGEMENT).catch(() => null);
      if (id && deja === id) return;

      const recu = await Updates.fetchUpdateAsync();
      // Règle 2 : trop tard, l'app est déjà ouverte.
      if (abandonne || !recu.isNew) return;

      if (id) await AsyncStorage.setItem(CLE_DERNIER_RECHARGEMENT, id).catch(() => {});
      if (abandonne) return;
      await Updates.reloadAsync();
    } catch {
      // Hors ligne, serveur lent, mise à jour refusée : on ouvre l'app telle quelle.
    }
  })();

  const delai = new Promise<void>((resolve) => {
    minuterie = setTimeout(() => {
      abandonne = true;
      resolve();
    }, delaiMs);
  });

  await Promise.race([travail, delai]);
  abandonne = true;
  if (minuterie) clearTimeout(minuterie);
}

/**
 * Retour au premier plan après une longue absence : on regarde s'il y a mieux, on
 * télécharge en silence, et on ne recharge QUE si l'appelant confirme que le moment est
 * sûr (accueil du parcours client, rien en cours). Sinon la mise à jour attend le
 * prochain lancement, comme d'habitude.
 */
export async function miseAJourAuRetour(momentSur: () => boolean): Promise<void> {
  if (!actif()) return;
  try {
    const verif = await Updates.checkForUpdateAsync();
    if (!verif.isAvailable) return;
    const id = idAnnonce(verif.manifest);
    const deja = await AsyncStorage.getItem(CLE_DERNIER_RECHARGEMENT).catch(() => null);
    if (id && deja === id) return;
    const recu = await Updates.fetchUpdateAsync();
    if (!recu.isNew) return;
    // Le moment est jugé APRÈS le téléchargement : le client a pu bouger entre-temps.
    if (!momentSur()) return;
    if (id) await AsyncStorage.setItem(CLE_DERNIER_RECHARGEMENT, id).catch(() => {});
    await Updates.reloadAsync();
  } catch {
    /* rien : la mise à jour s'appliquera au prochain lancement */
  }
}
