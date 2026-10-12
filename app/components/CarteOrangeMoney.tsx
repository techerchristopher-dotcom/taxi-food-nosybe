import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import { getEtatOrangeMoney } from '../data/api';

/**
 * Carte « Payer par Orange Money » (2026-10-12), sur la confirmation et le suivi d'une
 * commande payée à la livraison : numéro en gros, titulaire, montant exact et motif
 * (le numéro de commande, qui sert à reconnaître le paiement sur le téléphone).
 *
 * Une fois le paiement marqué « reçu » dans l'admin (`mon_paiement_orange_money`),
 * la carte laisse place à une ligne verte : le client ne se demande plus s'il doit payer.
 *
 * ⚠️ Le numéro et le nom sont les mêmes dans toutes les langues, et sont aussi écrits
 * dans `DeliverSheet.tsx` (livreur) et la fonction Edge `relancer-orange-money`.
 */
const NUMERO_AFFICHE = '+261 37 34 379 12';
const NUMERO_COPIE = '+261373437912';
const TITULAIRE = 'TECHER Jean Christopher';

const ORANGE = { fond: '#FFF3E8', bord: '#FFB27A', texte: '#8A3B00', fort: '#5C2700', accent: '#E06A00' };

export function CarteOrangeMoney({
  orderId,
  orderNumber,
  montant,
  recharge,
}: {
  orderId?: string | null;
  orderNumber: string;
  montant: number;
  /** Change quand la commande est relue (statut…) : l'état Orange Money est relu avec. */
  recharge?: unknown;
}) {
  const { t } = useTranslation();
  const [etat, setEtat] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (orderId) {
      void getEtatOrangeMoney(orderId).then((e) => {
        if (vivant) setEtat(e);
      });
    }
    return () => {
      vivant = false;
    };
  }, [orderId, recharge]);

  if (etat === 'recu') {
    return (
      <View style={styles.recu}>
        <Icon name="check_circle" size={18} color={colors.success} />
        <Text style={styles.recuTexte}>{t('orangeMoney.recu')}</Text>
      </View>
    );
  }

  async function copier() {
    try {
      await Clipboard.setStringAsync(NUMERO_COPIE);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* rien : le numéro reste lisible à l'écran */
    }
  }

  return (
    <View style={styles.carte}>
      <View style={styles.titreLigne}>
        <Icon name="smartphone" size={18} color={ORANGE.accent} />
        <Text style={styles.titre}>{t('orangeMoney.titre')}</Text>
      </View>
      <Text style={styles.numero} selectable>{NUMERO_AFFICHE}</Text>
      <Text style={styles.titulaire}>{TITULAIRE}</Text>
      <View style={styles.ligne}>
        <Text style={styles.ligneLabel}>{t('orangeMoney.montant')}</Text>
        <Text style={styles.ligneValeur}>{formatAr(montant)}</Text>
      </View>
      <View style={styles.ligne}>
        <Text style={styles.ligneLabel}>{t('orangeMoney.motif')}</Text>
        <Text style={styles.ligneValeur}>{orderNumber}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.bouton, pressed && { opacity: 0.7 }]}
        onPress={() => void copier()}
        accessibilityRole="button"
      >
        <Icon name={copie ? 'check' : 'content_copy'} size={16} color={ORANGE.texte} />
        <Text style={styles.boutonTexte}>{copie ? t('orangeMoney.copie') : t('orangeMoney.copier')}</Text>
      </Pressable>
      <Text style={styles.note}>{t('orangeMoney.ouEspeces')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: ORANGE.bord,
    backgroundColor: ORANGE.fond,
  },
  titreLigne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titre: { fontFamily: fonts.bold, fontSize: 14, color: ORANGE.texte },
  numero: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: 0.5, color: ORANGE.fort, marginTop: 8 },
  titulaire: { fontFamily: fonts.semibold, fontSize: 13, color: ORANGE.texte, marginTop: 2 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  ligneLabel: { fontFamily: fonts.regular, fontSize: 13, color: ORANGE.texte },
  ligneValeur: { fontFamily: fonts.bold, fontSize: 13, color: ORANGE.fort },
  bouton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ORANGE.accent,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 14, color: ORANGE.texte },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: ORANGE.texte, marginTop: 10 },
  recu: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  recuTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
});
