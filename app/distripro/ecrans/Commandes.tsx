import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/Icon';
import { fonts } from '../../theme/tokens';
import { ar, dateCourte, STATUTS, type CommandeDP } from '../api';
import { dp, useDistripro } from '../contexte';
import { Chargement, EnteteDP, Message } from '../composants';

export function couleurStatut(statut: string): { fond: string; texte: string } {
  switch (statut) {
    case 'livree': return { fond: dp.menthe, texte: dp.foretClair };
    case 'annulee': return { fond: dp.rougeFond, texte: dp.rouge };
    case 'en_livraison': return { fond: dp.cobaltClair, texte: dp.cobalt };
    default: return { fond: dp.ambreFond, texte: dp.ambre };
  }
}

export function EcranCommandes() {
  const router = useRouter();
  const { identite, liens } = useDistripro();
  const [commandes, setCommandes] = useState<CommandeDP[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    const r = await identite.mesCommandes();
    if (r.ok) { setCommandes(r.valeur); setErreur(null); }
    else if (r.reason === 'auth' && liens.connexion) router.replace(liens.connexion as never);
    else setErreur(r.message);
  }, [identite, liens, router]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  // Retour explicite : dans les onglets de l'app, « back » renvoie au premier onglet.
  const retour = () => router.navigate(liens.catalogue as never);

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP titre="Mes commandes" sousTitre="Commandes fournisseur DistriPro" retour={retour} />
      {commandes === null && !erreur ? <Chargement /> : null}
      {erreur && commandes === null ? <Message texte={erreur} action="Réessayer" onAction={charger} /> : null}
      {commandes ? (
        <FlatList
          data={commandes}
          keyExtractor={(c) => c.numero}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
          ListEmptyComponent={<Message texte="Aucune commande DistriPro pour l'instant." action="Voir le catalogue" onAction={() => router.replace(liens.catalogue as never)} />}
          renderItem={({ item }) => {
            const c = couleurStatut(item.statut);
            return (
              <Pressable onPress={() => router.push(liens.commande(item.numero) as never)} style={st.carte}>
                <View style={{ flex: 1 }}>
                  <Text style={st.numero}>{item.numero}</Text>
                  <Text style={st.sous}>Passée le {item.creee_le_fr} · livraison {dateCourte(item.date_livraison)}</Text>
                  <View style={st.basLigne}>
                    <Text style={[st.statut, { backgroundColor: c.fond, color: c.texte }]}>{STATUTS[item.statut] ?? item.statut}</Text>
                    <Text style={st.total}>{ar(item.total)}</Text>
                  </View>
                </View>
                <Icon name="chevron_right" size={22} color={dp.gris} />
              </Pressable>
            );
          }}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  carte: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: dp.blanc, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: dp.bord, marginBottom: 10,
  },
  numero: { fontFamily: fonts.extrabold, fontSize: 16, color: dp.encre },
  sous: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 2 },
  basLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statut: { fontFamily: fonts.bold, fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  total: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.foret },
});
