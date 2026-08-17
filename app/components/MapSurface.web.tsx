import { useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

/**
 * Pendant WEB de `MapSurface.tsx` : `react-native-maps` ne fonctionne que sur iOS/Android.
 * On garde ici l'aperçu sans dépendance native — tuiles raster OpenStreetMap affichées
 * par de simples <Image>, calées sur le point, avec le marqueur au centre exact.
 *
 * ⚠️ Usage léger toléré par la politique OSM. Pour un volume important, passer à un
 * fournisseur de tuiles dédié (avec clé).
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
};

export function MapSurface({ latitude, longitude }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.round(width);
    const h = Math.round(height);
    if ((w && w !== size.width) || (h && h !== size.height)) setSize({ width: w, height: h });
  }

  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  if (size.width > 0 && size.height > 0) {
    const originX = lngToWorldX(longitude, ZOOM) - size.width / 2;
    const originY = latToWorldY(latitude, ZOOM) - size.height / 2;
    const n = Math.pow(2, ZOOM);
    for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + size.width) / TILE); tx++) {
      for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + size.height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue; // pas de wrap vertical
        const wx = ((tx % n) + n) % n; // wrap horizontal
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
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.url }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
          fadeDuration={120}
        />
      ))}

      {/* Marqueur « vous êtes ici », au centre exact de la boîte = le point capté. */}
      <View style={styles.markerWrap}>
        <View style={styles.markerRing} />
        <View style={styles.markerDot} />
      </View>

      {/* Attribution requise par la politique OpenStreetMap. */}
      <Text style={styles.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  markerRing: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(232,52,42,0.22)' },
  markerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, borderWidth: 2.5, borderColor: colors.white },
  attribution: { position: 'absolute', left: 6, bottom: 4, fontFamily: fonts.regular, fontSize: 9, color: 'rgba(17,17,17,0.55)' },
});
