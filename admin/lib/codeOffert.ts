/**
 * Les petites règles d'un code offert côté écran : le nom proposé, le message
 * remis au client, l'état lisible d'un code.
 *
 * ⚠️ La base reste l'autorité. `admin_creer_codes_offerts` choisit le nom final
 * (suffixe en cas de collision) et refuse ce qui ne va pas ; ce fichier ne sert
 * qu'à MONTRER à l'admin, avant de valider, ce que la base va faire. Les deux
 * recopies ci-dessous (`texte_sans_accents`, `code_offert_nom_de_base`) ne sont
 * pas appelables depuis l'écran : leur exécution est retirée à `authenticated`.
 */

export const LIEN_COMMANDER = 'https://taxifoodnosybe.distripro207.com';

/** Fuseau du client : la date annoncée dans le message est celle de Nosy Be, pas celle du navigateur. */
const FUSEAU_NOSY_BE = 'Indian/Antananarivo';

// Recopie exacte des deux listes de `texte_sans_accents()` : même position,
// même lettre de remplacement.
const AVEC_ACCENTS = 'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżÀÁÂÃÄÅĀÇĆČÈÉÊËĒĖĘÌÍÎÏĪÑŃÒÓÔÕÖØŌÙÚÛÜŪÝŸŽŹŻ';
const SANS_ACCENTS = 'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzaaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzz';

/** Minuscules sans accents, comme `texte_sans_accents()`. */
export function texteSansAccents(texte: string | null | undefined): string {
  const s = (texte ?? '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'oe')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'ae')
    .replace(/ß/g, 'ss');
  let sortie = '';
  for (const c of s) {
    const i = AVEC_ACCENTS.indexOf(c);
    sortie += i >= 0 ? SANS_ACCENTS[i] : c;
  }
  return sortie.toLowerCase();
}

/** Les mots d'un nom, découpés comme la base (`btrim` ne retire que les espaces). */
function motsDuNom(nom: string | null | undefined): string[] {
  return (nom ?? '').replace(/^ +| +$/g, '').split(/\s+/);
}

/**
 * Le nom que la base donnera au code, avant tout suffixe de collision.
 * Recopie de `code_offert_nom_de_base()` : premier mot du nom ; s'il fait deux
 * lettres ou moins (« Ny Aina »), on colle le suivant, sinon on offrirait
 * « MERCINY ».
 */
export function nomDeCodePropose(fullName: string | null | undefined): string {
  const mots = motsDuNom(fullName);
  const lettres = (mot: string | undefined) =>
    texteSansAccents(mot ?? '').replace(/[^a-z]/g, '').toUpperCase();
  let prenom = lettres(mots[0]);
  if (prenom.length <= 2 && mots.length >= 2) prenom += lettres(mots[1]);
  prenom = prenom.slice(0, 20);
  if (prenom === '' || prenom === 'CLIENT') return 'MERCICLIENT';
  return `MERCI${prenom}`;
}

/** Ce que la base fera d'un nom de code imposé : lettres et chiffres, en majuscules. */
export function normaliserNomDeCode(saisie: string): string {
  return texteSansAccents(saisie).replace(/[^a-z0-9]/g, '').toUpperCase();
}

/**
 * Le prénom pour saluer le client, avec la même règle que la charge envoyée à
 * n8n (`notifier_code_offert`) : l'e-mail et le WhatsApp disent le même prénom.
 */
export function prenomDe(fullName: string | null | undefined): string | null {
  const mots = motsDuNom(fullName);
  const prenom = mots[0].length <= 2 && mots.length >= 2 ? `${mots[0]} ${mots[1]}` : mots[0];
  return prenom.trim() || null;
}

/**
 * Le dernier jour ENTIER où le code fonctionne, en heure de Nosy Be.
 *
 * Un code créé le 15 à 14 h expire le 15 du mois suivant à 14 h. Écrire
 * « jusqu'au 15 » promettrait la soirée du 15, où le code est refusé à la
 * caisse : on annonce la veille. Le client perd au pire quelques heures, jamais
 * une promesse.
 */
export function dernierJourValable(expireLe: string, maintenant: Date = new Date()): string {
  const veille = new Date(new Date(expireLe).getTime() - 86_400_000);
  const partie = (options: Intl.DateTimeFormatOptions, d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: FUSEAU_NOSY_BE }).format(d);
  const jour = Number(partie({ day: 'numeric' }, veille));
  const mois = partie({ month: 'long' }, veille);
  const annee = partie({ year: 'numeric' }, veille);
  const anneeCourante = partie({ year: 'numeric' }, maintenant);
  return `${jour === 1 ? '1er' : jour} ${mois}${annee !== anneeCourante ? ` ${annee}` : ''}`;
}

export type CodeARemettre = {
  code: string;
  full_name: string | null;
  restaurant_nom: string | null;
  offre: string;
  inclut_boissons: boolean;
  expire_le: string | null;
};

