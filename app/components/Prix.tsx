import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import { enPromo, pourcentRemise } from '../data/types';
import i18n from '../lib/i18n';

/**
 * Le prix d'un plat côté client : prix promo + ancien prix barré + badge « −10 % » quand une
 * promo court (table `promotions`, fin automatique), sinon le prix catalogue seul.
 *
 * ⚠️ Un seul rendu pour la ligne de carte, la fiche plat, l'Offre du jour et la rubrique
 * « Offres de la semaine » : deux écritures du prix barré finiraient par se contredire.
 * Le prix qui fait foi reste celui de la base (`prix_effectif` dans `create_order`).
 */
export function Prix({
  p,
  style,
  muted = false,
  badge = true,
}: {
  p: { price: number; promoPrice?: number | null; promoEnd?: string | null };
  style?: TextStyle;
  muted?: boolean;
  badge?: boolean;
}) {
  // Plat « à composer » (prix de base 0, le prix vient des pièces choisies) : jamais « 0 Ar ».
  if (p.price === 0 && !enPromo(p)) {
    return <Text style={[styles.prix, style, muted && styles.muted]}>{i18n.t('product.selonComposition')}</Text>;
  }
  if (!enPromo(p)) {
    return <Text style={[styles.prix, style, muted && styles.muted]}>{formatAr(p.price)}</Text>;
  }
  const promo = p.promoPrice as number;
  return (
    <View style={styles.ligne}>
      <Text style={[styles.prix, style, styles.promo, muted && styles.muted]}>{formatAr(promo)}</Text>
      <Text style={styles.barre}>{formatAr(p.price)}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTexte}>−{pourcentRemise(p.price, promo)} %</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  prix: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  promo: { color: colors.primary },
  muted: { color: colors.textFaint },
  barre: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeTexte: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.ink },
});
