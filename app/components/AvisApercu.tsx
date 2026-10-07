import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Etoiles, formatNote } from './Etoiles';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { listAvisRestaurant, mesAvisEnAttente } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { useSession } from '../store/session';

/**
 * « ⭐ Ce qu'en disent les clients » sur la fiche d'un restaurant (2026-10-07).
 *
 * Avant : un minuscule « ★ 4,7 (3) Voir les avis » perdu dans la ligne des horaires — le
 * porteur du projet ne les voyait pas lui-même. Désormais les 3 derniers avis (prénom,
 * étoiles, commentaire, photo, réponse du restaurant), puis « Voir les N avis ».
 *
 * Et l'appel à l'action qui fait gagner le porte-monnaie :
 *  - le client a une commande livrée À NOTER chez ce restaurant (< 7 jours, sans avis,
 *    `mes_avis_en_attente`) → « Note ta commande TF-xxx : +1 000 Ar » ouvre son suivi ;
 *  - sinon, sans aucun avis → « Sois le premier à noter ce restaurant… » + « Voir la carte ».
 */
export function AvisApercu({
  restaurantId,
  nbAvis,
  noteMoyenne,
  onVoirCarte,
}: {
  restaurantId: string;
  nbAvis: number;
  noteMoyenne: number | null;
  onVoirCarte: () => void;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const { data: avis } = useLoad(
    () => (nbAvis > 0 ? listAvisRestaurant(restaurantId, 3, 0) : Promise.resolve([])),
    [restaurantId, nbAvis],
  );
  const { data: enAttente } = useLoad(
    () => (session ? mesAvisEnAttente() : Promise.resolve([])),
    [session?.userId ?? '', restaurantId],
  );
  const aNoter = (enAttente ?? []).find((a) => a.restaurantId === restaurantId);

  const boutonNoter = aNoter ? (
    <Pressable style={styles.noter} onPress={() => router.push(`/order/${aNoter.orderId}?noter=1`)}>
      <Text style={styles.noterTexte}>⭐ {t('avisApercu.noterCommande', { numero: aNoter.numero })}</Text>
      <View style={styles.gain}>
        <Text style={styles.gainTexte}>+1 000 Ar</Text>
      </View>
    </Pressable>
  ) : null;

  if (nbAvis === 0) {
    return (
      <View style={styles.bloc}>
        <View style={styles.premier}>
          <Text style={styles.premierTitre}>⭐ {t('avisApercu.premierTitre')}</Text>
          <Text style={styles.premierTexte}>{t('avisApercu.premierTexte')}</Text>
          {boutonNoter ?? (
            <Pressable style={styles.carte} onPress={onVoirCarte}>
              <Icon name="restaurant_menu" size={18} color={colors.white} />
              <Text style={styles.carteTexte}>{t('avisApercu.voirCarte')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Text style={styles.titre}>⭐ {t('avisApercu.titre')}</Text>
        {noteMoyenne != null ? (
          <View style={styles.note}>
            <Text style={styles.noteValeur}>{formatNote(noteMoyenne, i18n.language)}</Text>
            <Etoiles valeur={noteMoyenne} taille={14} />
          </View>
        ) : null}
      </View>
      {boutonNoter}
      {(avis ?? []).map((a) => (
        <View key={a.id} style={styles.avis}>
          <View style={styles.avisTete}>
            <Text style={styles.prenom}>{a.prenom}</Text>
            <Etoiles valeur={a.noteRestaurant} taille={13} />
          </View>
          {a.commentaire ? (
            <Text style={styles.commentaire} numberOfLines={4}>
              « {a.commentaire} »
            </Text>
          ) : null}
          {a.photoUrl ? <Image source={{ uri: a.photoUrl }} style={styles.photo} contentFit="cover" /> : null}
          {a.reponseRestaurant ? (
            <View style={styles.reponse}>
              <Text style={styles.reponseLabel}>{t('avis.reponse')}</Text>
              <Text style={styles.reponseTexte} numberOfLines={3}>{a.reponseRestaurant}</Text>
            </View>
          ) : null}
        </View>
      ))}
      <Pressable style={styles.tous} onPress={() => router.push(`/restaurant/avis/${restaurantId}`)}>
        <Text style={styles.tousTexte}>{t('avisApercu.voirTous', { count: nbAvis })}</Text>
        <Icon name="chevron_right" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.divider, gap: 10 },
  tete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titre: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteValeur: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  avis: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 12, gap: 6 },
  avisTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prenom: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  commentaire: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.textDark },
  photo: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.tile, backgroundColor: colors.fieldBg },
  reponse: { paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.accent },
  reponseLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  reponseTexte: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textDark, marginTop: 2 },
  tous: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  tousTexte: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  noter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14,
  },
  noterTexte: { fontFamily: fonts.bold, fontSize: 14, color: colors.white, flexShrink: 1 },
  gain: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  gainTexte: { fontFamily: fonts.extrabold, fontSize: 12, color: colors.ink },
  premier: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.accent },
  premierTitre: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  premierTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.5, color: colors.textDark },
  carte: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: radius.lg, height: 44, marginTop: 4,
  },
  carteTexte: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
