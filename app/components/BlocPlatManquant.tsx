import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, fonts, formatAr, radius, spacing } from '../theme/tokens';
import { apercuRetraitManquants, resoudrePlatsManquants } from '../data/api';
import { Order } from '../data/types';

/**
 * Plat manquant (2026-10-20). Le restaurant n'a plus un des plats : au lieu d'annuler toute
 * la commande (TF-442 : le client n'a pas recommandé), on demande au client ce qu'il préfère.
 *  - « Retirer » : la base supprime le plat, recalcule tout (code promo, porte-monnaie) et
 *    accepte la commande si elle était encore « reçue » — le restaurant a vérifié le reste.
 *  - « Annuler » : rien à payer.
 * Le nouveau total affiché vient de la base (aperçu), jamais d'un calcul de l'écran.
 * Commande déjà payée en ligne : seule l'annulation est possible pour l'instant
 * (remboursement intégral automatique) — le remboursement partiel viendra plus tard.
 */
export function BlocPlatManquant({ order, onRepondu }: { order: Order; onRepondu: () => void }) {
  const { t } = useTranslation();
  const [total, setTotal] = useState<number | null>(null);
  const [payeeEnLigne, setPayeeEnLigne] = useState(false);
  const [envoi, setEnvoi] = useState<'retirer' | 'annuler' | null>(null);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [erreur, setErreur] = useState(false);
  const attente = !!order.modifAttenteDepuis && order.status !== 'annulee' && order.status !== 'livree';

  useEffect(() => {
    if (!attente) return;
    let actif = true;
    apercuRetraitManquants(order.id)
      .then((a) => {
        if (!actif) return;
        setTotal(a.apres.total);
        setPayeeEnLigne(a.payeeEnLigne);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
    // Les lignes manquantes peuvent s'ajouter : on relit l'aperçu à chaque changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attente, order.id, order.items.filter((i) => i.manquant).length]);

  if (!attente) return null;
  const manquants = order.items.filter((it) => it.manquant);

  async function choisir(choix: 'retirer' | 'annuler') {
    setEnvoi(choix);
    setErreur(false);
    try {
      await resoudrePlatsManquants(order.id, choix);
      onRepondu();
    } catch {
      setErreur(true);
      onRepondu();
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Icon name="edit_note" size={24} color={colors.dangerText} />
        <Text style={styles.titre}>{t('platManquant.titre')}</Text>
      </View>
      <Text style={styles.texte}>{t('platManquant.texte', { resto: order.restaurantName })}</Text>
      <View style={styles.liste}>
        {manquants.map((it, i) => (
          <Text key={it.id ?? i} style={styles.plat}>
            {it.quantity} × {it.name}
          </Text>
        ))}
      </View>
      {payeeEnLigne ? (
        <Text style={styles.texte}>{t('platManquant.payeeEnLigne')}</Text>
      ) : (
        <Button
          label={total != null ? t('platManquant.retirerTotal', { total: formatAr(total) }) : t('platManquant.retirer')}
          icon="check"
          onPress={() => choisir('retirer')}
          loading={envoi === 'retirer'}
          disabled={!!envoi}
        />
      )}
      {/* Annuler en deux appuis : un tap rapide sur le mauvais bouton ne doit pas tout perdre. */}
      <Button
        label={confirmerAnnulation ? t('platManquant.annulerConfirmer') : t('platManquant.annuler')}
        variant="outline"
        onPress={() => (confirmerAnnulation ? choisir('annuler') : setConfirmerAnnulation(true))}
        loading={envoi === 'annuler'}
        disabled={!!envoi}
      />
      <Text style={styles.note}>{t('platManquant.note')}</Text>
      {erreur ? <Text style={styles.erreur}>{t('platManquant.erreur')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: spacing.gap,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: 10,
  },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink, flex: 1 },
  texte: { fontFamily: fonts.medium, fontSize: 14, color: colors.warnText, lineHeight: 20 },
  liste: { gap: 4, paddingLeft: 4 },
  plat: { fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText, textDecorationLine: 'line-through' },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  erreur: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText },
});
