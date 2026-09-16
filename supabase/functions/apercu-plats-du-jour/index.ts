/**
 * Image d'apercu « PLATS DU JOUR » d'UN restaurant : une image 1200x630, a la charte Taxi Food.
 *
 * ⚠️ CE FICHIER EST LE TEXTE EXACT DU BUNDLE DEPLOYE. Le deploiement passe par MCP, pas par
 * `supabase functions deploy` : si tu modifies ce fichier, redeploie-le, sinon le depot decrit
 * un code qui ne tourne pas.
 *
 * ⚠️ JUMELLE DE `apercu-selection`. Les deux fonctions partagent la meme charte et les memes
 * primitives de dessin (texte, texteEspace, voile, photo, rangeesDe) — recopiees, parce que
 * deux fonctions Edge deployees separement ne peuvent pas partager un module sans compliquer
 * les deux deploiements. TOUTE retouche graphique doit etre portee dans LES DEUX, sinon les
 * partages `/j/` et `/s/` divergent. Ce qui differe volontairement :
 *   apercu-selection  : plusieurs restaurants, le nom du restaurant sous CHAQUE plat.
 *   celle-ci          : un seul restaurant, son nom dans le bandeau, les tuiles respirent.
 *
 * CHARTE (visuels-reseaux/gabarit.py) : photo PLEINE bord a bord, FILET OR, BANDEAU ROUGE
 * #E8342A, sur-titre or en capitales espacees, titre blanc tres gras.
 * ⚠️ Le fond brun sombre de la premiere version a ete REFUSE : ce n'est pas la charte. Ne pas
 * le reintroduire au pretexte que les photos de plats sont souvent sur ardoise noire.
 *
 * -- A quoi ca sert -----------------------------------------------------------------
 * Le lien `/j/<restaurant>` (landing/netlify/functions/partage.mjs) partage les plats a
 * l'affiche en UNE publication. Facebook n'affiche QUE l'apercu Open Graph de la page et
 * ignore tout texte passe au partageur : sans cette image, la publication ne montrerait rien.
 *
 * -- Toujours a jour ----------------------------------------------------------------
 * L'image suit les plats a l'affiche AU MOMENT de l'appel, prix relus en direct. Le cache est
 * court (10 min) : un changement de plat doit se voir vite dans les nouveaux partages. C'est
 * la difference avec `apercu-selection`, dont le contenu est fige a la creation et peut donc
 * etre mis en cache longtemps.
 *
 * -- Securite -----------------------------------------------------------------------
 * Lecture seule avec la cle publique : uniquement ce que l'app montre deja a tout le monde.
 * `verify_jwt = false` parce que les robots d'apercu n'envoient aucun jeton.
 */
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://bmdveawomizjpiebgtkj.supabase.co';
// Cle PUBLIQUE par conception (deja dans le bundle de l'app et la vitrine).
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

