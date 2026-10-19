import { heureNosyBe } from '../../lib/reservation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { RefuseSheet } from '../../components/RefuseSheet';
import { VisiteGuidee } from '../../components/VisiteGuidee';
import { colors, fonts, spacing } from '../../theme/tokens';
import { listRestaurantOrders, marquerVisiteProVue, setOrderStatus } from '../../data/api';
import { Order, OrderStatus, RefusalCode } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSondage } from '../../lib/useSondage';
import { useSession } from '../../store/session';
import { useNonLus } from '../../lib/useNonLus';
import { useRestaurantQueue } from '../../store/restaurantQueue';
import { useVisiteGuidee } from '../../store/visiteGuidee';
import { messageErreurCommandeResto } from '../../lib/erreurCommandeResto';

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

  // Rafraîchissement automatique tant que l'écran est monté (pas de push en V1), et
  // immédiat au retour dans l'app — typiquement après « Accepter » dans Telegram.
  useSondage(reload, POLL_MS);
  // Messages non lus par commande (bouton 💬 de chaque carte, 2026-10-13).
  const nonLus = useNonLus('restaurant');

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

  async function advance(
    order: Order,
    status: OrderStatus,
    refus?: { code: RefusalCode; precision: string | null },
  ) {
    setError(null);
    setWorking(order.id);
    try {
      await setOrderStatus(order.id, status, refus);
      setRefuseTarget(null);
      await reload();
    } catch (e) {
      // Le vrai motif, et la feuille de refus fermée : sinon le message restait caché
      // derrière elle (2026-10-19).
      setRefuseTarget(null);
      setError(messageErreurCommandeResto(e));
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

      {error ? <Text style={[styles.error, { marginTop: 12, paddingHorizontal: spacing.screen }]}>{error}</Text> : null}

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
          {list.map((order) => (
            <RestaurantOrderCard
              key={order.id}
              order={order}
              messagerie={{ role: 'restaurant', nonLus: nonLus[order.id] ?? 0 }}
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
        onConfirm={(refus) => refuseTarget && advance(refuseTarget, 'annulee', refus)}
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
    // Bascule automatique en base (tâche pg_cron, 30 à 60 s après l'acceptation) :
    // le restaurateur n'a plus rien à faire. Le bouton reste pour qui veut aller plus
    // vite, et un appui qui arrive APRÈS la bascule est accepté sans erreur par
    // `set_order_status` — il ne peut plus afficher « Action impossible ».
    if (order.preparationAuto) {
      return (
        <View style={{ gap: 8 }}>
          <Text style={styles.autoNote}>
            {/* Réservation : la base attend l'heure de lancement (`lancement_prevu_a`)
                avant de la passer en préparation — « moins d'une minute » serait faux. */}
            {order.lancementPrevu && new Date(order.lancementPrevu).getTime() > Date.now()
              ? `Acceptée — réservation : passera en préparation toute seule vers ${heureNosyBe(order.lancementPrevu, 'fr')}. Pas avant.`
              : "Acceptée — passe en préparation toute seule dans moins d'une minute."}
          </Text>
          <View style={styles.actionRow}>
            <Button label="Annuler" variant="outline" onPress={() => onRefuse(order)} disabled={busy} style={{ flex: 1 }} />
            <Button
              label="Démarrer maintenant"
              icon="soup_kitchen"
              variant="outline"
              onPress={() => onAdvance(order, 'en_preparation')}
              loading={busy}
              style={{ flex: 1.6 }}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.actionRow}>
        <Button label="Annuler" variant="outline" onPress={() => onRefuse(order)} disabled={busy} style={{ flex: 1 }} />
        <Button label="Démarrer la préparation" icon="soup_kitchen" onPress={() => onAdvance(order, 'en_preparation')} loading={busy} style={{ flex: 1.6 }} />
      </View>
    );
  }
  if (order.status === 'en_preparation') {
    return (
      <View style={styles.actionRow}>
        <Button label="Annuler" variant="outline" onPress={() => onRefuse(order)} disabled={busy} style={{ flex: 1 }} />
        <BoutonPrete onConfirm={() => onAdvance(order, 'en_livraison')} busy={busy} />
      </View>
    );
  }
  return null;
}

/**
 * « Marquer comme prête » en DEUX appuis (2026-10-19). Le soir de TF-439, « Accepter »,
 * « Démarrer » et « Marquer prête » occupaient le même endroit de l'écran : trois appuis
 * rapides ont envoyé la commande au livreur 9 s après l'acceptation. Le premier appui arme
 * le bouton (« Confirmer : prête ? »), le second l'envoie ; sans second appui il se
 * désarme seul au bout de 4 s. Pas d'`Alert` : elle n'existe pas sur le web.
 */
function BoutonPrete({ onConfirm, busy }: { onConfirm: () => void; busy: boolean }) {
  const [arme, setArme] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);
  // Un appui trop rapide après l'arrivée du bouton est ignoré (le doigt était encore là).
  const apparuLe = useRef(Date.now());
  return (
    <Button
      label={arme ? 'Confirmer : prête ?' : 'Marquer comme prête'}
      icon="check_circle"
      variant={arme ? 'primary' : 'outline'}
      loading={busy}
      style={{ flex: 1.6 }}
      onPress={() => {
        if (Date.now() - apparuLe.current < 800) return;
        if (!arme) {
          setArme(true);
          minuteur.current = setTimeout(() => setArme(false), 4000);
          return;
        }
        if (minuteur.current) clearTimeout(minuteur.current);
        setArme(false);
        onConfirm();
      }}
    />
  );
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
  autoNote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
});
