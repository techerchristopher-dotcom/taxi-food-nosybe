import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Avatar, Card, Divider, InfoBanner, SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, formatAr, radius, spacing } from '../theme/tokens';
import { formatAddressLine, PaymentMethod, paymentShort } from '../data/types';
import {
  createOrder,
  listAddresses,
  raisonPromoDepuisErreur,
  RaisonPromo,
  verifierCodePromo,
} from '../data/api';
import { useLoad } from '../lib/useLoad';
import { lineUnitPrice, packagingLines, useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';
import { useSession } from '../store/session';
import { useAuthIntent } from '../store/authIntent';

const METHODS: { key: PaymentMethod; icon: string; iconColor: string; subKey: string }[] = [
  { key: 'cb', icon: 'credit_card', iconColor: colors.textDark, subKey: 'checkout.cbSub' },
  { key: 'especes', icon: 'payments', iconColor: colors.textDark, subKey: 'checkout.especesSub' },
  { key: 'orange_money', icon: 'smartphone', iconColor: colors.secondary, subKey: 'checkout.orangeSub' },
];

/**
 * GARDE DU TUNNEL DE COMMANDE, second verrou.
 *
 * `app/address.tsx` porte le verrou principal et prétendait couvrir « tout chemin vers le
 * paiement, lien profond compris ». C'était faux : le schéma `taxifood` est déclaré et
 * expo-router expose chaque fichier de route, donc `taxifood:///checkout` ouvrait le
 * récapitulatif, le choix du paiement et le bouton « Valider » à quelqu'un sans compte.
 * Le dégât restait contenu (`useCheckout` vit en mémoire : `addressId` vaut null au
 * démarrage à froid, et `validate()` s'arrêtait sur « adresse manquante »), mais le message
 * parlait d'adresse là où il fallait proposer un compte.
 *
 * Deux cas, deux sorties :
 *  - pas de compte → connexion, avec `/address` en retour (l'écran qui vient juste avant) ;
 *  - compte mais aucune adresse choisie → `/address`, qui est précisément l'étape sautée.
 *
 * Composant séparé, comme dans `address.tsx` : les hooks du récapitulatif — dont
 * `useLoad(listAddresses)` — n'ont pas à s'exécuter pour quelqu'un qu'on redirige.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const addressId = useCheckout((s) => s.addressId);

  useEffect(() => {
    if (!session) {
      useAuthIntent.getState().set('/address');
      router.replace('/login');
      return;
    }
    if (!addressId) router.replace('/address');
  }, [session, addressId, router]);

  // Le temps de la bascule : fond neutre, pas de spinner — il laisserait croire à un
  // chargement alors qu'on quitte l'écran.
  if (!session || !addressId) return <View style={styles.container} />;
  return <CheckoutForm />;
}

/** Écran 07 — Validation de la commande (récap + choix du paiement). */
function CheckoutForm() {
  const router = useRouter();
  const { t } = useTranslation();

  const lines = useCart((s) => s.lines);
  const restaurantId = useCart((s) => s.restaurantId);
  const restaurantName = useCart((s) => s.restaurantName);
  const restaurantInitials = useCart((s) => s.restaurantInitials);
  const subtotal = useCart((s) => s.subtotal());
  const deliveryFee = useCart((s) => s.deliveryFee());
  const packaging = useMemo(() => packagingLines(lines), [lines]);
  const total = useCart((s) => s.total());
  const clear = useCart((s) => s.clear);

  const addressId = useCheckout((s) => s.addressId);
  const paymentMethod = useCheckout((s) => s.paymentMethod);
  const setPayment = useCheckout((s) => s.setPayment);

  const { data: addresses } = useLoad(() => listAddresses(), []);
  const address = addresses?.find((a) => a.id === addressId) ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code promo. `promo` n'est renseigné qu'après un aller-retour avec la base :
  // on n'affiche jamais une remise que le serveur n'a pas confirmée.
  const [codeSaisi, setCodeSaisi] = useState('');
  const [promo, setPromo] = useState<{ code: string; remise: number } | null>(null);
  const [promoRaison, setPromoRaison] = useState<RaisonPromo | 'reseau' | null>(null);
  const [promoEnCours, setPromoEnCours] = useState(false);

  const remise = promo?.remise ?? 0;
  const totalAPayer = Math.max(0, total - remise);

  async function appliquerCode() {
    const saisi = codeSaisi.trim();
    if (!saisi || !restaurantId) return;
    setPromoRaison(null);
    setPromoEnCours(true);
    try {
      const r = await verifierCodePromo(saisi, restaurantId, subtotal);
      if (r.valide) {
        setPromo({ code: r.code, remise: r.remise });
        setCodeSaisi(r.code);
      } else {
        setPromo(null);
        setPromoRaison(r.raison);
      }
    } catch {
      setPromo(null);
      setPromoRaison('reseau');
    } finally {
      setPromoEnCours(false);
    }
  }

  function retirerCode() {
    setPromo(null);
    setPromoRaison(null);
    setCodeSaisi('');
  }

  async function validate() {
    if (!restaurantId || !addressId) {
      setError(t('checkout.needAddress'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const order = await createOrder({
        restaurantId,
        addressId,
        paymentMethod,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          options: l.options.map((o) => ({ optionId: o.optionId, quantity: o.quantity })),
        })),
        // On envoie le CODE, jamais le montant : la base recalcule la remise.
        codePromo: promo?.code ?? null,
      });
      clear();
      // On transmet le total et le numéro renvoyés par la RPC (source autoritative,
      // déjà recalculée côté serveur) : la confirmation affiche le bon montant tout de
      // suite, sans dépendre du refetch (évite le « 0 Ar » transitoire).
      router.replace({
        pathname: '/confirmation',
        params: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: String(order.total),
          payment: paymentMethod,
        },
      });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      // Le code promo peut être refusé à la validation alors qu'il était bon
      // quelques secondes plus tôt (plafond atteint, commande passée depuis un
      // autre appareil). On le retire et on dit précisément pourquoi, plutôt
      // que d'afficher « la commande n'a pas pu être créée ».
      const raison = raisonPromoDepuisErreur(msg);
      if (raison) {
        setPromo(null);
        setPromoRaison(raison);
        setError(t('promo.rejeteALaValidation'));
      } else {
        setError(
          /position gps|localisation/i.test(msg) ? t('checkout.needGps') : t('checkout.failed'),
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title={t('checkout.title')} />

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.restoRow}>
            <Avatar initials={restaurantInitials || '--'} size={36} r={10} />
            <Text style={styles.restoName}>{restaurantName}</Text>
          </View>
          <Divider style={{ marginVertical: 14 }} />
          {lines.map((l) => (
            <View key={l.key} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {l.quantity} × {l.product.name}
                </Text>
                {l.options.length > 0 ? (
                  <Text style={styles.itemOptions}>{l.options.map((o) => o.name).join(', ')}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>{formatAr(lineUnitPrice(l) * l.quantity)}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.addrCard}>
          <Icon name="location_on" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            {address ? (
              <>
                <Text style={styles.addrLabel}>{formatAddressLine(address.zone, address.label)}</Text>
                <Text style={styles.addrDetail}>
                  {address.landmark} · {address.phone}
                </Text>
              </>
            ) : (
              <Text style={styles.addrLabel}>{t('checkout.noAddress')}</Text>
            )}
          </View>
          <Pressable onPress={() => router.push('/address')}>
            <Text style={styles.modify}>{t('common.modify')}</Text>
          </Pressable>
        </Card>

        <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>{t('promo.section')}</SectionLabel>
        <Card>
          {promo ? (
            <View style={styles.promoApplique}>
              <Icon name="check_circle" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitre}>{t('promo.applique', { code: promo.code })}</Text>
                <Text style={styles.promoSous}>
                  {t('promo.economie', { amount: formatAr(promo.remise) })}
                </Text>
              </View>
              <Pressable onPress={retirerCode} hitSlop={8}>
                <Text style={styles.modify}>{t('promo.retirer')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.promoLigne}>
              <TextInput
                style={styles.promoInput}
                value={codeSaisi}
                onChangeText={(v) => {
                  setCodeSaisi(v);
                  if (promoRaison) setPromoRaison(null);
                }}
                placeholder={t('promo.placeholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={appliquerCode}
                editable={!promoEnCours}
              />
              <Pressable
                onPress={appliquerCode}
                disabled={promoEnCours || codeSaisi.trim().length === 0}
                style={[
                  styles.promoBouton,
                  (promoEnCours || codeSaisi.trim().length === 0) && styles.promoBoutonInactif,
                ]}
              >
                {promoEnCours ? (
                  <ActivityIndicator size="small" color={colors.surface} />
                ) : (
                  <Text style={styles.promoBoutonTexte}>{t('promo.appliquer')}</Text>
                )}
              </Pressable>
            </View>
          )}
          {/* Un message d'erreur doit dire QUOI FAIRE, pas seulement que ça a raté. */}
          {promoRaison ? <Text style={styles.promoErreur}>{t(`promo.erreur.${promoRaison}`)}</Text> : null}
        </Card>

        <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>{t('checkout.paymentSection')}</SectionLabel>
        <View style={{ gap: 10 }}>
          {METHODS.map((m) => {
            const active = m.key === paymentMethod;
            return (
              <Pressable
                key={m.key}
                onPress={() => setPayment(m.key)}
                style={[styles.payRow, { borderColor: active ? colors.primary : colors.border }]}
              >
                <Icon name={m.icon} size={24} color={m.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payTitle}>{t(`payment.${m.key}`)}</Text>
                  <Text style={styles.paySub}>{t(m.subKey)}</Text>
                </View>
                <Icon
                  name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                  size={22}
                  color={active ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 14 }}>
          <InfoBanner>{t('checkout.noCharge')}</InfoBanner>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BottomBar>
        {/* Marchandise et livraison SEPAREES avant le total. Le client doit voir
            ce qu'il paie au restaurant et ce qu'il paie pour etre livre — un
            montant unique donne l'impression que le repas coute plus cher qu'il
            ne coute. C'est la meme decomposition que le panier et que la base. */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('cart.subtotal')}</Text>
          <Text style={styles.detailValue}>{formatAr(subtotal)}</Text>
        </View>
        {packaging.map((p) => (
          <View key={p.label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{p.label}</Text>
            <Text style={styles.detailValue}>{formatAr(p.amount)}</Text>
          </View>
        ))}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('common.deliveryFee')}</Text>
          <Text style={styles.detailValue}>{formatAr(deliveryFee)}</Text>
        </View>
        {promo ? (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, styles.remiseTexte]}>
              {t('promo.ligne', { code: promo.code })}
            </Text>
            <Text style={[styles.detailValue, styles.remiseTexte]}>−{formatAr(promo.remise)}</Text>
          </View>
        ) : null}
        <View style={styles.separateur} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.totalToPay', { method: paymentShort(paymentMethod) })}</Text>
          <Text style={styles.totalValue}>{formatAr(totalAPayer)}</Text>
        </View>
        <Button label={t('checkout.validate')} icon="check_circle" onPress={validate} loading={submitting} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  restoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restoName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  itemName: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  itemOptions: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  addrCard: { marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  addrDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
  modify: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  payRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  paySub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
  promoLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoInput: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  promoBouton: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
    alignItems: 'center',
  },
  promoBoutonInactif: { opacity: 0.45 },
  promoBoutonTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.surface },
  promoApplique: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoTitre: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  promoSous: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  promoErreur: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.dangerText, marginTop: 10 },
  remiseTexte: { color: colors.primary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  detailLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  detailValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark },
  separateur: { height: 1, backgroundColor: colors.border, marginTop: 6, marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
});
