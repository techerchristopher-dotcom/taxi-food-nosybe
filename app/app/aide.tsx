import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FilConversation } from '../components/FilConversation';
import { Icon } from '../components/Icon';
import { colors, fonts } from '../theme/tokens';
import { deposerPhotoSupport, envoyerSupport, lireSupport } from '../data/messagerie';
import { useSession } from '../store/session';
import { signInFor } from '../store/authIntent';

/**
 * « Écrire à Taxi Food » (2026-10-13) : un fil par client, hors commande — une question,
 * une réclamation, une suggestion. Taxi Food répond depuis l'admin (onglet 💬 Messages) et
 * le client reçoit un push. Jusqu'ici, un client ne pouvait écrire que par WhatsApp, sans
 * aucune trace en base.
 */
export default function AideScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.session?.userId ?? null);
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));

  if (!userId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Pressable onPress={retour} style={styles.back} accessibilityRole="button" accessibilityLabel={t('messagerie.retour')}>
          <Icon name="arrow_back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.center}>
          <Icon name="support_agent" size={44} color={colors.primary} />
          <Text style={styles.titre}>{t('messagerie.aide.titre')}</Text>
          <Text style={styles.sous}>{t('messagerie.aide.connexion')}</Text>
          <Pressable style={styles.btn} onPress={() => signInFor(router, '/aide')}>
            <Text style={styles.btnTxt}>{t('messagerie.aide.seConnecter')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <FilConversation
      titreParDefaut={t('messagerie.aide.titre')}
      canal={`support:${userId}`}
      charger={async (depuis) => {
        const f = await lireSupport(depuis);
        return { peutEcrire: f.peutEcrire, messages: f.messages, sousTitre: t('messagerie.aide.sousTitre') };
      }}
      envoyer={(texte, photo) => envoyerSupport(texte, photo)}
      deposerPhoto={(uri, mime) => deposerPhotoSupport(uri, mime)}
      rapides={[]}
      vide={t('messagerie.aide.vide')}
      quiLit={t('messagerie.aide.quiLit')}
      fermee=""
      concerne={(data) => data.type === 'support'}
      onRetour={retour}
      longueurMax={1000}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  titre: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  sous: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  btn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 24, minHeight: 48, justifyContent: 'center' },
  btnTxt: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
