import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import { Prix } from '../Prix';
import { ProductThumb } from '../ProductThumb';
import { QtyStepper } from '../QtyStepper';
import { colors, fonts, formatAr, radius, shadow } from '../../theme/tokens';
import { lineKey, RestaurantContext, useCart } from '../../store/cart';
import { Product } from '../../data/types';
import { mesurer } from '../../lib/mesure';

export type EcranVente = 'fiche' | 'panier' | 'recap';

/**
 * Rangée horizontale de boissons ou de desserts, ajout en UN tap.
 *
 * Un seul rendu pour les trois moments de la vente additionnelle (fiche plat, panier,
 * récapitulatif) : même carte, même prix (`Prix`, promo comprise), même ligne de
 * consigne. Une fois ajouté, le [+] devient un sélecteur de quantité : le client voit
 * que c'est dans le panier sans quitter l'écran.
 *
 * ⚠️ La consigne est AFFICHÉE sous le prix (« + 1 000 Ar consigne ») : le panier la
 * facture, le client doit la lire avant de taper, pas la découvrir au total.
 *
 * ⚠️ Le produit ajouté est le `Product` complet lu par `getMenu` (emballage compris),
 * jamais un objet reconstruit ici.
 */
export function RangeeAdditionnels({
  produits,
  ecran,
  taille = 116,
}: {
  produits: Product[];
  ecran: EcranVente;
  taille?: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const restaurantId = useCart((s) => s.restaurantId);
  const restaurantName = useCart((s) => s.restaurantName);
  const restaurantInitials = useCart((s) => s.restaurantInitials);
  const restaurantLogoUrl = useCart((s) => s.restaurantLogoUrl);
  const deliveryFeeValue = useCart((s) => s.deliveryFeeValue);

  function ajouter(p: Product) {
    // Un produit à options (taille, parfum…) passe par sa fiche, comme le [+] de la carte.
    if (p.hasOptions) {
      router.push(`/product/${p.id}`);
      return;
    }
    // Le panier est déjà ouvert chez CE restaurant (on ne propose que ses boissons) :
    // aucun conflit possible. Garde quand même : jamais d'ajout vers un autre resto.
    if (!restaurantId || restaurantId !== p.restaurantId) return;
    const ctx: RestaurantContext = {
      id: restaurantId,
      name: restaurantName,
      initials: restaurantInitials,
      logoUrl: restaurantLogoUrl,
      deliveryFee: deliveryFeeValue,
    };
    add(p, ctx);
    mesurer('vente-additionnelle', { ecran, produit: p.name });
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
      {produits.map((p) => {
        const cle = lineKey(p.id);
        const qte = lines.find((l) => l.key === cle)?.quantity ?? 0;
        const frais = p.packagingFee ?? 0;
        return (
          <View key={p.id} style={[styles.carte, { width: taille + 16 }]}>
            <View>
              <ProductThumb uri={p.photoUrl} size={taille} radius={radius.tile} />
              {qte === 0 ? (
                <Pressable
                  onPress={() => ajouter(p)}
                  style={styles.ajout}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('vente.ajouter', { nom: p.name })}
                >
                  <Icon name="add" size={22} color={colors.white} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.nom} numberOfLines={2}>
              {p.name}
            </Text>
            <Prix p={p} badge={false} style={styles.prix} />
            {frais > 0 ? (
              <Text style={styles.frais} numberOfLines={1}>
                {/consigne/i.test(p.packagingLabel ?? '')
                  ? t('vente.consigne', { montant: formatAr(frais) })
                  : `+ ${formatAr(frais)} ${p.packagingLabel ?? ''}`.trim()}
              </Text>
            ) : null}
            {qte > 0 ? (
              <View style={styles.qte}>
                <QtyStepper
                  value={qte}
                  onDec={() => setQuantity(cle, qte - 1)}
                  onInc={() => setQuantity(cle, qte + 1)}
                  size="sm"
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { gap: 10, paddingRight: 4, paddingVertical: 4 },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 8,
    ...shadow.card,
  },
  ajout: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  nom: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.ink,
    marginTop: 8,
    minHeight: 34,
  },
  prix: { fontSize: 14 },
  frais: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  qte: { marginTop: 8, alignItems: 'flex-start' },
});
