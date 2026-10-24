import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/Icon';
import { fonts } from '../../theme/tokens';
import { ar, chargerCatalogue, type CatalogueDP } from '../api';
import { dp, useDistripro } from '../contexte';
import { BarreBas, BoutonPanier, Chargement, EnteteDP, LigneProduit, Message } from '../composants';
import { totalIndicatif, usePanierDP } from '../panier';

/** Catalogue DistriPro : rayons, recherche, ajout au panier. Lisible sans compte. */
export function EcranCatalogue({ sousTitre, enHaut = true }: { sousTitre?: string | null; enHaut?: boolean }) {
  const router = useRouter();
  const { liens } = useDistripro();
  const [cat, setCat] = useState<CatalogueDP | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const [rayon, setRayon] = useState<number | null>(null);
  const [recherche, setRecherche] = useState('');
  const panier = usePanierDP();

  const charger = useCallback(async () => {
    try {
      const c = await chargerCatalogue();
      setCat(c);
      setErreur(false);
      usePanierDP.getState().rafraichir(c.produits);
    } catch {
      setErreur(true);
    }
  }, []);

  useEffect(() => {
    void panier.charger();
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retour sur l'onglet : prix et stock relus (ils bougent en base).
  useFocusEffect(useCallback(() => { if (cat) void charger(); }, [cat, charger]));

  const sections = useMemo(() => {
    if (!cat) return [];
    const q = recherche.trim().toLowerCase();
    const out: { title: string; data: CatalogueDP['produits'] }[] = [];
    for (const r of cat.rayons) {
      if (rayon !== null && r.id !== rayon) continue;
      for (const sc of r.sousCategories) {
        const data = cat.produits.filter(
          (p) => p.sousCategorieId === sc.id && (!q || p.nom.toLowerCase().includes(q) || (p.descriptif ?? '').toLowerCase().includes(q)),
        );
        if (data.length) out.push({ title: `${r.emoji ?? ''} ${sc.nom}`.trim(), data });
      }
    }
    return out;
  }, [cat, rayon, recherche]);

  const nb = panier.lignes.length;
  const total = totalIndicatif(panier.lignes);

  return (
    <View style={{ flex: 1, backgroundColor: dp.papier }}>
      <EnteteDP
        titre="Commander"
        sousTitre={sousTitre ?? 'Emballages, frites et légumes, livrés à Nosy Be'}
        enHaut={enHaut}
        droite={
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => router.push(liens.commandes as never)} style={st.icone} accessibilityLabel="Mes commandes DistriPro" hitSlop={6}>
              <Icon name="receipt_long" size={22} color={dp.blanc} />
            </Pressable>
            <BoutonPanier nombre={nb} onPress={() => router.push(liens.panier as never)} />
          </View>
        }
      />
      {!cat && !erreur ? <Chargement /> : null}
      {erreur && !cat ? <Message texte="Le catalogue DistriPro ne répond pas." action="Réessayer" onAction={charger} /> : null}
      {cat ? (
        <>
          <View style={st.filtres}>
            <View style={st.recherche}>
              <Icon name="search" size={20} color={dp.gris} />
              <TextInput
                value={recherche}
                onChangeText={setRecherche}
                placeholder="Rechercher (bol, frites, carton…)"
                placeholderTextColor={dp.gris}
                style={st.rechercheTexte}
                returnKeyType="search"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.puces}>
              <Puce texte="Tout" actif={rayon === null} onPress={() => setRayon(null)} />
              {cat.rayons.map((r) => (
                <Puce key={r.id} texte={`${r.emoji ?? ''} ${r.nom}`.trim()} actif={rayon === r.id} onPress={() => setRayon(r.id)} />
              ))}
            </ScrollView>
          </View>
          <SectionList
            sections={sections}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            stickySectionHeadersEnabled={false}
            refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
            ListHeaderComponent={
              <Text style={st.info}>
                Paiement à la livraison. Les prix marqués « provisoire » seront confirmés à l'arrivée du stock.
              </Text>
            }
            renderSectionHeader={({ section }) => <Text style={st.section}>{section.title}</Text>}
            renderItem={({ item }) => (
              <LigneProduit
                produit={item}
                quantite={panier.quantite(item.id)}
                ajouter={() => panier.ajouter(item)}
                retirer={() => panier.retirer(item.id)}
              />
            )}
            ListEmptyComponent={<Message texte="Aucun produit ne correspond." />}
          />
          {nb > 0 ? (
            <View style={st.flottant}>
              <BarreBas
                texte={`Voir le panier · ${nb} article${nb > 1 ? 's' : ''}`}
                montant={ar(total)}
                onPress={() => router.push(liens.panier as never)}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Puce({ texte, actif, onPress }: { texte: string; actif: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[st.puce, actif && st.puceActive]}>
      <Text style={[st.puceTexte, actif && st.puceTexteActif]}>{texte}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  icone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filtres: { backgroundColor: dp.blanc, borderBottomWidth: 1, borderBottomColor: dp.bord, paddingTop: 12 },
  recherche: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 12,
    backgroundColor: dp.papier, borderRadius: 12, borderWidth: 1, borderColor: dp.bord, minHeight: 44,
  },
  rechercheTexte: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: dp.encre, paddingVertical: 8 },
  puces: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  puce: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: dp.bord, backgroundColor: dp.blanc },
  puceActive: { backgroundColor: dp.foret, borderColor: dp.foret },
  puceTexte: { fontFamily: fonts.semibold, fontSize: 13, color: dp.encre },
  puceTexteActif: { color: dp.blanc },
  info: { fontFamily: fonts.medium, fontSize: 12, color: dp.gris, marginBottom: 6 },
  section: { fontFamily: fonts.extrabold, fontSize: 16, color: dp.encre, marginTop: 14, marginBottom: 8 },
  flottant: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
