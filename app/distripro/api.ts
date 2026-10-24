/**
 * DistriPro — la couche données du module « Commander » (lot 3) et du site
 * distripro207.com (lot 4). Un seul code pour les deux.
 *
 * - Le CATALOGUE est public : lu directement sur la base DistriPro avec sa clé
 *   PUBLIABLE (publique par conception, la même que sur son site). Seuls les
 *   produits PUBLIÉS en sortent (`publie = true`, décidé en base).
 * - Commander, lister ses commandes et lire ses documents passent par une
 *   IDENTITÉ, de deux sortes :
 *     • `pont`   — dans l'app Taxi Food : la session du partenaire, via la fonction
 *                  Edge `distripro` (aucun second compte, aucun secret ici) ;
 *     • `compte` — sur distripro207.com : le mot de passe client DistriPro.
 * - Aucun prix, aucun total n'est calculé ici : `creer_commande` fait foi. Les
 *   montants affichés avant validation sont une estimation, le serveur recalcule.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DP_URL = 'https://tlnpkvveeqzefghhywfe.supabase.co';
export const DP_KEY = 'sb_publishable__Vw3KFYROnVbwMVQlhteew_OHAnxwGC';

export type ProduitDP = {
  id: number;
  nom: string;
  prix: number;
  unite: string | null;
  conditionnement: string | null;
  qteParLot: number | null;
  qteMin: number;
  pas: number;
  /** null = pas de gestion de stock (légumes, frites) */
  stock: number | null;
  prixProvisoire: boolean;
  descriptif: string | null;
  image: string | null;
  sousCategorieId: number;
};

export type SousCategorieDP = { id: number; nom: string; ordre: number; rayonId: number };
export type RayonDP = { id: number; nom: string; slug: string | null; emoji: string | null; ordre: number; sousCategories: SousCategorieDP[] };
export type CatalogueDP = { rayons: RayonDP[]; produits: ProduitDP[] };

export type LigneCommandeDP = { libelle: string; quantite: number; prix_unitaire: number; sous_total: number; motif?: string | null; origine?: string };
export type CommandeDP = {
  id: number;
  numero: string;
  statut: 'recue' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';
  date_livraison: string;
  plage_livraison: string | null;
  creee_le_fr: string;
  paiement_mode: string;
  paiement_statut: 'en_attente' | 'paye';
  total: number;
  total_initial: number;
  commentaire: string | null;
  facture_numero: string | null;
  bl_numero: string | null;
  lignes: LigneCommandeDP[];
  livraison: LigneCommandeDP[];
};

export type DocumentDP = {
  type: 'bon_livraison' | 'facture' | string;
  numero: string;
  emis_le: string;
  total: number;
  donnees: {
    emetteur: Record<string, string | null>;
    client: Record<string, string | null>;
    commande: Record<string, unknown>;
    lignes: LigneCommandeDP[];
    total: number;
  };
};

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; reason: string; message: string };

export const PAIEMENTS: { code: string; libelle: string }[] = [
  { code: 'especes', libelle: 'Espèces' },
  { code: 'orange_money', libelle: 'Orange Money' },
  { code: 'carte', libelle: 'Carte bancaire' },
  { code: 'cheque', libelle: 'Chèque' },
  { code: 'virement', libelle: 'Virement' },
];

