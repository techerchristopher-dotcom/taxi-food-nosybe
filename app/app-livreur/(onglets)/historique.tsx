import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { EnTeteLivreur } from '../../components/livreur/EnTeteLivreur';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import { listMyDeliveries } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';
import { recapDuJour } from '../../lib/livreur/outils';

/**
 * Historique : le récapitulatif du jour (livraisons, espèces encaissées à remettre à
 * Taxi Food, Orange Money à vérifier), puis les livraisons terminées.
 * ⚠️ La rémunération du livreur n'est pas tranchée : rien ici ne parle de ce qu'il gagne.
 */
export default function Historique() {
  const userId = useSession((s) => s.session?.userId ?? '');
  const { data: orders, loading, reload } = useLoad(() => listMyDeliveries(userId), [userId]);
  const [tirage, setTirage] = useState(false);
  const list = orders ?? [];
  const recap = recapDuJour(list);

  return (
    <View style={styles.container}>
      <EnTeteLivreur title="Historique" />
      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={tirage}
              onRefresh={async () => {
                setTirage(true);
                await reload();
                setTirage(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.recap}>
            <Text style={styles.recapTitre}>Aujourd’hui</Text>
            <View style={styles.tuiles}>
              <View style={styles.tuile}>
                <Text style={styles.valeur}>{recap.livraisons}</Text>
                <Text style={styles.libelle}>livraison{recap.livraisons > 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.tuile}>
                <Text style={[styles.valeur, { color: colors.primary }]}>{formatAr(recap.especes)}</Text>
                <Text style={styles.libelle}>espèces à remettre ({recap.especesCommandes})</Text>
              </View>
            </View>
            {recap.orangeMoneyCommandes > 0 ? (
              <Text style={styles.note}>
                📱 Orange Money : {formatAr(recap.orangeMoney)} sur {recap.orangeMoneyCommandes} commande
                {recap.orangeMoneyCommandes > 1 ? 's' : ''}, vérifié par Taxi Food (rien à remettre).
              </Text>
            ) : null}
            {recap.carte > 0 ? <Text style={styles.note}>💳 {recap.carte} payée(s) par carte : rien à remettre.</Text> : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.center}>
              <Icon name="history" size={40} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>Pas encore de livraison</Text>
              <Text style={styles.emptySub}>Tes livraisons terminées apparaîtront ici.</Text>
            </View>
          ) : (
            list.map((order) => <RestaurantOrderCard key={order.id} order={order} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  recap: {
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  recapTitre: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tuiles: { flexDirection: 'row', gap: 12 },
  tuile: { flex: 1, backgroundColor: colors.bg, borderRadius: 14, padding: 12 },
  valeur: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  libelle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textDark },
});
