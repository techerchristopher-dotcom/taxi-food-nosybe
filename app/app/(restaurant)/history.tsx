import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { AvisRestaurateur } from '../../components/AvisRestaurateur';
import { Etoiles, formatNote } from '../../components/Etoiles';
import { Card } from '../../components/primitives';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { RestaurantOrderCard } from '../../components/RestaurantOrderCard';
import { colors, fonts, spacing } from '../../theme/tokens';
import { avisDeMonRestaurant, listRestaurantOrders } from '../../data/api';
import { OrderStatus } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

// Commandes terminées : livrées ou refusées.
const DONE: OrderStatus[] = ['livree', 'annulee'];

/**
 * Espace restaurant — Historique (plus récent en premier).
 *
 * Depuis le 2026-09-30, chaque commande livrée porte l'avis du client s'il en a
 * laissé un, avec le droit de réponse (docs/NOTATION-AVIS.md). Le résumé en tête
 * suit la même règle que le catalogue : note = cuisine + préparation, rien sous
 * trois avis.
 */
export default function RestaurantHistoryScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');
  // `error` est lu : sans lui, une liaison coupée annonçait « Pas encore d'historique » à
  // un restaurant qui en a un (voir le commentaire détaillé dans `index.tsx`).
  const { data: orders, loading, error: erreurReseau, reload } = useLoad(
    () => listRestaurantOrders(DONE, restaurantId),
    [restaurantId],
  );
  const { data: avis, reload: rechargerAvis } = useLoad(
    () => (restaurantId ? avisDeMonRestaurant(restaurantId) : Promise.resolve([])),
    [restaurantId],
  );
  const list = orders ?? [];
  const avisParCommande = new Map((avis ?? []).map((a) => [a.orderId, a]));
  const publies = (avis ?? []).filter((a) => a.statut === 'publie');
  const moyenne = publies.length >= 3
    ? publies.reduce((s, a) => s + a.noteRestaurant, 0) / publies.length
    : null;

  return (
    <View style={styles.container}>
      <RestaurantHeader title="Historique" />

      {loading && !orders ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : erreurReseau && !orders ? (
        <View style={styles.center}>
          <Icon name="cloud_off" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>Historique indisponible</Text>
          <Text style={styles.emptySub}>
            Impossible de joindre Taxi Food. Vérifiez votre connexion.
          </Text>
          <View style={{ height: 6 }} />
          <Button label="Réessayer" icon="refresh" onPress={reload} />
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
          {publies.length > 0 ? (
            <Card style={styles.resume}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitre}>Vos avis clients</Text>
                <Text style={styles.resumeSub}>
                  {moyenne != null
                    ? `Note ${formatNote(moyenne, 'fr')} / 5 sur ${publies.length} avis (cuisine + préparation)`
                    : `${publies.length} avis — la note s'affiche à partir de 3`}
                </Text>
              </View>
              {moyenne != null ? <Etoiles valeur={moyenne} taille={18} /> : null}
            </Card>
          ) : null}
          {list.map((order) => {
            const a = avisParCommande.get(order.id);
            return (
              <RestaurantOrderCard
                key={order.id}
                order={order}
                footer={a ? <AvisRestaurateur avis={a} onChange={rechargerAvis} /> : undefined}
              />
            );
          })}
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
  resume: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, borderWidth: 1.5, borderColor: colors.accent },
  resumeTitre: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  resumeSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
});
