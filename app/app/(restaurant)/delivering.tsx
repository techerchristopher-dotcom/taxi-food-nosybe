import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listRestaurantOrders, setOrderStatus } from '../../data/api';
import { Order, OrderStatus, RefusalCode } from '../../data/types';
import { RefuseSheet } from '../../components/RefuseSheet';
import { messageErreurCommandeResto } from '../../lib/erreurCommandeResto';
import { useLoad } from '../../lib/useLoad';
import { useSondage } from '../../lib/useSondage';
import { useSession } from '../../store/session';
import { useNonLus } from '../../lib/useNonLus';

// Commandes prêtes ou remises au livreur. Tant que le livreur ne l'a pas RÉCUPÉRÉE, le
// restaurant peut encore l'annuler, et la remettre « pas encore prête » si aucun livreur ne
// l'a prise (2026-10-19, après TF-439 restée coincée toute une nuit faute de ce bouton).
const DELIVERING: OrderStatus[] = ['en_livraison'];
const POLL_MS = 12000;

/** Espace restaurant — En livraison (suivi, lecture seule, rafraîchissement automatique). */
export default function RestaurantDeliveringScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');
  // `error` est lu : sans lui, une liaison coupée s'affichait « Aucune commande en
  // livraison » — la même contre-vérité que sur l'écran Commandes (voir le commentaire
  // détaillé dans `index.tsx`).
  const { data: orders, loading, error: erreurReseau, reload } = useLoad(
    () => listRestaurantOrders(DELIVERING, restaurantId),
    [restaurantId],
  );

  useSondage(reload, POLL_MS);
  const nonLus = useNonLus('restaurant');

  const list = orders ?? [];
  const [working, setWorking] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function advance(order: Order, status: OrderStatus, refus?: { code: RefusalCode; precision: string | null }) {
    setError(null);
    setWorking(order.id);
    try {
      await setOrderStatus(order.id, status, refus);
      setRefuseTarget(null);
    } catch (e) {
      setRefuseTarget(null);
      setError(messageErreurCommandeResto(e));
    } finally {
      setWorking(null);
      reload();
    }
  }

  return (
    <View style={styles.container}>
      <RestaurantHeader title="En livraison" />

      {/* Au-dessus du branchement : la liste peut être vide au moment où la liaison
          tombe, et « Aucune commande en livraison » serait alors trompeur. */}
      {erreurReseau && orders ? (
        <Text style={styles.warn}>
          Connexion perdue — cette liste date de votre dernier rafraîchissement réussi.
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : erreurReseau && !orders ? (
        <View style={styles.center}>
          <Icon name="cloud_off" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Liste indisponible</Text>
          <Text style={styles.emptySub}>
            Impossible de joindre Taxi Food. Vérifiez votre connexion — l'app réessaie
            toute seule.
          </Text>
          <View style={{ height: 6 }} />
          <Button label="Réessayer" icon="refresh" onPress={reload} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Icon name="two_wheeler" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Aucune commande en livraison</Text>
          <Text style={styles.emptySub}>Les commandes marquées « prêtes » apparaissent ici pendant leur transit.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {list.map((order) => (
            <RestaurantOrderCard
              key={order.id}
              order={order}
              messagerie={{ role: 'restaurant', nonLus: nonLus[order.id] ?? 0 }}
              footer={
                order.pickedUpAt ? null : (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.note}>
                      {order.courierId
                        ? 'Un livreur vient la chercher. Tu peux encore l’annuler tant qu’il ne l’a pas récupérée.'
                        : 'En attente d’un livreur. Marquée prête par erreur ? Remets-la en préparation.'}
                    </Text>
                    <View style={styles.actionRow}>
                      <Button label="Annuler" variant="outline" onPress={() => setRefuseTarget(order)} disabled={working === order.id} style={{ flex: 1 }} />
                      {order.courierId ? null : (
                        <Button
                          label="Pas encore prête"
                          icon="undo"
                          variant="outline"
                          onPress={() => advance(order, 'en_preparation')}
                          loading={working === order.id}
                          style={{ flex: 1.4 }}
                        />
                      )}
                    </View>
                  </View>
                )
              }
            />
          ))}
        </ScrollView>
      )}
      <RefuseSheet
        visible={!!refuseTarget}
        orderNumber={refuseTarget?.orderNumber}
        submitting={!!refuseTarget && working === refuseTarget.id}
        onCancel={() => setRefuseTarget(null)}
        onConfirm={(refus) => refuseTarget && advance(refuseTarget, 'annulee', refus)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center', marginTop: 12, paddingHorizontal: spacing.screen },
  note: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  actionRow: { flexDirection: 'row', gap: 10 },
  warn: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warnTextAlt,
    backgroundColor: colors.warnBg,
    paddingVertical: 10,
    paddingHorizontal: spacing.screen,
    textAlign: 'center',
  },
});
