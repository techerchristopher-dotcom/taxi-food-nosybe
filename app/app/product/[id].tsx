import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { QtyStepper } from '../../components/QtyStepper';
import { ConflictSheet } from '../../components/ConflictSheet';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../../theme/tokens';
import { OptionGroup, SelectedOption } from '../../data/types';
import { getProductDetail } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { RestaurantContext, useCart } from '../../store/cart';

/** Écran 04 — Détail d'un produit + configuration des options (choix guidés). */
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        <Text style={styles.notFound}>Produit introuvable.</Text>
      </View>
    );
  }

  const ctx: RestaurantContext | null = restaurant
    ? { id: restaurant.id, name: restaurant.name, initials: restaurant.initials, deliveryFee: restaurant.deliveryFee }
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

  function handleAdd() {
    if (!product || !ctx || !valid) return;
    if (canAdd(product)) {
      add(product, ctx, qty, selectedOptions);
      router.back();
    } else {
      setConflict(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.photo, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.photoHint}>photo produit</Text>
      </View>

      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.price}>{formatAr(product.price)}</Text>
          </View>
          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

          {groups.map((g) => {
            const cur = sel[g.id] ?? [];
            const single = g.maxSelect === 1;
            return (
              <View key={g.id} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={[styles.badge, g.required ? styles.badgeReq : styles.badgeOpt]}>
                    {g.required ? 'Obligatoire' : 'Facultatif'}
                  </Text>
                </View>
                {!single ? <Text style={styles.groupHint}>Jusqu'à {g.maxSelect} au choix</Text> : null}
                <View style={styles.groupBox}>
                  {g.options.map((o, i) => {
                    const selected = cur.includes(o.id);
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => toggle(g, o.id)}
                        style={[styles.optRow, i > 0 && styles.optBorder]}
                      >
                        <Text style={styles.optName}>{o.name}</Text>
                        {o.priceDelta > 0 ? (
                          <Text style={styles.optPrice}>+ {formatAr(o.priceDelta)}</Text>
                        ) : null}
                        <Icon
                          name={
                            single
                              ? selected ? 'radio_button_checked' : 'radio_button_unchecked'
                              : selected ? 'check_box' : 'check_box_outline_blank'
                          }
                          size={22}
                          color={selected ? colors.primary : colors.borderStrong}
                        />
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
          <Pressable
            onPress={handleAdd}
            disabled={!valid}
            style={({ pressed }) => [styles.addBtn, !valid && styles.addBtnDisabled, pressed && valid && { opacity: 0.9 }]}
          >
            <Text style={styles.addText}>
              {valid ? `Ajouter · ${formatAr(lineTotal)}` : 'Choisissez les options'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ConflictSheet
        visible={conflict}
        currentName={cartRestaurantName}
        newName={restaurant?.name ?? ''}
        onKeep={() => setConflict(false)}
        onClear={() => {
          if (ctx) replaceWith(product, ctx, qty, selectedOptions);
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
  photo: { height: 150, paddingHorizontal: spacing.screen },
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
  group: { marginTop: 22 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  badge: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  badgeReq: { backgroundColor: colors.warnBg, color: colors.warnTextAlt },
  badgeOpt: { backgroundColor: colors.fieldBg, color: colors.textMuted },
  groupHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  groupBox: {
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  optBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  optName: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  optPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary },
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
