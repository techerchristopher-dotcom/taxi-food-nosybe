import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import { usePromo } from '../store/promo';

/**
 * Saisie du code promo, partagée par le PANIER et le RÉCAPITULATIF.
 *
 * ⚠️ Un seul composant pour les deux écrans, et un seul état derrière
 * (`store/promo.ts`) : un code saisi au panier est déjà appliqué au
 * récapitulatif, avec sa remise. Deux saisies pour un seul code, c'est un client
 * qui renonce.
 *
 * Le bloc vit là où les frais de livraison s'affichent pour la première fois
 * dans le total : c'est à cet instant précis que le client voit « 10 000 Ar » et
 * décide de continuer ou de partir. La sortie de secours doit être là, pas trois
 * écrans plus loin.
 *
 * Le conteneur (Card, marges) appartient à l'écran qui monte le composant.
 */
export function CodePromo({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { code, remise, valide, raison, enAttenteConnexion, enCours, appliquer, retirer } = usePromo();

  const [saisi, setSaisi] = useState(code ?? '');
  // Le code retenu peut changer sans passer par ce champ : normalisation par la
  // base, retrait depuis l'autre écran, refus prononcé à la validation.
  useEffect(() => {
    setSaisi(code ?? '');
  }, [code]);

  if (valide && code) {
    return (
      <View style={[styles.ligne, style]}>
        <Icon name="check_circle" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{t('promo.applique', { code })}</Text>
          <Text style={styles.sous}>{t('promo.economie', { amount: formatAr(remise) })}</Text>
        </View>
        <Pressable onPress={retirer} hitSlop={8}>
          <Text style={styles.action}>{t('promo.retirer')}</Text>
        </Pressable>
      </View>
    );
  }

  /**
   * Visiteur sans compte. `verifier_code_promo` répond `non_connecte` — elle ne
   * PEUT pas se prononcer, l'unicité par client suppose de savoir qui commande.
   * Lui afficher un échec sec ferait fuir exactement le client qu'on retient :
   * on garde son code, on annonce la vérification à la connexion, et on ne
   * promet aucune remise avant que la base l'ait confirmée.
   */
  if (enAttenteConnexion && code) {
    return (
      <View style={[styles.ligne, style]}>
        <Icon name="schedule" size={20} color={colors.textDark} />
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{t('promo.enAttente', { code })}</Text>
          <Text style={styles.sous}>{t('promo.enAttenteDetail', { bouton: t('cart.order') })}</Text>
        </View>
        <Pressable onPress={retirer} hitSlop={8}>
          <Text style={styles.action}>{t('promo.retirer')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={style}>
      <View style={styles.saisieLigne}>
        <TextInput
          style={styles.input}
          value={saisi}
          onChangeText={setSaisi}
          placeholder={t('promo.placeholder')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => appliquer(saisi)}
          editable={!enCours}
        />
        <Pressable
          onPress={() => appliquer(saisi)}
          disabled={enCours || saisi.trim().length === 0}
          style={[styles.bouton, (enCours || saisi.trim().length === 0) && styles.boutonInactif]}
        >
          {enCours ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={styles.boutonTexte}>{t('promo.appliquer')}</Text>
          )}
        </Pressable>
      </View>
      {/* Un message d'erreur doit dire QUOI FAIRE, pas seulement que ça a raté.
          Sans erreur, on rappelle sur quoi porte la remise — sans jamais citer
          de taux ni de montant : ils vivent en base, pas dans un dictionnaire. */}
      {raison ? (
        <Text style={styles.erreur}>{t(`promo.erreur.${raison}`)}</Text>
      ) : (
        <Text style={styles.aide}>{t('promo.surLivraison')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titre: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  sous: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  action: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  saisieLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.bg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  bouton: {
    backgroundColor: colors.primary,
    borderRadius: radius.input,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
    alignItems: 'center',
  },
  boutonInactif: { opacity: 0.45 },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.surface },
  erreur: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.dangerText, marginTop: 10 },
  aide: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 10 },
});
