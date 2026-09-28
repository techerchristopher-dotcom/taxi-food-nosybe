/**
 * Les petites règles d'un prospect côté écran : distance, langue probable,
 * script à lire, liens de contact. La base reste l'autorité sur la prochaine
 * action (`prospect_prochaine_action`, vue `prospects_pilotage`) — ce fichier
 * ne fait que MONTRER quoi dire, jamais ce qu'il faut faire.
 *
 * Scripts recopiés mot pour mot de STRATEGIE-PROSPECTION-HEBERGEMENTS.md § 4 :
 * un script qui change ici sans changer là-bas se désynchronise en silence.
 */

export type Langue = 'fr' | 'it' | 'en';

export type Prospect = {
  id: string;
  nom: string;
  hote_prenom: string | null;
  zone: string | null;
  type_hebergement: string | null;
  capacite: number | null;
  telephone: string | null;
  telephone_2: string | null;
  facebook_url: string | null;
  email: string | null;
  notes: string | null;
  statut: string;
  priorite: string | null;
  canal_contact: string | null;
  etablissement: string | null;
  code_promo_id: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  km_restaurant: number | null;
  prochain_canal: string | null;
  prochaine_action: string | null;
  a_faire_le: string | null;
  rang: number | null;
};

/**
 * Distance en km entre deux points, approximation plane — même formule que
 * côté base (`prospects_pilotage`) : cohérence entre ce que l'écran affiche
 * et ce que la vue a déjà calculé, pas une seconde méthode qui diverge.
 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat1 - lat2) * 111;
  const dLng = (lng1 - lng2) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Langue probable de l'hôte, sur le seul indice fiable qu'on ait : le préfixe
 * du téléphone (stratégie § 6.2). `+39` italien, `+33`/`+261` français,
 * sinon anglais par défaut — un message en anglais reste compris partout,
 * ce qui n'est pas vrai de l'italien.
 */
export function langueProbable(p: Pick<Prospect, 'telephone' | 'telephone_2'>): Langue {
  const chiffres = (p.telephone ?? p.telephone_2 ?? '').replace(/\D/g, '');
  if (chiffres.startsWith('39')) return 'it';
  if (chiffres.startsWith('33') || chiffres.startsWith('261')) return 'fr';
  return 'en';
}

/** La personne s'occupe aussi d'un restaurant : angle concurrent, jamais de flyers dans sa salle. */
export function faitAussiRestaurant(p: Pick<Prospect, 'notes'>): boolean {
  return (p.notes ?? '').toUpperCase().includes('FAIT AUSSI RESTAURANT');
}

const LIEN_COMMANDER = 'https://taxifoodnosybe.distripro207.com';

function prenomOuVide(p: Pick<Prospect, 'hote_prenom'>): string {
  return (p.hote_prenom ?? '').trim();
}

function etablissementDe(p: Pick<Prospect, 'etablissement' | 'nom'>): string {
  return (p.etablissement ?? p.nom ?? '').trim();
}

type Textes = {
  bonjour: (prenom: string) => string;
  whatsapp: (prenom: string, etab: string) => string;
  appel: string;
  objections: { question: string; reponse: string }[];
  ecritSuffixe: string;
  surPlace: string;
};

