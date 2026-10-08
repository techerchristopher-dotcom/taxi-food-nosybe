import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Une photo en plein écran, sur fond noir, sans recadrage (`contain`) : c'est l'endroit
 * où le client vérifie à quoi ressemble VRAIMENT le plat — rien ne doit en être coupé.
 * Un tap n'importe où referme. Aucun module natif : livrable en OTA.
 */
export function PhotoPleinEcran({
  uri,
  legende,
  badge,
  onClose,
}: {
  uri: string | null;
  legende?: string | null;
  /** Pastille en bas, ex. « Vraie photo du plat ». */
  badge?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.fond} onPress={onClose} accessibilityLabel={t('product.fermerPhoto')}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" transition={150} />
        ) : null}
        <View style={[styles.fermer, { top: insets.top + 12 }]}>
          <Icon name="close" size={22} color={colors.ink} />
        </View>
        {legende || badge ? (
          <View style={[styles.bas, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTexte}>{badge}</Text>
              </View>
            ) : null}
            {legende ? <Text style={styles.legende}>{legende}</Text> : null}
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: '#000000' },
  fermer: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bas: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  badge: { backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeTexte: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  legende: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white, textAlign: 'center' },
});
