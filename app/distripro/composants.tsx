/**
 * Briques visuelles du module DistriPro. Charte DistriPro (vert forêt + cobalt) et
 * non Taxi Food : la bascule d'univers doit se voir (exigence A3).
 */
import { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { fonts } from '../theme/tokens';
import { dp } from './contexte';
import { ar, etatStock, libelleQuantite, prixPiece, type ProduitDP } from './api';

export function Monogramme({ taille = 34 }: { taille?: number }) {
  return (
    <View style={[s.mono, { width: taille, height: taille, borderRadius: taille * 0.28 }]}>
      <Text style={[s.monoTexte, { fontSize: taille * 0.5 }]}>D</Text>
      <View style={[s.monoPoint, { width: taille * 0.22, height: taille * 0.22, borderRadius: taille }]} />
    </View>
  );
}

export function EnteteDP({
  titre,
  sousTitre,
  retour,
  droite,
  enHaut = true,
}: {
  titre: string;
  sousTitre?: string | null;
  retour?: () => void;
  droite?: ReactNode;
  /** false quand un autre en-tête occupe déjà la zone sûre (barre d'état). */
  enHaut?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.entete, { paddingTop: (enHaut ? insets.top : 0) + 12 }]}>
      <View style={s.enteteLigne}>
        {retour ? (
          <Pressable onPress={retour} hitSlop={12} style={s.retour} accessibilityLabel="Retour">
            <Icon name="arrow_back" size={22} color={dp.blanc} />
          </Pressable>
        ) : (
          <Monogramme />
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.marque}>DISTRIPRO · ACHAT PRO</Text>
          <Text style={s.titre} numberOfLines={1}>{titre}</Text>
          {sousTitre ? <Text style={s.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
        </View>
        {droite}
      </View>
    </View>
  );
}

export function BoutonPanier({ nombre, onPress }: { nombre: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.boutonPanier} accessibilityLabel={`Panier, ${nombre} article(s)`} hitSlop={8}>
      <Icon name="shopping_cart" size={22} color={dp.blanc} />
      {nombre > 0 ? (
        <View style={s.pastille}><Text style={s.pastilleTexte}>{nombre}</Text></View>
      ) : null}
    </Pressable>
  );
}

const EMOJI_SC: Record<number, string> = {
  215: '🧅', 230: '🥣', 231: '🍱', 232: '🍟', 233: '🍕', 234: '🛍️', 235: '🥢', 236: '🥤', 237: '📄', 238: '🍟',
};

export function Vignette({ produit, taille = 64 }: { produit: Pick<ProduitDP, 'image' | 'sousCategorieId'>; taille?: number }) {
  if (produit.image) {
    return <Image source={{ uri: produit.image }} style={[s.vignette, { width: taille, height: taille }]} resizeMode="cover" />;
  }
  return (
    <View style={[s.vignette, s.vignetteVide, { width: taille, height: taille }]}>
      <Text style={{ fontSize: taille * 0.42 }}>{EMOJI_SC[produit.sousCategorieId] ?? '📦'}</Text>
    </View>
  );
}

export function Stepper({
  quantite,
  libelle,
  plus,
  moins,
  plusDesactive,
}: {
  quantite: number;
  libelle: string;
  plus: () => void;
  moins: () => void;
  plusDesactive?: boolean;
}) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={moins} style={s.stepBtn} hitSlop={6} accessibilityLabel="Retirer">
        <Icon name={quantite <= 0 ? 'remove' : 'remove'} size={20} color={dp.foret} />
      </Pressable>
      <Text style={s.stepTexte} numberOfLines={1}>{libelle}</Text>
      <Pressable
        onPress={plus}
        disabled={plusDesactive}
        style={[s.stepBtn, plusDesactive && { opacity: 0.35 }]}
        hitSlop={6}
        accessibilityLabel="Ajouter"
      >
        <Icon name="add" size={20} color={dp.foret} />
      </Pressable>
    </View>
  );
}

