import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import type { ReversementCommande as Ligne } from '../data/api';
import { dateCourte, pourcent, textesReversement } from '../lib/textesReversement';

/**
 * Sous une commande livrée de l'Historique du restaurant : a-t-elle été reversée ?
 * Pastille verte « Reversé le 12/10 · réf. D22570 », le montant de CETTE commande et,
 * en petit, le versement entier (un virement couvre souvent plusieurs commandes — sans
 * ça, le restaurant compare le montant d'une commande à celui du virement). Pastille
 * grise « À reverser » sinon, « Réglé à la commande » pour les restaurants payés à la
 * commande. Le calcul se déplie : plats + emballage − commission − part offerte.
 *
 * Données : `mes_reversements_commandes` (staff du restaurant seulement, net FIGÉ au
 * reversement). Rien n'est calculé ici.
 */
export function ReversementCommande({ ligne }: { ligne: Ligne }) {
  const [ouvert, setOuvert] = useState(false);
  const t = textesReversement(ligne.langue);
  const vert = ligne.etat !== 'a_reverser';

  const titre =
    ligne.etat === 'reverse'
      ? `${t.reverse(dateCourte(ligne.reverseLe))}${ligne.reference ? ` · ${t.ref} ${ligne.reference}` : ''}`
      : ligne.etat === 'regle_a_la_commande'
        ? t.regle
        : t.aReverser;

  return (
    <View style={[styles.bloc, vert ? styles.blocVert : styles.blocGris]}>
      <View style={styles.tete}>
        <Icon name={vert ? 'check_circle' : 'schedule'} size={18} color={vert ? colors.success : colors.textMuted} />
        <Text style={[styles.titre, { color: vert ? colors.success : colors.textDark }]} numberOfLines={2}>
          {titre}
        </Text>
        <Text style={[styles.montant, { color: vert ? colors.success : colors.ink }]}>{formatAr(ligne.net)}</Text>
      </View>
      {ligne.etat === 'reverse' && ligne.versementMontant != null && (ligne.versementNb ?? 0) > 1 ? (
        <Text style={styles.sous}>
          {t.pourCetteCommande} · {t.versement(formatAr(ligne.versementMontant), ligne.versementNb ?? 0)}
        </Text>
      ) : null}

      <Pressable onPress={() => setOuvert((v) => !v)} style={styles.lien} accessibilityRole="button">
        <Text style={styles.lienTexte}>{ouvert ? t.masquerCalcul : t.voirCalcul}</Text>
        <Icon name={ouvert ? 'expand_less' : 'expand_more'} size={18} color={colors.textMuted} />
      </Pressable>

      {ouvert ? (
        <View style={styles.calcul}>
          <Ligne label={t.plats} valeur={formatAr(ligne.plats)} />
          {ligne.emballage > 0 ? <Ligne label={`+ ${t.emballage}`} valeur={formatAr(ligne.emballage)} /> : null}
          <Ligne label={`− ${t.commission(pourcent(ligne.taux))}`} valeur={`−${formatAr(ligne.commission)}`} />
          {ligne.offert > 0 ? <Ligne label={`− ${t.offert}`} valeur={`−${formatAr(ligne.offert)}`} /> : null}
          <View style={styles.trait} />
          <Ligne label={`= ${ligne.etat === 'a_reverser' ? t.totalAVenir : t.total}`} valeur={formatAr(ligne.net)} fort />
        </View>
      ) : null}
    </View>
  );
}

function Ligne({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <View style={styles.ligne}>
      <Text style={[styles.ligneLabel, fort && styles.fort]}>{label}</Text>
      <Text style={[styles.ligneValeur, fort && styles.fort]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: radius.tile, padding: 12, borderWidth: 1 },
  blocVert: { backgroundColor: '#ECFDF3', borderColor: '#A7E3BE' },
  blocGris: { backgroundColor: colors.bg, borderColor: colors.border },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { flex: 1, fontFamily: fonts.bold, fontSize: 13 },
  montant: { fontFamily: fonts.extrabold, fontSize: 15 },
  sous: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4, marginLeft: 26 },
  lien: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, marginTop: 6, marginLeft: 26, minHeight: 32 },
  lienTexte: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  calcul: { marginTop: 4, marginLeft: 26, gap: 4 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ligneLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textDark },
  ligneValeur: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  fort: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  trait: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});
