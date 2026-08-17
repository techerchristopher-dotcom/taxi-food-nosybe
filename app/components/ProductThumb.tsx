import { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { thumbnailUrl } from '../data/types';

/**
 * Vignette produit : affiche la vraie photo (`uri` = products.photo_url) si présente et
 * chargeable, sinon un repli propre (aplat neutre + icône générique — jamais le nom du
 * produit, jamais une case blanche). Si l'image échoue au chargement → repli automatique.
 * `muted` = variante grisée (produit indisponible / restaurant fermé).
 *
 * `initials` : repli TEXTUEL au lieu de l'icône générique — utilisé pour les logos de
 * restaurant (un resto sans logo, ex. Angelo, garde son pastille d'initiales).
 */
export function ProductThumb({
  uri,
  size = 64,
  radius: r = radius.tile,
  muted = false,
  initials,
  style,
}: {
  uri?: string | null;
  size?: number;
  radius?: number;
  muted?: boolean;
  initials?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  // Réinitialise l'état d'erreur si l'URL change (recyclage de vignette dans une liste).
  useEffect(() => setFailed(false), [uri]);

  const dims = { width: size, height: size, borderRadius: r };
  const src = thumbnailUrl(uri, size); // vignette légère redimensionnée

  if (src && !failed) {
    return (
      <Image
        source={{ uri: src }}
        resizeMode="cover"
        onError={(e) => {
          console.warn('[ProductThumb] échec chargement image', uri, e?.nativeEvent?.error);
          setFailed(true); // bascule sur le repli propre
        }}
        style={[dims, style] as StyleProp<ImageStyle>}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        dims,
        { backgroundColor: muted ? colors.photoGrayB : colors.photoWarmB },
        style,
      ]}
    >
      {initials ? (
        <Text
          style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {initials}
        </Text>
      ) : (
        <Icon name="restaurant" size={Math.round(size * 0.42)} color={muted ? colors.textFaint : colors.photoWarmText} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.bold, color: colors.photoWarmText, letterSpacing: 0.3 },
});