export const STATUTS: Record<string, string> = {
  recue: 'Reçue',
  en_preparation: 'En préparation',
  en_livraison: 'En cours de livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const ENTETES = { apikey: DP_KEY, Authorization: `Bearer ${DP_KEY}` };

async function lire<T>(chemin: string): Promise<T> {
  const r = await fetch(`${DP_URL}/rest/v1/${chemin}`, { headers: ENTETES });
  if (!r.ok) throw new Error(`distripro ${r.status}`);
  return (await r.json()) as T;
}

export async function rpcPublic<T>(fonction: string, params: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${DP_URL}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: { ...ENTETES, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`distripro ${r.status}`);
  return (await r.json()) as T;
}

/** Le catalogue publié : rayons ▸ sous-rayons ▸ produits, dans l'ordre de la base. */
export async function chargerCatalogue(): Promise<CatalogueDP> {
  type Brut = {
    id: number; nom: string; prix_detail: number; unite: string | null; conditionnement: string | null;
    qte_par_lot: number | null; qte_min: number; pas: number; stock: number | null; prix_provisoire: boolean;
    descriptif: string | null; image_clean_url: string | null; image_url: string | null; sous_categorie_id: number;
    rang_sous_cat: number | null;
  };
  const produits = await lire<Brut[]>(
    'produits?select=id,nom,prix_detail,unite,conditionnement,qte_par_lot,qte_min,pas,stock,prix_provisoire,descriptif,image_clean_url,image_url,sous_categorie_id,rang_sous_cat' +
      '&publie=eq.true&est_star=eq.true&actif=eq.true&prix_detail=not.is.null&order=sous_categorie_id.asc,prix_detail.asc,id.asc',
  );
  const idsSc = [...new Set(produits.map((p) => p.sous_categorie_id))];
  if (idsSc.length === 0) return { rayons: [], produits: [] };
  const scs = await lire<{ id: number; nom: string; ordre: number | null; rayon_id: number }[]>(
    `sous_categories?select=id,nom,ordre,rayon_id&id=in.(${idsSc.join(',')})`,
  );
  const idsR = [...new Set(scs.map((s) => s.rayon_id))];
  const rayons = await lire<{ id: number; nom: string; slug: string | null; emoji: string | null; ordre: number | null }[]>(
    `rayons?select=id,nom,slug,emoji,ordre&id=in.(${idsR.join(',')})`,
  );
  return {
    rayons: rayons
      .map((r) => ({
        id: r.id,
        nom: r.nom,
        slug: r.slug,
        emoji: r.emoji,
        ordre: r.ordre ?? 0,
        sousCategories: scs
          .filter((s) => s.rayon_id === r.id)
          .map((s) => ({ id: s.id, nom: s.nom, ordre: s.ordre ?? 0, rayonId: s.rayon_id }))
          .sort((a, b) => a.ordre - b.ordre),
      }))
      .sort((a, b) => a.ordre - b.ordre),
    produits: produits.map((p) => ({
      id: p.id,
      nom: p.nom,
      prix: Number(p.prix_detail),
      unite: p.unite,
      conditionnement: p.conditionnement,
      qteParLot: p.qte_par_lot,
      qteMin: p.qte_min ?? 1,
      pas: p.pas ?? 1,
      stock: p.stock,
      prixProvisoire: !!p.prix_provisoire,
      descriptif: p.descriptif,
      image: p.image_clean_url || p.image_url || null,
      sousCategorieId: p.sous_categorie_id,
    })),
  };
}

export async function datesLivraison(): Promise<string[]> {
  const r = await rpcPublic<{ dates: string[] }>('dates_livraison_possibles');
  return r?.dates ?? [];
}

/** Ce qui distingue l'app (pont) du site (compte DistriPro). */
export type Identite = {
  mode: 'pont' | 'compte';
  /** Nom affiché sur l'écran de validation (le restaurant, ou l'établissement du compte). */
  nom(): Promise<Resultat<string>>;
  commander(p: {
    lignes: { produit_id: number; quantite: number }[];
    dateLivraison: string;
    paiementMode: string;
    commentaire: string | null;
  }): Promise<Resultat<CommandeDP>>;
  mesCommandes(): Promise<Resultat<CommandeDP[]>>;
  document(numero: string): Promise<Resultat<DocumentDP>>;
};

const MESSAGES: Record<string, string> = {
  pas_partenaire: 'Réservé aux restaurants partenaires Taxi Food.',
  compte_distripro_desactive: 'Votre compte DistriPro est désactivé. Contactez Taxi Food.',
  distripro_indisponible: 'DistriPro ne répond pas. Réessayez dans un instant.',
  reseau: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  auth: 'Session expirée. Reconnectez-vous.',
  introuvable: 'Document introuvable.',
};

function echec<T>(reason: string, message?: string | null): Resultat<T> {
  return { ok: false, reason, message: message || MESSAGES[reason] || 'Une erreur est survenue. Réessayez.' };
}

/**
 * Identité « pont » : la session Taxi Food. `invoke` est injecté (le client Supabase
 * de l'app) pour que ce fichier ne dépende pas de la configuration Taxi Food sur le site.
 */
export function identitePont(
  invoke: (body: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>,
  restaurantId: () => string | null,
): Identite {
  async function appel(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await invoke({ ...body, restaurant_id: restaurantId() ?? undefined });
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    // Réponse non 2xx : supabase-js range le corps dans error.context (Response)
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try { return (await ctx.json()) as Record<string, unknown>; } catch { /* rien */ }
    }
    return { ok: false, reason: 'reseau' };
  }
  return {
    mode: 'pont',
    async nom() {
      const r = await appel({ action: 'session' });
      if (!r.ok) return echec(String(r.reason ?? 'reseau'), r.message as string);
      return { ok: true, valeur: String((r.restaurant as { nom?: string })?.nom ?? '') };
    },
    async commander(p) {
      const r = await appel({
        action: 'commander', lignes: p.lignes, date_livraison: p.dateLivraison,
        paiement_mode: p.paiementMode, commentaire: p.commentaire,
      });
      if (!r.ok) return echec(String(r.reason ?? 'reseau'), r.message as string);
      return { ok: true, valeur: r.commande as CommandeDP };
    },
    async mesCommandes() {
      const r = await appel({ action: 'mes_commandes' });
      if (!r.ok) return echec(String(r.reason ?? 'reseau'), r.message as string);
      return { ok: true, valeur: (r.commandes as CommandeDP[]) ?? [] };
    },
    async document(numero) {
      const r = await appel({ action: 'document', numero });
      if (!r.ok) return echec(String(r.reason ?? 'reseau'), r.message as string);
      return { ok: true, valeur: r.document as DocumentDP };
    },
  };
}

/** Identité « compte » : le mot de passe client DistriPro (site distripro207.com). */
const CLE_MDP = 'dp_client_mdp';

export async function compteConnecte(): Promise<{ mdp: string; nom: string } | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_MDP);
    return brut ? (JSON.parse(brut) as { mdp: string; nom: string }) : null;
  } catch {
    return null;
  }
}

