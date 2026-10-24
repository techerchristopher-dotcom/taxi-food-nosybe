import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { fonts } from '../../theme/tokens';
import { ar, dateCourte, PAIEMENTS, STATUTS, type CommandeDP, type DocumentDP } from '../api';
import { dp, useDistripro } from '../contexte';
import { Chargement, EnteteDP, Message } from '../composants';
import { couleurStatut } from './Commandes';

const ETAPES = ['recue', 'en_preparation', 'en_livraison', 'livree'];

/** Détail d'une commande DistriPro + bon de livraison / facture rendus nativement. */
export function EcranCommande({ numero }: { numero: string }) {
  const router = useRouter();
  const { identite, liens } = useDistripro();
  const [commande, setCommande] = useState<CommandeDP | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentDP | null>(null);
  const [docCharge, setDocCharge] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await identite.mesCommandes();
    if (!r.ok) { setErreur(r.message); return; }
    const c = r.valeur.find((x) => x.numero === numero) ?? null;
    if (!c) setErreur('Commande introuvable.');
    setCommande(c);
  }, [identite, numero]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  async function ouvrir(num: string) {
    setDocCharge(num);
    const r = await identite.document(num);
    setDocCharge(null);
    if (r.ok) setDoc(r.valeur);
    else setErreur(r.message);
  }

  // Retour explicite : dans les onglets de l'app, « back » renvoie au premier onglet.
  const retour = () => router.navigate(liens.commandes as never);

  if (!commande) {
    return (
      <View style={{ flex: 1, backgroundColor: dp.papier }}>
        <EnteteDP titre={numero} retour={retour} />
        {erreur ? <Message texte={erreur} action="Réessayer" onAction={charger} /> : <Chargement />}
      </View>
    );
  }

  const c = couleurStatut(commande.statut);
  const lignes = commande.livraison?.length ? commande.livraison : commande.lignes;
  const etape = ETAPES.indexOf(commande.statut);
  const paiement = PAIEMENTS.find((p) => p.code === commande.paiement_mode)?.libelle ?? commande.paiement_mode;

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP titre={commande.numero} sousTitre={`Passée le ${commande.creee_le_fr}`} retour={retour} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={st.carte}>
          <Text style={[st.statut, { backgroundColor: c.fond, color: c.texte }]}>{STATUTS[commande.statut] ?? commande.statut}</Text>
          {commande.statut !== 'annulee' ? (
            <View style={st.etapes}>
              {ETAPES.map((e, i) => (
                <View key={e} style={[st.etape, i <= etape && { backgroundColor: dp.foretClair }]} />
              ))}
            </View>
          ) : null}
          <Text style={st.info}>Livraison prévue : <Text style={st.fort}>{dateCourte(commande.date_livraison)}</Text>
            {commande.plage_livraison ? ` (${commande.plage_livraison})` : ''}</Text>
          <Text style={st.info}>Paiement à la livraison : <Text style={st.fort}>{paiement}</Text>
            {commande.paiement_statut === 'paye' ? ' · payé ✓' : ''}</Text>
          {commande.commentaire ? <Text style={st.info}>Précision : {commande.commentaire}</Text> : null}
        </View>

        <Text style={st.titreBloc}>Articles</Text>
        <View style={st.carte}>
          {lignes.map((l, i) => (
            <View key={i} style={[st.ligne, i > 0 && st.separateur]}>
              <View style={{ flex: 1 }}>
                <Text style={st.libelle}>{l.quantite} × {l.libelle}</Text>
                {l.motif ? <Text style={st.motif}>{l.motif}</Text> : null}
              </View>
              <Text style={st.montant}>{ar(l.sous_total)}</Text>
            </View>
          ))}
          <View style={[st.ligne, st.separateur]}>
            <Text style={[st.libelle, st.fort]}>Total</Text>
            <Text style={[st.montant, { fontSize: 17 }]}>{ar(commande.total)}</Text>
          </View>
        </View>

        {commande.bl_numero || commande.facture_numero ? (
          <>
            <Text style={st.titreBloc}>Documents</Text>
            {[commande.bl_numero && { n: commande.bl_numero, t: 'Bon de livraison' }, commande.facture_numero && { n: commande.facture_numero, t: 'Facture' }]
              .filter(Boolean)
              .map((d) => d as { n: string; t: string })
              .map((d) => (
                <Pressable key={d.n} style={st.doc} onPress={() => ouvrir(d.n)}>
                  <Icon name="description" size={22} color={dp.foret} />
                  <Text style={st.docTexte}>{d.t} · {d.n}</Text>
                  {docCharge === d.n ? <ActivityIndicator color={dp.foret} /> : <Icon name="chevron_right" size={22} color={dp.gris} />}
                </Pressable>
              ))}
          </>
        ) : (
          <Text style={st.aide}>Le bon de livraison et la facture apparaîtront ici dès leur émission.</Text>
        )}
      </ScrollView>
      <VueDocument doc={doc} fermer={() => setDoc(null)} />
    </View>
  );
}