export function LigneProduit({
  produit,
  quantite,
  ajouter,
  retirer,
}: {
  produit: ProduitDP;
  quantite: number;
  ajouter: () => void;
  retirer: () => void;
}) {
  const stock = etatStock(produit);
  const piece = prixPiece(produit);
  const indispo = stock !== null && !stock.dispo;
  const auMax = produit.stock !== null && quantite + produit.pas > produit.stock;
  return (
    <View style={s.ligne}>
      <Vignette produit={produit} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.nom} numberOfLines={2}>{produit.nom}</Text>
        {produit.descriptif ? <Text style={s.descriptif} numberOfLines={2}>{produit.descriptif}</Text> : null}
        <View style={s.prixLigne}>
          <Text style={s.prix}>{ar(produit.prix)}</Text>
          <Text style={s.unite}>
            {produit.unite === 'kg' ? ' le kg' : produit.conditionnement ? ` · ${produit.conditionnement.toLowerCase()}` : ''}
          </Text>
        </View>
        <View style={s.badges}>
          {piece ? <Text style={s.piece}>{piece}</Text> : null}
          {produit.qteMin > 1 ? <Text style={s.min}>Minimum {libelleQuantite(produit, produit.qteMin)}</Text> : null}
          {produit.prixProvisoire ? <Text style={s.provisoire}>Prix provisoire</Text> : null}
          {stock ? (
            <Text style={[s.stock, !stock.dispo && s.stockVide]}>{stock.texte}</Text>
          ) : null}
        </View>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          {indispo ? null : quantite > 0 ? (
            <Stepper
              quantite={quantite}
              libelle={libelleQuantite(produit, quantite)}
              plus={ajouter}
              moins={retirer}
              plusDesactive={auMax}
            />
          ) : (
            <Pressable onPress={ajouter} style={s.ajouter} accessibilityLabel={`Ajouter ${produit.nom}`}>
              <Icon name="add" size={18} color={dp.blanc} />
              <Text style={s.ajouterTexte}>
                Ajouter{produit.qteMin > 1 ? ` (${libelleQuantite(produit, produit.qteMin)})` : ''}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export function Chargement() {
  return (
    <View style={s.centre}>
      <ActivityIndicator color={dp.foret} />
    </View>
  );
}

export function Message({ texte, action, onAction }: { texte: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.centre}>
      <Text style={s.message}>{texte}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={[s.ajouter, { marginTop: 14 }]}>
          <Text style={s.ajouterTexte}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function BarreBas({ texte, montant, onPress, desactive }: { texte: string; montant?: string; onPress: () => void; desactive?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.barre, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable onPress={onPress} disabled={desactive} style={[s.barreBtn, desactive && { opacity: 0.5 }]}>
        <Text style={s.barreTexte}>{texte}</Text>
        {montant ? <Text style={s.barreMontant}>{montant}</Text> : null}
      </Pressable>
    </View>
  );
}

export const s = StyleSheet.create({
  mono: { backgroundColor: dp.blanc, alignItems: 'center', justifyContent: 'center' },
  monoTexte: { fontFamily: fonts.extrabold, color: dp.foret, marginTop: -2 },
  monoPoint: { position: 'absolute', right: 5, bottom: 5, backgroundColor: dp.cobalt },
  entete: { backgroundColor: dp.foret, paddingHorizontal: 16, paddingBottom: 14 },
  enteteLigne: { flexDirection: 'row', alignItems: 'center' },
  retour: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  marque: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: '#8BBFA9' },
  titre: { fontFamily: fonts.extrabold, fontSize: 19, color: dp.blanc, marginTop: 1 },
  sousTitre: { fontFamily: fonts.medium, fontSize: 12, color: '#C3DDD0', marginTop: 2 },
  boutonPanier: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pastille: {
    position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: dp.cobalt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  pastilleTexte: { fontFamily: fonts.bold, fontSize: 10, color: dp.blanc },
  vignette: { borderRadius: 12, backgroundColor: dp.menthe },
  vignetteVide: { alignItems: 'center', justifyContent: 'center' },
  ligne: {
    flexDirection: 'row', backgroundColor: dp.blanc, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: dp.bord, marginBottom: 10,
  },
  nom: { fontFamily: fonts.bold, fontSize: 15, color: dp.encre },
  descriptif: { fontFamily: fonts.regular, fontSize: 12, color: dp.gris, marginTop: 2 },
  prixLigne: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6, flexWrap: 'wrap' },
  prix: { fontFamily: fonts.extrabold, fontSize: 16, color: dp.foret },
  unite: { fontFamily: fonts.medium, fontSize: 12, color: dp.gris },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  piece: { fontFamily: fonts.semibold, fontSize: 11, color: dp.cobalt },
  min: { fontFamily: fonts.semibold, fontSize: 11, color: dp.foretClair },
  provisoire: {
    fontFamily: fonts.semibold, fontSize: 11, color: dp.ambre, backgroundColor: dp.ambreFond,
    paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden',
  },
  stock: { fontFamily: fonts.semibold, fontSize: 11, color: dp.foretClair },
  stockVide: { color: dp.ambre },
  ajouter: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: dp.foret,
    paddingHorizontal: 14, minHeight: 40, borderRadius: 999, alignSelf: 'flex-start',
  },
  ajouterTexte: { fontFamily: fonts.bold, fontSize: 14, color: dp.blanc },
  stepper: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: dp.foret,
    borderRadius: 999, minHeight: 40,
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepTexte: { fontFamily: fonts.bold, fontSize: 14, color: dp.foret, minWidth: 70, textAlign: 'center' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontFamily: fonts.medium, fontSize: 15, color: dp.gris, textAlign: 'center' },
  barre: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: dp.blanc, borderTopWidth: 1, borderTopColor: dp.bord },
  barreBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: dp.foret,
    borderRadius: 14, minHeight: 52, paddingHorizontal: 18,
  },
  barreTexte: { fontFamily: fonts.bold, fontSize: 16, color: dp.blanc },
  barreMontant: { fontFamily: fonts.extrabold, fontSize: 16, color: dp.blanc },
});
