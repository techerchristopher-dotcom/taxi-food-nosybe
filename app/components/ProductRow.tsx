import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { ProductThumb } from './ProductThumb';
import { QtyStepper } from './QtyStepper';
import { colors, fonts, formatAr, radius, shadow } from '../theme/tokens';
import { Product } from '../data/types';

/**
 * Ligne produit du menu : nom + description + prix à gauche, grande photo à droite
 * (116 pt) avec le bouton d'ajout posé dessus. Sans photo, le texte prend la ligne.
 * - disponible & absent du panier : bouton [+] rouge
 * - disponible & déjà au panier : sélecteur de quantité, carte bordée rouge
 * - indisponible : grisé + pastille « Indisponible », non cliquable
 * - restaurant fermé (`commandable` faux) : la ligne reste lisible et
 *   ouvrable, mais SANS bouton d'ajout — voir la carte d'un restaurant fermé
 *   est normal, composer un panier qui sera refusé à la validation ne l'est pas.
 */
export function ProductRow({
  product,
  qty,
  onOpen,
  onInc,
  onDec,
  onShare,
  commandable = true,
}: {
  product: Product;
  qty: number;
  onOpen: () => void;
  onInc: () => void;
  onDec: () => void;
  /** Absent = pas de bouton de partage sur cette ligne. */
  onShare?: () => void;
  /** Faux quand le restaurant est fermé ou pas encore ouvert. */
  commandable?: boolean;
}) {
  const { t } = useTranslation();
  const available = product.isAvailable;
  const inCart = qty > 0;

  const peutAjouter = available && commandable;
  const aPhoto = !!product.photoUrl;

  // Ajout au panier : « + » seul, ou sélecteur de quantité une fois le plat au panier.
  const ajout = peutAjouter ? (
    inCart ? (
      <QtyStepper value={qty} onDec={onDec} onInc={onInc} size="md" />
    ) : (
      <Pressable onPress={onInc} style={styles.addBtn} hitSlop={6}>
        <Icon name="add" size={22} color={colors.white} />
      </Pressable>
    )
  ) : null;

  return (
    <Pressable
      onPress={available ? onOpen : undefined}
      style={[
        styles.card,
        aPhoto ? styles.cardPhoto : styles.cardSansPhoto,
        !available && styles.muted,
        inCart && styles.selected,
      ]}
    >
      <View style={[styles.texte, aPhoto && styles.textePhoto]}>
        <Text style={[styles.name, !available && { color: colors.textDark }]}>{product.name}</Text>
        {/* Repère alimentaire : à Nosy Be une part importante de la clientèle ne
            mange pas de porc. La composition en toutes lettres ne suffit pas, il
            faut le voir sans avoir à ouvrir la fiche. */}
        {product.dietTags?.includes('porc') ? (
          <View style={styles.dietBadge}>
            <Text style={styles.dietText}>{t('product.contientPorc')}</Text>
          </View>
        ) : null}
        {product.description ? (
          <Text style={styles.desc} numberOfLines={aPhoto ? 3 : undefined}>
            {product.description}
          </Text>
        ) : null}
        <View style={[styles.prixLigne, aPhoto && styles.prixLignePhoto]}>
          {available ? (
            <Text style={styles.price}>{formatAr(product.price)}</Text>
          ) : (
            <View style={styles.unavailRow}>
              <Text style={styles.priceMuted}>{formatAr(product.price)}</Text>
              <View style={styles.unavailBadge}>
                {/* ⚠️ « Bientôt de retour » raconte une RUPTURE — un plat qui revient.
                    Les milkshakes de La Cabane n'ont jamais été servis : ils s'annoncent.
                    D'où deux mots pour deux situations, et non un seul par paresse. */}
                <Text style={styles.unavailText}>
                  {t(product.listingStatus === 'coming_soon'
                    ? 'restaurantCard.comingSoon'
                    : 'restaurantCard.unavailable')}
                </Text>
              </View>
            </View>
          )}
          {/* ⚠️ Le partage est volontairement DISCRET : gris, sans fond, plus petit.
              La ligne a déjà une action principale — ajouter au panier — et deux
              boutons de même poids se disputeraient le pouce. Il reste visible sur
              un plat indisponible : un restaurateur annonce volontiers un plat qui
              revient demain. */}
          {onShare ? (
            <Pressable onPress={onShare} style={styles.shareBtn} hitSlop={8}>
              <Icon name="ios_share" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* La photo est ce qui fait commander : grande, à droite, et le bouton d'ajout
          posé DESSUS (dans ses bords — Android rogne ce qui dépasse d'un parent).
          ⚠️ Sans photo, pas de case vide de 116 px : le texte prend toute la largeur
          et le bouton revient au bout de la ligne. Un grand aplat orange par plat
          sans photo (Le Nandipo : 38 sur 43) ferait une carte de trous. */}
      {aPhoto ? (
        <View style={styles.photo}>
          <ProductThumb
            uri={product.photoUrl}
            size={PHOTO}
            radius={radius.tile}
            muted={!available}
          />
          {ajout ? <View style={inCart ? styles.surPhotoStepper : styles.surPhotoAdd}>{ajout}</View> : null}
        </View>
      ) : (
        ajout
      )}
    </Pressable>
  );
}

/** Côté de la photo d'une ligne de carte. ≈ 31 % d'un écran de 375 pt. */
const PHOTO = 116;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    ...shadow.card,
  },
  cardPhoto: { alignItems: 'stretch', paddingLeft: 14 },
  cardSansPhoto: { alignItems: 'center' },
  texte: { flex: 1, minWidth: 0 },
  // Avec photo, le prix descend en bas de la colonne, aligné sur le bas de la photo.
  textePhoto: { minHeight: PHOTO },
  prixLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  prixLignePhoto: { marginTop: 'auto', paddingTop: 8 },
  photo: { width: PHOTO, height: PHOTO },
  surPhotoAdd: { position: 'absolute', right: 6, bottom: 6 },
  surPhotoStepper: { position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' },
  muted: { opacity: 0.6 },
  shareBtn: { padding: 6, marginRight: -6 },
  selected: { borderWidth: 1.5, borderColor: colors.primary },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  desc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  price: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  unavailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  priceMuted: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMuted },
  unavailBadge: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.dangerText },
  dietBadge: {
    alignSelf: 'flex-start',
    height: 20,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    marginBottom: 1,
  },
  dietText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.warnText },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
});