export async function connecterCompte(mdp: string): Promise<Resultat<string>> {
  try {
    const r = await rpcPublic<Record<string, unknown>>('login_client', { p_mdp: mdp.trim() });
    if (!r?.ok) return echec('auth', 'Mot de passe inconnu. Il vous a été remis par DistriPro.');
    const client = (r.client ?? r) as { nom_etablissement?: string };
    const nom = String(client.nom_etablissement ?? 'Mon établissement');
    await AsyncStorage.setItem(CLE_MDP, JSON.stringify({ mdp: mdp.trim(), nom }));
    return { ok: true, valeur: nom };
  } catch {
    return echec('reseau');
  }
}

export async function deconnecterCompte() {
  try { await AsyncStorage.removeItem(CLE_MDP); } catch { /* rien */ }
}

export function identiteCompte(): Identite {
  async function mdp(): Promise<string | null> {
    return (await compteConnecte())?.mdp ?? null;
  }
  return {
    mode: 'compte',
    async nom() {
      const c = await compteConnecte();
      return c ? { ok: true, valeur: c.nom } : echec('auth');
    },
    async commander(p) {
      const m = await mdp();
      if (!m) return echec('auth');
      try {
        const r = await rpcPublic<Record<string, unknown>>('creer_commande', {
          p_mdp: m, p_lignes: p.lignes, p_date_livraison: p.dateLivraison,
          p_paiement_mode: p.paiementMode, p_commentaire: p.commentaire, p_est_demo: false,
        });
        if (!r?.ok) return echec(String(r?.reason ?? 'inconnu'), r?.message as string);
        return { ok: true, valeur: r.commande as CommandeDP };
      } catch {
        return echec('reseau');
      }
    },
    async mesCommandes() {
      const m = await mdp();
      if (!m) return echec('auth');
      try {
        const r = await rpcPublic<Record<string, unknown>>('mes_commandes', { p_mdp: m });
        if (!r?.ok) return echec(String(r?.reason ?? 'inconnu'));
        return { ok: true, valeur: (r.commandes as CommandeDP[]) ?? [] };
      } catch {
        return echec('reseau');
      }
    },
    async document(numero) {
      const m = await mdp();
      if (!m) return echec('auth');
      try {
        const r = await rpcPublic<Record<string, unknown>>('mon_document', { p_mdp: m, p_numero: numero });
        if (!r?.ok) return echec(String(r?.reason ?? 'introuvable'));
        return { ok: true, valeur: r.document as DocumentDP };
      } catch {
        return echec('reseau');
      }
    },
  };
}

/** 9 juin → « mar. 9 juin » (fuseau sans importance : la date est une date pure). */
export function dateCourte(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  const jours = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${jours[d.getUTCDay()]} ${j} ${mois[m - 1]}`;
}

/** « 23 500 Ar » */
export function ar(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;
}

/** Prix à la pièce d'un lot (« 470 Ar pièce »), seulement pour un paquet. */
export function prixPiece(p: ProduitDP): string | null {
  if (p.unite !== 'paquet' || !p.qteParLot || p.qteParLot <= 1) return null;
  return `${ar(Math.round(p.prix / p.qteParLot))} pièce`;
}

/** Libellé d'unité pour la quantité : « 3 paquets », « 2 kg », « 2 sachets ». */
export function libelleQuantite(p: Pick<ProduitDP, 'unite'>, q: number): string {
  switch (p.unite) {
    case 'kg': return `${q} kg`;
    case 'sachet': return `${q} sachet${q > 1 ? 's' : ''}`;
    case 'paquet': return `${q} paquet${q > 1 ? 's' : ''}`;
    default: return `${q}`;
  }
}

/** État de stock lisible (null = pas de stock géré). */
export function etatStock(p: ProduitDP): { texte: string; dispo: boolean } | null {
  if (p.stock === null) return null;
  if (p.stock <= 0) return { texte: 'Réassort en cours', dispo: false };
  if (p.stock <= 5) return { texte: `Plus que ${p.stock}`, dispo: true };
  return { texte: 'En stock', dispo: true };
}
