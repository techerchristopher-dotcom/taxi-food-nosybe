import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { RefuseSheet } from '../../components/RefuseSheet';
import { VisiteGuidee } from '../../components/VisiteGuidee';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listRestaurantOrders, marquerVisiteProVue, setOrderStatus } from '../../data/api';
import { Order, OrderStatus } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';
import { useRestaurantQueue } from '../../store/restaurantQueue';
import { useVisiteGuidee } from '../../store/visiteGuidee';

// Statuts « actifs » : demandent une action ou un suivi. en_livraison sort de la liste.
const ACTIVE: OrderStatus[] = ['recue', 'confirmee', 'en_preparation'];
const POLL_MS = 12000;

/** Espace restaurant — Commandes en cours (rafraîchissement automatique). */
export default function RestaurantOrdersScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');
  const setActiveCount = useRestaurantQueue((s) => s.setActiveCount);
  // ⚠️ `error` est LU, et ce n'est pas un détail de confort.
  //
  // `useLoad` l'expose depuis toujours ; aucun écran ne le lisait. Quand la liaison de
  // Nosy Be tombe — elle tombe —, `listRestaurantOrders` rejette, `orders` reste `null`,
  // et cet écran affichait alors, en toutes lettres, « Aucune commande en cours ». C'est
  // le pire mensonge que puisse faire cette application à un restaurateur : elle affirme
  // qu'il n'a rien à préparer alors qu'elle n'a simplement pas pu poser la question. Il
  // range son téléphone, et les commandes attendent.
  const { data: orders, loading, error: erreurReseau, reload } = useLoad(
    () => listRestaurantOrders(ACTIVE, restaurantId),
    [restaurantId],
  );

  // Rafraîchissement automatique tant que l'écran est monté (pas de push en V1).
  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // Alimente le badge de l'onglet (nombre de commandes en attente d'action).
  useEffect(() => {
    if (orders) setActiveCount(orders.length);
  }, [orders, setActiveCount]);

  const [working, setWorking] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------------ Visite
  // La visite guidée se joue ICI, et pas ailleurs : c'est le seul écran où la
  // commande d'exemple a un sens, et c'est celui sur lequel le restaurateur
  // atterrit en entrant dans son espace.
  const visiteProVueLe = useSession((s) => s.session?.visiteProVueLe ?? null);
  const sessionChargee = useSession((s) => !!s.session);
  const refreshSession = useSession((s) => s.refresh);
  const visiteDemandee = useVisiteGuidee((s) => s.demandee);
  const consommerDemande = useVisiteGuidee((s) => s.consommerDemande);
  const [visite, setVisite] = useState(false);
  // Une seule proposition spontanée par montage de l'écran. Sans ce verrou, la
  // visite refermée sans mémorisation se rouvrirait aussitôt (la session dit
  // toujours « jamais vue »), et le restaurateur ne pourrait plus en sortir.
  const [dejaProposee, setDejaProposee] = useState(false);

  useEffect(() => {
    if (!sessionChargee || dejaProposee || visiteProVueLe !== null) return;
    setDejaProposee(true);
    setVisite(true);
  }, [sessionChargee, dejaProposee, visiteProVueLe]);

  // Rediffusion demandée depuis les Réglages (le bouton y change d'onglet).
  useEffect(() => {
    if (!visiteDemandee) return;
    consommerDemande();
    setDejaProposee(true);
    setVisite(true);
  }, [visiteDemandee, consommerDemande]);

  async function fermerVisite(memoriser: boolean) {
    setVisite(false);
    try {
      await marquerVisiteProVue(memoriser);
      // La session porte la date : sans ce rafraîchissement, la visite se
      // rouvrirait au prochain montage de l'écran alors qu'elle est vue.
      await refreshSession();
    } catch {
      // Réseau coupé : le verrou local tient pour cette session, et la visite
      // se represente au prochain lancement. Rien à dire au restaurateur.
    }
  }

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

      {/* Liste déjà lue une fois puis connexion perdue : on garde ce qu'on a — c'est
          mieux que rien — mais on dit qu'elle a cessé de se rafraîchir. Le bandeau vit
          ICI, au-dessus du branchement : la liste peut très bien être VIDE quand la
          liaison tombe, et « Aucune commande en cours » tout seul serait alors la même
          contre-vérité qu'avant. */}
      {erreurReseau && orders ? (
        <Text style={styles.warn}>
          Connexion perdue — cette liste date de votre dernier rafraîchissement réussi.
        </Text>
      ) : null}

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : erreurReseau && !orders ? (
        // Rien n'a JAMAIS été lu : on ne sait pas s'il a des commandes. On le dit.
        <View style={styles.center}>
          <Icon name="cloud_off" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Liste indisponible</Text>
          <Text style={styles.emptySub}>
            Impossible de joindre Taxi Food. Vos commandes sont peut-être là, mais nous ne
            pouvons pas les lire. Vérifiez votre connexion — l'app réessaie toute seule.
          </Text>
          <View style={{ height: 6 }} />
          <Button label="Réessayer" icon="refresh" onPress={reload} />
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

      <VisiteGuidee visible={visite} onFermer={fermerVisite} />
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
  actionRow: { flexDirection: 'row', gap: 10 },
});
