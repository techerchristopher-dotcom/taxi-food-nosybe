/**
 * Image d'apercu d'une SELECTION : UNE image 1200x630 qui assemble les photos des plats
 * choisis par le fondateur, avec pour chacun son nom, son prix ET LE NOM DU RESTAURANT.
 *
 * -- A quoi ca sert -----------------------------------------------------------------
 * Le lien `/s/<uuid>` (landing/netlify/functions/partage.mjs) partage une selection en UNE
 * publication. Facebook n'affiche QUE l'apercu Open Graph de la page et ignore tout texte
 * passe au partageur : sans une image qui montre les plats, la publication n'en montrerait
 * aucun. Cette fonction fabrique cette image.
 *
 * -- Pourquoi le nom du restaurant sous CHAQUE plat ----------------------------------
 * Une selection melange plusieurs etablissements, et le panier de l'app est MONO-RESTAURANT
 * (app/store/cart.ts, `canAdd`). Sans le nom du restaurant, le client ne sait pas chez qui il
 * commande ni pourquoi deux plats de l'image lui demandent deux commandes. C'est une
 * information de premiere necessite, pas une decoration : elle est donc sur l'image, pas
 * seulement sur la page.
 *
 * -- Qui l'appelle ------------------------------------------------------------------
 * La fonction Netlify, qui la re-sert depuis NOTRE domaine (`/s/<uuid>/apercu.jpg`) : un
 * apercu WhatsApp ne s'affiche de facon fiable qu'en JPEG leger servi par le meme domaine que
 * la page. Ce fetch n'envoie NI apikey NI Authorization -> `verify_jwt = false` est
 * OBLIGATOIRE (declare dans supabase/config.toml, ne pas l'oublier au redeploiement).
 *
 * -- Securite -----------------------------------------------------------------------
 * Une seule source de donnees : la RPC PUBLIQUE `selection_publique`, appelee avec la cle
 * publiable (anon). JAMAIS de service_role dans une fonction que n'importe quel robot peut
 * appeler. C'est la RPC qui decide de tout : selection inconnue, inactive ou expiree -> zero
 * ligne ; plat archive, indisponible ou restaurant `coming_soon` -> filtre. Cette fonction ne
 * refait aucun de ces controles, pour qu'il n'existe qu'UN seul endroit ou ils vivent.
 *
 * -- Rien n'est gele ----------------------------------------------------------------
 * Le nom, le prix et la photo sont relus a chaque generation. Une page qui affiche un prix
 * perime ment au client, et c'est lui qui paiera la difference a la caisse.
 */
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://bmdveawomizjpiebgtkj.supabase.co';
// Cle PUBLIQUE par conception (deja dans le bundle de l'app et dans la vitrine).
const CLE = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';

// Archivo, la police de l'app (theme/tokens.ts), en TTF statique.
const POLICE_GRASSE = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/800ExtraBold/Archivo_800ExtraBold.ttf';
const POLICE_DEMI = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/archivo@0.4.2/600SemiBold/Archivo_600SemiBold.ttf';

