import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { Card } from '../components/primitives';
import { colors, fonts, spacing } from '../theme/tokens';
import { mesAvisEnAttente } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { useSession } from '../store/session';

/** Jours restants (arrondi au-dessus) avant la fin du délai de 7 jours. */
function joursRestants(limite: string): number {
  return Math.max(0, Math.ceil((new Date(limite).getTime() - Date.now()) / 86_400_000));
}

/**
 * Avis en attente (2026-10-07) : les commandes que le client peut encore noter pour gagner
 * 1 000 Ar chacune. La liste vient de la base (`mes_avis_en_attente`, mêmes règles que
 * `deposer_avis`) : une commande affichée ici est une commande que la base acceptera.
 * Au tap : le suivi de la commande, où se trouve le bloc d'avis.
 */
export default function AvisEnAttenteScreen() {
  const session = useSession((s) => s.session);
  // Sans compte, il n'y a rien à noter : la page Porte-monnaie explique et propose la connexion.
  if (!session) return <Redirect href="/porte-monnaie" />;
  return <Liste />;
}

function Liste() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, loading, error } = useLoad(() => mesAvisEnAttente(), []);

  return (
    <View style={styles.container}>
      <Header title={t('avisEnAttente.titre')} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32, gap: 12 }}>
        <Text style={styles.intro}>{t('avisEnAttente.intro')}</Text>
        {loading && !data ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        ) : error && !data ? (
          <Text style={styles.vide}>{t('avisEnAttente.erreur')}</Text>
        ) : (data ?? []).length === 0 ? (
          <Text style={styles.vide}>{t('avisEnAttente.vide')}</Text>
        ) : (
          (data ?? []).map((a) => (
            <Pressable key={a.orderId} onPress={() => router.push(`/order/${a.orderId}?noter=1`)}>
              <Card style={styles.ligne}>
                <Text style={styles.etoile}>⭐</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resto} numberOfLines={1}>{a.restaurant}</Text>
                  <Text style={styles.detail}>
                    {t('avisEnAttente.commande', { numero: a.numero })} ·{' '}
                    {t('avisEnAttente.joursRestants', { count: joursRestants(a.limiteLe) })}
                  </Text>
                </View>
                <View style={styles.gain}>
                  <Text style={styles.gainTexte}>+1 000 Ar</Text>
                </View>
                <Icon name="chevron_right" size={20} color={colors.textFaint} />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  vide: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textMuted, marginTop: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etoile: { fontSize: 22 },
  resto: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  detail: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  gain: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  gainTexte: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
});
