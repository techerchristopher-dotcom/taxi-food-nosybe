import { formatAr } from './util';

/**
 * Les petites règles d'une SÉLECTION côté écran : les liens, le texte prêt à
 * coller, l'état lisible, les limites annoncées avant que la base ne refuse.
 *
 * Une sélection, c'est une poignée de plats choisis à la main par le fondateur,
 * publiés sous un seul lien partageable. À ne pas confondre avec « à l'affiche »
 * (`is_featured`), qui appartient au restaurateur et vit dans son espace.
 *
 * ⚠️ LA BASE RESTE L'AUTORITÉ. `admin_creer_selection` refuse un titre vide, plus
 * de 12 plats, plus de 5 restaurants, une durée hors bornes, et tout plat non
 * commandable. Les contrôles de ce fichier ne remplacent rien : ils servent à
 * DIRE à l'avance ce que la base va faire, pour ne pas laisser cliquer dans le
 * vide. Un écran n'est jamais l'autorité.
 *
 * ⚠️ RIEN N'EST GELÉ. Nom, prix et photo sont relus en direct à chaque ouverture
 * de la page publique. Le texte fabriqué ici est une photographie de l'instant
 * où on le copie — il vieillit, la page non. C'est pour ça que le prix n'est
 * jamais recopié ailleurs que dans ce message d'annonce.
 */

/**
 * Le domaine du PARTAGE, celui qui porte les balises Open Graph rendues par la
 * fonction Netlify. C'est lui, et lui seul, qu'on colle sur Facebook ou
 * WhatsApp : l'autre domaine (l'app web, plus bas) n'a aucune balise et
 * n'afficherait qu'un lien nu.
 */
export const SITE_PARTAGE = 'https://taxifoodnosybe.distripro207.com';

// L'app web (`taxifood.distripro207.com/product/<id>`), là où le client met le
// plat au panier, n'est PAS citée ici : c'est la page publique `/s/<id>` qui y
// renvoie. Cet écran ne fabrique que des liens porteurs de balises Open Graph.

// Les bornes de `admin_creer_selection`, recopiées telles quelles.
export const TITRE_MAX = 80;
export const PLATS_MIN = 1;
export const PLATS_MAX = 12;
export const RESTAURANTS_MAX = 5;
export const VALIDITE_MIN = 1;
export const VALIDITE_MAX = 90;
export const VALIDITE_DEFAUT = 7;

/** Un plat tel que l'écran le manipule : lu en direct dans le catalogue admin. */
export type PlatChoisi = {
  id: string;
  nom: string;
  prix: number;
  photoUrl: string | null;
  restaurantId: string;
  restaurantNom: string;
};

/** Une ligne de `admin_lister_selections`. */
export type SelectionListee = {
  id: string;
  titre: string;
  cree_le: string;
  expire_le: string;
  actif: boolean;
  nb_plats: number;
  nb_restaurants: number;
  restaurants: string[] | null;
};

export type EtatSelection = 'active' | 'expiree' | 'desactivee';

/** La page partageable. */
export function lienSelection(id: string): string {
  return `${SITE_PARTAGE}/s/${id}`;
}

/** L'image assemblée que les messageries afficheront en aperçu. */
export function lienApercu(id: string): string {
  return `${SITE_PARTAGE}/s/${id}/apercu.jpg`;
}

/**
 * WhatsApp sans destinataire : `wa.me` sans numéro ouvre le sélecteur de
 * contact avec le message déjà écrit. C'est ce qu'il faut ici — on publie à la
 * cantonade, on n'écrit pas à quelqu'un en particulier.
 */
export function lienWhatsApp(texte: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
}

/**
 * ⚠️ Le partageur Facebook IGNORE tout texte qu'on lui passe (`quote` est mort
 * en 2017) : le titre, la description et l'image viennent EXCLUSIVEMENT des
 * balises Open Graph de `/s/<id>`. Documenté dans `app/lib/partage.ts`, et
 * revérifié ici — ne pas réessayer d'y glisser le message.
 */
export function lienFacebook(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/** Appareil tactile — téléphone ou tablette. L'iPad récent se déclare « Macintosh ». */
export function estTactile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.maxTouchPoints > 1 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Partage vers Facebook.
 *
 * ⚠️ `sharer.php` NE MARCHE PAS SUR TÉLÉPHONE : Facebook renvoie vers son
 * application, qui ne le gère pas, et la page s'ouvre sans rien à partager. Sur
 * ORDINATEUR il fonctionne parfaitement — d'où un défaut totalement invisible
 * tant qu'on ne teste que là. Le constat vient de `app/lib/partage.ts`, où les
 * trois voies ont été essayées ; ce dashboard s'ouvre sur un téléphone, donc la
 * garde compte ici autant que dans l'app.
 *
 * ⚠️ On ne passe PAS `text` à `navigator.share` : iOS le colle devant l'URL, et
 * le composeur reçoit alors une phrase contenant un lien plutôt qu'un lien — il
 * ne va pas chercher l'aperçu.
 *
 * ⚠️ À appeler DIRECTEMENT dans le gestionnaire de clic, sans attendre quoi que
 * ce soit avant : `navigator.share` exige un geste de l'utilisateur encore chaud.
 */
export async function partagerFacebook(titre: string, url: string): Promise<void> {
  if (estTactile() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titre, url });
      return;
    } catch {
      // Feuille refermée, ou aucune cible : ce n'est pas une erreur de l'écran.
      return;
    }
  }
  window.open(lienFacebook(url), '_blank', 'noopener,noreferrer');
}

/** Presse-papiers. `false` si le navigateur refuse : à l'appelant de proposer la copie à la main. */
export async function copierDansLePressePapier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