/* ====================================================================================
 * GEOMETRIE — le calcul complet, parce qu'une tuile qui deborde ne se voit pas en code.
 *
 * Reference empirique reprise de apercu-plats-du-jour : la hauteur rendue d'un texte par
 * `Image.renderText` vaut environ 1,35 x la taille demandee (verifiable sur l'original :
 * nom et prix en taille 30 y sont espaces de 40 px).
 *
 * HORIZONTAL (identique dans les deux dispositions) :
 *   48 (marge) + 348 + 30 (ecart) + 348 + 30 (ecart) + 348 + 48 (marge) = 1200  OK
 *   -> TUILE_L = (1200 - 2*48 - 2*30) / 3 = 1044 / 3 = 348
 *
 * VERTICAL, EN-TETE (commun) :
 *   surtitre  taille 26 a y=28  -> hauteur ~35 -> bas 63
 *   titre     taille 38 a y=64  -> hauteur ~51 -> bas 115
 *   La grille demarre a 128 : 13 px de garde sous l'en-tete.
 *
 * VERTICAL, GRILLE 3x2 (4 a 6 plats) — c'est le cas serre :
 *   bloc = photo 168 + 10 + (nom/prix, taille 22 -> ~30) + 4 + (resto, taille 17 -> ~23) = 235
 *   rangee 1 : 128 -> 363
 *   ecart vertical : 16
 *   rangee 2 : 379 -> 614
 *   reste sous la derniere ligne : 630 - 614 = 16 px  OK, ca tient.
 *
 * VERTICAL, UNE RANGEE (1 a 3 plats) — la hauteur libre sert a agrandir la photo :
 *   bloc = photo 348 + 12 + (nom/prix, taille 28 -> ~38) + 4 + (resto, taille 20 -> ~27) = 429
 *   bloc centre dans l'espace [128, 630] : (630 - 128 - 429) / 2 = 36 -> depart a 164
 *   photo 164 -> 512 ; nom/prix 524 -> 562 ; resto 566 -> 593
 *   reste : 630 - 593 = 37 px  OK.
 * ==================================================================================== */
const L = 1200;
const H = 630;
const MARGE = 48;
const ECART_X = 30;
const TUILE_L = 348; // (1200 - 2*MARGE - 2*ECART_X) / 3
const ECART_Y = 16;
const Y_GRILLE = 128; // bas de l'en-tete (~115) + garde

// Six plats au maximum sur l'image : la 7e tuile n'a nulle part ou aller. Les autres
// plats de la selection restent visibles sur la page /s/<uuid>, qui n'a pas cette limite.
const MAX_TUILES = 6;

const ORANGE = Image.rgbaToColor(255, 122, 26, 255);
const BLANC = Image.rgbaToColor(255, 255, 255, 255);
const GRIS = Image.rgbaToColor(196, 188, 180, 255);
const CASE_VIDE = Image.rgbaToColor(60, 52, 46, 255);

/* ====================================================================================
 * POLICES
 * ==================================================================================== */

let polices: Promise<[Uint8Array, Uint8Array]> | null = null;

/**
 * Charge les deux TTF une fois par isolate.
 *
 * ⚠️ POURQUOI ce n'est pas un simple `??=` comme dans apercu-plats-du-jour : `??=` memorise
 * la promesse MEME REJETEE. Un incident de 30 secondes chez le CDN de polices suffirait alors
 * a eteindre tous les apercus jusqu'au recyclage de l'isolate — sans rien qui le signale.
 * On remet donc la variable a null en cas d'echec, pour qu'un appel suivant reessaie.
 * Et on verifie `r.ok` : un 502 renvoie une page HTML, dont les octets ne sont pas une police
 * et font lever `renderText` beaucoup plus loin, la ou la cause est illisible.
 */
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
    // Ne libere que SA propre tentative : un appel concurrent a pu deja en poser une bonne.
    if (polices === essai) polices = null;
  });
  return essai;
}

/* ====================================================================================
 * DONNEES
 * ==================================================================================== */

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

/**
 * Lit la selection par la RPC publique. Zero ligne = selection inconnue, inactive ou expiree :
 * c'est la RPC qui tranche, jamais cette fonction.
 */
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
  // La RPC ordonne deja par rang ; on ne re-trie pas, on se contente de tronquer.
  return Array.isArray(lignes) ? lignes.slice(0, MAX_TUILES) : [];
}

/* ====================================================================================
 * RENDU
 * ==================================================================================== */

/** 30000 -> « 30 000 Ar », comme `formatAr` dans l'app. */
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

