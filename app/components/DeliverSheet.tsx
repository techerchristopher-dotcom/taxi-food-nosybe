import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Button } from './Button';
import { colors, fonts, formatAr, radius, spacing } from '../theme/tokens';
import { Order, paymentLabel } from '../data/types';

/**
 * Confirmation de livraison. Si le paiement est en espèces, le livreur doit cocher qu'il a
 * bien encaissé le montant exact (trace en cas de litige) avant de valider. Sinon, simple
 * confirmation.
 *
 * ⚠️ `paymentStatus` L'EMPORTE SUR `paymentMethod`. Une commande peut porter
 * « espèces » ET avoir été réellement encaissée par carte : le repli espèces
 * (`basculer_en_especes`) repasse la commande en espèces sans pouvoir annuler le
 * PaymentIntent chez Stripe, et une authentification bancaire qui aboutit après
 * la bascule laisse `payment_method = 'especes'` avec `payment_status = 'paye'`.
 * Demander au livreur d'encaisser dans ce cas ferait payer le client DEUX FOIS,
 * la totalité de la commande. On se fie donc à ce qui a été encaissé, pas au
 * mode annoncé.
 */
export function DeliverSheet({
  order,
  submitting,
  onCancel,
  onConfirm,
}: {
  order: Order | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (cashConfirmed: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);

  // Déjà encaissé en ligne : plus rien à prendre au client, quel que soit le
  // mode affiché sur la commande.
  const dejaPayeEnLigne = order?.paymentStatus === 'paye';
  const isCash = order?.paymentMethod === 'especes' && !dejaPayeEnLigne;
  const canConfirm = !isCash || checked;

  function close() {
    setChecked(false);
    onCancel();
  }

  return (
    <Modal visible={!!order} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={() => !submitting && close()} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Confirmer la livraison{order ? ` #${order.orderNumber}` : ''}</Text>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Montant · {order ? paymentLabel(order.paymentMethod) : ''}</Text>
          <Text style={styles.amount}>{order ? formatAr(order.total) : ''}</Text>
        </View>

        {isCash ? (
          <Pressable style={styles.check} onPress={() => setChecked((v) => !v)}>
            <View style={[styles.box, checked && styles.boxOn]}>
              {checked ? <Icon name="check" size={16} color={colors.white} /> : null}
            </View>
            <Text style={styles.checkText}>J'ai bien encaissé {order ? formatAr(order.total) : ''} en espèces.</Text>
          </Pressable>
        ) : (
          <Text style={styles.noCash}>
            {dejaPayeEnLigne
              ? 'Déjà payé par carte en ligne — ne rien encaisser.'
              : `Paiement ${order ? paymentLabel(order.paymentMethod) : ''} — rien à encaisser en espèces.`}
          </Text>
        )}

        <View style={styles.actions}>
          <Button label="Annuler" variant="outline" onPress={close} style={{ flex: 1 }} />
          <Button
            label="Confirmer la livraison"
            icon="check_circle"
            onPress={() => onConfirm(isCash)}
            loading={submitting}
            disabled={!canConfirm}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: spacing.screen },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.4 },
  amountBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.tile,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDark },
  amount: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  noCash: { marginTop: 16, fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
});
