import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Messagerie de commande (2026-10-13) — client, livreur, restaurant et Taxi Food.
 *
 * Tout passe par des fonctions en base (`messagerie_*`) : la table n'est lisible par
 * personne, et c'est la base qui vérifie que l'appelant tient bien le rôle annoncé SUR
 * cette commande (un même compte peut être client, livreur et restaurateur à la fois :
 * l'écran dit donc toujours « en tant que qui » il parle).
 *
 * Photos : bucket PRIVÉ `messages`, chemin `<commande>/<moi>/<fichier>`, lues par liens
 * signés à durée courte — une photo de portail ne doit jamais être publique.
 */

export type RoleMessagerie = 'client' | 'livreur' | 'restaurant' | 'admin';

export type MessageCommande = {
  id: string;
  auteurRole: RoleMessagerie;
  estMoi: boolean;
  auteurNom: string | null;
  texte: string | null;
  photoPath: string | null;
  createdAt: string;
};

export type Conversation = {
  orderNumber: string;
  peutEcrire: boolean;
  fermeLe: string | null;
  participants: { client: string | null; livreur: string | null; restaurant: string | null };
  messages: MessageCommande[];
};

type MessageBrut = {
  id: string;
  auteur_role: RoleMessagerie;
  est_moi: boolean;
  auteur_nom: string | null;
  texte: string | null;
  photo_path: string | null;
  created_at: string;
};

function mapMessage(m: MessageBrut): MessageCommande {
  return {
    id: m.id,
    auteurRole: m.auteur_role,
    estMoi: !!m.est_moi,
    auteurNom: m.auteur_nom,
    texte: m.texte,
    photoPath: m.photo_path,
    createdAt: m.created_at,
  };
}

export function estRoleMessagerie(v: unknown): v is RoleMessagerie {
  return v === 'client' || v === 'livreur' || v === 'restaurant' || v === 'admin';
}

/** Code d'erreur métier (`messagerie:fermee`…) lu dans une erreur Supabase, sinon null. */
export function codeErreurMessagerie(e: unknown): string | null {
  const msg = (e as { message?: string })?.message ?? '';
  const m = msg.match(/messagerie:([a-z_]+)/);
  return m ? m[1] : null;
}

/** Lit la conversation (et la marque comme lue). `depuis` = seulement les nouveaux. */
export async function lireConversation(
  orderId: string,
  role: RoleMessagerie,
  depuis?: string | null,
): Promise<Conversation> {
  const { data, error } = await supabase.rpc('messagerie_lire', {
    p_order_id: orderId,
    p_en_tant_que: role,
    p_depuis: depuis ?? null,
  });
  if (error) throw error;
  const d = data as {
    order_number: string;
    peut_ecrire: boolean;
    ferme_le: string | null;
    participants: Conversation['participants'];
    messages: MessageBrut[];
  };
  return {
    orderNumber: d.order_number,
    peutEcrire: !!d.peut_ecrire,
    fermeLe: d.ferme_le,
    participants: d.participants ?? { client: null, livreur: null, restaurant: null },
    messages: (d.messages ?? []).map(mapMessage),
  };
}

export async function envoyerMessage(
  orderId: string,
  role: RoleMessagerie,
  texte: string | null,
  photoPath: string | null = null,
): Promise<MessageCommande> {
  const { data, error } = await supabase.rpc('messagerie_envoyer', {
    p_order_id: orderId,
    p_en_tant_que: role,
    p_texte: texte,
    p_photo_path: photoPath,
  });
  if (error) throw error;
  return mapMessage(data as MessageBrut);
}

/** Non-lus par commande pour un rôle (badges). Ne lève jamais : un badge raté n'est pas grave. */
export async function nonLusMessagerie(role: RoleMessagerie): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('messagerie_non_lus', { p_en_tant_que: role });
  if (error || !data) return {};
  const out: Record<string, number> = {};
  for (const r of data as { order_id: string; non_lus: number }[]) out[r.order_id] = r.non_lus ?? 0;
  return out;
}

/**
 * Réduit la photo avant l'envoi sur le web (canvas, 1600 px de côté au plus, JPEG 0,72).
 * Sur téléphone, le sélecteur a déjà compressé (qualité 0,5) : pas de module natif de
 * redimensionnement dans les binaires en ligne, et l'OTA ne peut pas en ajouter.
 */
async function reduirePourLeWeb(uri: string): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = uri;
    });
    const max = 1600;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72));
  } catch {
    return null;
  }
}

/** Dépose la photo dans `messages/<commande>/<moi>/…` et renvoie son chemin. */
export async function deposerPhotoMessage(orderId: string, uri: string, mime?: string | null): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Connexion requise');

  let corps: ArrayBuffer | Blob;
  let contentType: string;
  const reduite = await reduirePourLeWeb(uri);
  if (reduite) {
    corps = reduite;
    contentType = 'image/jpeg';
  } else {
    corps = await fetch(uri).then((r) => r.arrayBuffer());
    const bas = (mime ?? '').toLowerCase();
    contentType = bas.startsWith('image/') ? bas : uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  }
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType.includes('hei') ? 'heic' : 'jpg';
  const path = `${orderId}/${session.user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('messages').upload(path, corps, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/**
 * Lien signé (1 h) pour afficher une photo. Passe par le transformateur d'images :
 * 900 px de large, JPEG — c'est ce qui rend la photo lisible sur la liaison de Nosy Be,
 * et ce qui affiche un HEIC d'iPhone sur Android et Chrome.
 */
const cacheLiens = new Map<string, { url: string; expire: number }>();
export async function lienPhotoMessage(path: string, pleineTaille = false): Promise<string | null> {
  const cle = `${path}|${pleineTaille ? 'g' : 'p'}`;
  const deja = cacheLiens.get(cle);
  if (deja && deja.expire > Date.now()) return deja.url;
  const { data, error } = await supabase.storage
    .from('messages')
    .createSignedUrl(path, 3600, { transform: { width: pleineTaille ? 1600 : 900, quality: 70, resize: 'contain' } });
  if (error || !data?.signedUrl) return null;
  cacheLiens.set(cle, { url: data.signedUrl, expire: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
