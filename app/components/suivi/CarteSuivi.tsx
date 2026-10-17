import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, fonts } from '../../theme/tokens';
import type { SuiviLivreur } from '../../data/suivi';

/**
 * Carte de suivi du livreur — NATIVE (MapKit sur iPhone, Google Maps sur Android : la
 * carte elle-même est gratuite et illimitée). Le pendant web est `CarteSuivi.web.tsx`.
 *
 * `react-native-maps` est dans tous les binaires en magasin depuis le build 6 : ce
 * composant part en mise à jour à distance sans nouveau build.
 *
 * Le cadrage suit les points à chaque nouvelle lecture (toutes les 20 à 60 s) ; entre
 * deux lectures le client peut zoomer et déplacer la carte.
 */
export function CarteSuivi({ suivi, hauteur = 240 }: { suivi: SuiviLivreur; hauteur?: number }) {
  const carte = useRef<MapView>(null);
  const livreur = suivi.position;
  const cible = suivi.phase === 'vers_restaurant' ? suivi.restaurant : suivi.client;

  const points = useMemo(() => {
    const p: { latitude: number; longitude: number }[] = [];
    if (livreur) p.push({ latitude: livreur.lat, longitude: livreur.lng });
    // Le restaurant reste dans le cadre : la trace en part.
    if (suivi.restaurant) p.push({ latitude: suivi.restaurant.lat, longitude: suivi.restaurant.lng });
    if (suivi.client) p.push({ latitude: suivi.client.lat, longitude: suivi.client.lng });
    return p;
  }, [livreur, suivi.restaurant, suivi.client]);

  const cle = points.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|');
  useEffect(() => {
    if (points.length < 2) return;
    const t = setTimeout(() => {
      carte.current?.fitToCoordinates(points, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  const centre = livreur ?? suivi.client ?? suivi.restaurant;
  if (!centre) return null;

  return (
    <View style={[styles.cadre, { height: hauteur }]}>
      <MapView
        ref={carte}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: centre.lat, longitude: centre.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {suivi.trace.length > 1 ? (
          <Polyline
            coordinates={suivi.trace.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        ) : null}
        {livreur && cible ? (
          <Polyline
            coordinates={[
              { latitude: livreur.lat, longitude: livreur.lng },
              { latitude: cible.lat, longitude: cible.lng },
            ]}
            strokeColor="rgba(26,26,26,0.45)"
            strokeWidth={2}
            lineDashPattern={[6, 6]}
          />
        ) : null}
        {suivi.restaurant ? (
          <Marker coordinate={{ latitude: suivi.restaurant.lat, longitude: suivi.restaurant.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.pastille, { backgroundColor: colors.ink }]}>
              <Text style={styles.emoji}>🍽️</Text>
            </View>
          </Marker>
        ) : null}
        {suivi.client ? (
          <Marker coordinate={{ latitude: suivi.client.lat, longitude: suivi.client.lng }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.pastille, { backgroundColor: colors.success }]}>
              <Text style={styles.emoji}>🏠</Text>
            </View>
          </Marker>
        ) : null}
        {livreur ? (
          <Marker
            key={`${livreur.lat},${livreur.lng}`}
            coordinate={{ latitude: livreur.lat, longitude: livreur.lng }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={10}
          >
            <View style={[styles.pastille, styles.livreur]}>
              <Text style={styles.emoji}>🛵</Text>
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.photoGrayA },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  livreur: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary },
  emoji: { fontFamily: fonts.regular, fontSize: 17 },
});