/**
 * Le message WhatsApp, prêt à envoyer. Charte client : tutoiement, présent,
 * phrases courtes, aucun emoji. Première ligne : pour qui et quoi ; puis
 * « Tape le code … au moment de payer ».
 *
 * La livraison offerte est payée par Taxi Food (contrainte en base) : c'est
 * donc Taxi Food qui l'offre dans le message, pas le restaurant.
 */
export function messageWhatsApp(c: CodeARemettre, maintenant: Date = new Date()): string {
  const prenom = prenomDe(c.full_name);
  const bonjour = prenom ? `Bonjour ${prenom}` : 'Bonjour';
  // En minuscule : ce repli arrive en milieu de phrase (« Bonjour, ton restaurant t'offre… »).
  const resto = c.restaurant_nom ?? 'ton restaurant';

  const lignes: string[] = [];
  if (c.offre === 'livraison') {
    lignes.push(`${bonjour}, Taxi Food t'offre la livraison de ta prochaine commande chez ${resto}.`);
    // Un code livraison n'offre pas l'emballage : le taire ferait découvrir le carton à la caisse,
    // et « seulement » y serait faux.
    lignes.push(`Tu paies les plats, l'emballage et les boissons.`);
  } else if (c.inclut_boissons) {
    lignes.push(`${bonjour}, ${resto} t'offre ton prochain repas : plats, suppléments, emballage et boissons.`);
    lignes.push('Tu paies seulement la livraison.');
  } else {
    lignes.push(`${bonjour}, ${resto} t'offre ton prochain repas : plats, suppléments et emballage.`);
    lignes.push('Tu paies seulement la livraison et les boissons.');
  }
  lignes.push(`Tape le code ${c.code} au moment de payer.`);
  lignes.push(c.expire_le
    ? `Valable une fois, jusqu'au ${dernierJourValable(c.expire_le, maintenant)}.`
    : 'Valable une fois.');
  lignes.push(`Commander : ${LIEN_COMMANDER} — Taxi Food.`);
  lignes.push('');
  lignes.push('Réponds STOP pour ne plus recevoir nos offres.');
  return lignes.join('\n');
}

/**
 * Les chiffres d'un numéro pour wa.me. La base les normalise déjà en format
 * international (`telephone_du_client`) ; on retire tout le reste par sécurité.
 * Trop court pour être un numéro : pas de lien, plutôt qu'un lien vers personne.
 */
export function chiffresWhatsApp(telephone: string | null | undefined): string | null {
  const chiffres = (telephone ?? '').replace(/\D/g, '');
  return chiffres.length >= 8 ? chiffres : null;
}

export function lienWhatsApp(telephone: string | null | undefined, message: string): string | null {
  const chiffres = chiffresWhatsApp(telephone);
  return chiffres ? `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}` : null;
}

/**
 * Un numéro malgache joignable sur WhatsApp est un mobile : +261 3x…
 * `normaliser_telephone` convertit TOUT numéro à 10 chiffres commençant par 0
 * en +261 — un « 06 12 34 56 78 » français devient +261 612 345 678, un
 * numéro qui n'est pas celui du client. On ne bloque pas, on fait relire.
 */
export function numeroASurveiller(telephone: string | null | undefined): boolean {
  const chiffres = chiffresWhatsApp(telephone);
  return !!chiffres && chiffres.startsWith('261') && chiffres[3] !== '3';
}

/** « +261 36 15 74 521 » : l'affichage 2-2-2-3 des numéros malgaches. */
export function telephoneLisible(telephone: string | null | undefined): string {
  const c = chiffresWhatsApp(telephone);
  if (!c) return telephone ?? '';
  const m = c.match(/^261(\d{2})(\d{2})(\d{2})(\d{3})$/);
  return m ? `+261 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${c}`;
}

export type EtatCode = 'actif' | 'utilise' | 'expire' | 'desactive';

/**
 * L'état lisible d'un code, dans l'ordre qui compte pour l'admin : un code
 * utilisé reste « utilisé » même expiré ou désactivé ensuite — c'est ce qui
 * s'est réellement passé. Expiré comme la base : strictement après `expire_le`.
 */
export function etatDuCode(
  c: { actif: boolean; utilise: boolean; expire_le: string | null },
  maintenant: number = Date.now(),
): EtatCode {
  if (c.utilise) return 'utilise';
  if (!c.actif) return 'desactive';
  if (c.expire_le && maintenant > new Date(c.expire_le).getTime()) return 'expire';
  return 'actif';
}

/** « tf 96 », « 96 », « TF-096 » → « TF-96 ». Ce qui ne ressemble pas à un numéro est rendu tel quel. */
export function numeroDeCommande(saisie: string): string | null {
  const s = saisie.trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(?:TF)?-?(\d+)$/);
  return m ? `TF-${Number.parseInt(m[1], 10)}` : s;
}

/** Entier positif saisi à la main (« 37 000 » accepté). NaN sinon. */
export function entierSaisi(saisie: string): number {
  const s = saisie.replace(/\s/g, '');
  return /^\d+$/.test(s) ? Number.parseInt(s, 10) : Number.NaN;
}