const TEXTES: Record<Langue, Textes> = {
  fr: {
    bonjour: (prenom) => (prenom ? `Bonjour ${prenom}` : 'Bonjour'),
    whatsapp: (prenom, etab) =>
      `${prenom ? `Bonjour ${prenom}` : 'Bonjour'}, Christopher de Taxi Food, la livraison de repas à Nosy Be.\n` +
      `Vos clients de ${etab || 'votre établissement'} me demandent souvent où manger le soir.\n` +
      `Je vous propose un code de réduction à leur nom : c'est vous qui le leur offrez, ça ne vous coûte rien. ` +
      `Je passe vous déposer des flyers cette semaine si ça vous intéresse ?`,
    appel:
      `Bonjour, Christopher de Taxi Food, la livraison de repas. Je ne vous vends rien.\n` +
      `Vos clients cherchent où dîner, surtout ceux qui n'ont pas de voiture. J'ai un code de réduction que vous ` +
      `pouvez leur offrir, à votre nom. Je vous dépose des flyers, et vous n'avez rien d'autre à faire. Je passe quand ?`,
    objections: [
      { question: '« Ça me coûte combien ? »', reponse: 'Rien. Pas d\'abonnement, pas de commission, aucun engagement.' },
      { question: '« Et moi je gagne quoi ? »', reponse: 'Vos clients arrêtent de vous demander où manger, et ils repartent contents. Si vous voulez qu\'on aille plus loin plus tard, on en reparle.' },
      { question: '« On fait déjà à manger. »', reponse: 'Justement : quand votre cuisine ferme, vos clients n\'ont plus rien. Le code sert après votre service, pas pendant.' },
    ],
    ecritSuffixe: `\n\nNotre app : App Store et Play Store. Restaurants partenaires et commande : ${LIEN_COMMANDER}\nRépondez sur WhatsApp, c'est plus simple pour moi : `,
    surPlace: `Bonjour, Christopher, Taxi Food. Je passe déposer des flyers pour vos clients : livraison de repas le soir, ` +
      `avec une réduction à votre nom. Vous êtes bien la personne qui accueille ?`,
  },
  it: {
    bonjour: (prenom) => (prenom ? `Buongiorno ${prenom}` : 'Buongiorno'),
    whatsapp: (prenom, etab) =>
      `${prenom ? `Buongiorno ${prenom}` : 'Buongiorno'}, sono Christopher di Taxi Food, consegna di pasti a Nosy Be.\n` +
      `I vostri clienti di ${etab || 'vostra struttura'} mi chiedono spesso dove mangiare la sera.\n` +
      `Vi propongo un codice sconto a vostro nome: siete voi a offrirlo, non vi costa nulla. ` +
      `Passo a lasciarvi dei volantini questa settimana se vi interessa?`,
    appel:
      `Buongiorno, Christopher di Taxi Food, consegna di pasti. Non vi vendo niente.\n` +
      `I vostri clienti cercano dove cenare, soprattutto chi non ha auto. Ho un codice sconto che potete offrire ` +
      `a vostro nome. Vi lascio dei volantini, non dovete fare altro. Quando posso passare?`,
    objections: [
      { question: '« Quanto mi costa? »', reponse: 'Niente. Nessun abbonamento, nessuna commissione, nessun impegno.' },
      { question: '« E io cosa ci guadagno? »', reponse: 'I vostri clienti smettono di chiedervi dove mangiare, e se ne vanno contenti. Se poi volete andare oltre, ne riparliamo.' },
      { question: '« Cuciniamo già noi. »', reponse: 'Appunto: quando la vostra cucina chiude, i vostri clienti non hanno più nulla. Il codice serve dopo il vostro servizio, non durante.' },
    ],
    ecritSuffixe: `\n\nLa nostra app: App Store e Play Store. Ristoranti partner e ordini: ${LIEN_COMMANDER}\nRispondete su WhatsApp, è più semplice per me: `,
    surPlace: `Buongiorno, Christopher, Taxi Food. Passo a lasciare volantini per i vostri clienti: consegna pasti la sera, ` +
      `con uno sconto a vostro nome. Siete voi la persona alla reception?`,
  },
  en: {
    bonjour: (prenom) => (prenom ? `Hello ${prenom}` : 'Hello'),
    whatsapp: (prenom, etab) =>
      `${prenom ? `Hello ${prenom}` : 'Hello'}, Christopher from Taxi Food, meal delivery in Nosy Be.\n` +
      `Your guests at ${etab || 'your place'} often ask me where to eat in the evening.\n` +
      `I'd like to offer you a discount code in your name: it's you who offers it, it costs you nothing. ` +
      `I can drop off flyers this week if you're interested?`,
    appel:
      `Hello, Christopher from Taxi Food, meal delivery. I'm not selling you anything.\n` +
      `Your guests are looking for somewhere to eat, especially those without a car. I have a discount code you ` +
      `can offer them, in your name. I'll drop off flyers, nothing else for you to do. When can I stop by?`,
    objections: [
      { question: '"How much does it cost me?"', reponse: 'Nothing. No subscription, no commission, no commitment.' },
      { question: '"What do I get out of it?"', reponse: 'Your guests stop asking you where to eat, and leave happy. If you want to go further later, we can talk.' },
      { question: '"We already cook here."', reponse: 'Exactly: once your kitchen closes, your guests have nothing left. The code works after your service, not during it.' },
    ],
    ecritSuffixe: `\n\nOur app: App Store and Play Store. Partner restaurants and ordering: ${LIEN_COMMANDER}\nReply on WhatsApp, it's easier for me: `,
    surPlace: `Hello, Christopher, Taxi Food. I'm dropping off flyers for your guests: evening meal delivery, ` +
      `with a discount in your name. Are you the person at reception?`,
  },
};

