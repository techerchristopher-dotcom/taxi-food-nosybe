import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { clientRepondreAttente } from '../data/api';
import { Order } from '../data/types';

/**
 * Client injoignable (2026-10-19). Le livreur ou le restaurant n'arrive pas à joindre le
 * client : la commande est « en attente de ta réponse ». Un tap sur « Je suis là » lève le
 * blocage et prévient le livreur. Le téléphone du livreur n'est pas affiché ici : le client
 * l'a déjà par l'appel manqué, et la messagerie de la commande reste ouverte en dessous.
 */
export function BlocAttenteClient({ order, onRepondu }: { order: Order; onRepondu: () => void }) {
  const { t } = useTranslation();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(false);
  if (!order.attenteClientDepuis) return null;

  async function repondre() {
    setEnvoi(true);
    setErreur(false);
    try {
      await clientRepondreAttente(order.id);
      onRepondu();
    } catch {
      setErreur(true);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Icon name="call" size={22} color={colors.dangerText} />
        <Text style={styles.titre}>{t('attenteClient.titre')}</Text>
      </View>
      <Text style={styles.texte}>{t('attenteClient.texte')}</Text>
      <Button label={t('attenteClient.bouton')} onPress={repondre} loading={envoi} />
      {erreur ? <Text style={styles.erreur}>{t('attenteClient.erreur')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: spacing.gap,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 10,
  },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink, flex: 1 },
  texte: { fontFamily: fonts.medium, fontSize: 14, color: colors.warnText, lineHeight: 20 },
  erreur: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText },
});