async function lire<T>(chemin: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: CLE, Authorization: `Bearer ${CLE}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? (j as T[]) : [];
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
 *  ILLISIBLE sur une photo claire : sur une canette blanche, le texte passait sur un voile a
 *  30 %. Le texte occupe le tiers bas : le voile y est deja a son maximum.
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
    console.error('[apercu-plats-du-jour] photo illisible, aplat a la place', url, e);
    return null;
  }
}

type Plat = { name: string; price: number; photo_url: string | null };
type Resto = { name: string; zone_served: string | null };

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('r') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('restaurant invalide', { status: 400 });

  try {
    const [restos, plats, [grasse, demi]] = await Promise.all([
      lire<Resto>(`restaurants?id=eq.${id}&select=name,zone_served`),
      // ⚠️ Limite passee de 3 a 6 le 2026-09-16 : la grille sait desormais tenir deux rangees.
      // Un restaurant qui met cinq plats a l'affiche les voit tous dans le partage.
      lire<Plat>(
        `products?restaurant_id=eq.${id}&is_featured=eq.true&is_archived=eq.false&is_available=eq.true`
        + `&select=name,price,photo_url&order=sort_order.asc,name.asc&limit=${MAX_TUILES}`,
      ),
      chargerPolices(),
    ]);
    if (!restos.length || !plats.length) return new Response('aucun plat du jour', { status: 404 });

    const fond = new Image(L, H);
    fond.drawBox(1, 1, L, H, ROUGE);

    /* ---- LES PHOTOS, bord a bord ---------------------------------------------------- */
    const rangees = rangeesDe(plats.length);
    const hRangee = Math.floor(H_PHOTOS / rangees.length);
    const uneRangee = rangees.length === 1;

    const tuiles: { x: number; y: number; w: number; h: number; p: Plat }[] = [];
    let index = 0;
    rangees.forEach((parRangee, r) => {
      const largeurBase = Math.floor(L / parRangee);
      const y = r * hRangee;
      const h = r === rangees.length - 1 ? H_PHOTOS - y : hRangee;
      for (let i = 0; i < parRangee; i++) {
        const x = i * largeurBase;
        const w = i === parRangee - 1 ? L - x : largeurBase;
        tuiles.push({ x, y, w, h, p: plats[index++] });
      }
    });

    // ⚠️ TOUTES les photos en parallele : en serie, six allers-retours depassent le temps qu'un
    // robot d'apercu accepte d'attendre.
    const photos = await Promise.all(tuiles.map((t) => photo(t.p.photo_url, t.w, t.h)));

    // Un seul restaurant : le nom du plat peut etre plus grand que dans une selection, il n'a
    // pas a partager la ligne avec une enseigne.
    const tailleNom = uneRangee ? 30 : 23;
    const taillePrix = uneRangee ? 26 : 20;
    const hVoile = uneRangee ? 156 : 118;

    tuiles.forEach((t, i) => {
      const img = photos[i];
      // ⚠️ L'ENCRE D'ABORD, LA PHOTO ENSUITE : les packshots de boissons sont des PNG DETOURES,
      // sans ce fond le rouge de la marque apparait autour de la bouteille.
      fond.drawBox(t.x + 1, t.y + 1, t.w, t.h, img ? ENCRE : CASE_VIDE);
      if (img) fond.composite(img, t.x, t.y);

      const hv = Math.min(hVoile, t.h);
      fond.composite(voile(t.w, hv), t.x, t.y + t.h - hv);

      const padX = uneRangee ? 26 : 18;
      const largeurUtile = t.w - padX * 2;

      // ⚠️ LE NOM SUR SA PROPRE LIGNE, PLEINE LARGEUR. Le prix etait a droite sur la meme
      // ligne : il mangeait la moitie de la tuile et « Poulet basquaise » sortait en
      // « Poulet b… ». Un nom de plat tronque ne donne pas envie, il intrigue au mieux.
      const nom = texte(grasse, tailleNom, t.p.name, BLANC, largeurUtile);
      fond.composite(nom, t.x + padX, t.y + t.h - (uneRangee ? 88 : 74));

      const montant = Image.renderText(grasse, taillePrix, prix(t.p.price), OR);
      fond.composite(montant, t.x + padX, t.y + t.h - (uneRangee ? 44 : 36));
    });

    /* ---- LE FILET OR ET LE BANDEAU ROUGE -------------------------------------------- */
    fond.drawBox(1, H_PHOTOS + 1, L, FILET, OR);
    const yBande = H_PHOTOS + FILET;

    fond.composite(texteEspace(grasse, 20, 'Les plats du jour', OR, 4), MARGE, yBande + 22);
    // Le nom du restaurant EST le titre : c'est l'information de la publication.
    fond.composite(texte(grasse, 46, restos[0].name, BLANC, L - MARGE * 2), MARGE, yBande + 54);

    const zone = restos[0].zone_served ? `Livré à ${restos[0].zone_served}` : 'Livraison à Nosy Be';
    fond.composite(texte(demi, 21, zone, BLANC_DOUX, L - MARGE * 2 - 360), MARGE, yBande + 124);

    const site = Image.renderText(demi, 19, 'taxifoodnosybe.distripro207.com', BLANC_DOUX);
    fond.composite(site, L - MARGE - site.width, yBande + 126);

    /* ---- CACHE COURT ----------------------------------------------------------------
     * 10 minutes, et c'est voulu : contrairement a une selection — figee a sa creation — les
     * plats a l'affiche changent d'un service a l'autre. Un plat retire doit disparaitre vite
     * des nouveaux partages. */
    return new Response(await fond.encodeJPEG(82), {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=600, s-maxage=600',
      },
    });
  } catch (e) {
    console.error('[apercu-plats-du-jour]', e);
    return new Response('erreur', { status: 500, headers: { 'cache-control': 'no-store, max-age=0' } });
  }
});
