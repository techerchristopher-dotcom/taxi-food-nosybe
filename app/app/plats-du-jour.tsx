import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { ProductThumb } from '../components/ProductThumb';
import { LignePlatDuJour, libelleOuverture } from '../components/PlatDuJour';
import { listPlatsDuJour, PlatDuJour } from '../data/api';
import { initialsFromName } from '../data/types';
import { useLoad } from '../lib/useLoad';
import { colors, fonts, radius, spacing } from '../theme/tokens';

/**
 * « Voir tout » — tous les plats du jour de l'île, GROUPÉS PAR RESTAURANT.
 *
 * ⚠️ Le groupement n'est pas cosmétique : le panier est MONO-RESTAURANT
 * (`cart.ts`, `canAdd`). Une liste à plat inviterait à composer une commande
 * qui mélange deux établissements, et le client se cognerait au deuxième plat.
 * Même raisonnement que la page de partage d'une sélection (`/s/`).
 *
 * ⚠️ L'ORDRE VIENT DE LA BASE et n'est pas recalculé ici : la RPC rend déjà les
 * restaurants ouverts d'abord, puis l'ordre du catalogue. Le regroupement se
 * fait donc dans l'ordre d'arrivée — une `Map` conserve l'ordre d'insertion,
 * c'est exactement ce qu'il faut.
 */
export default function PlatsDuJourScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: plats, loading, error } = useLoad(() => listPlatsDuJour(), []);

  const groupes = useMemo(() => {
    const parResto = new Map<string, { resto: PlatDuJour; plats: PlatDuJour[] }>();
    for (const p of plats ?? []) {
      const g = parResto.get(p.restaurantId);
      if (g) g.plats.push(p);
      else parResto.set(p.restaurantId, { resto: p, plats: [p] });
    }
    return [...parResto.values()];
  }, [plats]);

  return (
    <View style={styles.container}>
      <Header title={t('platsDuJour.title')} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>{t('platsDuJour.intro')}</Text>

        {loading && !plats ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <Text style={styles.vide}>{t('platsDuJour.error')}</Text>
        ) : groupes.length === 0 ? (
          /* ⚠️ État vide PROPRE, et pas une page blanche : aucun plat du jour
             est un état normal (les restaurateurs décrochent leur affiche). On
             renvoie vers le catalogue, qui, lui, n'est jamais vide. */
          <View style={styles.videBloc}>
            <Text style={styles.videTitre}>{t('platsDuJour.emptyTitle')}</Text>
            <Text style={styles.vide}>{t('platsDuJour.empty')}</Text>
            <Pressable style={styles.videBouton} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.videBoutonTexte}>{t('platsDuJour.emptyCta')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 22 }}>
            {groupes.map(({ resto, plats: liste }) => {
              const ferme = !resto.isOpen;
              return (
                <View key={resto.restaurantId} style={{ gap: 10 }}>
                  <Pressable
                    style={styles.entete}
                    onPress={() => router.push(`/restaurant/${resto.restaurantId}`)}
                    accessibilityRole="button"
                  >
                    <ProductThumb
                      uri={resto.restaurantLogoUrl}
                      size={40}
                      radius={12}
                      muted={ferme}
                      initials={initialsFromName(resto.restaurantName)}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.restoNom} numberOfLines={1}>
                        {resto.restaurantName}
                      </Text>
                      <Text style={styles.restoSous} numberOfLines={1}>
                        {[resto.restaurantCuisine, resto.restaurantZone].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={[styles.etat, ferme ? styles.etatFerme : styles.etatOuvert]}>
                      <Text style={[styles.etatTexte, ferme ? styles.etatTexteFerme : styles.etatTexteOuvert]}>
                        {ferme ? libelleOuverture(resto, t) : t('restaurantCard.open')}
                      </Text>
                    </View>
                    <Icon name="chevron_right" size={18} color={colors.textFaint} />
                  </Pressable>

                  <View style={{ gap: 8 }}>
                    {liste.map((p) => (
                      <LignePlatDuJour
                        key={p.id}
                        p={p}
                        onPress={() => router.push(`/product/${p.id}`)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, marginBottom: 18 },
  center: { paddingVertical: 60, alignItems: 'center' },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restoNom: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  restoSous: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  etat: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  etatOuvert: { backgroundColor: colors.successBg },
  etatFerme: { backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border },
  etatTexte: { fontFamily: fonts.semibold, fontSize: 11 },
  etatTexteOuvert: { color: colors.successDark },
  etatTexteFerme: { color: colors.textDark },
  videBloc: { gap: 10, alignItems: 'center', paddingVertical: 40 },
  videTitre: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  vide: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  videBouton: {
    marginTop: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videBoutonTexte: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
});
