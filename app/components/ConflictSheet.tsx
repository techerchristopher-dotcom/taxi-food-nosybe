import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Button } from './Button';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Feuille « Changer de restaurant ? » (écran 05b de la maquette).
 * Déclenchée quand on ajoute un produit d'un autre restaurant que le panier en cours.
 */
export function ConflictSheet({
  visible,
  currentName,
  newName,
  onClear,
  onKeep,
}: {
  visible: boolean;
  currentName: string;
  newName: string;
  onClear: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onKeep} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
          <View style={styles.iconTile}>
            <Icon name="swap_horiz" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('conflict.title')}</Text>
          <Text style={styles.body}>
            {t('conflict.bodyStart')}
            <Text style={styles.strong}>{currentName}</Text>
            {t('conflict.bodyMiddle')}
            <Text style={styles.strong}>{newName}</Text>
            {t('conflict.bodyEnd')}
          </Text>
          <View style={{ gap: 10, marginTop: 22 }}>
            <Button label={t('conflict.clear')} onPress={onClear} />
            <Button label={t('conflict.keep')} variant="outline" onPress={onKeep} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, color: colors.ink, marginTop: 16 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textDark, marginTop: 8 },
  strong: { fontFamily: fonts.bold },
});
