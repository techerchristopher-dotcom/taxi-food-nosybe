import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { colors, fonts, radius } from '../../theme/tokens';
import { Product } from '../../data/types';
import { useCart } from '../../store/cart';
import { RangeeAdditionnels } from './RangeeAdditionnels';

/**
 * « Une boisson bien fraîche avec ça ? » — la feuille qui s'ouvre JUSTE APRÈS l'ajout
 * d'un plat au panier, depuis sa fiche.
 *
 * C'est le moment où le client a le plus faim et où la décision coûte un tap : il ne
 * faut ni le chercher dans la carte, ni le découvrir au panier. Le plat est déjà
 * ajouté — la feuille ne retient rien, « Non merci » ferme et on continue comme avant.
 *
 * Une seule fois par panier et par restaurant (`dejaProposee`) : un client qui a dit
 * non ne doit pas se le faire redemander à chaque plat.
 */
const refusees = new Set<string>();

export function dejaProposee(restaurantId: string): boolean {
  return refusees.has(restaurantId);
}

export function ProposeBoisson({
  visible,
  restaurantId,
  platAjoute,
  produits,
  genre,
  onFermer,
}: {
  visible: boolean;
  restaurantId: string;
  platAjoute: string;
  produits: Product[];
  genre: 'boisson' | 'dessert';
  onFermer: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const ids = new Set(produits.map((p) => p.id));
  const nbAjoutes = useCart((s) => s.lines.filter((l) => ids.has(l.product.id)).reduce((n, l) => n + l.quantity, 0));

  function fermer() {
    refusees.add(restaurantId);
    onFermer();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fermer}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={fermer} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.ajoute}>
            <Icon name="check_circle" size={18} color={colors.success} />
            <Text style={styles.ajouteTexte} numberOfLines={1}>
              {t('vente.platAjoute', { nom: platAjoute })}
            </Text>
          </View>
          <Text style={styles.titre}>{genre === 'boisson' ? t('vente.titreBoisson') : t('vente.titreDessert')}</Text>
          <Text style={styles.sousTitre}>
            {genre === 'boisson' ? t('vente.sousTitreBoisson') : t('vente.sousTitreDessert')}
          </Text>
          <View style={{ marginTop: 14, marginHorizontal: -4 }}>
            <RangeeAdditionnels produits={produits} ecran="fiche" taille={104} />
          </View>
          <View style={{ gap: 10, marginTop: 18 }}>
            {nbAjoutes > 0 ? (
              <Button label={t('vente.continuer')} onPress={fermer} />
            ) : (
              <Button label={t('vente.nonMerci')} variant="outline" onPress={fermer} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  ajoute: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ajouteTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  titre: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 26, color: colors.ink, marginTop: 10 },
  sousTitre: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textDark, marginTop: 4 },
});
