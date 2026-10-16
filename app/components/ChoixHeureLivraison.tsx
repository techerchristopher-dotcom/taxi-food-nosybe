import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './primitives';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';
import { listerCreneaux } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { heureNosyBe } from '../lib/reservation';

/**
 * « Quand veux-tu être livré ? » — commande programmée, LE JOUR MÊME (2026-10-16).
 *
 * - Restaurant OUVERT : « Dès que possible » (par défaut) ou un créneau plus tard.
 * - Restaurant FERMÉ (rouvre aujourd'hui) : un créneau obligatoire, le premier est
 *   choisi d'office.
 *
 * Les créneaux viennent de la base (`creneaux_livraison`) : préparation et livraison
 * estimées, marge comprise, lancement en cuisine dans un service du restaurant.
 * L'écran ne calcule aucune heure ; `commander_programme` revérifie tout.
 */
export function ChoixHeureLivraison({
  restaurantId,
  addressId,
  productIds,
  ouvert,
  valeur,
  onChange,
}: {
  restaurantId: string;
  addressId: string | null;
  productIds: string[];
  /** null tant que l'état d'ouverture n'est pas connu. */
  ouvert: boolean | null;
  /** Heure ISO choisie, ou null = dès que possible. */
  valeur: string | null;
  onChange: (iso: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const cle = productIds.join(',');
  const { data: creneaux, loading } = useLoad(
    () => listerCreneaux(restaurantId, addressId, productIds),
    [restaurantId, addressId, cle],
  );

  // Fermé : pas de « dès que possible », le premier créneau est pris d'office.
  // Un créneau choisi qui a disparu (le temps a passé) est remplacé, jamais gardé.
  useEffect(() => {
    if (!creneaux || ouvert === null) return;
    const encore = valeur && creneaux.some((c) => c.livraison === valeur);
    if (encore) return;
    if (ouvert) {
      if (valeur) onChange(null);
    } else {
      onChange(creneaux[0]?.livraison ?? null);
    }
  }, [creneaux, ouvert, valeur, onChange]);

  if (ouvert === null) return null;
  // Ouvert et aucun créneau plus tard : rien à proposer, l'écran reste celui d'avant.
  if (ouvert && creneaux && creneaux.length === 0) return null;

  return (
    <Card>
      {!ouvert ? (
        <View style={styles.avis}>
          <Icon name="schedule" size={20} color={colors.success} />
          <Text style={styles.avisTexte}>{t('reservation.checkoutFerme')}</Text>
        </View>
      ) : null}

      {loading && !creneaux ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
      ) : creneaux && creneaux.length === 0 ? (
        <Text style={styles.vide}>{t('reservation.aucunCreneau')}</Text>
      ) : (
        <View style={styles.chips}>
          {ouvert ? (
            <Pressable
              onPress={() => onChange(null)}
              style={[styles.chip, valeur === null && styles.chipActif]}
              accessibilityRole="radio"
              accessibilityState={{ selected: valeur === null }}
            >
              <Text style={[styles.chipTexte, valeur === null && styles.chipTexteActif]}>
                {t('reservation.desQuePossible')}
              </Text>
            </Pressable>
          ) : null}
          {(creneaux ?? []).map((c) => {
            const actif = valeur === c.livraison;
            return (
              <Pressable
                key={c.livraison}
                onPress={() => onChange(c.livraison)}
                style={[styles.chip, actif && styles.chipActif]}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
              >
                <Text style={[styles.chipTexte, actif && styles.chipTexteActif]}>
                  {heureNosyBe(c.livraison, i18n.language)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {valeur ? (
        <Text style={styles.note}>
          {t(ouvert ? 'reservation.noteOuvert' : 'reservation.noteFerme', {
            heure: heureNosyBe(valeur, i18n.language),
          })}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  avis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.successBg,
  },
  avisTexte: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActif: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTexte: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  chipTexteActif: { color: colors.white },
  vide: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 12 },
});
