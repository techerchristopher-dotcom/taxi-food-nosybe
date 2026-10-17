import { useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts } from '../../theme/tokens';
import type { SuiviLivreur } from '../../data/suivi';

/**
 * Carte de suivi du livreur — WEB (taxifood.distripro207.com). `react-native-maps` n'existe
 * pas dans le navigateur : on recompose la carte avec les tuiles OpenStreetMap, comme
 * `MapSurface.web.tsx`, cadrée pour contenir le livreur, la prochaine étape et le client.
 * Trace et ligne vers l'étape sont dessinées en SVG. Aucun script externe (rien à ajouter
 * à la politique de sécurité du site), aucune clé, aucun coût.
 *
 * La carte n'est pas déplaçable : elle se recadre à chaque lecture (20 à 60 s).
 */
const TILE = 256;
const MARGE = 44;

function worldX(lng: number, z: number) {
  return ((lng + 180) / 360) * TILE * Math.pow(2, z);
}
function worldY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * Math.pow(2, z);
}

export function CarteSuivi({ suivi, hauteur = 240 }: { suivi: SuiviLivreur; hauteur?: number }) {
  const [taille, setTaille] = useState({ w: 0, h: 0 });
  function onLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    if (w !== taille.w || h !== taille.h) setTaille({ w, h });
  }

  const livreur = suivi.position;
  const cible = suivi.phase === 'vers_restaurant' ? suivi.restaurant : suivi.client;
  const cadre: { lat: number; lng: number }[] = [];
  if (livreur) cadre.push(livreur);
  // Le restaurant reste dans le cadre : la trace en part, elle ne doit pas sortir de la carte.
  if (suivi.restaurant) cadre.push(suivi.restaurant);
  if (suivi.client) cadre.push(suivi.client);
  if (!cadre.length) return null;

  // Zoom le plus fort qui fait tenir tous les points dans la boîte (marges comprises).
  let zoom = 17;
  if (taille.w > 0) {
    for (let z = 17; z >= 11; z--) {
      const xs = cadre.map((p) => worldX(p.lng, z));
      const ys = cadre.map((p) => worldY(p.lat, z));
      zoom = z;
      if (Math.max(...xs) - Math.min(...xs) <= taille.w - 2 * MARGE && Math.max(...ys) - Math.min(...ys) <= taille.h - 2 * MARGE) break;
    }
  }
  const xs = cadre.map((p) => worldX(p.lng, zoom));
  const ys = cadre.map((p) => worldY(p.lat, zoom));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const ox = cx - taille.w / 2;
  const oy = cy - taille.h / 2;
  const px = (p: { lat: number; lng: number }) => ({ x: worldX(p.lng, zoom) - ox, y: worldY(p.lat, zoom) - oy });

  const tuiles: { cle: string; url: string; left: number; top: number }[] = [];
  if (taille.w > 0) {
    const n = Math.pow(2, zoom);
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + taille.w) / TILE); tx++) {
      for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + taille.h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        tuiles.push({
          cle: `${zoom}_${tx}_${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${((tx % n) + n) % n}/${ty}.png`,
          left: tx * TILE - ox,
          top: ty * TILE - oy,
        });
      }
    }
  }

  const pastille = (p: { lat: number; lng: number }, emoji: string, fond: string, grand = false) => {
    const { x, y } = px(p);
    const d = grand ? 42 : 34;
    return (
      <View
        style={[styles.pastille, { left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: fond }]}
        pointerEvents="none"
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.cadre, { height: hauteur }]} onLayout={onLayout}>
      {tuiles.map((t) => (
        <Image key={t.cle} source={{ uri: t.url }} style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }} />
      ))}
      {taille.w > 0 ? (
        <Svg width={taille.w} height={taille.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          {suivi.trace.length > 1 ? (
            <Polyline
              points={suivi.trace.map(([lat, lng]) => { const q = px({ lat, lng }); return `${q.x},${q.y}`; }).join(' ')}
              fill="none"
              stroke={colors.primary}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {livreur && cible ? (
            <Polyline
              points={`${px(livreur).x},${px(livreur).y} ${px(cible).x},${px(cible).y}`}
              fill="none"
              stroke="rgba(26,26,26,0.45)"
              strokeWidth={2}
              strokeDasharray="6,6"
            />
          ) : null}
        </Svg>
      ) : null}
      {taille.w > 0 && suivi.restaurant ? pastille(suivi.restaurant, '🍽️', colors.ink) : null}
      {taille.w > 0 && suivi.client ? pastille(suivi.client, '🏠', colors.success) : null}
      {taille.w > 0 && livreur ? pastille(livreur, '🛵', colors.primary, true) : null}
      <Text style={styles.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.photoGrayA },
  pastille: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.white },
  emoji: { fontFamily: fonts.regular, fontSize: 17 },
  attribution: { position: 'absolute', left: 6, bottom: 4, fontFamily: fonts.regular, fontSize: 9, color: 'rgba(17,17,17,0.55)' },
});
