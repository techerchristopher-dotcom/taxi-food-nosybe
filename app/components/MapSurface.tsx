import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * Surface de carte NATIVE (MapKit sur iOS, Google Maps sur Android) — via `react-native-maps`.
 *
 * Volontairement non interactive (`pointerEvents="none"`) : c'est un APERÇU. Le geste utile est
 * l'appui, capté par le `Pressable` parent (`MapPreview`), qui ouvre l'app de cartes du téléphone
 * où le client peut zoomer et vérifier réellement le repère.
 *
 * Le pendant web est `MapSurface.web.tsx` (tuiles OpenStreetMap) : `react-native-maps` n'a pas
 * d'implémentation web, un import direct casserait le bundle navigateur.
 */

/** Emprise affichée autour du point (~250 m) — assez serré pour reconnaître la rue. */
const DELTA = 0.0025;

type Props = {
  latitude: number;
  longitude: number;
};

export function MapSurface({ latitude, longitude }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        // `region` (et non `initialRegion`) : la carte suit une nouvelle capture GPS.
        region={{ latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        cacheEnabled
      >
        <Marker coordinate={{ latitude, longitude }} pinColor={colors.primary} />
      </MapView>
    </View>
  );
}
