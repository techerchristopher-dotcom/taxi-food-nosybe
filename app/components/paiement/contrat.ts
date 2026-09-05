/**
 * Contrat commun aux deux implémentations du formulaire de carte.
 *
 * Le SDK Stripe n'est pas le même selon la plateforme, et Stripe l'a dit
 * explicitement : `@stripe/stripe-react-native` ne supportera jamais le web
 * (stripe/stripe-react-native#1556). D'où deux fichiers :
 *
 *   FormulaireCarte.tsx      → natif  : PaymentSheet (@stripe/stripe-react-native)
 *   FormulaireCarte.web.tsx  → web    : Payment Element (@stripe/react-stripe-js)
 *
 * ⚠️ CE FICHIER EST CE QUI EMPÊCHE LE BUNDLE WEB DE CASSER. Metro choisit
 * l'extension `.web.tsx` avant `.tsx` : le module natif n'entre donc jamais dans
 * `expo export --platform web`, qui alimente taxifood.distripro207.com. Le jour
 * où quelqu'un importe `@stripe/stripe-react-native` ailleurs qu'ici, sans
 * jumeau `.web`, l'export web échoue. Le composant est placé HORS de `app/`
 * exprès : dans `app/`, expo-router exige aussi une version sans suffixe et
 * traiterait chaque fichier comme une route.
 */

export type ResultatPaiement =
  /**
   * Le client a confirmé sur son appareil. ⚠️ CELA NE VEUT PAS DIRE PAYÉ.
   * Seul le webhook Stripe, vérifié par signature côté serveur, fait foi. Ce
   * résultat autorise seulement à passer à l'écran d'attente du verdict.
   */
  | { etat: 'confirme_cote_client' }
  /** Le client a fermé la feuille de paiement. Rien n'a été débité. */
  | { etat: 'annule' }
  /** Refus de la banque, carte expirée, 3-D Secure abandonné… */
  | { etat: 'echoue'; message: string }
  /**
   * Le paiement est parti mais Stripe le tient encore en cours (authentification
   * en attente, virement différé). Ni payé ni raté : il faut le dire au client.
   */
  | { etat: 'en_cours' };

export type ProprietesFormulaireCarte = {
  /** Secret de confirmation renvoyé par `creer-paiement`. Ne jamais journaliser. */
  clientSecret: string;
  /** Clé publiable Stripe, servie par le Vault via l'Edge Function. */
  publishableKey: string;
  /** Montant exact à débiter, en unité mineure (centimes). Calculé en base. */
  montantMineur: number;
  /** Devise du prélèvement (`eur`). */
  devise: string;
  /** Libellé du bouton, déjà traduit et déjà formaté (« Payer 12,07 € »). */
  libelleBouton: string;
  /** Appelé une fois, avec le verdict côté client. */
  onResultat: (r: ResultatPaiement) => void;
  /** Vrai pendant que l'écran attend le verdict serveur : le bouton se verrouille. */
  occupe?: boolean;
};
