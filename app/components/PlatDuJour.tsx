import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ProductThumb } from './ProductThumb';
import { PlatDuJour } from '../data/api';
import { libelleOuverture } from '../lib/ouverture';
import { colors, fonts, formatAr, radius } from '../theme/tokens';

/**
 * Les plats du jour de toute l'île — une carte, et une ligne.
 *
 * ⚠️ LE NOM DU RESTAURANT EST OBLIGATOIRE ici, alors qu'il ne l'est pas sur la
 * fiche d'un restaurant : hors contexte, « Paella à 30 000 Ar » ne dit pas chez
 * qui on la commande, et c'est précisément ce qu'on vient chercher.
 *
 * ⚠️ UN RESTAURANT FERMÉ RESTE VISIBLE, grisé, avec son heure d'ouverture. La
 * carte est alors INERTE (pas de tap) : ouvrir la fiche d'un plat qu'on ne peut
 * pas commander est une impasse. L'heure, elle, dit quand revenir — c'est la
 * seule information utile à cet instant.
 */

/** Carte verticale — la rangée qui défile sur l'accueil. */
export function CartePlatDuJour({
  p,
  width = 150,
  onPress,
}: {
  p: PlatDuJour;
  width?: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const ferme = !p.isOpen;
  // À 375 px la carte descend sous 110 px de large : le nom du plat et le prix
  // doivent alors rétrécir d'un point, sinon « Escalope de poulet milanaise »
  // mange trois lignes et la rangée devient un mur de texte.
  const serre = width < 120;
  return (
    <Pressable
      onPress={onPress}
      disabled={ferme}
      style={[{ width }, ferme && styles.eteint]}
      accessibilityRole="button"
      accessibilityLabel={`${p.name} — ${p.restaurantName} — ${formatAr(p.price)}`}
    >
      <View>
        <ProductThumb uri={p.photoUrl} size={width} radius={radius.tile} muted={ferme} />
        {ferme ? (
          <View style={styles.pastilleFermee}>
            <Text style={styles.pastilleFermeeTexte} numberOfLines={1}>
              {libelleOuverture(p, t)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 8, gap: 2 }}>
        <Text style={styles.resto} numberOfLines={1}>
          {p.restaurantName}
        </Text>
        <Text style={[styles.nom, serre && styles.nomSerre]} numberOfLines={2}>
          {p.name}
        </Text>
        <Text style={[styles.prix, serre && styles.prixSerre]}>{formatAr(p.price)}</Text>
        {p.dietTags.includes('porc') ? (
          <View style={styles.porc}>
            <Text style={styles.porcTexte}>{t('product.contientPorc')}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Ligne horizontale — l'écran « Voir tout », groupé par restaurant. */
export function LignePlatDuJour({ p, onPress }: { p: PlatDuJour; onPress: () => void }) {
  const { t } = useTranslation();
  const ferme = !p.isOpen;
  return (
    <Pressable
      onPress={onPress}
      disabled={ferme}
      style={[styles.ligne, ferme && styles.eteint]}
      accessibilityRole="button"
      accessibilityLabel={`${p.name} — ${formatAr(p.price)}`}
    >
      <ProductThumb uri={p.photoUrl} size={72} radius={radius.tile} muted={ferme} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.ligneNom} numberOfLines={2}>
          {p.name}
        </Text>
        {p.description ? (
          <Text style={styles.ligneDesc} numberOfLines={2}>
            {p.description}
          </Text>
        ) : null}
        <View style={styles.ligneBas}>
          <Text style={styles.prix}>{formatAr(p.price)}</Text>
          {p.dietTags.includes('porc') ? (
            <View style={styles.porc}>
              <Text style={styles.porcTexte}>{t('product.contientPorc')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eteint: { opacity: 0.55 },
  // Posée SUR la photo : l'heure de retour se lit sans quitter la vignette des
  // yeux, et elle ne pousse pas le nom du plat hors de la carte.
  pastilleFermee: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(26,26,26,0.82)',
  },
  pastilleFermeeTexte: {
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    color: colors.white,
    textAlign: 'center',
  },
  resto: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  nom: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, lineHeight: 18 },
  nomSerre: { fontSize: 12.5, lineHeight: 16 },
  prixSerre: { fontSize: 12 },
  prix: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDark },
  porc: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.warnBg,
  },
  porcTexte: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.warnText },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  ligneNom: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, lineHeight: 19 },
  ligneDesc: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  ligneBas: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
