import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { CourierHeader } from '../../components/CourierHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { DeliverSheet } from '../../components/DeliverSheet';
import { colors, fonts, spacing } from '../../theme/tokens';
import {
  claimDelivery,
  getCourierAvailability,
  getMyActiveDelivery,
  listAvailableDeliveries,
  markDelivered,
  markPickedUp,
  releaseDelivery,
  setCourierAvailability,
} from '../../data/api';
import { Order } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

const POLL_MS = 12000;

/** Espace livreur — Livraisons : disponibilité, commande en cours, ou file des dispo. */
export default function CourierDeliveriesScreen() {
  const userId = useSession((s) => s.session?.userId ?? '');

  const { data, loading, reload } = useLoad(async () => {
    const available = await getCourierAvailability(userId);
    const active = await getMyActiveDelivery(userId);
    // On ne charge la file des dispo que si le livreur est disponible et libre.
    const list = available && !active ? await listAvailableDeliveries() : [];
    return { available, active, list };
  }, [userId]);

  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);

  async function run(key: string, fn: () => Promise<void>, errMsg: string) {
    setError(null);
    setBusy(key);
    try {
      await fn();
      setDeliverTarget(null);
      await reload();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(msg || errMsg);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  const available = data?.available ?? false;
  const active = data?.active ?? null;
  const list = data?.list ?? [];

  return (
    <View style={styles.container}>
      <CourierHeader title="Livraisons" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Bascule de disponibilité */}
        <View style={styles.availCard}>
          <Icon name={available ? 'bolt' : 'pause_circle'} size={24} color={available ? colors.success : colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.availTitle}>{available ? 'Disponible' : 'Indisponible'}</Text>
            <Text style={styles.availSub}>
              {available ? 'Tu reçois les commandes à livrer.' : 'Active pour voir les commandes à livrer.'}
            </Text>
          </View>
          <Switch
            value={available}
            disabled={busy === 'avail'}
            onValueChange={(v) => run('avail', () => setCourierAvailability(v), 'Bascule impossible.')}
            trackColor={{ true: colors.success, false: colors.borderStrong }}
            thumbColor={colors.white}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading && !data ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : active ? (
          // Une livraison en cours : la montrer avec ses actions.
          <>
            <Text style={styles.section}>Ma livraison en cours</Text>
            <RestaurantOrderCard
              order={active}
              footer={
                active.pickedUp ? (
                  <Button
                    label="Marquer livrée"
                    icon="check_circle"
                    onPress={() => setDeliverTarget(active)}
                    loading={busy === active.id}
                  />
                ) : (
                  <View style={styles.row}>
                    <Button
                      label="Abandonner"
                      variant="outline"
                      onPress={() => run(active.id, () => releaseDelivery(active.id), 'Abandon impossible.')}
                      disabled={busy === active.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Récupérée"
                      icon="inventory_2"
                      onPress={() => run(active.id, () => markPickedUp(active.id), 'Action impossible.')}
                      loading={busy === active.id}
                      style={{ flex: 1.3 }}
                    />
                  </View>
                )
              }
            />
          </>
        ) : !available ? (
          <View style={styles.center}>
            <Icon name="pause_circle" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Tu es indisponible</Text>
            <Text style={styles.emptySub}>Active ta disponibilité pour voir les commandes à livrer.</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.center}>
            <Icon name="two_wheeler" size={40} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Aucune commande à livrer</Text>
            <Text style={styles.emptySub}>Les commandes prêtes apparaissent ici automatiquement.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.section}>Commandes à livrer</Text>
            {list.map((order) => (
              <RestaurantOrderCard
                key={order.id}
                order={order}
                footer={
                  <Button
                    label="Je la prends"
                    icon="pan_tool"
                    onPress={() => run(order.id, () => claimDelivery(order.id), 'Commande déjà prise.')}
                    loading={busy === order.id}
                  />
                }
              />
            ))}
          </>
        )}
      </ScrollView>

      <DeliverSheet
        order={deliverTarget}
        submitting={!!deliverTarget && busy === deliverTarget.id}
        onCancel={() => setDeliverTarget(null)}
        onConfirm={(cash) =>
          deliverTarget && run(deliverTarget.id, () => markDelivered(deliverTarget.id, cash), 'Livraison impossible.')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  availCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  availTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  availSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  section: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center', marginBottom: 12 },
});
