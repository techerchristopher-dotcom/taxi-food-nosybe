import { useState } from 'react';
import { Image, LayoutChangeEvent, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';

/**
 * Aperçu de carte cliquable — vérifier visuellement que la position captée est la bonne.
 *
 * Sans dépendance native ni clé d'API : on affiche les tuiles raster OpenStreetMap
 * (`tile.openstreetmap.org`) via de simples <Image>, calées sur le point à afficher.
 * Un appui ouvre l'app de cartes native (Plans / Google Maps) pour une vérification complète.
 *
 * ⚠️ Usage MVP léger toléré par la politique OSM ; pour un volume important, basculer vers
 * un fournisseur de tuiles dédié (clé). Voir la note dans le README si ça devient nécessaire.
 */

const TILE = 256;
const ZOOM = 16;

function lngToWorldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE * Math.pow(2, z);
}
function latToWorldY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * Math.pow(2, z);
}

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  /** Libellé passé à l'app de cartes (nom du lieu / quartier). */
  label?: string;
};

export function MapPreview({ latitude, longitude, height = 150, label }: Props) {
  const [width, setWidth] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w && w !== width) setWidth(w);
  }

  function openMaps() {
    const q = encodeURIComponent(label ?? 'Position de livraison');
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${q})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    }) as string;
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    });
  }

  // Tuiles à afficher : on centre la boîte (width x height) sur le point.
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  if (width > 0) {
    const centerX = lngToWorldX(longitude, ZOOM);
    const centerY = latToWorldY(latitude, ZOOM);
    const originX = centerX - width / 2; // coin haut-gauche de la boîte, en pixels monde
    const originY = centerY - height / 2;
    const n = Math.pow(2, ZOOM);
    const firstTx = Math.floor(originX / TILE);
    const lastTx = Math.floor((originX + width) / TILE);
    const firstTy = Math.floor(originY / TILE);
    const lastTy = Math.floor((originY + height) / TILE);
    for (let tx = firstTx; tx <= lastTx; tx++) {
      for (let ty = firstTy; ty <= lastTy; ty++) {
        const wx = ((tx % n) + n) % n; // wrap horizontal
        if (ty < 0 || ty >= n) continue; // pas de wrap vertical
        tiles.push({
          key: `${tx}_${ty}`,
          url: `https://tile.openstreetmap.org/${ZOOM}/${wx}/${ty}.png`,
          left: tx * TILE - originX,
          top: ty * TILE - originY,
        });
      }
    }
  }

  return (
    <Pressable onPress={openMaps} onLayout={onLayout} style={[styles.box, { height }]} hitSlop={0}>
      <View style={StyleSheet.absoluteFill}>
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: t.url }}
            style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
            fadeDuration={120}
          />
        ))}
      </View>

      {/* Marqueur « vous êtes ici », calé au centre exact de la boîte = le point. */}
      <View pointerEvents="none" style={styles.markerWrap}>
        <View style={styles.markerRing} />
        <View style={styles.markerDot} />
      </View>

      {/* Indice « appuyer pour ouvrir ». */}
      <View pointerEvents="none" style={styles.badge}>
        <Icon name="my_location" size={13} color={colors.white} />
        <Text style={styles.badgeText}>Vérifier sur la carte</Text>
      </View>

      {/* Attribution requise par la politique OpenStreetMap. */}
      <Text pointerEvents="none" style={styles.attribution}>© OpenStreetMap</Text>
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
  markerWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(232,52,42,0.22)',
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.white,
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
  attribution: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontFamily: fonts.regular,
    fontSize: 9,
    color: 'rgba(17,17,17,0.55)',
  },
});
