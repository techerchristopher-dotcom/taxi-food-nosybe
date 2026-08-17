import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { MapSurface } from './MapSurface';
import { colors, fonts } from '../theme/tokens';

/**
 * Aperçu de carte cliquable — vérifier visuellement que la position captée est la bonne.
 *
 * La surface elle-même vient de `MapSurface` : carte NATIVE (`react-native-maps` → MapKit sur
 * iOS, Google Maps sur Android), avec repli sur des tuiles OpenStreetMap côté web
 * (`MapSurface.web.tsx`), `react-native-maps` n'ayant pas d'implémentation navigateur.
 *
 * Un appui ouvre l'app de cartes du téléphone pour une vérification complète (zoom, satellite).
 */

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  /** Libellé passé à l'app de cartes (nom du lieu / quartier). */
  label?: string;
};

export function MapPreview({ latitude, longitude, height = 150, label }: Props) {
  const { t } = useTranslation();

  function openMaps() {
    const q = encodeURIComponent(label ?? t('address.mapLabel'));
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${q})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    }) as string;
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    });
  }

  return (
    <Pressable onPress={openMaps} style={[styles.box, { height }]} hitSlop={0}>
      <MapSurface latitude={latitude} longitude={longitude} />

      {/* Indice « appuyer pour ouvrir ». */}
      <View pointerEvents="none" style={styles.badge}>
        <Icon name="my_location" size={13} color={colors.white} />
        <Text style={styles.badgeText}>{t('address.mapBadge')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.photoGrayB,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17,17,17,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
});
