import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { CourierHeader } from '../../components/CourierHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listMyDeliveries } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

/** Espace livreur — Historique de mes livraisons (livree, lecture seule). */
export default function CourierHistoryScreen() {
  const userId = useSession((s) => s.session?.userId ?? '');
  const { data: orders, loading } = useLoad(() => listMyDeliveries(userId), [userId]);
  const list = orders ?? [];

  return (
    <View style={styles.container}>
      <CourierHeader title="Mes livraisons" />

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Icon name="history" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Pas encore de livraison</Text>
          <Text style={styles.emptySub}>Tes livraisons terminées apparaîtront ici.</Text>
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
