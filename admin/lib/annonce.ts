/**
 * Annonces push — logique pure de l'écran (sans React, sans réseau).
 *
 * Les garde-fous qui comptent vivent EN BASE (`admin_creer_annonce` : longueurs,
 * cible, route, doublon 24 h). Ce qui est ici sert à les dire avant, pas à les
 * remplacer : l'écran n'est jamais l'autorité.
 */

export const TITRE_MAX = 50;
export const CORPS_MAX = 150;

export type Cible = 'clients' | 'moi';

export type AnnonceListee = {
  id: string;
  titre: string;
  corps: string;
  cible: Cible;
  route: string | null;
  statut: 'preparee' | 'envoyee' | 'echouee';
  creee_le: string;
  envoyee_le: string | null;
  jetons_vises: number;
  envois_reussis: number;
  envois_echoues: number;
  jetons_supprimes: number;
  auteur: string;
};

export type Resultat = {
  jetons_vises: number;
  reussis: number;
  echoues: number;
  supprimes: number;
  recus_ok: number | null;
  recus_echoues: number | null;
  erreurs?: Record<string, number>;
};

/** Le mot à taper pour confirmer un envoi à tout le monde. */
export const MOT_DE_CONFIRMATION = 'ENVOYER';

/** Ce qui manque pour pouvoir envoyer, ou null. */
export function erreurDeSaisie(titre: string, corps: string): string | null {
  const t = titre.trim();
  const c = corps.trim();
  if (!t) return 'Le titre manque.';
  if (t.length > TITRE_MAX) return `Le titre fait ${t.length} caractères, ${TITRE_MAX} au maximum.`;
  if (!c) return 'Le message manque.';
  if (c.length > CORPS_MAX) return `Le message fait ${c.length} caractères, ${CORPS_MAX} au maximum.`;
  return null;
}

/** Message lisible pour une erreur levée par la base ou la fonction Edge. */
export function messageErreur(brut: string): string {
  const m = brut ?? '';
  if (m.includes('annonce:titre_invalide')) return `Titre vide ou plus long que ${TITRE_MAX} caractères.`;
  if (m.includes('annonce:corps_invalide')) return `Message vide ou plus long que ${CORPS_MAX} caractères.`;
  if (m.includes('annonce:cible_inconnue')) return 'Destinataires inconnus.';
  if (m.includes('annonce:route_invalide')) return 'Écran d’ouverture invalide.';
  if (m.includes('annonce:doublon_24h')) {
    return 'Cette annonce, mot pour mot, est déjà partie dans les dernières 24 h. Rien n’a été renvoyé.';
  }
  if (m.includes('Reserve aux administrateurs') || m.includes('reserve_aux_admins')) {
    return 'Ce compte n’a pas le rôle administrateur.';
  }
  if (m.includes('deja_envoyee')) return 'Cette annonce est déjà partie. Rien n’a été renvoyé.';
  return `Refusé : ${m}`;
}

/** « il y a 2 h », « le 17/09 à 19h04 » — l'historique se lit d'un coup d'œil. */
export function quand(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 60 * 12) return `il y a ${Math.floor(minutes / 60)} h`;
  return `le ${d.toLocaleDateString('fr-FR')} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Ce que l'écran affiche comme résultat.
 *
 * ⚠️ On distingue « accepté par Expo » de « reçu par un téléphone ». Mesuré le
 * 2026-09-18 : 10 acceptés, 1 reçu — les 9 autres étaient des installations
 * disparues. Annoncer 10 serait faux, et c'est le genre de chiffre qu'on répète
 * ensuite à un restaurateur.
 */
export function resume(r: Resultat): string {
  const morceaux = [`${r.reussis} appareil${r.reussis > 1 ? 's' : ''} accepté${r.reussis > 1 ? 's' : ''} par Expo`];
  if (r.recus_ok !== null) morceaux.push(`${r.recus_ok} vraiment reçu${r.recus_ok > 1 ? 's' : ''}`);
  else morceaux.push('reçus pas encore disponibles');
  if (r.echoues) morceaux.push(`${r.echoues} échec${r.echoues > 1 ? 's' : ''}`);
  if (r.supprimes) morceaux.push(`${r.supprimes} jeton${r.supprimes > 1 ? 's' : ''} mort${r.supprimes > 1 ? 's' : ''} supprimé${r.supprimes > 1 ? 's' : ''}`);
  return morceaux.join(' · ');
}
