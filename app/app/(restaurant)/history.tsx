import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listRestaurantOrders } from '../../data/api';
import { OrderStatus } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

// Commandes terminées : livrées ou refusées. Lecture seule.
const DONE: OrderStatus[] = ['livree', 'annulee'];

/** Espace restaurant — Historique (plus récent en premier, lecture seule). */
export default function RestaurantHistoryScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');
  const { data: orders, loading } = useLoad(() => listRestaurantOrders(DONE, restaurantId), [restaurantId]);
  const list = orders ?? [];

  return (
    <View style={styles.container}>
      <RestaurantHeader title="Historique" />

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Icon name="history" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Pas encore d'historique</Text>
          <Text style={styles.emptySub}>Les commandes livrées ou refusées apparaîtront ici.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {list.map((order) => (
            <RestaurantOrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
});
