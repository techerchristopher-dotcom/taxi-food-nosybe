import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Nouveaute } from '../data/api';
import { thumbnailUrl } from '../data/types';
import { libelleOuverture } from '../lib/ouverture';
import { colors, fonts, radius, shadow } from '../theme/tokens';

/**
 * ✨ « Nouveau sur Taxi Food » — un restaurant qui vient de rejoindre l'aventure.
 *
 * ⚠️ LA CARTE EST FAITE DE SES PLATS, pas de son logo ni de sa couverture : un restaurant
 * qui arrive n'a souvent ni l'un ni l'autre (Les Siciliens, le 2026-10-02), mais il a ses
 * photos de plats. Quatre photos, une par catégorie (choisies par la base), en mosaïque.
 *
 * ⚠️ UN RESTAURANT FERMÉ RESTE TOUCHABLE ici, contrairement à la carte d'un plat du jour :
 * on ouvre sa CARTE, pas un plat qu'on ne pourrait pas commander. Découvrir le menu d'un
 * nouveau venu à 17 h pour commander à 18 h, c'est exactement ce qu'on veut.
 */
export function CarteNouveaute({ n, width, onPress }: { n: Nouveaute; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const photos = n.plats.filter((p) => p.photoUrl).slice(0, 4);
  const hauteur = Math.round(width * 0.5);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.carte, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${t('nouveautes.badge')} — ${n.name} — ${n.cuisineType}`}
    >
      <View style={[styles.mosaique, { height: hauteur }]}>
        <Mosaique photos={photos.map((p) => p.photoUrl as string)} largeur={width} hauteur={hauteur} />
        <View style={styles.badgeSurPhoto}>
          <BadgeNouveau />
        </View>
        {!n.isOpen ? (
          <View style={styles.pastilleFermee}>
            <Text style={styles.pastilleFermeeTexte} numberOfLines={1}>
              {libelleOuverture(n, t)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.corps}>
        <Text style={styles.nom} numberOfLines={1}>{n.name}</Text>
        <Text style={styles.sous} numberOfLines={1}>
          {[n.cuisineType, n.zone].filter(Boolean).join(' — ')}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaTexte}>{t('nouveautes.voirCarte')}</Text>
          <Icon name="chevron_right" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

/** 1 photo = pleine ; 2 = côte à côte ; 3 = une grande + deux ; 4 = 2 × 2. 0 = fond chaud. */
function Mosaique({ photos, largeur, hauteur }: { photos: string[]; largeur: number; hauteur: number }) {
  const gap = 2;
  const img = (uri: string, w: number, h: number) => (
    <Image
      key={uri}
      source={{ uri: thumbnailUrl(uri, Math.max(w, h)) }}
      style={{ width: w, height: h, backgroundColor: colors.photoWarmB }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
    />
  );
  if (photos.length === 0) return <View style={{ flex: 1, backgroundColor: colors.photoWarmB }} />;
  if (photos.length === 1) return img(photos[0], largeur, hauteur);
  const demi = (largeur - gap) / 2;
  const demiH = (hauteur - gap) / 2;
  if (photos.length === 2) {
    return <View style={{ flexDirection: 'row', gap }}>{photos.map((u) => img(u, demi, hauteur))}</View>;
  }
  if (photos.length === 3) {
    return (
      <View style={{ flexDirection: 'row', gap }}>
        {img(photos[0], demi, hauteur)}
        <View style={{ gap }}>{photos.slice(1).map((u) => img(u, demi, demiH))}</View>
      </View>
    );
  }
  return (
    <View style={{ gap }}>
      <View style={{ flexDirection: 'row', gap }}>{photos.slice(0, 2).map((u) => img(u, demi, demiH))}</View>
      <View style={{ flexDirection: 'row', gap }}>{photos.slice(2, 4).map((u) => img(u, demi, demiH))}</View>
    </View>
  );
}

/** Le badge « ✨ Nouveau » — même pastille sur la rangée, la carte vedette et les lignes. */
export function BadgeNouveau() {
  const { t } = useTranslation();
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeTexte}>✨ {t('nouveautes.badge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  mosaique: { overflow: 'hidden', backgroundColor: colors.photoWarmB },
  badgeSurPhoto: { position: 'absolute', top: 8, left: 8 },
  pastilleFermee: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,26,26,0.82)',
  },
  pastilleFermeeTexte: { fontFamily: fonts.semibold, fontSize: 11, color: colors.white },
  corps: { padding: 12, paddingTop: 10, gap: 2 },
  nom: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sous: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  ctaTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  badge: {
    alignSelf: 'flex-start',
    height: 22,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexte: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
});
