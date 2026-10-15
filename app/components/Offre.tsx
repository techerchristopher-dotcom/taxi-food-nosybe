import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Prix } from './Prix';
import { Offre } from '../data/api';
import { imageUrl, pourcentRemise } from '../data/types';
import { FUSEAU_NOSY_BE, libelleOuverture } from '../lib/ouverture';
import { colors, fonts, radius, shadow } from '../theme/tokens';

/**
 * 🏷️ « Offres de la semaine » — un plat en promo (table `promotions`, fin automatique).
 *
 * La carte montre la PHOTO du plat, le badge « −10 % », le prix barré et la date de fin :
 * le client doit comprendre en un coup d'œil que c'est temporaire. Un restaurant fermé reste
 * touchable (on ouvre la fiche du plat pour préparer sa commande), avec son heure d'ouverture.
 */
export function CarteOffre({ o, width, onPress }: { o: Offre; width: number; onPress: () => void }) {
  const { t, i18n } = useTranslation();
  const hauteur = Math.round(width * 0.56);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.carte, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${o.name} — ${o.restaurantName} — −${pourcentRemise(o.price, o.promoPrice)} %`}
    >
      <View style={[styles.photo, { height: hauteur }]}>
        {o.photoUrl ? (
          <Image source={{ uri: imageUrl(o.photoUrl, Math.round(width * 1.5), Math.round(hauteur * 1.5)) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeTexte}>−{pourcentRemise(o.price, o.promoPrice)} %</Text>
        </View>
        {!o.isOpen ? (
          <View style={styles.pastilleFermee}>
            <Text style={styles.pastilleFermeeTexte} numberOfLines={1}>{libelleOuverture(o, t)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.corps}>
        <Text style={styles.nom} numberOfLines={1}>{o.name}</Text>
        <Text style={styles.sous} numberOfLines={1}>{o.restaurantName}</Text>
        <View style={styles.basLigne}>
          <Prix p={{ price: o.price, promoPrice: o.promoPrice, promoEnd: o.fin }} style={styles.prix} badge={false} />
        </View>
        <View style={styles.finLigne}>
          <Icon name="schedule" size={14} color={colors.secondary} />
          <Text style={styles.fin} numberOfLines={1}>{t('offres.jusquA', { jour: jourDeFin(o.fin, i18n.language) })}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Le dernier jour de la promo, en toutes lettres, à l'heure de Nosy Be. Une promo qui finit à
 * 0 h le lundi se termine DIMANCHE : on retire une minute avant de nommer le jour.
 */
function jourDeFin(fin: string, langue: string): string {
  const d = new Date(new Date(fin).getTime() - 60_000);
  try {
    return new Intl.DateTimeFormat(langue || 'fr', { weekday: 'long', timeZone: FUSEAU_NOSY_BE }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

const styles = StyleSheet.create({
  carte: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', ...shadow.card },
  photo: { overflow: 'hidden', backgroundColor: colors.photoWarmB },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeTexte: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  pastilleFermee: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,26,26,0.82)',
  },
  pastilleFermeeTexte: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
  corps: { padding: 12, paddingTop: 10, gap: 2 },
  nom: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sous: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  basLigne: { marginTop: 4 },
  prix: { fontSize: 18, fontFamily: fonts.extrabold },
  finLigne: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  fin: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary },
});