/**
 * Les plats regroupés par restaurant, dans l'ordre où ils ont été cochés.
 *
 * ⚠️ CE REGROUPEMENT N'EST PAS DÉCORATIF. Le panier est mono-restaurant
 * (`app/store/cart.ts`, `canAdd`) : un client qui veut un plat chez deux
 * restaurants passe deux commandes. Mélanger les plats dans une liste à plat
 * laisserait croire le contraire, et la déception arriverait au moment du panier.
 */
export function grouperParRestaurant(
  plats: PlatChoisi[],
): { restaurantId: string; restaurantNom: string; plats: PlatChoisi[] }[] {
  const groupes: { restaurantId: string; restaurantNom: string; plats: PlatChoisi[] }[] = [];
  for (const p of plats) {
    const g = groupes.find((x) => x.restaurantId === p.restaurantId);
    if (g) g.plats.push(p);
    else groupes.push({ restaurantId: p.restaurantId, restaurantNom: p.restaurantNom, plats: [p] });
  }
  return groupes;
}

/** `btrim` du SQL : il ne retire que les espaces, là où `trim()` mangerait aussi les tabulations. */
function btrim(texte: string): string {
  return texte.replace(/^ +| +$/g, '');
}

/**
 * Le message prêt à coller. Charte du dépôt : tutoiement, présent, phrases
 * courtes, aucune promesse de délai.
 *
 * Le lien est mis SUR SA PROPRE LIGNE, en fin de message : les messageries ne
 * fabriquent l'aperçu que si l'URL est isolée.
 */
export function texteAPartager(titre: string, plats: PlatChoisi[], lien: string): string {
  const groupes = grouperParRestaurant(plats);
  const lignes: string[] = [btrim(titre)];

  for (const g of groupes) {
    lignes.push('');
    lignes.push(g.restaurantNom);
    for (const p of g.plats) lignes.push(`- ${p.nom} — ${formatAr(p.prix)}`);
  }

  lignes.push('');
  lignes.push('Tu regardes et tu commandes ici :');
  lignes.push(lien);

  // La règle du panier ne se dit que quand elle s'applique : sur un seul
  // restaurant, elle n'apprendrait rien et ressemblerait à une restriction.
  if (groupes.length > 1) {
    lignes.push('');
    lignes.push('Chaque commande part chez un seul restaurant. Tu prends chez deux ? Fais deux commandes.');
  }

  return lignes.join('\n');
}

/**
 * Ce que la base refusera, dit avant de cliquer. `null` si tout va bien.
 * Les messages parlent de ce que l'admin voit à l'écran, pas de colonnes SQL.
 */
export function erreurDeSaisie(titre: string, plats: PlatChoisi[], validite: number): string | null {
  const t = btrim(titre);
  if (t === '') return 'Écris un titre : c’est la première chose que les gens liront.';
  if (t.length > TITRE_MAX) return `Le titre fait ${t.length} caractères, le maximum est ${TITRE_MAX}.`;
  if (plats.length < PLATS_MIN) return 'Coche au moins un plat.';
  if (plats.length > PLATS_MAX) return `${plats.length} plats cochés, le maximum est ${PLATS_MAX}.`;

  const nbRestaurants = grouperParRestaurant(plats).length;
  if (nbRestaurants > RESTAURANTS_MAX) {
    return `${nbRestaurants} restaurants dans la sélection, le maximum est ${RESTAURANTS_MAX}.`;
  }
  if (!Number.isInteger(validite) || validite < VALIDITE_MIN || validite > VALIDITE_MAX) {
    return `La durée va de ${VALIDITE_MIN} à ${VALIDITE_MAX} jours.`;
  }
  return null;
}

/**
 * L'état lisible d'une sélection.
 *
 * Désactivée d'abord : c'est un geste délibéré, et il explique mieux qu'une date
 * pourquoi la page ne s'ouvre plus. Dans les deux cas `selection_publique`
 * renvoie zéro ligne — pour le client, le lien est mort.
 */
export function etatSelection(s: SelectionListee, maintenant: number = Date.now()): EtatSelection {
  if (!s.actif) return 'desactivee';
  if (maintenant > new Date(s.expire_le).getTime()) return 'expiree';
  return 'active';
}

export const ETAT_LIBELLE: Record<EtatSelection, string> = {
  active: 'Active',
  expiree: 'Expirée',
  desactivee: 'Désactivée',
};

/**
 * ⚠️ À l'heure de Nosy Be, pas du navigateur : le fondateur peut ouvrir l'écran
 * depuis la France (1 à 2 h de décalage) et lire « expire le 17 » pour une
 * sélection qui meurt le 16 sur place.
 */
const FORMAT_NOSY_BE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Indian/Antananarivo',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function dateNosyBe(iso: string | null): string {
  if (!iso) return '—';
  const p = Object.fromEntries(FORMAT_NOSY_BE.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const anneeCourante = FORMAT_NOSY_BE.formatToParts(new Date()).find((x) => x.type === 'year')?.value;
  const annee = p.year !== anneeCourante ? `/${p.year}` : '';
  return `${p.day}/${p.month}${annee} ${p.hour}h${p.minute}`;
}

/**
 * Les initiales d'un plat sans photo.
 *
 * ADR-007 : jamais de visuel approximatif. Sans photo du plat réellement servi,
 * on laisse la place vide et on affiche des lettres — c'est ce que fait déjà
 * l'app, et c'est ce que le personnel utilise pour contrôler ce qu'il sert.
 */
export function initiales(nom: string): string {
  const mots = btrim(nom).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  const lettres = mots.slice(0, 2).map((m) => m[0] ?? '').join('');
  return lettres.toUpperCase();
}
