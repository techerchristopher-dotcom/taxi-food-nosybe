import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Button } from '../../components/Button';
import { EnTeteLivreur } from '../../components/livreur/EnTeteLivreur';
import { colors, fonts, radius, spacing } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { arreterSuivi, useEtatGps } from '../../lib/livreur/suiviGps';

const AUTORISATION: Record<string, string> = {
  ok: '✅ Toujours autorisée',
  premier_plan: '⚠️ Seulement quand l’app est ouverte — choisis « Toujours »',
  refusee: '❌ Refusée',
  inconnue: 'Pas encore demandée',
};

/** Profil : compte, autorisation de position, version, déconnexion, suppression du compte. */
export default function Profil() {
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const autorisation = useEtatGps((s) => s.autorisation);
  const [occupe, setOccupe] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '';
  const paquet = Updates.createdAt
    ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(Updates.createdAt)
    : 'intégré';

  async function sortir() {
    setOccupe('sortie');
    try {
      await arreterSuivi();
      await signOut();
    } finally {
      setOccupe(null);
    }
  }

  function supprimer() {
    Alert.alert(
      'Supprimer ton compte ?',
      'Ton compte Taxi Food (client et livreur) sera supprimé définitivement. Tes livraisons passées restent dans la comptabilité, sans ton nom.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setOccupe('suppr');
            try {
              await arreterSuivi();
              await deleteAccount();
            } finally {
              setOccupe(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <EnTeteLivreur title="Profil" />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: 14, paddingBottom: 32 }}>
        <View style={styles.carte}>
          <Text style={styles.label}>Compte</Text>
          <Text style={styles.valeur}>{session?.fullName}</Text>
          <Text style={styles.sous}>{session?.email}</Text>
          {session?.phone ? <Text style={styles.sous}>{session.phone}</Text> : null}
        </View>

        <View style={styles.carte}>
          <Text style={styles.label}>Position pendant les courses</Text>
          <Text style={styles.valeur}>{AUTORISATION[autorisation] ?? autorisation}</Text>
          <Text style={styles.sous}>
            Ta position n’est partagée que pendant une course, avec le client concerné et Taxi Food. Elle est effacée au
            bout de 7 jours.
          </Text>
          <Button label="Réglages de localisation" variant="outline" icon="settings" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: 8 }} />
        </View>

        <View style={styles.carte}>
          <Text style={styles.label}>Application</Text>
          <Text style={styles.sous}>
            Taxi Food Livreur {version} · {Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web'} · paquet du {paquet}
          </Text>
        </View>

        <Button label="Se déconnecter" variant="outline" icon="logout" onPress={sortir} loading={occupe === 'sortie'} />
        <Button label="Supprimer mon compte" variant="outline" onPress={supprimer} loading={occupe === 'suppr'} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  carte: { backgroundColor: colors.surface, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  valeur: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginTop: 2 },
  sous: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
});
