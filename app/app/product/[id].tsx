import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { QtyStepper } from '../../components/QtyStepper';
import { ConflictSheet } from '../../components/ConflictSheet';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../../theme/tokens';
import { imageUrl, OptionGroup, SelectedOption, thumbnailUrl } from '../../data/types';

/** Doivent rester alignés sur `styles.photo.height` et `styles.chipThumbWrap`. */
const PHOTO_HEIGHT = 150;
const CHIP_THUMB = 34;
import { getProductDetail } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { RestaurantContext, useCart } from '../../store/cart';
import { lienProduit, textePartageProduit } from '../../lib/partage';
import { PartageEnLigne, PartageSheet } from '../../components/PartageSheet';

/** Écran 04 — Détail d'un produit + configuration des options (choix guidés). */
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  const { data, loading } = useLoad(() => getProductDetail(id!), [id]);
  const product = data?.product ?? null;
  const restaurant = data?.restaurant ?? null;
  const groups = useMemo(() => data?.groups ?? [], [data]);

  const add = useCart((s) => s.add);
  const replaceWith = useCart((s) => s.replaceWith);
  const canAdd = useCart((s) => s.canAdd);
  const cartRestaurantName = useCart((s) => s.restaurantName);

  const [qty, setQty] = useState(1);
  // Sélections : { [groupId]: optionId[] }.
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [conflict, setConflict] = useState(false);
  // Vignettes d'options en échec de chargement → fallback silencieux en texte seul.
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [partageOuvert, setPartageOuvert] = useState(false);

  // ⚠️ Un groupe OBLIGATOIRE qui ne propose qu'UNE seule option ne pose aucune
  // question : c'est une composition, pas un choix. Le laisser à cocher coûte un
  // tap pour rien et, si le client ne le voit pas, un bouton « Ajouter » grisé
  // qu'il ne peut pas expliquer — le pire des deux mondes.
  //
  // Le cas est réel depuis le 2026-09-06 : chez Chez Bidul & Truc, l'accompagnement
  // des hamburgers a été ramené aux seules frites. « Coché par défaut » n'existe
  // NULLE PART en base — `product_options` n'a pas de colonne pour ça — donc la
  // règle vit ici, et elle vaut pour tous les restaurants, pas pour un cas
  // particulier codé en dur.
  //
  // `...auto` d'abord, `...prev` ensuite : une sélection déjà faite l'emporte
  // toujours. La règle pré-remplit, elle n'écrase jamais.
  useEffect(() => {
    const auto: Record<string, string[]> = {};
    for (const g of groups) {
      if (g.required && g.options.length === 1 && g.options[0].isAvailable) {
        auto[g.id] = [g.options[0].id];
      }
    }
    if (Object.keys(auto).length) setSel((prev) => ({ ...auto, ...prev }));
  }, [groups]);


  if (loading && !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('product.notFound')}</Text>
      </View>
    );
  }

  // Voir la carte d'un restaurant ferme est normal ; y composer un panier que
  // `create_order` refusera ne l'est pas. Coupe l'ajout, pas la consultation.
  const commandable = restaurant?.isOpen ?? false;

  const ctx: RestaurantContext | null = restaurant
    ? {
        id: restaurant.id,
        name: restaurant.name,
        initials: restaurant.initials,
        logoUrl: restaurant.logoUrl,
        deliveryFee: restaurant.deliveryFee,
      }
    : null;

  function toggle(g: OptionGroup, optionId: string) {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.maxSelect === 1) return { ...prev, [g.id]: [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.maxSelect) return prev; // plafond atteint
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  }

  const selectedOptions: SelectedOption[] = groups.flatMap((g) =>
    (sel[g.id] ?? []).flatMap((optionId) => {
      const o = g.options.find((x) => x.id === optionId);
      return o ? [{ optionId: o.id, groupId: g.id, name: o.name, priceDelta: o.priceDelta, quantity: 1 }] : [];
    }),
  );

  const valid = groups.every((g) => {
    const n = (sel[g.id] ?? []).length;
    if (g.required && n < Math.max(g.minSelect, 1)) return false;
    return n >= g.minSelect && n <= g.maxSelect;
  });

  const unitPrice = product.price + selectedOptions.reduce((n, o) => n + o.priceDelta * o.quantity, 0);
  const lineTotal = unitPrice * qty;

  /**
   * Revenir en arriere — ou, faute d'arriere, aller quelque part.
   *
   * ⚠️ DEFAUT REEL, constate le 2026-09-07. `router.back()` seul ne fait RIEN
   * quand l'ecran a ete ouvert DIRECTEMENT : c'est exactement le cas d'un client
   * qui arrive par un lien WhatsApp, la pile de navigation etant vide. Le plat
   * etait bien ajoute au panier, mais l'ecran ne bougeait pas — et ca se lit
   * comme une application figee. Le partage social a rendu ce chemin courant :
   * c'est desormais l'arrivee la plus frequente sur cette fiche.
   *
   * On retombe sur la carte du restaurant plutot que sur l'accueil : le client
   * vient d'ajouter un plat, il est chez CE restaurant, et il en ajoutera
   * peut-etre un deuxieme.
   */
  function retour() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (restaurant?.id) router.replace(`/restaurant/${restaurant.id}`);
    else router.replace('/');
  }

  function handleAdd() {
    if (!product || !ctx || !valid) return;
    if (canAdd(product)) {
      add(product, ctx, qty, selectedOptions);
      retour();
    } else {
      setConflict(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.photo, { paddingTop: insets.top + 12 }]}>
        {product.photoUrl ? (
          <Image
            // Bandeau plein écran de 150 pt de haut : on demande cette taille-là, pas le
            // PNG d'origine (1 à 2 Mo pour ~40 ko une fois redimensionné en WebP).
            source={{ uri: imageUrl(product.photoUrl, width, PHOTO_HEIGHT) }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.photoWarmB }]}
            onError={({ error }) => console.warn('[product] échec photo', product.photoUrl, error)}
          />
        ) : null}
        <View style={styles.photoActions}>
          <Pressable onPress={retour} style={styles.closeBtn} hitSlop={8}>
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
          {/* Partage : envoie un lien https ouvrant cette fiche dans l'app, ou le
              store si le destinataire ne l'a pas. Voir `lib/partage.ts`. */}
          <Pressable
            onPress={() => setPartageOuvert(true)}
            style={styles.closeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('product.share')}
          >
            <Icon name="ios_share" size={20} color={colors.ink} />
          </Pressable>
        </View>
        {!product.photoUrl ? <Text style={styles.photoHint}>{t('product.photoHint')}</Text> : null}
      </View>

      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>{formatAr(product.price)}</Text>
          </View>
          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

          {/* ⚠️ Annoncé et atteignable d'un tap, pas caché derrière l'icône de
              l'en-tête : le restaurateur qui pousse son plat sur la page Facebook
              de son établissement ne va pas chercher une icône. C'est aussi
              l'écran où un client tombe en suivant un lien partagé — donc celui
              où il repartagera. */}
          <View style={styles.partage}>
            <PartageEnLigne
              titre={product.name}
              texte={textePartageProduit({ name: product.name, restaurantName: restaurant?.name })}
              url={lienProduit(product.id)}
            />
          </View>

          {groups.map((g) => {
            const cur = sel[g.id] ?? [];
            const single = g.maxSelect === 1;
            return (
              <View key={g.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={[styles.badge, g.required ? styles.badgeReq : styles.badgeOpt]}>
                    {g.required ? t('product.required') : t('product.optional')}
                  </Text>
                </View>
                {!single ? (
                  <Text style={styles.groupHint}>{t('product.upTo', { count: g.maxSelect })}</Text>
                ) : null}
                <View style={styles.chipRow}>
                  {g.options.map((o) => {
                    const selected = cur.includes(o.id);
                    const hasThumb = !!o.photoUrl && !imgFailed[o.id];
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => toggle(g, o.id)}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        {hasThumb ? (
                          <View style={styles.chipThumbWrap}>
                            <Image
                              // 34 pt à l'écran. C'est ici que le gain est le plus fort :
                              // un groupe de sauces affichait jusqu'à 8 PNG de ~1 Mo.
                              source={{ uri: thumbnailUrl(o.photoUrl, CHIP_THUMB) }}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={220}
                              style={styles.chipThumb}
                              onError={() => setImgFailed((f) => ({ ...f, [o.id]: true }))}
                            />
                          </View>
                        ) : null}
                        {/* Nom + supplément empilés : le prix ne pousse plus la puce hors de sa
                            colonne (c'était la cause du rendu « liste » sur les groupes payants). */}
                        <View style={styles.chipText}>
                          <Text
                            style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                            numberOfLines={2}
                          >
                            {o.name}
                          </Text>
                          {o.priceDelta > 0 ? (
                            <Text style={[styles.chipPrice, selected && styles.chipPriceSelected]}>
                              + {formatAr(o.priceDelta)}
                            </Text>
                          ) : null}
                        </View>
                        {/* Coche en pastille d'angle : hors flux, donc sans effet sur la largeur. */}
                        {selected ? (
                          <View style={styles.chipCheck}>
                            <Icon name="check" size={12} color={colors.primary} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.stepperWrap}>
            <QtyStepper value={qty} onDec={() => setQty((q) => Math.max(1, q - 1))} onInc={() => setQty((q) => Math.min(20, q + 1))} size="lg" />
          </View>
          {/* Restaurant ferme ou pas encore ouvert : la fiche reste consultable
              (on arrive souvent ici par un lien partage), mais l'ajout est coupe.
              `isOpen` vaut deja faux pour un `coming_soon` (voir data/api.ts). */}
          <Pressable
            onPress={handleAdd}
            disabled={!valid || !commandable}
            style={({ pressed }) => [
              styles.addBtn,
              (!valid || !commandable) && styles.addBtnDisabled,
              pressed && valid && commandable && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.addText}>
              {!commandable
                ? restaurant?.listingStatus === 'coming_soon'
                  ? t('product.restaurantBientot')
                  : t('product.restaurantFerme')
                : valid
                  ? t('product.addWithPrice', { price: formatAr(lineTotal) })
                  : t('product.chooseOptions')}
            </Text>
          </Pressable>
        </View>
      </View>

      <PartageSheet
        visible={partageOuvert}
        titre={product.name}
        texte={textePartageProduit({ name: product.name, restaurantName: restaurant?.name })}
        url={lienProduit(product.id)}
        onClose={() => setPartageOuvert(false)}
      />

      <ConflictSheet
        visible={conflict}
        currentName={cartRestaurantName}
        newName={restaurant?.name ?? ''}
        onKeep={() => setConflict(false)}
        onClear={() => {
          if (ctx) replaceWith(product, ctx, qty, selectedOptions);
          setConflict(false);
          retour();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.photoWarmB },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notFound: { fontFamily: fonts.semibold, color: colors.textMuted },
  photo: { height: 150, paddingHorizontal: spacing.screen },
  photoActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  photoHint: { position: 'absolute', left: spacing.screen, bottom: 14, fontFamily: fonts.mono, fontSize: 10, color: colors.photoWarmText },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  grabber: { width: 44, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.ink },
  price: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.primary },
  desc: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textDark, marginTop: 8 },
  partage: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.divider },
  group: { marginTop: 22 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  badge: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  badgeReq: { backgroundColor: colors.warnBg, color: colors.warnTextAlt },
  badgeOpt: { backgroundColor: colors.fieldBg, color: colors.textMuted },
  groupHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  // Grille à 2 colonnes, identique pour TOUS les groupes (obligatoire/facultatif,
  // choix unique/multiple). La largeur est fixée par la colonne, pas par le contenu :
  // une puce avec supplément reste dans sa colonne au lieu de prendre toute la ligne.
  chip: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { flex: 1, minWidth: 0 },
  chipLabel: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.ink },
  chipLabelSelected: { color: colors.white },
  chipPrice: { fontFamily: fonts.semibold, fontSize: 12, color: colors.secondary, marginTop: 2 },
  chipPriceSelected: { color: colors.white },
  chipCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipThumbWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipThumb: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  stepperWrap: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  addBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  addBtnDisabled: { backgroundColor: colors.borderStrong, shadowOpacity: 0 },
  addText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
