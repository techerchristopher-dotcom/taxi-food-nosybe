/**
 * Commande par téléphone — logique pure de l'écran (sans React, sans réseau).
 *
 * La base reste l'autorité : prix, disponibilité, options obligatoires,
 * ouverture et heures de service sont RE-vérifiés par `create_order`, appelée
 * par `admin_commande_telephone`. Ce qui est calculé ici n'est qu'une
 * estimation affichée pendant l'appel.
 */

export type Option = { id: string; name: string; price_delta: number; is_available: boolean; sort_order: number | null };
export type Groupe = {
  id: string; name: string; min_select: number; max_select: number; required: boolean;
  sort_order: number | null; product_options: Option[];
};
export type Plat = {
  id: string; name: string; price: number; category_id: string | null; is_available: boolean;
  in_menu: boolean | null; is_featured: boolean | null; photo_url: string | null;
  packaging_fee: number | null; stock_quantity: number | null;
};
export type Categorie = { id: string; name: string; icon: string | null; sort_order: number | null; categorie_servie_maintenant: boolean | null };

/** Une ligne du panier : un plat, ses options choisies, une quantité. */
export type Ligne = { cle: string; plat: Plat; options: Option[]; quantite: number };

/** Même clé pour le même plat avec les mêmes options : on additionne au lieu de dupliquer. */
export function cleLigne(platId: string, optionIds: string[]): string {
  return `${platId}|${[...optionIds].sort().join(',')}`;
}

export function prixUnitaire(l: Pick<Ligne, 'plat' | 'options'>): number {
  return l.plat.price + l.options.reduce((s, o) => s + (o.price_delta ?? 0), 0);
}

export function totalEstime(lignes: Ligne[], livraison: number) {
  const plats = lignes.reduce((s, l) => s + prixUnitaire(l) * l.quantite, 0);
  const emballage = lignes.reduce((s, l) => s + (l.plat.packaging_fee ?? 0) * l.quantite, 0);
  return { plats, emballage, livraison, total: plats + emballage + livraison };
}

/** Le premier groupe dont la sélection ne respecte pas min / max / obligatoire, ou null. */
export function groupeIncomplet(groupes: Groupe[], choisies: Record<string, string[]>): Groupe | null {
  for (const g of groupes) {
    const n = (choisies[g.id] ?? []).length;
    const min = g.required ? Math.max(g.min_select, 1) : g.min_select;
    if (n < min || n > g.max_select) return g;
  }
  return null;
}

/** Charge utile de `create_order`, au format exact de l'app (`app/data/api.ts`). */
export function articlesPourLaBase(lignes: Ligne[]) {
  return lignes.map((l) => ({
    product_id: l.plat.id,
    quantity: l.quantite,
    options: l.options.map((o) => ({ option_id: o.id, quantity: 1 })),
  }));
}

/**
 * Position collée pendant l'appel : « -13.40, 48.26 », une localisation
 * WhatsApp copiée, ou un lien Google Maps long (`@lat,lng`, `q=lat,lng`,
 * `!3dlat!4dlng`). Un lien court `maps.app.goo.gl` ne contient AUCUNE
 * coordonnée : il faut l'ouvrir et copier les chiffres — le navigateur ne
 * peut pas le résoudre (CORS).
 */
export function lirePosition(texte: string): { lat: number; lng: number } | null {
  const t = (texte ?? '').trim();
  if (!t) return null;
  const nombre = '(-?\\d{1,3}(?:[.,]\\d+)?)';
  const motifs = [
    new RegExp(`!3d${nombre}!4d${nombre}`),
    new RegExp(`@${nombre},${nombre}`),
    new RegExp(`[?&](?:q|query|ll|destination)=${nombre},\\s*${nombre}`),
    new RegExp(`^${nombre}\\s*[,;\\s]\\s*${nombre}$`),
  ];
  for (const m of motifs) {
    const r = t.replace(/%2C/gi, ',').match(m);
    if (r) {
      const lat = Number(r[1].replace(',', '.'));
      const lng = Number(r[2].replace(',', '.'));
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

/**
 * Nosy Be, Nosy Komba et Nosy Sakatia, avec de la marge. Hors de ce cadre, la
 * position est presque sûrement une erreur de copie (latitude et longitude
 * inversées, signe perdu) : le 2026-09-10 une adresse était « en pleine mer ».
 */
export function dansNosyBe(p: { lat: number; lng: number }): boolean {
  return p.lat >= -13.55 && p.lat <= -13.05 && p.lng >= 48.05 && p.lng <= 48.45;
}

export const ZONES = ['Hell-Ville', 'Ambatoloaka', 'Madirokely', 'Dar es Salam', 'Ambondrona', 'Andilana', 'Djamandjary', 'Aéroport / Fascene'];

/** Message lisible pour une erreur levée par la base pendant l'envoi. */
export function messageErreur(brut: string): string {
  const m = brut ?? '';
  if (m.includes('service:restaurant_ferme')) return 'Le restaurant ne prend pas de commande en ce moment (fermé ou pas encore ouvert). Rien n’a été envoyé.';
  if (m.includes('service:categorie_hors_service')) {
    const [, nom, de, a] = m.split('|');
    return `« ${nom ?? 'Cette catégorie'} » n’est servie que de ${de ?? '?'} à ${a ?? '?'}. Retire ce plat du panier. Rien n’a été envoyé.`;
  }
  if (m.includes('telephone:nom_manquant')) return 'Le nom du client manque.';
  if (m.includes('telephone:numero_invalide')) return 'Le numéro du client est invalide (8 à 15 chiffres).';
  if (m.includes('telephone:zone_manquante')) return 'La zone de livraison manque.';
  if (m.includes('telephone:repere_manquant')) return 'Le repère manque : c’est lui qui guide le livreur.';
  if (m.includes('telephone:position_incomplete')) return 'Position incomplète : colle latitude ET longitude, ou vide le champ.';
  if (m.includes('telephone:position_hors_nosy_be')) return 'Cette position est hors de Nosy Be : vérifie-la ou vide le champ.';
  if (m.includes('Position GPS manquante')) return 'La base exige encore une position GPS : la migration « commande téléphone sans GPS » n’est pas en place. Rien n’a été envoyé.';
  if (m.includes('telephone:panier_vide')) return 'Le panier est vide.';
  if (m.includes('Produit indisponible')) return 'Un plat du panier n’est plus disponible. Recharge la carte et retire-le. Rien n’a été envoyé.';
  if (m.includes('Choix requis manquant') || m.includes('Nombre de choix invalide') || m.includes('Option invalide')) {
    return `${m.replace(/^.*?(Choix requis|Nombre de choix|Option invalide)/, '$1')}. Rien n’a été envoyé.`;
  }
  if (m.includes('Reserve aux administrateurs')) return 'Ce compte n’a pas le rôle administrateur.';
  return `La base a refusé la commande : ${m}. Rien n’a été envoyé.`;
}
