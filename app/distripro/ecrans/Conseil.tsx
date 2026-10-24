import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/Icon';
import { fonts } from '../../theme/tokens';
import { ar, type ConseilDP, type LigneConseil } from '../api';
import { dp, useDistripro } from '../contexte';
import { BarreBas, Chargement, EnteteDP, Message } from '../composants';
import { usePanierDP } from '../panier';

/**
 * « Ma liste conseillée » : à partir des plats VRAIMENT vendus sur Taxi Food ces
 * 30 derniers jours (relus côté serveur), les contenants qu'il faut pour chaque plat,
 * ce que coûte l'emballage d'un plat au prix DistriPro, comparé à ce que le client paie,
 * et les lots à commander pour un mois.
 */
export function EcranConseil() {
  const router = useRouter();
  const { identite, liens } = useDistripro();
  const panier = usePanierDP();
  const [conseil, setConseil] = useState<ConseilDP | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoute, setAjoute] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!identite.conseil) { setErreur('Indisponible ici.'); return; }
    const r = await identite.conseil();
    if (r.ok) { setConseil(r.valeur); setErreur(null); } else setErreur(r.message);
  }, [identite]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  const dispo = (l: LigneConseil) => l.stock === null || l.stock > 0;

  function ajouter(lignes: LigneConseil[]) {
    let n = 0;
    for (const l of lignes.filter(dispo)) {
      const q = panier.fixer(
        { id: l.produit_id, nom: l.nom, prix: l.prix_lot, unite: 'paquet', qteMin: 1, pas: 1, stock: l.stock,
          conditionnement: null, qteParLot: l.qte_par_lot, prixProvisoire: l.prix_provisoire, descriptif: null, image: null, sousCategorieId: 0 },
        l.lots,
      );
      if (q > 0) n += 1;
    }
    const absents = lignes.length - lignes.filter(dispo).length;
    setAjoute(n > 0
      ? `${n} produit${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au panier.${absents ? ` ${absents} en réassort, pas encore commandable${absents > 1 ? 's' : ''}.` : ''}`
      : 'Rien d\'ajouté : ces emballages sont en réassort.');
  }

  const retour = () => router.navigate(liens.catalogue as never);

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP titre="Ma liste conseillée" sousTitre="D'après vos ventes Taxi Food des 30 derniers jours" retour={retour} />
      {!conseil && !erreur ? <Chargement /> : null}
      {erreur && !conseil ? <Message texte={erreur} action="Réessayer" onAction={charger} /> : null}
      {conseil ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {conseil.categories.length === 0 ? (
            <Text style={st.aide}>Aucune vente livrée sur les 30 derniers jours : la liste se remplira avec vos premières commandes.</Text>
          ) : null}

          {conseil.liste.length > 0 ? (
            <>
              <Text style={st.titreBloc}>Pour un mois</Text>
              <View style={st.carte}>
                {conseil.liste.map((l, i) => (
                  <View key={l.produit_id} style={[st.ligne, i > 0 && st.separateur]}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.nom}>{l.nom}</Text>
                      <Text style={st.sous}>
                        ≈ {l.pieces} pièces · {l.lots} lot{l.lots > 1 ? 's' : ''} · {ar(l.prix_lot * l.lots)}
                        {l.prix_provisoire ? ' (prix provisoire)' : ''}
                      </Text>
                      {!dispo(l) ? <Text style={st.reassort}>Réassort en cours</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {conseil.categories.map((c) => (
            <View key={c.categorie} style={{ marginTop: 18 }}>
              <Text style={st.titreBloc}>{c.categorie} · {c.plats} plat{c.plats > 1 ? 's' : ''} vendu{c.plats > 1 ? 's' : ''}</Text>
              {c.fiches.length === 0 ? <Text style={st.aide}>Pas de fiche emballage pour cette catégorie.</Text> : null}
              {c.fiches.map((f) => (
                <View key={f.nom} style={[st.carte, { marginBottom: 8 }]}>
                  <Text style={st.fiche}>{f.nom}</Text>
                  {f.contenants.map((k, i) => (
                    <View key={i} style={st.contenant}>
                      <Icon name={k.produit_id ? 'check_circle' : 'schedule'} size={16} color={k.produit_id ? dp.foretClair : dp.ambre} />
                      <Text style={st.contenantTexte}>
                        {k.quantite > 1 ? `${Number(k.quantite)} × ` : ''}{k.contenant}
                        {k.prix_piece ? ` · ${ar(k.prix_piece)} pièce` : ' · pas encore au catalogue'}
                      </Text>
                    </View>
                  ))}
                  <View style={st.compare}>
                    <Text style={st.compareTexte}>
                      Emballage d'un plat : <Text style={st.fort}>{f.cout_plat ? ar(f.cout_plat) : '—'}</Text>
                      {!f.complet && f.cout_plat ? ' (hors contenants à venir)' : ''}
                    </Text>
                    {c.forfait ? <Text style={st.compareTexte}>Votre client paie : <Text style={st.fort}>{ar(c.forfait)}</Text></Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ))}

          {conseil.sans_fiche.length ? (
            <Text style={[st.aide, { marginTop: 16 }]}>Sans emballage conseillé : {conseil.sans_fiche.join(', ')}.</Text>
          ) : null}
          <Text style={[st.aide, { marginTop: 12 }]}>
            Estimation : quand une catégorie regroupe plusieurs sortes de plats, les ventes sont réparties à parts égales entre leurs fiches.
          </Text>
          {ajoute ? <Text style={st.ok}>{ajoute}</Text> : null}
        </ScrollView>
      ) : null}
      {conseil && conseil.liste.length > 0 ? (
        <View style={st.flottant}>
          <BarreBas texte="Tout ajouter au panier" onPress={() => ajouter(conseil.liste)} />
        </View>
      ) : null}
    </View>
  );
}

/** Carte d'appel en tête du catalogue (app seulement). */
export function CarteConseil() {
  const router = useRouter();
  const { liens } = useDistripro();
  if (!liens.conseil) return null;
  return (
    <Pressable onPress={() => router.push(liens.conseil as never)} style={st.appel}>
      <Icon name="auto_awesome" size={22} color={dp.blanc} />
      <View style={{ flex: 1 }}>
        <Text style={st.appelTitre}>Ma liste conseillée</Text>
        <Text style={st.appelTexte}>Les emballages qu'il vous faut, d'après vos ventes Taxi Food.</Text>
      </View>
      <Icon name="chevron_right" size={22} color={dp.blanc} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: dp.blanc, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: dp.bord },
  titreBloc: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.encre, marginBottom: 8 },
  ligne: { paddingVertical: 8 },
  separateur: { borderTopWidth: 1, borderTopColor: dp.bord },
  nom: { fontFamily: fonts.semibold, fontSize: 14, color: dp.encre },
  sous: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 2 },
  reassort: { fontFamily: fonts.semibold, fontSize: 11, color: dp.ambre, marginTop: 2 },
  fiche: { fontFamily: fonts.bold, fontSize: 14, color: dp.foret, marginBottom: 6 },
  contenant: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  contenantTexte: { fontFamily: fonts.regular, fontSize: 13, color: dp.encre, flex: 1 },
  compare: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: dp.bord, gap: 2 },
  compareTexte: { fontFamily: fonts.regular, fontSize: 13, color: dp.encre },
  fort: { fontFamily: fonts.bold },
  aide: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris },
  ok: { fontFamily: fonts.semibold, fontSize: 14, color: dp.foretClair, backgroundColor: dp.menthe, borderRadius: 10, padding: 12, marginTop: 14 },
  flottant: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  appel: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: dp.cobalt, borderRadius: 14,
    padding: 14, marginBottom: 12,
  },
  appelTitre: { fontFamily: fonts.extrabold, fontSize: 15, color: dp.blanc },
  appelTexte: { fontFamily: fonts.regular, fontSize: 12, color: dp.blanc, marginTop: 2 },
});
