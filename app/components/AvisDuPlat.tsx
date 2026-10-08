import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Etoiles } from './Etoiles';
import { Icon } from './Icon';
import { PhotoPleinEcran } from './PhotoPleinEcran';
import { colors, fonts, radius } from '../theme/tokens';
import { thumbnailUrl } from '../data/types';
import { listAvisDuPlat } from '../data/api';
import { useLoad } from '../lib/useLoad';

/**
 * « Ils ont commandé ce plat » sur la fiche d'un plat (2026-10-08).
 *
 * Le visuel de la carte donne envie ; ici le client voit ce qui a VRAIMENT été livré :
 * les photos prises par les clients, puis leurs avis, chacun avec ce qu'il a commandé.
 * Source : `avis_du_plat` (avis publiés des commandes qui contiennent ce plat, ceux avec
 * photo d'abord). Rien du tout tant que personne ne l'a noté — pas d'encart vide.
 */
export function AvisDuPlat({ productId, restaurantId }: { productId: string; restaurantId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useLoad(() => listAvisDuPlat(productId, 10).catch(() => []), [productId]);
  const [ouverte, setOuverte] = useState<{ uri: string; prenom: string } | null>(null);

  const avis = data ?? [];
  if (avis.length === 0) return null;
  const photos = avis.filter((a) => a.photoUrl);

  return (
    <View style={styles.bloc}>
      <Text style={styles.titre}>⭐ {t('product.avisTitre')}</Text>

      {photos.length > 0 ? (
        <>
          <Text style={styles.sousTitre}>{t('product.photosClients')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {photos.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setOuverte({ uri: a.photoUrl!, prenom: a.prenom })}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('product.photoDe', { prenom: a.prenom })}
              >
                <Image
                  source={{ uri: thumbnailUrl(a.photoUrl, PHOTO) }}
                  style={styles.photo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <Text style={styles.photoPrenom} numberOfLines={1}>{a.prenom}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {avis.slice(0, 3).map((a) => (
        <View key={a.id} style={styles.avis}>
          <View style={styles.avisTete}>
            <Text style={styles.prenom}>{a.prenom}</Text>
            <Etoiles valeur={a.noteRestaurant} taille={13} />
          </View>
          {a.plats?.length ? (
            <Text style={styles.plats} numberOfLines={2}>
              {t('avis.aCommande', { plats: a.plats.join(', ') })}
            </Text>
          ) : null}
          {a.commentaire ? (
            <Text style={styles.commentaire} numberOfLines={4}>« {a.commentaire} »</Text>
          ) : null}
          {a.reponseRestaurant ? (
            <View style={styles.reponse}>
              <Text style={styles.reponseLabel}>{t('avis.reponse')}</Text>
              <Text style={styles.reponseTexte} numberOfLines={3}>{a.reponseRestaurant}</Text>
            </View>
          ) : null}
        </View>
      ))}

      <Pressable style={styles.tous} onPress={() => router.push(`/restaurant/avis/${restaurantId}`)}>
        <Text style={styles.tousTexte}>{t('product.voirAvisResto')}</Text>
        <Icon name="chevron_right" size={18} color={colors.primary} />
      </Pressable>

      <PhotoPleinEcran
        uri={ouverte?.uri ?? null}
        legende={ouverte ? t('product.photoDe', { prenom: ouverte.prenom }) : null}
        onClose={() => setOuverte(null)}
      />
    </View>
  );
}

const PHOTO = 112;

const styles = StyleSheet.create({
  bloc: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider, gap: 10 },
  titre: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  sousTitre: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.textMuted },
  photos: { gap: 10, paddingRight: 4 },
  photo: { width: PHOTO, height: PHOTO, borderRadius: radius.tile, backgroundColor: colors.photoWarmB },
  photoPrenom: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textDark, marginTop: 4, maxWidth: PHOTO },
  avis: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 12, gap: 6 },
  avisTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prenom: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  plats: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  commentaire: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textDark },
  reponse: { paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.accent },
  reponseLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  reponseTexte: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textDark, marginTop: 2 },
  tous: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  tousTexte: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
