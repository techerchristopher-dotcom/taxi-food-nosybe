import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { DeliverSheet } from '../../components/DeliverSheet';
import { EnTeteLivreur } from '../../components/livreur/EnTeteLivreur';
import { BandeauGps } from '../../components/livreur/BandeauGps';
import { AttenteClientLivreur } from '../../components/livreur/AttenteClientLivreur';
import { FinDeTournee } from '../../components/livreur/FinDeTournee';
import { colors, fonts, spacing } from '../../theme/tokens';
import {
  claimDelivery,
  getCourierAvailability,
  listAvailableDeliveries,
  listMyActiveDeliveries,
  markArrived,
  markArriving,
  markDelivered,
  markPickedUp,
  releaseDelivery,
  setCourierAvailability,
} from '../../data/api';
import { Order } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSondage } from '../../lib/useSondage';
import { useNonLus } from '../../lib/useNonLus';
import { useSession } from '../../store/session';
import { arreterSuivi, demarrerSuivi, envoyerFile, useEtatGps } from '../../lib/livreur/suiviGps';
import { naviguerVers, positionClient, positionsRestaurants, Point } from '../../lib/livreur/outils';

const POLL_MS = 12000;
const VEILLE = 'tournee-livreur';

/**
 * App Taxi Food Livreur — Livraisons. Reprend À L'IDENTIQUE l'espace livreur de l'app
 * client (mêmes RPC, mêmes règles : aucune limite de commandes ni de restaurants depuis le
 * 2026-10-16), et ajoute :
 *   - le partage de position pendant la tournée (démarré au premier « Je la prends »,
 *     arrêté quand la tournée est vide) et son bandeau d'état ;
 *   - « Itinéraire » : vers le restaurant avant la récupération, vers le client après ;
 *   - l'écran qui reste allumé tant qu'une course est en cours ;
 *   - le tirer-pour-actualiser.
 */
export default function Livraisons() {
  const userId = useSession((s) => s.session?.userId ?? '');
  const autorisation = useEtatGps((s) => s.autorisation);

  const { data, loading, reload } = useLoad(async () => {
    const available = await getCourierAvailability(userId);
    const actives = await listMyActiveDeliveries(userId);
    const list = available ? await listAvailableDeliveries() : [];
    const restos = await positionsRestaurants([...actives, ...list].map((o) => o.restaurantId)).catch(
      () => ({}) as Record<string, Point>,
    );
    return { available, actives, list, restos };
  }, [userId]);

  useSondage(reload, POLL_MS);
  const nonLus = useNonLus('livreur');

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [tirage, setTirage] = useState(false);

  const available = data?.available ?? false;
  const actives = data?.actives ?? [];
  const list = data?.list ?? [];
  const restos = data?.restos ?? {};
  const enCourse = actives.length > 0;

  // Partage de position : tant qu'une commande est tenue. On ne DEMANDE jamais
  // l'autorisation tout seul (le bandeau explique d'abord, Google Play l'exige) ;
  // on démarre seulement si elle est déjà accordée.
  const charge = !!data;
  useEffect(() => {
    if (!charge) return;
    if (enCourse && (autorisation === 'ok' || autorisation === 'premier_plan')) {
      void demarrerSuivi();
    } else if (!enCourse) {
      void arreterSuivi();
    }
  }, [charge, enCourse, autorisation]);

  // Écran allumé pendant la tournée.
  useEffect(() => {
    if (enCourse) activateKeepAwakeAsync(VEILLE).catch(() => {});
    else deactivateKeepAwake(VEILLE).catch(() => {});
    return () => {
      deactivateKeepAwake(VEILLE).catch(() => {});
    };
  }, [enCourse]);

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

  async function actualiser() {
    setTirage(true);
    try {
      await reload();
      void envoyerFile();
    } finally {
      setTirage(false);
    }
  }

  function boutonItineraire(order: Order) {
    const cible = order.pickedUp ? positionClient(order) : restos[order.restaurantId] ?? null;
    if (!cible) return null;
    return (
      <Button
        label={order.pickedUp ? 'Itinéraire vers le client' : `Itinéraire vers ${order.restaurantName}`}
        icon="directions"
        variant="dark"
        onPress={() => naviguerVers(cible)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <EnTeteLivreur title="Livraisons" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={tirage} onRefresh={actualiser} tintColor={colors.primary} />}
      >
        <BandeauGps enCourse={enCourse} />

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
            {enCourse ? (
              <>
                <Text style={styles.section}>Ma tournée · {actives.length}</Text>
                {actives.map((order) => (
                  <RestaurantOrderCard
                    key={order.id}
                    order={order}
                    messagerie={{ role: 'livreur', nonLus: nonLus[order.id] ?? 0 }}
                    footer={
                      <View style={{ gap: 8 }}>
                        {boutonItineraire(order)}
                        <AttenteClientLivreur order={order} onChange={reload} />
                        {order.pickedUp ? (
                          <>
                            {order.arrivedAt ? (
                              <Text style={styles.jalon}>✓ Client prévenu : tu es devant chez lui</Text>
                            ) : order.arrivingAt ? (
                              <Text style={styles.jalon}>✓ Client prévenu : tu arrives dans 5 min</Text>
                            ) : null}
                            <View style={styles.row}>
                              <Button
                                label="Marquer livrée"
                                icon="check_circle"
                                variant={order.arrivedAt ? 'primary' : 'outline'}
                                onPress={() => setDeliverTarget(order)}
                                loading={busy === order.id}
                                style={{ flex: 1 }}
                              />
                              {!order.arrivingAt ? (
                                <Button
                                  label="J'arrive"
                                  icon="near_me"
                                  onPress={() => run(order.id, () => markArriving(order.id), 'Action impossible.')}
                                  loading={busy === order.id}
                                  style={{ flex: 1.2 }}
                                />
                              ) : !order.arrivedAt ? (
                                <Button
                                  label="Je suis là"
                                  icon="location_on"
                                  onPress={() => run(order.id, () => markArrived(order.id), 'Action impossible.')}
                                  loading={busy === order.id}
                                  style={{ flex: 1.2 }}
                                />
                              ) : null}
                            </View>
                          </>
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
                        )}
                      </View>
                    }
                  />
                ))}
              </>
            ) : null}

            {!available ? (
              <View style={styles.center}>
                <Icon name="pause_circle" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>Tu es indisponible</Text>
                <Text style={styles.emptySub}>Active ta disponibilité pour voir les commandes à livrer.</Text>
              </View>
            ) : list.length === 0 ? (
              <View style={styles.center}>
                <Icon name="two_wheeler" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>{enCourse ? 'Aucune autre commande prête' : 'Aucune commande à livrer'}</Text>
                <Text style={styles.emptySub}>
                  {enCourse
                    ? 'Les nouvelles commandes prêtes, de n’importe quel restaurant, apparaîtront ici.'
                    : 'Les commandes prêtes apparaissent ici automatiquement.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.section}>{enCourse ? 'À ajouter à ta tournée' : 'Commandes à livrer'}</Text>
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
            <FinDeTournee />
          </>
        )}
      </ScrollView>

      <DeliverSheet
        order={deliverTarget}
        submitting={!!deliverTarget && busy === deliverTarget.id}
        onCancel={() => setDeliverTarget(null)}
        onConfirm={(cash, mode) =>
          deliverTarget && run(deliverTarget.id, () => markDelivered(deliverTarget.id, cash, mode), 'Livraison impossible.')
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
  jalon: { fontFamily: fonts.medium, fontSize: 12, color: colors.success },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 6 },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center', marginBottom: 12 },
});
