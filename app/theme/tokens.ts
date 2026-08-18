/**
 * Design system — Taxi Food
 * Jetons extraits fidèlement de la maquette Claude Design (design/taxi-food-deck/_parts.json).
 * Ne pas inventer de valeurs : toute couleur/rayon/espacement vient des styles inline de la maquette.
 */

export const colors = {
  // Marque
  primary: '#E8342A', // rouge
  secondary: '#FF8A1E', // orange
  accent: '#FFC72C', // jaune

  // Encre & texte
  ink: '#1A1A1A', // quasi-noir (titres, barres sombres)
  textDark: '#4A4744', // texte courant foncé
  textMuted: '#8A8580', // texte secondaire
  textFaint: '#B4AFA9', // texte/icône désactivé

  // Surfaces
  bg: '#F5F2EF', // fond crème de l'app
  surface: '#FFFFFF',
  border: '#E9E5E0',
  borderStrong: '#DCD8D3',
  divider: '#F0EDE9',
  fieldBg: '#F5F2EF',

  // Sémantique
  success: '#16A34A',
  successDark: '#15803D',
  successBg: '#E7F6EC',
  warnBg: '#FFF3E2',
  warnText: '#8A5A12',
  warnTextAlt: '#B4620A',
  dangerBg: '#FDECEB',
  dangerText: '#C42419',

  // Accents chauds pour les vignettes produits (placeholder rayé)
  photoWarmA: '#FFE9CF',
  photoWarmB: '#FFDCB2',
  photoWarmText: '#A9743C',
  photoGrayA: '#EEE9E4',
  photoGrayB: '#E4DED8',

  white: '#FFFFFF',
} as const;

/** Familles de polices (chargées via expo-font dans app/_layout.tsx). */
export const fonts = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  extrabold: 'Archivo_800ExtraBold',
  // Labels techniques, prix, badges numériques
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Rayons de bordure observés dans la maquette. */
export const radius = {
  sm: 5,
  input: 12,
  tile: 14, // vignettes produits
  lg: 16,
  card: 20,
  sheet: 28,
  hero: 26, // en-têtes arrondis
  iconTile: 30,
  pill: 999,
  phone: 44,
} as const;

export const spacing = {
  screen: 20, // marge horizontale standard des écrans
  gap: 12,
} as const;

/** Ombres — mappées iOS/Android à partir des box-shadow de la maquette. */
export const shadow = {
  card: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  button: {
    shadowColor: '#E8342A',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  floating: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.32,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/**
 * Applique une opacité à une couleur hex du design system : `withAlpha(colors.primary, 0.1)`.
 * Sert aux fonds teintés dérivés d'une couleur de marque — on ne fige pas une nouvelle
 * couleur dans la palette pour un simple voile.
 */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** Formate un montant en ariary avec séparateur d'espace : 78000 -> "78 000 Ar". */
export function formatAr(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
}
