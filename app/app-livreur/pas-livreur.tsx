import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { colors, fonts, spacing } from '../theme/tokens';
import { useSession } from '../store/session';

/**
 * Compte connecté sans rôle livreur ACTIF. Rien n'est lisible ici : la base refuse toutes
 * les données livreur à ce compte. On dit où en est la demande et comment la faire.
 */
export default function PasLivreur() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession((s) => s.session);
  const refresh = useSession((s) => s.refresh);
  const signOut = useSession((s) => s.signOut);
  const requestRole = useSession((s) => s.requestRole);
  const [occupe, setOccupe] = useState<string | null>(null);
  const role = session?.roles.find((r) => r.role === 'livreur');
  const enAttente = role?.status === 'pending';

  async function faire(cle: string, fn: () => Promise<unknown>) {
    setOccupe(cle);
    try {
      await fn();
      router.replace('/');
    } catch {
      /* l'écran reste tel quel */
    } finally {
      setOccupe(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Icon name={enAttente ? 'hourglass_empty' : 'block'} size={46} color={colors.textMuted} />
      <Text style={styles.titre}>{enAttente ? 'Demande en cours de validation' : 'Ce compte n’est pas livreur'}</Text>
      <Text style={styles.texte}>
        {enAttente
          ? 'Taxi Food doit valider ton compte livreur. Tu pourras livrer dès que c’est fait : appuie sur « Vérifier » ensuite.'
          : `Le compte ${session?.email ?? ''} n’a pas encore le rôle livreur. Envoie une demande : Taxi Food la validera.`}
      </Text>
      <View style={{ flex: 1 }} />
      {enAttente ? (
        <Button label="Vérifier" icon="refresh" onPress={() => faire('verif', refresh)} loading={occupe === 'verif'} />
      ) : (
        <Button
          label="Demander à devenir livreur"
          icon="two_wheeler"
          onPress={() => faire('demande', () => requestRole('livreur'))}
          loading={occupe === 'demande'}
        />
      )}
      <Button
        label="Écrire à Taxi Food (WhatsApp)"
        variant="outline"
        icon="chat"
        onPress={() => Linking.openURL('https://wa.me/261361574521').catch(() => {})}
        style={{ marginTop: 10 }}
      />
      <Button
        label="Se déconnecter"
        variant="outline"
        onPress={() => faire('sortie', signOut)}
        loading={occupe === 'sortie'}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.screen, alignItems: 'stretch' },
  titre: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink, textAlign: 'center', marginTop: 16, letterSpacing: -0.4 },
  texte: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
});