/**
 * Photo d'un plat, aux dimensions demandees.
 *
 * ⚠️ Largeur ET hauteur sont des parametres : en grille les tuiles sont paysage (348x168) et
 * en rangee unique elles sont carrees (348x348). L'original figeait un cote unique.
 *
 * ⚠️ Le try/catch couvre TOUT le corps, `decode` compris. Un seul fichier corrompu, tronque ou
 * dans un format qu'imagescript ne sait pas lire faisait tomber l'affiche entiere : l'exception
 * remontait par le `Promise.all`, la fonction repondait 500, et Netlify remplacait l'image par
 * le logo generique — que Facebook garde ENSUITE definitivement en cache pour cette
 * publication. L'echec d'une tuile doit rester l'echec d'une tuile.
 *
 * On passe d'abord par le transformateur d'images Supabase : il sait decoder le HEIC et rend
 * une image deja a la bonne taille, donc bien plus legere a telecharger et a decoder ici.
 */
async function photo(url: string | null, largeur: number, hauteur: number): Promise<Image | null> {
  if (!url) return null;
  try {
    const objet = '/storage/v1/object/public/';
    const i = url.indexOf(objet);
    const source = i < 0
      ? url // URL hors stockage Supabase : on la prend telle quelle, sans transformation.
      : `${url.slice(0, i)}/storage/v1/render/image/public/${url.slice(i + objet.length)}`
        + `?width=${largeur}&height=${hauteur}&resize=cover`;
    const r = await fetch(source);
    if (!r.ok) return null;
    const img = await decode(new Uint8Array(await r.arrayBuffer()));
    if (!(img instanceof Image)) return null;
    // Rayon proportionnel : 22 px sur une tuile de 168 px de haut serait une pastille.
    return img.cover(largeur, hauteur).roundCorners(Math.min(22, Math.round(hauteur / 9)));
  } catch (e) {
    console.error('[apercu-selection] photo illisible, tuile grise a la place', url, e);
    return null;
  }
}

