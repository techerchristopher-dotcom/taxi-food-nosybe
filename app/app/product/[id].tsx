import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { QtyStepper } from '../../components/QtyStepper';
import { ConflictSheet } from '../../components/ConflictSheet';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../../theme/tokens';
import { getProduct, getRestaurant } from '../../data/mock';
import { useCart } from '../../store/cart';

/** Écran 04 — Détail d'un produit (feuille montante / modale). */
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = getProduct(id!);

  const add = useCart((s) => s.add);
  const replaceWith = useCart((s) => s.replaceWith);
  const canAdd = useCart((s) => s.canAdd);
  const cartRestaurantId = useCart((s) => s.restaurantId);

  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState('');
  const [conflict, setConflict] = useState(false);

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Produit introuvable.</Text>
      </View>
    );
  }

  function handleAdd() {
    if (!product) return;
    if (canAdd(product)) {
      add(product, qty, comment.trim() || undefined);
      router.back();
    } else {
      setConflict(true);
    }
  }

  const currentName = cartRestaurantId ? getRestaurant(cartRestaurantId)?.name ?? '' : '';
  const newName = getRestaurant(product.restaurantId)?.name ?? '';

  return (
    <View style={styles.container}>
      {/* Zone photo (placeholder) */}
      <View style={[styles.photo, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.photoHint}>photo produit plein cadre</Text>
      </View>

      {/* Feuille de détail */}
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>{formatAr(product.price)}</Text>
          </View>
          <Text style={styles.desc}>{product.description}</Text>

          {product.tags && product.tags.length > 0 ? (
            <View style={styles.tags}>
              {product.tags.map((t) => {
                const spicy = t.toLowerCase() === 'épicé';
                return (
                  <View key={t} style={[styles.tag, spicy ? styles.tagSpicy : styles.tagNeutral]}>
                    {spicy ? <Icon name="local_fire_department" size={15} color={colors.warnTextAlt} /> : null}
                    <Text style={[styles.tagText, { color: spicy ? colors.warnTextAlt : colors.textDark }]}>
                      {t}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Commentaire pour le restaurant</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Ex. sans oignons, bien cuite…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.commentField}
          />
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.stepperWrap}>
            <QtyStepper value={qty} onDec={() => setQty((q) => Math.max(1, q - 1))} onInc={() => setQty((q) => Math.min(20, q + 1))} size="lg" />
          </View>
          <Pressable onPress={handleAdd} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.addText}>Ajouter · {formatAr(product.price * qty)}</Text>
          </Pressable>
        </View>
      </View>

      <ConflictSheet
        visible={conflict}
        currentName={currentName}
        newName={newName}
        onKeep={() => setConflict(false)}
        onClear={() => {
          replaceWith(product, qty, comment.trim() || undefined);
          setConflict(false);
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.photoWarmB },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notFound: { fontFamily: fonts.semibold, color: colors.textMuted },
  photo: { flex: 1, paddingHorizontal: spacing.screen },
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '62%',
  },
  grabber: { width: 44, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, letterSpacing: -0.5, color: colors.ink },
  price: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
  desc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textDark, marginTop: 10 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  tagSpicy: { backgroundColor: colors.warnBg },
  tagNeutral: { backgroundColor: colors.fieldBg },
  tagText: { fontFamily: fonts.semibold, fontSize: 11 },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 6,
  },
  commentField: {
    minHeight: 64,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
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
  addText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
