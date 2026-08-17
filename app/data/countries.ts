/**
 * Indicatifs téléphoniques proposés à l'inscription / connexion.
 *
 * Nosy Be est une destination touristique : les clients ne sont pas tous malgaches.
 * La Réunion (+262) en particulier représente une part importante des visiteurs, et un
 * indicatif figé à +261 leur interdisait purement et simplement de créer un compte.
 *
 * `minDigits` / `maxDigits` = longueur du numéro NATIONAL (sans l'indicatif, sans le 0
 * de tête). La validation s'adapte donc au pays choisi : un numéro réunionnais à 9
 * chiffres n'est plus refusé par une règle pensée pour Telma/Orange/Airtel.
 */
export type Country = {
  /** Code ISO 3166-1 alpha-2 — clé stable (plusieurs pays partagent un indicatif). */
  code: string;
  name: string;
  flag: string;
  /** Indicatif avec le +. */
  dial: string;
  minDigits: number;
  maxDigits: number;
  /** Exemple de numéro national, affiché en placeholder. */
  example: string;
};

/** Madagascar en tête : c'est le cas par défaut et le plus fréquent. */
export const COUNTRIES: Country[] = [
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', dial: '+261', minDigits: 9, maxDigits: 9, example: '32 45 678 90' },
  { code: 'RE', name: 'La Réunion', flag: '🇷🇪', dial: '+262', minDigits: 9, maxDigits: 9, example: '692 12 34 56' },
  { code: 'YT', name: 'Mayotte', flag: '🇾🇹', dial: '+262', minDigits: 9, maxDigits: 9, example: '639 12 34 56' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '+33', minDigits: 9, maxDigits: 9, example: '6 12 34 56 78' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', dial: '+39', minDigits: 9, maxDigits: 11, example: '312 345 6789' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', dial: '+32', minDigits: 8, maxDigits: 9, example: '470 12 34 56' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', dial: '+41', minDigits: 9, maxDigits: 9, example: '78 123 45 67' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', dial: '+49', minDigits: 10, maxDigits: 11, example: '151 23456789' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', dial: '+44', minDigits: 10, maxDigits: 10, example: '7400 123456' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', dial: '+34', minDigits: 9, maxDigits: 9, example: '612 34 56 78' },
  { code: 'US', name: 'États-Unis / Canada', flag: '🇺🇸', dial: '+1', minDigits: 10, maxDigits: 10, example: '415 555 0123' },
  { code: 'MU', name: 'Maurice', flag: '🇲🇺', dial: '+230', minDigits: 7, maxDigits: 8, example: '5251 2345' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', dial: '+248', minDigits: 7, maxDigits: 7, example: '251 2345' },
  { code: 'KM', name: 'Comores', flag: '🇰🇲', dial: '+269', minDigits: 7, maxDigits: 7, example: '321 2345' },
  { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', dial: '+27', minDigits: 9, maxDigits: 9, example: '71 234 5678' },
];

/** Pays par défaut : Madagascar. */
export const DEFAULT_COUNTRY = COUNTRIES[0];

export function findCountry(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}

/**
 * Numéro national nettoyé : chiffres seuls, sans le 0 de tête que beaucoup de gens
 * tapent par réflexe (`06…` en France, `032…` à Madagascar) — l'indicatif le remplace.
 */
export function nationalDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

/** Numéro au format E.164 (`+261324567890`), seul format accepté par Supabase Auth. */
export function toE164(country: Country, input: string): string {
  return country.dial + nationalDigits(input);
}

/** Le numéro saisi est-il plausible pour le pays choisi ? */
export function isValidNumber(country: Country, input: string): boolean {
  const n = nationalDigits(input).length;
  return n >= country.minDigits && n <= country.maxDigits;
}