/* ====================================================================================
 * SERVEUR
 * ==================================================================================== */

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get('s') ?? '';
  // Meme gabarit d'UUID que la regexp de routage de partage.mjs : c'est ce format qui empeche
  // un identifiant fabrique de reecrire l'URL PostgREST.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('selection invalide', { status: 400 });

  try {
    const [lignes, [grasse, demi]] = await Promise.all([lireSelection(id), chargerPolices()]);

    if (!lignes.length) {
      // Inconnue, desactivee ou expiree. `no-store` est obligatoire : le 2026-09-05, une
      // reponse de repli mise en cache a continue de s'appliquer apres la reparation.
      return new Response('selection indisponible', {
        status: 404,
        headers: { 'cache-control': 'no-store, max-age=0' },
      });
    }

    // Fond : degrade sombre vertical, dans l'esprit des photos (ardoise, fond noir).
    const fond = new Image(L, H);
    for (let y = 1; y <= H; y++) {
      const k = y / H;
      const c = Image.rgbaToColor(
        Math.round(34 - 16 * k),
        Math.round(28 - 14 * k),
        Math.round(24 - 12 * k),
        255,
      );
      fond.drawBox(1, y, L, 1, c); // drawBox est indexe a 1, composite a 0.
    }

    // En-tete reduit : il ne doit pas manger la hauteur dont la grille a besoin.
    const marque = Image.renderText(grasse, 26, 'Taxi Food', ORANGE);
    const sousMarque = Image.renderText(demi, 18, 'Livraison a Nosy Be', GRIS);
    fond.composite(marque, L - MARGE - marque.width, 30);
    fond.composite(sousMarque, L - MARGE - sousMarque.width, 70);
    fond.composite(Image.renderText(grasse, 26, 'LA SELECTION', ORANGE), MARGE, 28);
    // Largeur restante a gauche de la marque, moins une gouttiere de 30 px.
    const largeurTitre = L - MARGE - MARGE - Math.max(marque.width, sousMarque.width) - 30;
    fond.composite(texte(grasse, 38, lignes[0].titre, BLANC, largeurTitre), MARGE, 64);

    // Disposition : une rangee jusqu'a 3 plats, grille 3x2 au-dela.
    const enGrille = lignes.length > 3;
    const hauteurPhoto = enGrille ? 168 : 348;
    const tailleNom = enGrille ? 22 : 28;
    const tailleResto = enGrille ? 17 : 20;
    const ecartPhotoNom = enGrille ? 10 : 12;
    const hauteurNom = Math.round(tailleNom * 1.35);
    const decalageResto = ecartPhotoNom + hauteurNom + 4;
    const hauteurBloc = hauteurPhoto + decalageResto + Math.round(tailleResto * 1.35);

    const rangees = enGrille ? [lignes.slice(0, 3), lignes.slice(3)] : [lignes];
    const hauteurTotale = rangees.length * hauteurBloc + (rangees.length - 1) * ECART_Y;
    // Grille : ancree en haut, elle occupe deja presque toute la hauteur (16 px de reste).
    // Rangee unique : centree dans la place libre, sinon l'image parait tomber vers le haut.
    const y0 = enGrille ? Y_GRILLE : Y_GRILLE + Math.round((H - Y_GRILLE - hauteurTotale) / 2);

    // ⚠️ TOUTES les photos en parallele. En serie, six allers-retours vers le transformateur
    // d'images depassent largement le temps qu'un robot d'apercu accepte d'attendre.
    const photos = await Promise.all(lignes.map((p) => photo(p.photo_url, TUILE_L, hauteurPhoto)));

    let index = 0;
    rangees.forEach((rangee, r) => {
      // Chaque rangee est centree pour elle-meme : une derniere rangee de 1 ou 2 plats
      // (selection de 4 ou 5) reste alignee sur l'axe de l'image, pas collee a gauche.
      const largeurRangee = rangee.length * TUILE_L + (rangee.length - 1) * ECART_X;
      const xDepart = Math.round((L - largeurRangee) / 2);
      const yTuile = y0 + r * (hauteurBloc + ECART_Y);

      rangee.forEach((p, i) => {
        const x = xDepart + i * (TUILE_L + ECART_X);
        const img = photos[index++];
        if (img) fond.composite(img, x, yTuile);
        else fond.drawBox(x + 1, yTuile + 1, TUILE_L, hauteurPhoto, CASE_VIDE);

        // Prix rendu d'abord : sa largeur decide de la place qui reste au nom.
        const montant = Image.renderText(grasse, tailleNom, prix(p.prix), ORANGE);
        const nom = texte(demi, tailleNom, p.nom, BLANC, Math.max(40, TUILE_L - montant.width - 12));
        const yNom = yTuile + hauteurPhoto + ecartPhotoNom;
        fond.composite(nom, x, yNom);
        fond.composite(montant, x + TUILE_L - montant.width, yNom);

        // Sans le nom du restaurant, le client ne sait pas chez qui commander. En gris et plus
        // petit : c'est un reperage, il ne doit pas concurrencer le nom du plat.
        if (p.restaurant_nom) {
          fond.composite(
            texte(demi, tailleResto, p.restaurant_nom, GRIS, TUILE_L),
            x,
            yTuile + hauteurPhoto + decalageResto,
          );
        }
      });
    });

    const jpeg = await fond.encodeJPEG(82);

    /* CACHE LONG — et volontairement long.
     *
     * Une generation a froid a ete MESUREE a 11,7 s pour seulement trois photos, au-dela de ce
     * que le robot Facebook accepte d'attendre. Or s'il abandonne, la publication garde
     * DEFINITIVEMENT l'image de repli generique : un echec de 10 secondes coute une publication
     * entiere. Servir chaud est donc une exigence, pas un confort.
     *
     * Le contenu ne bouge quasiment plus une fois la selection publiee : la liste des plats est
     * figee a la creation, et seuls un prix ou une photo peuvent evoluer. On accepte ce retard
     * sur l'IMAGE (la page /s/, elle, relit tout a chaque ouverture et reste la reference).
     *
     * Le cache est plafonne par l'expiration de la selection : inutile de laisser une image
     * survivre a la selection qu'elle annonce.
     */
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
    // `no-store` : une erreur passagere ne doit pas se figer dans un cache intermediaire.
    return new Response('erreur', { status: 500, headers: { 'cache-control': 'no-store, max-age=0' } });
  }
});
