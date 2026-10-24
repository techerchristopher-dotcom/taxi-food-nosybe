import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { fonts } from '../theme/tokens';
import { compteConnecte, connecterCompte, deconnecterCompte } from '../distripro/api';
import { dp } from '../distripro/contexte';
import { EnteteDP } from '../distripro/composants';

/**
 * Connexion au compte client DistriPro. Pas d'inscription en ligne : le compte est créé
 * par DistriPro, qui remet le mot de passe. Les partenaires Taxi Food commandent depuis
 * l'onglet « Commander » de leur app, sans mot de passe.
 */
export default function Connexion() {
  const router = useRouter();
  const [mdp, setMdp] = useState('');
  const [nom, setNom] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { compteConnecte().then((c) => setNom(c?.nom ?? null)); }, []);

  async function valider() {
    setEnvoi(true); setErreur(null);
    const r = await connecterCompte(mdp);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP titre="Mon compte" sousTitre="Compte client DistriPro" retour={() => router.navigate('/')} />
      <View style={{ padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {nom ? (
          <>
            <Text style={st.titre}>Connecté : {nom}</Text>
            <Pressable style={st.bouton} onPress={() => router.push('/commandes')}><Text style={st.boutonTexte}>Mes commandes</Text></Pressable>
            <Pressable style={st.boutonSec} onPress={async () => { await deconnecterCompte(); setNom(null); }}>
              <Text style={st.boutonSecTexte}>Se déconnecter</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={st.titre}>Se connecter</Text>
            <Text style={st.aide}>Entrez le mot de passe que DistriPro vous a remis.</Text>
            <TextInput
              value={mdp}
              onChangeText={setMdp}
              placeholder="Mot de passe"
              placeholderTextColor={dp.gris}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={valider}
              style={st.champ}
            />
            {erreur ? <Text style={st.erreur}>{erreur}</Text> : null}
            <Pressable style={[st.bouton, (!mdp || envoi) && { opacity: 0.5 }]} disabled={!mdp || envoi} onPress={valider}>
              <Text style={st.boutonTexte}>{envoi ? 'Connexion…' : 'Se connecter'}</Text>
            </Pressable>
            <Text style={[st.aide, { marginTop: 24 }]}>Pas encore de compte ? Demandez-le sur WhatsApp.</Text>
            <Pressable style={st.boutonSec} onPress={() => Linking.openURL('https://wa.me/261361574521?text=' + encodeURIComponent('Bonjour DistriPro, je voudrais ouvrir un compte pour commander.'))}>
              <Text style={st.boutonSecTexte}>Écrire sur WhatsApp</Text>
            </Pressable>
            <Text style={[st.aide, { marginTop: 18 }]}>Restaurant partenaire Taxi Food ? Commandez directement depuis l'onglet « Commander » de votre espace partenaire, sans mot de passe.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  titre: { fontFamily: fonts.extrabold, fontSize: 22, color: dp.encre },
  aide: { fontFamily: fonts.regular, fontSize: 14, color: dp.gris, marginTop: 6 },
  champ: { marginTop: 16, backgroundColor: dp.blanc, borderWidth: 1, borderColor: dp.bord, borderRadius: 12, padding: 14, fontFamily: fonts.medium, fontSize: 16, color: dp.encre },
  erreur: { fontFamily: fonts.semibold, fontSize: 14, color: dp.rouge, marginTop: 10 },
  bouton: { marginTop: 16, backgroundColor: dp.foret, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 16, color: dp.blanc },
  boutonSec: { marginTop: 10, borderWidth: 1.5, borderColor: dp.foret, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  boutonSecTexte: { fontFamily: fonts.bold, fontSize: 15, color: dp.foret },
});