function VueDocument({ doc, fermer }: { doc: DocumentDP | null; fermer: () => void }) {
  const insets = useSafeAreaInsets();
  if (!doc) return null;
  const titre = doc.type === 'facture' ? 'Facture' : 'Bon de livraison';
  const e = doc.donnees.emetteur ?? {};
  const cl = doc.donnees.client ?? {};
  const lignes = doc.donnees.lignes ?? [];
  const texte = [
    `${titre} ${doc.numero}`,
    `${e.raison_sociale ?? ''} — NIF ${e.nif ?? ''}`,
    `Client : ${cl.nom_etablissement ?? ''}`,
    ...lignes.map((l) => `${l.quantite} × ${l.libelle} : ${ar(l.sous_total)}`),
    `Total : ${ar(doc.donnees.total ?? doc.total)}`,
  ].join('\n');
  return (
    <Modal visible animationType="slide" onRequestClose={fermer}>
      <View style={{ flex: 1, backgroundColor: dp.papier, paddingTop: insets.top }}>
        <View style={st.docEntete}>
          <Pressable onPress={fermer} hitSlop={12} accessibilityLabel="Fermer"><Icon name="close" size={24} color={dp.encre} /></Pressable>
          <Text style={st.docTitre}>{titre}</Text>
          <Pressable onPress={() => Share.share({ message: texte })} hitSlop={12} accessibilityLabel="Partager"><Icon name="share" size={22} color={dp.foret} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
          <View style={st.carte}>
            <Text style={st.docNumero}>{titre} n° {doc.numero}</Text>
            <Text style={st.info}>Émis le {new Date(doc.emis_le).toLocaleDateString('fr-FR')}</Text>
            <Text style={[st.info, { marginTop: 10 }]}><Text style={st.fort}>{e.raison_sociale}</Text>{e.forme_juridique ? ` (${e.forme_juridique})` : ''}</Text>
            <Text style={st.info}>{[e.adresse, e.ville].filter(Boolean).join(', ')}</Text>
            <Text style={st.info}>NIF {e.nif ?? '—'} · STAT {e.stat ?? '—'}</Text>
            <Text style={[st.info, { marginTop: 10 }]}>Client : <Text style={st.fort}>{cl.nom_etablissement}</Text></Text>
            {cl.emplacement ? <Text style={st.info}>{cl.emplacement}</Text> : null}
          </View>
          <View style={[st.carte, { marginTop: 12 }]}>
            {lignes.map((l, i) => (
              <View key={i} style={[st.ligne, i > 0 && st.separateur]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.libelle}>{l.quantite} × {l.libelle}</Text>
                  <Text style={st.motif}>{ar(l.prix_unitaire)} l'unité{l.motif ? ` · ${l.motif}` : ''}</Text>
                </View>
                <Text style={st.montant}>{ar(l.sous_total)}</Text>
              </View>
            ))}
            <View style={[st.ligne, st.separateur]}>
              <Text style={[st.libelle, st.fort]}>Total</Text>
              <Text style={[st.montant, { fontSize: 17 }]}>{ar(doc.donnees.total ?? doc.total)}</Text>
            </View>
            {e.mention_tva ? <Text style={st.aide}>{e.mention_tva}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: dp.blanc, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: dp.bord },
  statut: { alignSelf: 'flex-start', fontFamily: fonts.bold, fontSize: 13, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  etapes: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  etape: { flex: 1, height: 6, borderRadius: 3, backgroundColor: dp.bord },
  info: { fontFamily: fonts.regular, fontSize: 14, color: dp.encre, marginTop: 4 },
  fort: { fontFamily: fonts.bold },
  titreBloc: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.encre, marginTop: 20, marginBottom: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  separateur: { borderTopWidth: 1, borderTopColor: dp.bord },
  libelle: { fontFamily: fonts.medium, fontSize: 14, color: dp.encre },
  motif: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 2 },
  montant: { fontFamily: fonts.extrabold, fontSize: 14, color: dp.foret },
  aide: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 14 },
  doc: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: dp.blanc, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: dp.bord, marginBottom: 8, minHeight: 52,
  },
  docTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: dp.encre },
  docEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: dp.bord, backgroundColor: dp.blanc },
  docTitre: { fontFamily: fonts.extrabold, fontSize: 17, color: dp.encre },
  docNumero: { fontFamily: fonts.extrabold, fontSize: 17, color: dp.foret },
});
