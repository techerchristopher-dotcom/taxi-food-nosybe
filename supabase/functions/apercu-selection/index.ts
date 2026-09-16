/**
 * Image d'apercu d'une SELECTION : UNE image 1200x630, a la charte Taxi Food.
 *
 * ⚠️ CE FICHIER EST LE TEXTE EXACT DU BUNDLE DEPLOYE (verifie par get_edge_function le
 * 2026-09-16). Le deploiement passe par MCP, pas par `supabase functions deploy` : si tu
 * modifies ce fichier, redeploie-le, sinon le depot decrit un code qui ne tourne pas.
 *
 * CHARTE (visuels-reseaux/gabarit.py) : photo PLEINE bord a bord, FILET OR, BANDEAU ROUGE,
 * sur-titre or en capitales espacees, titre blanc tres gras, prix en blanc sur voile encre.
 * JAMAIS de fond sombre degrade : la premiere version recopiait celui de apercu-plats-du-jour,
 * elle etait hors charte et a ete refusee.
 *
 * Le nom du restaurant est sous CHAQUE plat : le panier de l'app est MONO-RESTAURANT
 * (app/store/cart.ts, canAdd), le client doit savoir chez qui il commande.
 *
 * Qui l'appelle : landing/netlify/functions/partage.mjs, qui re-sert cette image depuis NOTRE
 * domaine (/s/<uuid>/apercu.jpg) — un apercu WhatsApp ne s'affiche de facon fiable qu'en JPEG
 * leger servi par le meme domaine que la page.
 *
 * Source de donnees unique : la RPC PUBLIQUE selection_publique, cle publiable (anon), jamais
 * service_role. verify_jwt = false est OBLIGATOIRE : le fetch de Netlify n'envoie aucun jeton.
 *
 * Rien n'est gele : nom, prix et photo sont relus a chaque generation. Une image qui annonce un
 * prix perime ment au client, et c'est lui qui paiera la difference a la caisse.
 */
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://bmdveawomizjpiebgtkj.supabase.co';
const CLE = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';

const POLICE_GRASSE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/800ExtraBold/Archivo_800ExtraBold.ttf';
const POLICE_DEMI = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/600SemiBold/Archivo_600SemiBold.ttf';

// Couleurs : app/theme/tokens.ts et visuels-reseaux/gabarit.py. Aucune couleur inventee.
const ROUGE = Image.rgbaToColor(232, 52, 42, 255);   // #E8342A
const OR = Image.rgbaToColor(255, 199, 44, 255);     // #FFC72C
const ENCRE = Image.rgbaToColor(19, 19, 19, 255);    // #131313
const BLANC = Image.rgbaToColor(255, 255, 255, 255);
const BLANC_DOUX = Image.rgbaToColor(255, 255, 255, 235);
const CASE_VIDE = Image.rgbaToColor(46, 42, 40, 255);

const L = 1200;
const H = 630;
const MARGE = 48;
const FILET = 6;
const BANDE = 200;
const H_PHOTOS = H - BANDE - FILET; // 424
const MAX_TUILES = 6;

/** Repartition en rangees. Jamais une rangee d'un seul plat sous une rangee de trois. */
function rangeesDe(n: number): number[] {
  if (n <= 3) return [n];
  if (n === 4) return [2, 2];
  if (n === 5) return [3, 2];
  return [3, 3];
}

let polices: Promise<[Uint8Array, Uint8Array]> | null = null;

/** ⚠️ Pas de `??=` : il memorise une promesse REJETEE, et une panne de 30 s du CDN eteindrait
 *  tous les apercus jusqu'au recyclage de l'isolate. On remet a null en cas d'echec. */
function chargerPolices(): Promise<[Uint8Array, Uint8Array]> {
  if (polices) return polices;
  const essai = Promise.all(
    [POLICE_GRASSE, POLICE_DEMI].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`police ${r.status} sur ${u}`);
      const octets = new Uint8Array(await r.arrayBuffer());
      if (octets.byteLength < 1024) throw new Error(`police vide sur ${u}`);
      return octets;
    }),
  ) as Promise<[Uint8Array, Uint8Array]>;
  polices = essai;
  essai.catch(() => {
    if (polices === essai) polices = null;
  });
  return essai;
}

type Ligne = {
  titre: string;
  expire_le: string;
  rang: number;
  product_id: string;
  nom: string;
  prix: number;
  photo_url: string | null;
  restaurant_id: string;
  restaurant_nom: string;
};