export type Script = {
  corps: string;
  objections: { question: string; reponse: string }[];
};

/** Le script à lire ou copier pour un canal donné, dans la langue probable de l'hôte. */
export function script(canal: string, langue: Langue, p: Prospect): Script {
  const t = TEXTES[langue];
  const prenom = prenomOuVide(p);
  const etab = etablissementDe(p);
  if (canal === 'whatsapp') return { corps: t.whatsapp(prenom, etab), objections: t.objections };
  if (canal === 'appel') return { corps: t.appel, objections: t.objections };
  if (canal === 'messenger' || canal === 'email') {
    return { corps: t.whatsapp(prenom, etab) + t.ecritSuffixe, objections: t.objections };
  }
  return { corps: t.surPlace, objections: t.objections };
}

export function chiffresTel(telephone: string | null | undefined): string | null {
  const c = (telephone ?? '').replace(/\D/g, '');
  return c.length >= 8 ? c : null;
}

export function lienWhatsApp(telephone: string | null | undefined, message: string): string | null {
  const c = chiffresTel(telephone);
  return c ? `https://wa.me/${c}?text=${encodeURIComponent(message)}` : null;
}

export function lienTel(telephone: string | null | undefined): string | null {
  const c = chiffresTel(telephone);
  return c ? `tel:+${c}` : null;
}

export function lienMessenger(facebookUrl: string | null | undefined): string | null {
  return facebookUrl ? facebookUrl : null;
}

export function lienMailto(email: string | null | undefined, sujet: string, corps: string): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

export function lienCarte(lat: number | string | null, lng: number | string | null): string | null {
  if (lat === null || lng === null) return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
}

/** Le libellé à afficher pour la prochaine action, avec sa date si elle est passée (en retard). */
export function libelleProchaineAction(p: Pick<Prospect, 'prochaine_action' | 'a_faire_le'>): string {
  if (!p.prochaine_action) return 'Rien à faire';
  if (!p.a_faire_le) return p.prochaine_action;
  const today = new Date().toISOString().slice(0, 10);
  if (p.a_faire_le <= today) return p.prochaine_action;
  const d = new Date(p.a_faire_le);
  const label = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  return `${p.prochaine_action} (à partir du ${label})`;
}

export function estEnRetard(p: Pick<Prospect, 'a_faire_le'>): boolean {
  if (!p.a_faire_le) return false;
  return p.a_faire_le <= new Date().toISOString().slice(0, 10);
}

export const CANAL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  appel: 'Appel',
  messenger: 'Messenger',
  email: 'E-mail',
  visite: 'Visite',
  flyers: 'Flyers',
  controle: 'Contrôle',
};

export const RESULTAT_LABEL: Record<string, string> = {
  pas_de_reponse: 'Pas de réponse',
  a_rappeler: 'À rappeler',
  interesse: 'Intéressé',
  accepte: 'Accepté',
  refus: 'Refus',
  absent: 'Absent',
  ferme: 'Fermé',
  mauvais_numero: 'Mauvais numéro',
  code_utilise: 'Code utilisé',
  code_dormant: 'Code dormant',
};
