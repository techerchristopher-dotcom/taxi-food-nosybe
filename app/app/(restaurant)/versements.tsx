import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Card } from '../../components/primitives';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { colors, fonts, formatAr, spacing } from '../../theme/tokens';
import { mesVersements } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { dateCourte, textesReversement } from '../../lib/textesReversement';
import { useSession } from '../../store/session';

/**
 * Espace restaurant — « Mes versements » (2026-10-12), ouvert depuis les Réglages.
 * Un versement de Taxi Food par ligne : date, référence Orange Money, montant, et les
 * commandes qu'il paie. Lu par `mes_versements` (staff du restaurant seulement).
 * Pas un onglet : `href: null` dans `_layout.tsx`.
 */
export default function VersementsScreen() {
  const router = useRouter();
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');
  const { data, loading, error } = useLoad(
    () => (restaurantId ? mesVersements(restaurantId) : Promise.resolve([])),
    [restaurantId],
  );
  const liste = data ?? [];
  const t = textesReversement(liste[0]?.langue);

  return (
    <View style={styles.container}>
      <RestaurantHeader title={t.mesVersements} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} style={styles.retour} accessibilityRole="button">
          <Icon name="arrow_back" size={18} color={colors.textDark} />
          <Text style={styles.retourTexte}>{t.retour}</Text>
        </Pressable>
        <Text style={styles.intro}>{t.mesVersementsTexte}</Text>
        {loading && !data ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : error && !data ? (
          <Text style={styles.vide}>{error}</Text>
        ) : liste.length === 0 ? (
          <Text style={styles.vide}>{t.aucunVersement}</Text>
        ) : (
          liste.map((v) => (
            <Card key={v.id} style={styles.carte}>
              <View style={styles.tete}>
                <Icon name="check_circle" size={20} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.titre}>{t.reverse(dateCourte(v.payeLe))}</Text>
                  {v.reference ? <Text style={styles.ref}>{t.ref} {v.reference}</Text> : null}
                </View>
                <Text style={styles.montant}>{formatAr(v.montant)}</Text>
              </View>
              <Text style={styles.commandes}>
                {t.commandes(v.nbCommandes || v.numeros.length)} : {v.numeros.join(', ')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  retour: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  retourTexte: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark },
  intro: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  vide: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  carte: { marginBottom: 10 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titre: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  ref: { fontFamily: fonts.monoBold ?? fonts.semibold, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  montant: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.success },
  commandes: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textDark, marginTop: 8, marginLeft: 30 },
});
