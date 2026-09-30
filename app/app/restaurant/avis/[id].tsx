import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Etoiles, formatNote } from '../../../components/Etoiles';
import { Icon } from '../../../components/Icon';
import { Card } from '../../../components/primitives';
import { colors, fonts, radius, spacing } from '../../../theme/tokens';
import { getRestaurant, listAvisRestaurant } from '../../../data/api';
import { useLoad } from '../../../lib/useLoad';

/** JJ/MM/AAAA sans dépendre d'Intl. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Les avis d'un restaurant — `/restaurant/avis/[id]`.
 *
 * Lecture publique (RPC `avis_restaurant`) : prénom figé, trois notes, commentaire,
 * date, réponse du restaurant. Rien d'autre ne sort de la base. La note d'en-tête
 * est celle du catalogue (`note_moyenne`, null sous trois avis).
 */
export default function AvisRestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const { data: restaurant } = useLoad(() => getRestaurant(id!), [id]);
  const { data: avis, loading, error } = useLoad(() => listAvisRestaurant(id!, 50), [id]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Icon name="arrow_back" size={22} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('avis.ecranTitre')}</Text>
            {restaurant ? <Text style={styles.headerSub}>{restaurant.name}</Text> : null}
          </View>
        </View>
        {restaurant ? (
          <View style={styles.noteBanner}>
            {restaurant.noteMoyenne != null ? (
              <>
                <Text style={styles.noteGrosse}>{formatNote(restaurant.noteMoyenne, i18n.language)}</Text>
                <View>
                  <Etoiles valeur={restaurant.noteMoyenne} taille={18} />
                  <Text style={styles.noteSub}>
                    {t('avis.noteRestaurant')} · {t('avis.nombre', { count: restaurant.nbAvis })}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.noteSub}>
                {restaurant.nbAvis > 0
                  ? `${t('avis.pasAssez')} · ${t('avis.nombre', { count: restaurant.nbAvis })}`
                  : t('avis.pasAssez')}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24, gap: 10 }} showsVerticalScrollIndicator={false}>
        {loading && !avis ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.vide}>{t('avis.erreurChargement')}</Text>
        ) : !avis || avis.length === 0 ? (
          <Text style={styles.vide}>{t('avis.aucun')}</Text>
        ) : (
          avis.map((a) => (
            <Card key={a.id}>
              <View style={styles.avisHead}>
                <Text style={styles.prenom}>{a.prenom}</Text>
                <Text style={styles.date}>{dateCourte(a.createdAt)}</Text>
              </View>
              <Etoiles valeur={a.noteRestaurant} taille={18} style={{ marginTop: 4 }} />
              <Text style={styles.detail}>
                {t('avis.cuisine')} {a.noteCuisine}/5 · {t('avis.preparation')} {a.notePreparation}/5 · {t('avis.livraison')} {a.noteLivraison}/5
              </Text>
              {a.commentaire ? <Text style={styles.commentaire}>{a.commentaire}</Text> : null}
              {a.photoUrl ? <Image source={{ uri: a.photoUrl }} style={styles.photo} contentFit="cover" /> : null}
              {a.reponseRestaurant ? (
                <View style={styles.reponse}>
                  <Text style={styles.reponseLabel}>{t('avis.reponse')}</Text>
                  <Text style={styles.reponseTexte}>{a.reponseRestaurant}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.ink, paddingHorizontal: spacing.screen, paddingBottom: 18 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.white },
  headerSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  noteBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  noteGrosse: { fontFamily: fonts.extrabold, fontSize: 34, color: colors.white },
  noteSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  vide: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  avisHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  prenom: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  date: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  detail: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 6 },
  commentaire: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 8 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, marginTop: 10, backgroundColor: colors.fieldBg },
  reponse: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accent },
  reponseLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  reponseTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDark, marginTop: 2 },
});
