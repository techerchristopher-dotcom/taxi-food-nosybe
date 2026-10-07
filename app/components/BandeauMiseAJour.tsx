import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { appliquerMiseAJour, useMiseAJourPrete } from '../lib/miseAJour';

/**
 * « Nouvelle version disponible — Mettre à jour » (2026-10-07).
 *
 * Posé au-dessus de tous les écrans (dans `_layout.tsx`), en haut, sous la barre d'état.
 * N'apparaît que si une mise à jour est DÉJÀ téléchargée (`useMiseAJourPrete`) : le tap
 * recharge immédiatement, sans attente réseau. La croix le masque jusqu'au prochain
 * retour au premier plan — on ne force jamais un rechargement au milieu d'un panier.
 */
export function BandeauMiseAJour() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const prete = useMiseAJourPrete((s) => s.prete);
  const masquee = useMiseAJourPrete((s) => s.masquee);
  const masquer = useMiseAJourPrete((s) => s.masquer);
  if (!prete || masquee) return null;

  return (
    <View pointerEvents="box-none" style={[styles.calque, { top: insets.top + 8 }]}>
      <View style={styles.bandeau}>
        <Pressable style={styles.action} onPress={() => void appliquerMiseAJour()} accessibilityRole="button">
          <Icon name="system_update" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>{t('miseAJour.titre')}</Text>
            <Text style={styles.cta}>{t('miseAJour.cta')}</Text>
          </View>
        </Pressable>
        <Pressable onPress={masquer} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('miseAJour.fermer')} style={styles.croix}>
          <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calque: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  titre: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  cta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent, marginTop: 1 },
  croix: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
