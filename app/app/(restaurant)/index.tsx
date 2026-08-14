import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { RefuseSheet } from '../../components/RefuseSheet';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listRestaurantOrders, setOrderStatus } from '../../data/api';
import { Order, OrderStatus } from '../../data/types';
import { useLoad } from '../../lib/useLoad';

// Statuts « actifs » : demandent une action ou un suivi. en_livraison sort de la liste.
const ACTIVE: OrderStatus[] = ['recue', 'confirmee', 'en_preparation'];
const POLL_MS = 12000;

/** Espace restaurant — Commandes en cours (rafraîchissement automatique). */
export default function RestaurantOrdersScreen() {
  const { data: orders, loading, reload } = useLoad(() => listRestaurantOrders(ACTIVE), []);

  // Rafraîchissement automatique tant que l'écran est monté (pas de push en V1).
  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const [working, setWorking] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function advance(order: Order, status: OrderStatus, reason?: string) {
    setError(null);
    setWorking(order.id);
    try {
      await setOrderStatus(order.id, status, reason);
      setRefuseTarget(null);
      await reload();
    } catch {
      setError("Action impossible. La commande a peut-être changé — la liste se rafraîchit.");
      await reload();
    } finally {
      setWorking(null);
    }
  }

  const list = orders ?? [];

  return (
    <View style={styles.container}>
      <RestaurantHeader title="Commandes en cours" />

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Icon name="inbox" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Aucune commande en cours</Text>
          <Text style={styles.emptySub}>Les nouvelles commandes apparaissent ici automatiquement.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {list.map((order) => (
            <RestaurantOrderCard
              key={order.id}
              order={order}
              footer={<OrderActions order={order} busy={working === order.id} onAdvance={advance} onRefuse={setRefuseTarget} />}
            />
          ))}
        </ScrollView>
      )}

      <RefuseSheet
        visible={!!refuseTarget}
        orderNumber={refuseTarget?.orderNumber}
        submitting={!!refuseTarget && working === refuseTarget.id}
        onCancel={() => setRefuseTarget(null)}
        onConfirm={(reason) => refuseTarget && advance(refuseTarget, 'annulee', reason)}
      />
    </View>
  );
}

/** Boutons d'action selon le statut courant (seules les transitions valides sont offertes). */
function OrderActions({
  order,
  busy,
  onAdvance,
  onRefuse,
}: {
  order: Order;
  busy: boolean;
  onAdvance: (o: Order, s: OrderStatus) => void;
  onRefuse: (o: Order) => void;
}) {
  if (order.status === 'recue') {
    return (
      <View style={styles.actionRow}>
        <Button label="Refuser" variant="outline" onPress={() => onRefuse(order)} disabled={busy} style={{ flex: 1 }} />
        <Button label="Accepter" icon="check" onPress={() => onAdvance(order, 'confirmee')} loading={busy} style={{ flex: 1.3 }} />
      </View>
    );
  }
  if (order.status === 'confirmee') {
    return <Button label="Démarrer la préparation" icon="soup_kitchen" onPress={() => onAdvance(order, 'en_preparation')} loading={busy} />;
  }
  if (order.status === 'en_preparation') {
    return <Button label="Marquer comme prête" icon="check_circle" onPress={() => onAdvance(order, 'en_livraison')} loading={busy} />;
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center', marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
});
