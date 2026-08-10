import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onKeep} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
          <View style={styles.iconTile}>
            <Icon name="swap_horiz" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Changer de restaurant ?</Text>
          <Text style={styles.body}>
            Votre panier contient des plats de <Text style={styles.strong}>{currentName}</Text>. Ajouter
            un produit de <Text style={styles.strong}>{newName}</Text> videra le panier en cours.
          </Text>
          <View style={{ gap: 10, marginTop: 22 }}>
            <Button label="Vider et continuer" onPress={onClear} />
            <Button label="Garder mon panier" variant="outline" onPress={onKeep} />
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
