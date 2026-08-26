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
  listMyActiveDeliveries,
  listAvailableDeliveries,
  MAX_TOURNEE,
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
    const actives = await listMyActiveDeliveries(userId);
    // Des qu'il tient une commande, la base n'acceptera plus que le MEME
    // restaurant : on filtre la file sur celui-la. Lui montrer des commandes
    // qu'il ne peut pas prendre, c'est lui donner un bouton qui echoue.
    const resto = actives.length ? actives[0].restaurantId : null;
    const complet = actives.length >= MAX_TOURNEE;
    const list = available && !complet ? await listAvailableDeliveries(resto) : [];
    return { available, actives, list, complet };
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
  const actives = data?.actives ?? [];
  const list = data?.list ?? [];
  const complet = data?.complet ?? false;

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
        ) : (
          <>
            {/* La tournee : ce que le livreur tient deja. Chaque commande garde
                ses propres actions — on recupere tout au restaurant, puis on
                livre client par client, dans l'ordre qu'on veut. */}
            {actives.length > 0 ? (
              <>
                <Text style={styles.section}>
                  Ma tournée · {actives.length}/{MAX_TOURNEE}
                </Text>
                {actives.map((order) => (
                  <RestaurantOrderCard
                    key={order.id}
                    order={order}
                    footer={
                      order.pickedUp ? (
                        <Button
                          label="Marquer livrée"
                          icon="check_circle"
                          onPress={() => setDeliverTarget(order)}
                          loading={busy === order.id}
                        />
                      ) : (
                        <View style={styles.row}>
                          <Button
                            label="Abandonner"
                            variant="outline"
                            onPress={() => run(order.id, () => releaseDelivery(order.id), 'Abandon impossible.')}
                            disabled={busy === order.id}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label="Récupérée"
                            icon="inventory_2"
                            onPress={() => run(order.id, () => markPickedUp(order.id), 'Action impossible.')}
                            loading={busy === order.id}
                            style={{ flex: 1.3 }}
                          />
                        </View>
                      )
                    }
                  />
                ))}
              </>
            ) : null}

            {/* Ce qu'il peut encore prendre. */}
            {!available ? (
              <View style={styles.center}>
                <Icon name="pause_circle" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>Tu es indisponible</Text>
                <Text style={styles.emptySub}>Active ta disponibilité pour voir les commandes à livrer.</Text>
              </View>
            ) : complet ? (
              <View style={styles.center}>
                <Icon name="inventory_2" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>Ta tournée est complète</Text>
                <Text style={styles.emptySub}>
                  Livre une commande pour pouvoir en prendre une autre.
                </Text>
              </View>
            ) : list.length === 0 ? (
              <View style={styles.center}>
                <Icon name="two_wheeler" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>
                  {actives.length ? 'Rien d\'autre dans ce restaurant' : 'Aucune commande à livrer'}
                </Text>
                <Text style={styles.emptySub}>
                  {actives.length
                    ? 'Une tournée ne mélange pas deux restaurants. Livre celles-ci, puis reviens.'
                    : 'Les commandes prêtes apparaissent ici automatiquement.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.section}>
                  {actives.length ? 'À ajouter à ta tournée' : 'Commandes à livrer'}
                </Text>
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
