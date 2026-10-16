import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './primitives';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';
import type { Order } from '../data/types';
import { annulerMaReservation, refusReservationDepuisErreur } from '../data/api';
import { heureNosyBe } from '../lib/reservation';

/**
 * Suivi d'une commande programmée (2026-10-16) : l'heure de livraison choisie, et
 * « Annuler ma commande » tant que le restaurant ne l'a pas acceptée.
 *
 * ⚠️ Deux taps, pas une alerte système : `Alert.alert` avec boutons ne s'affiche pas
 * sur le web. La base revérifie de toute façon (`annuler_ma_reservation` refuse une
 * commande déjà acceptée).
 */
export function BlocReservation({ order, onAnnulee }: { order: Order; onAnnulee: () => void }) {
  const { t, i18n } = useTranslation();
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!order.livraisonSouhaitee || order.status === 'annulee' || order.status === 'livree') return null;
  const annulable = order.status === 'recue';

  async function annuler() {
    if (!confirmer) {
      setConfirmer(true);
      return;
    }
    setBusy(true);
    setErreur(null);
    try {
      await annulerMaReservation(order.id);
      onAnnulee();
    } catch (e) {
      const refus = refusReservationDepuisErreur((e as { message?: string })?.message ?? '');
      setErreur(refus?.motif === 'deja_acceptee' ? t('reservation.annulerTropTard') : t('reservation.annulerEchec'));
      setConfirmer(false);
      onAnnulee();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.carte}>
      <View style={styles.ligne}>
        <Icon name="event" size={22} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>
            {t('reservation.prevueA', { heure: heureNosyBe(order.livraisonSouhaitee, i18n.language) })}
          </Text>
          <Text style={styles.texte}>{t('reservation.indicatif')}</Text>
        </View>
      </View>
      {annulable ? (
        <>
          <Pressable
            onPress={annuler}
            disabled={busy}
            style={({ pressed }) => [styles.bouton, confirmer && styles.boutonConfirmer, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={[styles.boutonTexte, confirmer && styles.boutonTexteConfirmer]}>
              {confirmer ? t('reservation.annulerConfirmer') : t('reservation.annuler')}
            </Text>
          </Pressable>
          {confirmer && !busy ? (
            <Pressable onPress={() => setConfirmer(false)} hitSlop={8}>
              <Text style={styles.garder}>{t('reservation.garder')}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  carte: { marginTop: 14 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titre: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  texte: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  bouton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  boutonConfirmer: { backgroundColor: colors.dangerText },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText },
  boutonTexteConfirmer: { color: colors.white },
  garder: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 10, textAlign: 'center' },
});