async function lireSelection(id: string): Promise<Ligne[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/selection_publique`, {
    method: 'POST',
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${CLE}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_id: id }),
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const lignes = (await r.json()) as Ligne[];
  return Array.isArray(lignes) ? lignes.slice(0, MAX_TUILES) : [];
}

/** 30000 -> « 30 000 Ar », comme formatAr dans l'app. */
function prix(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;
}

/** Texte rendu, raccourci avec « … » s'il depasse `largeur`. */
function texte(police: Uint8Array, taille: number, contenu: string, couleur: number, largeur: number) {
  let t = contenu.trim() || ' ';
  let img = Image.renderText(police, taille, t, couleur);
  while (img.width > largeur && t.length > 4) {
    t = t.slice(0, -1);
    img = Image.renderText(police, taille, `${t.trimEnd()}…`, couleur);
  }
  return img;
}

/** Capitales tres espacees : la signature des sur-titres de la charte (letter-spacing 3.8px).
 *  renderText ne sait pas espacer : on rend lettre a lettre. Les espaces ont une largeur nulle,
 *  d'ou l'avance forfaitaire. */
function texteEspace(police: Uint8Array, taille: number, contenu: string, couleur: number, ecart: number) {
  const lettres = [...contenu.toUpperCase()];
  const rendus = lettres.map((c) => (c === ' ' ? null : Image.renderText(police, taille, c, couleur)));
  const largeur = rendus.reduce<number>((s, r) => s + (r ? r.width : Math.round(taille * 0.34)) + ecart, 0);
  const hauteur = rendus.reduce<number>((h, r) => Math.max(h, r ? r.height : 0), 1);
  const bande = new Image(Math.max(1, largeur), hauteur);
  let x = 0;
  for (const r of rendus) {
    if (r) {
      bande.composite(r, x, 0);
      x += r.width + ecart;
    } else {
      x += Math.round(taille * 0.34) + ecart;
    }
  }
  return bande;
}

/** Voile sombre au bas d'une photo (meme procede que _bandeau dans gabarit.py).
 *  ⚠️ RAMPE COURTE, PUIS PLEIN. Une courbe douce (k*k) etait jolie sur une photo sombre et
 *  ILLISIBLE sur une photo claire : sur la canette blanche, le nom du restaurant en or passait
 *  sur un voile a 30 %. Le texte occupe le tiers bas : le voile y est deja a son maximum.
 *  ⚠️ composite melange, drawBox remplace : le voile est une image a canal alpha. */
function voile(largeur: number, hauteur: number) {
  const v = new Image(largeur, hauteur);
  for (let y = 0; y < hauteur; y++) {
    const k = y / (hauteur - 1);
    const a = Math.round(255 * Math.min(0.94, 2 * k));
    v.drawBox(1, y + 1, largeur, 1, Image.rgbaToColor(19, 19, 19, a));
  }
  return v;
}

/** ⚠️ try/catch sur TOUT le corps, decode compris : un seul fichier illisible faisait tomber
 *  l'affiche entiere, la fonction repondait 500, et Facebook figeait l'image generique pour
 *  cette publication. L'echec d'une tuile doit rester l'echec d'une tuile.
 *  Le transformateur Supabase sait decoder le HEIC et rend deja la bonne taille.
 *  Pas de roundCorners : les photos vont bord a bord. */
async function photo(url: string | null, largeur: number, hauteur: number): Promise<Image | null> {
  if (!url) return null;
  try {
    const objet = '/storage/v1/object/public/';
    const i = url.indexOf(objet);
    const source = i < 0
      ? url
      : `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + objet.length)}`
        + `?width=${largeur}&height=${hauteur}&resize=cover`;
    const r = await fetch(source);
    if (!r.ok) return null;
    const img = await decode(new Uint8Array(await r.arrayBuffer()));
    if (!(img instanceof Image)) return null;
    return img.cover(largeur, hauteur);
  } catch (e) {
    console.error('[apercu-selection] photo illisible, aplat a la place', url, e);
    return null;
  }
}

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('s') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('selection invalide', { status: 400 });

  try {
    const [lignes, [grasse, demi]] = await Promise.all([lireSelection(id), chargerPolices()]);

    if (!lignes.length) {
      // Inconnue, desactivee ou expiree. no-store obligatoire : le 2026-09-05, une reponse de
      // repli mise en cache a continue de s'appliquer apres la reparation.
      return new Response('selection indisponible', {
        status: 404,
        headers: { 'cache-control': 'no-store, max-age=0' },
      });
    }

    const fond = new Image(L, H);
    fond.drawBox(1, 1, L, H, ROUGE);

    const rangees = rangeesDe(lignes.length);
    const hRangee = Math.floor(H_PHOTOS / rangees.length);
    const uneRangee = rangees.length === 1;

    // Geometrie calculee AVANT le telechargement : chaque photo est demandee au transformateur
    // a sa taille finale exacte, jamais redimensionnee deux fois. La derniere tuile de chaque
    // rangee absorbe l'arrondi, pour que la somme fasse exactement 1200 (aucun lisere).
    const tuiles: { x: number; y: number; w: number; h: number; p: Ligne }[] = [];
    let index = 0;
    rangees.forEach((parRangee, r) => {
      const largeurBase = Math.floor(L / parRangee);
      const y = r * hRangee;
      const h = r === rangees.length - 1 ? H_PHOTOS - y : hRangee;
      for (let i = 0; i < parRangee; i++) {
        const x = i * largeurBase;
        const w = i === parRangee - 1 ? L - x : largeurBase;
        tuiles.push({ x, y, w, h, p: lignes[index++] });
      }
    });

    // ⚠️ TOUTES les photos en parallele : en serie, six allers-retours depassent le temps qu'un
    // robot d'apercu accepte d'attendre.
    const photos = await Promise.all(tuiles.map((t) => photo(t.p.photo_url, t.w, t.h)));

    const tailleNom = uneRangee ? 30 : 23;
    const tailleResto = uneRangee ? 20 : 16;
    const hVoile = uneRangee ? 170 : 120;

    tuiles.forEach((t, i) => {
      const img = photos[i];
      // ⚠️ L'ENCRE D'ABORD, LA PHOTO ENSUITE. Les packshots de boissons sont des PNG DETOURES :
      // sans ce fond, le rouge de la marque apparait autour de la bouteille, et deux tuiles
      // voisines ne se ressemblent plus du tout selon le format de leur fichier.
      fond.drawBox(t.x + 1, t.y + 1, t.w, t.h, img ? ENCRE : CASE_VIDE);
      if (img) fond.composite(img, t.x, t.y);

      const hv = Math.min(hVoile, t.h);
      fond.composite(voile(t.w, hv), t.x, t.y + t.h - hv);

      const padX = uneRangee ? 26 : 18;
      const largeurUtile = t.w - padX * 2;

      // Le restaurant EN PREMIER, en or : c'est lui qui dit chez qui on commande.
      if (t.p.restaurant_nom) {
        const resto = texte(demi, tailleResto, t.p.restaurant_nom, OR, largeurUtile);
        fond.composite(resto, t.x + padX, t.y + t.h - (uneRangee ? 96 : 68));
      }

      // Prix rendu d'abord : sa largeur decide de la place qui reste au nom.
      const montant = Image.renderText(grasse, tailleNom, prix(t.p.prix), BLANC);
      const nom = texte(grasse, tailleNom, t.p.nom, BLANC, Math.max(40, largeurUtile - montant.width - 14));
      const yNom = t.y + t.h - (uneRangee ? 60 : 42);
      fond.composite(nom, t.x + padX, yNom);
      fond.composite(montant, t.x + t.w - padX - montant.width, yNom);
    });

    fond.drawBox(1, H_PHOTOS + 1, L, FILET, OR);

    const yBande = H_PHOTOS + FILET;
    fond.composite(texteEspace(grasse, 20, 'La sélection Taxi Food', OR, 4), MARGE, yBande + 22);
    fond.composite(texte(grasse, 46, lignes[0].titre, BLANC, L - MARGE * 2), MARGE, yBande + 54);

    // Les restaurants concernes : le client doit voir d'un coup d'oeil combien d'enseignes sont
    // dans la publication — le panier est mono-restaurant.
    const restos = [...new Set(lignes.map((x) => x.restaurant_nom).filter(Boolean))];
    const ligneRestos = texte(demi, 21, restos.join('  ·  '), BLANC_DOUX, L - MARGE * 2 - 360);
    fond.composite(ligneRestos, MARGE, yBande + 124);

    const site = Image.renderText(demi, 19, 'taxifoodnosybe.distripro207.com', BLANC_DOUX);
    fond.composite(site, L - MARGE - site.width, yBande + 126);

    const jpeg = await fond.encodeJPEG(82);

    // CACHE LONG, volontairement : une generation a froid mesuree a 11,7 s sur la fonction
    // voisine depasse ce que le robot Facebook attend, et son abandon fige DEFINITIVEMENT
    // l'image generique sur la publication. Plafonne par l'expiration de la selection.
    const resteSec = Math.floor((Date.parse(lignes[0].expire_le) - Date.now()) / 1000);
    const duree = Math.max(60, Math.min(7 * 24 * 3600, Number.isFinite(resteSec) ? resteSec : 60));

    return new Response(jpeg, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': `public, max-age=${duree}, s-maxage=${duree}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    console.error('[apercu-selection]', e);
    return new Response('erreur', { status: 500, headers: { 'cache-control': 'no-store, max-age=0' } });
  }
});
