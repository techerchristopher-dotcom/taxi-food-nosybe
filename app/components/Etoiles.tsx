import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';

/**
 * Étoiles de notation — en lecture (`valeur` seule) ou en saisie (`onChange`).
 *
 * 1 à 5, jamais 0 : « 0 étoile » n'existe nulle part ailleurs, un client ne le
 * comprendrait pas. Une valeur nulle = « pas encore noté », rendue en étoiles vides.
 * En lecture, la moyenne s'arrondit à la demi-étoile : 4,3 → 4 pleines ; 4,5 → 4 et
 * demie ; 4,8 → 5. Même règle que Google.
 */
export function Etoiles({
  valeur,
  onChange,
  taille = 22,
  couleur = colors.accent,
  vide = colors.photoGrayB,
  style,
}: {
  valeur: number | null;
  onChange?: (n: number) => void;
  taille?: number;
  couleur?: string;
  vide?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const v = valeur ?? 0;
  return (
    <View style={[styles.row, style]} accessibilityRole={onChange ? 'adjustable' : 'image'}
      accessibilityLabel={valeur == null ? undefined : t('avis.a11y', { n: valeur })}>
      {[1, 2, 3, 4, 5].map((i) => {
        const nom = v >= i ? 'star' : v >= i - 0.5 ? 'star_half' : 'star_outline';
        const pleine = nom !== 'star_outline';
        const etoile = <Icon name={nom} size={taille} color={pleine ? couleur : vide} />;
        if (!onChange) return <View key={i}>{etoile}</View>;
        return (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} accessibilityRole="button"
            accessibilityLabel={t('avis.a11y', { n: i })}>
            {etoile}
          </Pressable>
        );
      })}
    </View>
  );
}

/** « 4,6 » ou « 4.6 » selon la langue — sans dépendre d'Intl, absent de certains Hermes. */
export function formatNote(note: number, langue: string): string {
  const s = note.toFixed(1);
  return langue.startsWith('en') ? s : s.replace('.', ',');
}

/** « ★ 4,6 (32) » — la note d'un restaurant sur une ligne meta. Rien sous trois avis. */
export function NoteCompacte({ note, nb, taille = 12 }: { note: number | null; nb: number; taille?: number }) {
  const { i18n } = useTranslation();
  if (note == null) return null;
  return (
    <View style={styles.compacte}>
      <Icon name="star" size={taille + 3} color={colors.accent} />
      <Text style={[styles.compacteTexte, { fontSize: taille }]}>
        {formatNote(note, i18n.language)}
        {nb > 0 ? ` (${nb})` : ''}
      </Text>
    </View>
  );
}

/**
 * Pastille de note pour les cartes de l'accueil (2026-10-07) : « ★ 4,7 · 3 avis » sur fond
 * jaune, bien plus visible que la note compacte en texte gris. Rien sans note.
 */
export function NotePastille({ note, nb }: { note: number | null; nb: number }) {
  const { t, i18n } = useTranslation();
  if (note == null) return null;
  return (
    <View style={styles.pastille}>
      <Icon name="star" size={15} color={colors.ink} />
      <Text style={styles.pastilleNote}>{formatNote(note, i18n.language)}</Text>
      {nb > 0 ? <Text style={styles.pastilleNb}>· {t('avis.nombre', { count: nb })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  compacte: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  compacteTexte: { fontFamily: fonts.semibold, color: colors.textDark },
  pastille: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  pastilleNote: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.ink },
  pastilleNb: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
});
