import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../components/Icon';
import { fonts } from '../../theme/tokens';
import { ar, dateCourte, datesLivraison, libelleQuantite, PAIEMENTS } from '../api';
import { dp, useDistripro } from '../contexte';
import { BarreBas, EnteteDP, Message, Stepper } from '../composants';
import { totalIndicatif, usePanierDP } from '../panier';

/**
 * Panier + validation. Le total affiché est INDICATIF : `creer_commande` relit prix,
 * minimum, stock et date, et c'est sa réponse qui fait foi.
 */
export function EcranPanier() {
  const router = useRouter();
  const { identite, liens, dansTaxiFood } = useDistripro();
  const panier = usePanierDP();
  const [dates, setDates] = useState<string[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [paiement, setPaiement] = useState('especes');
  const [commentaire, setCommentaire] = useState('');
  const [nom, setNom] = useState<string | null>(null);
  const [besoinConnexion, setBesoinConnexion] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void panier.charger();
    datesLivraison().then((d) => { setDates(d); setDate(d[0] ?? null); }).catch(() => setDates([]));
    identite.nom().then((r) => {
      if (r.ok) setNom(r.valeur);
      else if (r.reason === 'auth') setBesoinConnexion(true);
      else setErreur(r.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retour explicite : dans les onglets de l'app, « back » renvoie au premier onglet.
  const retour = () => router.navigate(liens.catalogue as never);

  async function valider() {
    if (!date) return;
    setEnvoi(true);
    setErreur(null);
    const r = await identite.commander({
      lignes: panier.lignes.map((l) => ({ produit_id: l.produitId, quantite: l.quantite })),
      dateLivraison: date,
      paiementMode: paiement,
      commentaire: commentaire.trim() || null,
    });
    setEnvoi(false);
    if (!r.ok) {
      if (r.reason === 'auth' && liens.connexion) { router.push(liens.connexion as never); return; }
      setErreur(r.message);
      return;
    }
    panier.vider();
    router.replace(liens.commande(r.valeur.numero) as never);
  }

  if (panier.lignes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: dp.papier }}>
        <EnteteDP titre="Mon panier" retour={retour} />
        <Message texte="Votre panier DistriPro est vide." action="Voir le catalogue" onAction={() => router.replace(liens.catalogue as never)} />
      </View>
    );
  }

  const total = totalIndicatif(panier.lignes);

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP titre="Mon panier" sousTitre="Commande fournisseur — livrée par DistriPro" retour={retour} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        {panier.lignes.map((l) => (
          <View key={l.produitId} style={st.ligne}>
            <View style={{ flex: 1 }}>
              <Text style={st.nom} numberOfLines={2}>{l.nom}</Text>
              <Text style={st.sous}>{ar(l.prix)}{l.unite === 'kg' ? ' le kg' : ' l\'unité de vente'}</Text>
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stepper
                  quantite={l.quantite}
                  libelle={libelleQuantite(l, l.quantite)}
                  plus={() => panier.ajouter({ id: l.produitId, nom: l.nom, prix: l.prix, unite: l.unite, qteMin: l.qteMin, pas: l.pas, stock: l.stock, conditionnement: null, qteParLot: null, prixProvisoire: false, descriptif: null, image: null, sousCategorieId: 0 })}
                  moins={() => panier.retirer(l.produitId)}
                  plusDesactive={l.stock !== null && l.quantite + l.pas > l.stock}
                />
                <Text style={st.sousTotal}>{ar(l.prix * l.quantite)}</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={st.totalLigne}>
          <Text style={st.totalTexte}>Total estimé</Text>
          <Text style={st.totalMontant}>{ar(total)}</Text>
        </View>
        <Text style={st.aide}>Le montant définitif est confirmé à la validation.</Text>

        {besoinConnexion ? (
          <View style={st.carte}>
            <Text style={st.titreBloc}>Connexion nécessaire</Text>
            <Text style={st.aide}>Le catalogue est libre ; pour commander, connectez-vous avec le mot de passe remis par DistriPro.</Text>
            {liens.connexion ? (
              <Pressable style={st.boutonSec} onPress={() => router.push(liens.connexion as never)}>
                <Text style={st.boutonSecTexte}>Se connecter</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {nom ? (
              <View style={st.pour}>
                <Icon name="storefront" size={18} color={dp.foret} />
                <Text style={st.pourTexte}>Commande pour <Text style={{ fontFamily: fonts.bold }}>{nom}</Text></Text>
              </View>
            ) : null}

            <Text style={st.titreBloc}>Date de livraison</Text>
            {dates === null ? <ActivityIndicator color={dp.foret} /> : (
              <View style={st.puces}>
                {dates.slice(0, 7).map((d) => (
                  <Pressable key={d} onPress={() => setDate(d)} style={[st.puce, date === d && st.puceActive]}>
                    <Text style={[st.puceTexte, date === d && { color: dp.blanc }]}>{dateCourte(d)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={st.aide}>Commande avant midi : livrée le lendemain. Après midi : le surlendemain.</Text>

            <Text style={st.titreBloc}>Paiement à la livraison</Text>
            {PAIEMENTS.map((p) => (
              <Pressable key={p.code} onPress={() => setPaiement(p.code)} style={st.choix}>
                <Icon name={paiement === p.code ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={dp.foret} />
                <Text style={st.choixTexte}>{p.libelle}</Text>
              </Pressable>
            ))}
            {dansTaxiFood ? (
              <View style={[st.choix, { opacity: 0.5 }]} accessibilityState={{ disabled: true }}>
                <Icon name="radio_button_unchecked" size={22} color={dp.gris} />
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Text style={st.choixTexte}>Déduit de mon prochain reversement Taxi Food</Text>
                  <Text style={[st.bientot, { marginTop: 3 }]}>Pas encore disponible</Text>
                </View>
              </View>
            ) : null}

            <Text style={st.titreBloc}>Précision pour la livraison</Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="Horaire, accès, personne à appeler…"
              placeholderTextColor={dp.gris}
              style={st.champ}
              multiline
              maxLength={300}
            />
            {erreur ? <Text style={st.erreur}>{erreur}</Text> : null}
          </>
        )}
      </ScrollView>
      {!besoinConnexion ? (
        <View style={st.flottant}>
          <BarreBas
            texte={envoi ? 'Envoi…' : 'Valider la commande'}
            montant={ar(total)}
            desactive={envoi || !date || !nom}
            onPress={valider}
          />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  ligne: { backgroundColor: dp.blanc, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: dp.bord, marginBottom: 10 },
  nom: { fontFamily: fonts.bold, fontSize: 15, color: dp.encre },
  sous: { fontFamily: fonts.medium, fontSize: 12, color: dp.gris, marginTop: 2 },
  sousTotal: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.foret },
  totalLigne: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  totalTexte: { fontFamily: fonts.bold, fontSize: 16, color: dp.encre },
  totalMontant: { fontFamily: fonts.extrabold, fontSize: 18, color: dp.foret },
  aide: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 4 },
  carte: { backgroundColor: dp.blanc, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: dp.bord, marginTop: 16 },
  pour: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: dp.menthe, borderRadius: 12, padding: 12, marginTop: 16 },
  pourTexte: { fontFamily: fonts.medium, fontSize: 14, color: dp.encre, flex: 1 },
  titreBloc: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.encre, marginTop: 20, marginBottom: 8 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: dp.bord, backgroundColor: dp.blanc },
  puceActive: { backgroundColor: dp.foret, borderColor: dp.foret },
  puceTexte: { fontFamily: fonts.semibold, fontSize: 13, color: dp.encre },
  choix: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  choixTexte: { fontFamily: fonts.medium, fontSize: 15, color: dp.encre, flexShrink: 1 },
  bientot: {
    fontFamily: fonts.semibold, fontSize: 11, color: dp.ambre, backgroundColor: dp.ambreFond,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  champ: {
    backgroundColor: dp.blanc, borderWidth: 1, borderColor: dp.bord, borderRadius: 12, padding: 12,
    minHeight: 70, fontFamily: fonts.regular, fontSize: 16, color: dp.encre, textAlignVertical: 'top',
  },
  erreur: { fontFamily: fonts.semibold, fontSize: 14, color: dp.rouge, backgroundColor: dp.rougeFond, borderRadius: 10, padding: 12, marginTop: 14 },
  boutonSec: { marginTop: 10, borderWidth: 1.5, borderColor: dp.foret, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  boutonSecTexte: { fontFamily: fonts.bold, fontSize: 15, color: dp.foret },
  flottant: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
