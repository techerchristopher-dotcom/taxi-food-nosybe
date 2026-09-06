import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { CodePromo } from '../components/CodePromo';
import { Avatar, Card, Divider, InfoBanner, SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { ChoixModePaiement } from '../components/paiement/ChoixModePaiement';
import { colors, fonts, formatAr, spacing } from '../theme/tokens';
import { formatAddressLine, paymentShort } from '../data/types';
import { createOrder, listAddresses, raisonPromoDepuisErreur } from '../data/api';
import {
  apercuMontantMineur,
  ConfigPaiement,
  CONFIG_PAIEMENT_ETEINTE,
  formatMontantMineur,
  formatTaux,
  lireConfigPaiement,
} from '../data/paiement';
import { useLoad } from '../lib/useLoad';
import { useFraisLivraisonAJour } from '../lib/fraisLivraison';
import { lineUnitPrice, packagingLines, useCart } from '../store/cart';
import { usePromo, usePromoStore } from '../store/promo';
import { useCheckout } from '../store/checkout';
import { useSession } from '../store/session';
import { useAuthIntent } from '../store/authIntent';

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
  const { t, i18n } = useTranslation();

  const lines = useCart((s) => s.lines);
  const restaurantId = useCart((s) => s.restaurantId);
  const restaurantName = useCart((s) => s.restaurantName);
  const restaurantInitials = useCart((s) => s.restaurantInitials);
  const subtotal = useCart((s) => s.subtotal());
  const deliveryFee = useCart((s) => s.deliveryFee());
  const packaging = useMemo(() => packagingLines(lines), [lines]);
  const total = useCart((s) => s.total());
  const clear = useCart((s) => s.clear);

  // Dernier écran avant le débit : les frais de livraison affichés doivent être
  // ceux que `create_order` va facturer, pas ceux mémorisés au premier ajout au
  // panier. Voir `lib/fraisLivraison.ts` — c'est aussi ce qui empêche la remise
  // d'un code promo d'effacer à l'écran une livraison réellement due.
  useFraisLivraisonAJour();

  const addressId = useCheckout((s) => s.addressId);
  const paymentMethod = useCheckout((s) => s.paymentMethod);
  const setPayment = useCheckout((s) => s.setPayment);

  const { data: addresses } = useLoad(() => listAddresses(), []);
  const address = addresses?.find((a) => a.id === addressId) ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Code promo — état PARTAGÉ avec le panier (`store/promo.ts`). Le client l'a
  // très probablement déjà saisi là-bas, au moment où les frais de livraison sont
  // apparus dans son total : il le retrouve ici rempli, remise comprise, et n'a
  // rien à retaper. `remise` reste un aperçu confirmé par la base, jamais un
  // calcul local.
  const promo = usePromo();
  const totalAPayer = Math.max(0, total - promo.remise);

  // ------------------------------------------------------------ PAIEMENT CARTE
  // Réglages lus en base (`payment_config`), jamais devinés : le taux, la devise
  // et l'interrupteur général y vivent. Tant qu'on n'a pas répondu, on part de
  // « carte éteinte » — mieux vaut proposer les espèces à quelqu'un qui aurait pu
  // payer par carte que d'ouvrir un tunnel qu'on ne sait pas configurer.
  const [configPaiement, setConfigPaiement] = useState<ConfigPaiement>(CONFIG_PAIEMENT_ETEINTE);
  useEffect(() => {
    let vivant = true;
    lireConfigPaiement()
      .then((c) => {
        if (vivant) setConfigPaiement(c);
      })
      .catch(() => {
        /* repli déjà en place : carte éteinte */
      });
    return () => {
      vivant = false;
    };
  }, []);

  // Aperçu du montant en euros. Même règle d'arrondi que `montant_eur_centimes`
  // en base (au SUPÉRIEUR) pour que le chiffre annoncé ici soit exactement celui
  // que le serveur calculera à l'étape suivante.
  const apercuEur = apercuMontantMineur(totalAPayer, configPaiement.fxArParEur);
  const montantTropFaible = apercuEur != null && apercuEur < configPaiement.montantMinimumMinor;
  /**
   * La carte n'apparaît QUE si la base l'autorise. `carte_active = false` est
   * l'arrêt d'urgence : l'option ne doit pas être grisée, elle ne doit pas
   * exister. Un montant sous le minimum Stripe la retire aussi — le paiement
   * échouerait de toute façon côté serveur, autant ne pas le proposer.
   */
  const carteProposable = configPaiement.carteActive && apercuEur != null && !montantTropFaible;

  // Si la carte disparaît sous les pieds du client (interrupteur coupé pendant
  // qu'il compose son panier, code promo qui fait passer le total sous le
  // minimum), on le ramène sur le mode par défaut plutôt que de laisser une
  // sélection invisible.
  useEffect(() => {
    if (paymentMethod === 'cb' && !carteProposable) setPayment('especes');
  }, [paymentMethod, carteProposable, setPayment]);

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
        // Tout code retenu part, même quand la vérification d'aperçu n'a pas
        // abouti (réponse encore en vol, réseau coupé) — c'est `create_order`
        // qui tranche, et le client ne perd plus sa remise en silence. Seul un
        // code qu'elle a déjà refusé reste à quai : il ferait échouer la
        // commande en boucle. Voir `store/promo.ts`.
        codePromo: promo.aEnvoyer,
      });
      // Le panier est vidé dès que la commande existe, y compris pour une carte
      // non encore payée : la commande est créée quoi qu'il arrive, et garder le
      // panier inviterait à la passer une seconde fois. Le repli espèces et la
      // reprise de paiement travaillent sur la commande, plus sur le panier.
      clear();
      // On transmet le total et le numéro renvoyés par la RPC (source autoritative,
      // déjà recalculée côté serveur) : la confirmation affiche le bon montant tout de
      // suite, sans dépendre du refetch (évite le « 0 Ar » transitoire).
      const params = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: String(order.total),
        payment: paymentMethod,
      };
      // ⚠️ La carte s'encaisse AVANT la confirmation. On ne va sur
      // `/confirmation` que quand il n'y a rien à débiter, sinon on afficherait
      // « commande envoyée ! » à quelqu'un qui n'a pas encore payé.
      router.replace(
        paymentMethod === 'cb'
          ? { pathname: '/paiement', params }
          : { pathname: '/confirmation', params },
      );
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      // Le code promo peut être refusé à la validation alors qu'il était bon
      // quelques secondes plus tôt (plafond atteint, commande passée depuis un
      // autre appareil). On le retire et on dit précisément pourquoi, plutôt
      // que d'afficher « la commande n'a pas pu être créée ».
      const raison = raisonPromoDepuisErreur(msg);
      if (raison) {
        usePromoStore.getState().marquerRefus(raison);
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
          {/* Même bloc qu'au panier, même état : si le code a été saisi là-bas,
              il est ici déjà appliqué, remise à l'appui. Jamais deux saisies. */}
          <CodePromo />
        </Card>

        <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>{t('checkout.paymentSection')}</SectionLabel>
        <ChoixModePaiement
          valeur={paymentMethod}
          onChange={setPayment}
          carteProposable={carteProposable}
        />

        {/* ⚠️ « aucun débit maintenant » devient FAUX dès qu'une carte est
            prélevée en ligne. Le bandeau suit donc le mode choisi, et la carte
            annonce le montant exact en euros AVANT le paiement — c'est ce qui
            protège d'une contestation bancaire et d'un rejet en revue Apple. */}
        <View style={{ marginTop: 14 }}>
          {paymentMethod === 'cb' && apercuEur != null ? (
            <InfoBanner icon="credit_card">
              {t('checkout.cbDebit', {
                montant: formatMontantMineur(apercuEur, configPaiement.devise, i18n.language),
                taux: formatTaux(configPaiement.fxArParEur),
              })}
            </InfoBanner>
          ) : (
            <InfoBanner>{t('checkout.noCharge')}</InfoBanner>
          )}
        </View>

        {/* Le taux est PROPRE A TAXI FOOD, il ne suit pas le cours du jour, et la
            banque du client peut ajouter ses frais. Le taire serait la meilleure
            facon de recolter une contestation bancaire. */}
        {paymentMethod === 'cb' && apercuEur != null ? (
          <Text style={styles.infoCarte}>{t('paiement.mentionDevise')}</Text>
        ) : null}

        {/* Le minimum Stripe (50 centimes) n'est jamais atteint par une vraie
            commande, mais un code promo peut faire tomber le total très bas. On
            explique pourquoi la carte a disparu plutôt que de la faire
            disparaître en silence. */}
        {configPaiement.carteActive && montantTropFaible ? (
          <Text style={styles.infoCarte}>{t('checkout.cbMinimum')}</Text>
        ) : null}

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
        {promo.remise > 0 && promo.code ? (
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
  infoCarte: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    marginTop: 10,
  },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
  remiseTexte: { color: colors.primary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  detailLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  detailValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark },
  separateur: { height: 1, backgroundColor: colors.border, marginTop: 6, marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
});
