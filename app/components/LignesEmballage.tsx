import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, formatAr } from '../theme/tokens';
import type { PackagingLine } from '../store/cart';

/**
 * Les frais d'emballage, ligne par ligne, tels que le client doit les LIRE.
 *
 * Une consigne de 2 000 Ar sur une boisson à 5 000, c'est +40 % du prix affiché :
 * une ligne muette « Emballage » ne suffit plus. Chaque ligne donne quatre
 * choses — le vrai libellé, le détail « n × montant », le montant, et une phrase
 * grise qui dit ce qu'est cette somme.
 *
 * ⚠️ La phrase ne promet RIEN que l'app ne fait pas : aucun retour de bouteille
 * n'existe dans le modèle (pas de champ, pas d'écran). Formulations
 * descriptives, prises par défaut le 27/09/2026 en attendant le mot du porteur
 * du projet ; un libellé inconnu (« Boîte à pizza ») n'a pas de phrase.
 *
 * Même composant sur les quatre écrans (panier, paiement, suivi, carte
 * restaurant) : le libellé lu doit être le même partout.
 */
export function LignesEmballage({
  lignes,
  compact = false,
}: {
  lignes: PackagingLine[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!lignes.length) return null;
  return (
    <>
      {lignes.map((l) => {
        const note = noteDe(l.label, t);
        return (
          <View key={l.label} style={[styles.bloc, compact && styles.blocCompact]}>
            <View style={styles.ligne}>
              <Text style={[styles.libelle, compact && styles.libelleCompact]}>{l.label}</Text>
              <Text style={[styles.montant, compact && styles.montantCompact]}>{formatAr(l.amount)}</Text>
            </View>
            <Text style={styles.detail}>
              {t('common.packagingDetail', { count: l.count, unit: formatAr(l.unit) })}
            </Text>
            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

/** La phrase d'explication d'un libellé — null quand on n'a rien d'honnête à dire. */
function noteDe(label: string, t: (k: string) => string): string | null {
  const l = label.toLowerCase();
  if (l.includes('consigne')) return t('common.packagingNoteConsigne');
  if (l.includes('emporter')) return t('common.packagingNoteEmporter');
  return null;
}

const styles = StyleSheet.create({
  bloc: { marginTop: 10 },
  blocCompact: { marginTop: 2 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  libelle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textDark },
  libelleCompact: { fontSize: 13, color: colors.textMuted },
  montant: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  montantCompact: { fontSize: 13 },
  detail: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  note: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: colors.textMuted, marginTop: 2 },
});
