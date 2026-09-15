/**
 * Image d'aperçu « Plats du jour » d'un restaurant : UNE image 1200×630 qui assemble les
 * photos de ses plats à l'affiche (3 au plus), avec leurs noms et leurs prix.
 *
 * ── À quoi ça sert ─────────────────────────────────────────────────────────────
 * Le lien `/j/<restaurant>` (landing/netlify/functions/partage.mjs) partage les plats du
 * jour en UNE publication. Facebook n'affiche QUE l'aperçu Open Graph de la page (il ignore
 * tout texte passé au partageur) : sans une image qui montre les trois plats, la publication
 * n'en montrerait qu'un. Cette fonction fabrique cette image.
 *
 * ── Qui l'appelle ──────────────────────────────────────────────────────────────
 * La fonction Netlify, qui la re-sert depuis NOTRE domaine (`/j/<id>/apercu.jpg`) : un
 * aperçu WhatsApp ne s'affiche de façon fiable qu'en JPEG léger servi par le même domaine
 * que la page (voir `apercuImage` dans partage.mjs).
 *
 * ── Sécurité ───────────────────────────────────────────────────────────────────
 * Lecture seule, avec la clé publique (publishable/anon) : elle ne lit que ce que l'app
 * affiche déjà à n'importe qui. `verify_jwt = false` parce que les robots d'aperçu
 * n'envoient aucun jeton. Aucune écriture, aucune clé service_role.
 *
 * ⚠️ Toujours À JOUR : l'image suit les plats à l'affiche au moment de l'appel. Le cache est
 * court (10 min) pour qu'un changement de plat se voie vite dans les nouveaux partages.
 */
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://bmdveawomizjpiebgtkj.supabase.co';
// Clé PUBLIQUE par conception (déjà dans le bundle de l'app et la vitrine).
const CLE = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';

// Archivo, la police de l'app (theme/tokens.ts), en TTF statique.
const POLICE_GRASSE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/800ExtraBold/Archivo_800ExtraBold.ttf';
const POLICE_DEMI = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/600SemiBold/Archivo_600SemiBold.ttf';

const L = 1200;
const H = 630;
const TUILE = 330;
const ECART = 45;
const ORANGE = Image.rgbaToColor(255, 122, 26, 255);
const BLANC = Image.rgbaToColor(255, 255, 255, 255);
const GRIS = Image.rgbaToColor(196, 188, 180, 255);

let polices: Promise<[Uint8Array, Uint8Array]> | null = null;
function chargerPolices() {
  polices ??= Promise.all(
    [POLICE_GRASSE, POLICE_DEMI].map(async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer())),
  ) as Promise<[Uint8Array, Uint8Array]>;
  return polices;
}

async function lire<T>(chemin: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: CLE, Authorization: `Bearer ${CLE}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return (await r.json()) as T[];
}

/** 30000 → « 30 000 Ar », comme `formatAr` dans l'app. */
function prix(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;
}

/** Texte rendu, raccourci avec « … » s'il dépasse `largeur`. */
function texte(police: Uint8Array, taille: number, contenu: string, couleur: number, largeur: number) {
  let t = contenu;
  let img = Image.renderText(police, taille, t, couleur);
  while (img.width > largeur && t.length > 4) {
    t = t.slice(0, -1);
    img = Image.renderText(police, taille, `${t.trimEnd()}…`, couleur);
  }
  return img;
}

/** Photo du plat en carré : passe par le transformateur Supabase (léger, HEIC compris). */
async function photo(url: string | null): Promise<Image | null> {
  if (!url) return null;
  const objet = '/storage/v1/object/public/';
  const i = url.indexOf(objet);
  const source = i < 0
    ? url
    : `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + objet.length)}?width=${TUILE}&height=${TUILE}&resize=cover`;
  const r = await fetch(source);
  if (!r.ok) return null;
  const img = await decode(new Uint8Array(await r.arrayBuffer()));
  if (!(img instanceof Image)) return null;
  return img.cover(TUILE, TUILE).roundCorners(22);
}

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('r') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('restaurant invalide', { status: 400 });

  try {
    const [restos, plats, [grasse, demi]] = await Promise.all([
      lire<{ name: string }>(`restaurants?id=eq.${id}&select=name`),
      lire<{ name: string; price: number; photo_url: string | null }>(
        `products?restaurant_id=eq.${id}&is_featured=eq.true&is_archived=eq.false&is_available=eq.true`
          + '&select=name,price,photo_url&order=sort_order.asc,name.asc&limit=3',
      ),
      chargerPolices(),
    ]);
    if (!restos.length || !plats.length) return new Response('aucun plat du jour', { status: 404 });

    // Fond : dégradé sombre vertical, dans l'esprit des photos (ardoise, fond noir).
    const fond = new Image(L, H);
    for (let y = 1; y <= H; y++) {
      const k = y / H;
      const c = Image.rgbaToColor(Math.round(34 - 16 * k), Math.round(28 - 14 * k), Math.round(24 - 12 * k), 255);
      fond.drawBox(1, y, L, 1, c);
    }

    // En-tête : « PLATS DU JOUR » + nom du restaurant, marque Taxi Food à droite.
    fond.composite(Image.renderText(grasse, 28, 'PLATS DU JOUR', ORANGE), 60, 38);
    fond.composite(texte(grasse, 50, restos[0].name, BLANC, 820), 60, 76);
    const marque = Image.renderText(grasse, 30, 'Taxi Food', ORANGE);
    fond.composite(marque, L - 60 - marque.width, 40);
    const sousMarque = Image.renderText(demi, 20, 'Livraison à Nosy Be', GRIS);
    fond.composite(sousMarque, L - 60 - sousMarque.width, 80);

    // Tuiles centrées : 1, 2 ou 3 plats.
    const n = plats.length;
    const largeurTotale = n * TUILE + (n - 1) * ECART;
    const x0 = Math.round((L - largeurTotale) / 2);
    const yPhoto = 168;
    const images = await Promise.all(plats.map((p) => photo(p.photo_url)));

    plats.forEach((p, i) => {
      const x = x0 + i * (TUILE + ECART);
      const img = images[i];
      if (img) fond.composite(img, x, yPhoto);
      else fond.drawBox(x + 1, yPhoto + 1, TUILE, TUILE, Image.rgbaToColor(60, 52, 46, 255));
      const nom = texte(demi, 30, p.name, BLANC, TUILE);
      fond.composite(nom, x + Math.round((TUILE - nom.width) / 2), yPhoto + TUILE + 16);
      const montant = Image.renderText(grasse, 30, prix(p.price), ORANGE);
      fond.composite(montant, x + Math.round((TUILE - montant.width) / 2), yPhoto + TUILE + 56);
    });

    return new Response(await fond.encodeJPEG(82), {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (e) {
    console.error('[apercu-plats-du-jour]', e);
    return new Response('erreur', { status: 500 });
  }
});
