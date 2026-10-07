import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from './primitives';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';
import type { EstimationCommande, Order } from '../data/types';
import { useMaintenant } from '../lib/horloge';

/**
 * ⏱️ Estimation indicative de la commande (2026-10-07).
 *
 * Les chiffres viennent de `estimations_commande`, FIGÉE par la base à la création : l'écran
 * ne recalcule aucune durée, il ne fait que RECALER l'heure d'arrivée sur les étapes réelles
 * déjà franchies :
 *   - rien de réel encore     → livrée vers = heure estimée par la base ;
 *   - prête (`ready_at`)      → livrée vers = prête + (attente livreur + trajet) estimés ;
 *   - récupérée (`picked_up`) → livrée vers = récupérée + trajet estimé.
 * Le compte à rebours ne passe jamais en négatif (« Encore quelques minutes ») et s'arrête à
 * la livraison sur la durée RÉELLE. Masqué pour une commande annulée ou sans estimation
 * (commandes antérieures au 2026-10-07). La mention « indicative » reste toujours visible.
 */
export function BlocEstimation({ order, estimation }: { order: Order; estimation: EstimationCommande | null }) {
  const { t } = useTranslation();
  const livree = order.status === 'livree';
  const actif = !!estimation && !livree && order.status !== 'annulee';
  const maintenant = useMaintenant(actif, 1000);
  if (!estimation || order.status === 'annulee') return null;

  const minutes = (n: number) => n * 60_000;
  const cible = order.pickedUpAt
    ? new Date(new Date(order.pickedUpAt).getTime() + minutes(estimation.trajetMin))
    : order.readyAt
      ? new Date(new Date(order.readyAt).getTime() + minutes(estimation.livraisonMin))
      : new Date(estimation.heureLivreeEstimee);
  const prete = order.readyAt ? new Date(order.readyAt) : new Date(estimation.heurePreteEstimee);

  let compteur: string;
  let compteurLibelle: string;
  if (livree) {
    const reel =
      order.deliveredAt && order.createdAt
        ? Math.max(1, Math.round((new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime()) / 60_000))
        : null;
    compteurLibelle = '';
    compteur = reel != null ? t('estimation.livreeEn', { min: reel }) : t('estimation.livree');
  } else {
    const resteMs = cible.getTime() - maintenant.getTime();
    compteurLibelle = t('estimation.reste');
    compteur = resteMs > 0 ? formatReste(resteMs) : t('estimation.encoreQuelquesMinutes');
  }

  return (
    <Card style={styles.card}>
      <View style={styles.tete}>
        <Icon name="timer" size={20} color={colors.secondary} />
        <Text style={styles.titre}>{t('estimation.titre')}</Text>
      </View>

      <View style={styles.compteurBloc}>
        {compteurLibelle ? <Text style={styles.compteurLibelle}>{compteurLibelle}</Text> : null}
        <Text style={[styles.compteur, livree && styles.compteurLivre]}>{compteur}</Text>
      </View>

      <Ligne
        libelle={t('estimation.preparation', { min: estimation.preparationMin })}
        valeur={order.readyAt ? t('estimation.preteA', { heure: hhmm(prete) }) : t('estimation.preteVers', { heure: hhmm(prete) })}
      />
      {estimation.chargeMin > 0 && !order.readyAt ? (
        <Text style={styles.detail}>
          {t('estimation.charge', { count: estimation.chargeCommandes, min: estimation.chargeMin })}
        </Text>
      ) : null}
      <Ligne libelle={t('estimation.livraison', { min: estimation.livraisonMin })} valeur="" />
      {!livree ? (
        <Ligne libelle={t('estimation.livreeVers')} valeur={hhmm(cible)} fort />
      ) : null}

      <Text style={styles.mention}>{t('estimation.mention')}</Text>
    </Card>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <View style={styles.ligne}>
      <Text style={[styles.ligneLibelle, fort && styles.fort]}>{libelle}</Text>
      {valeur ? <Text style={[styles.ligneValeur, fort && styles.fortValeur]}>{valeur}</Text> : null}
    </View>
  );
}

/** Heure locale du téléphone, « 19h05 » (même convention que `createdLabel`). */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/** « 12:07 », ou « 1:04:09 » au-delà d'une heure. */
function formatReste(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const styles = StyleSheet.create({
  card: { marginTop: 14 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  titre: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  compteurBloc: { alignItems: 'center', paddingVertical: 8, marginBottom: 8, borderRadius: 14, backgroundColor: colors.warnBg },
  compteurLibelle: { fontFamily: fonts.medium, fontSize: 12, color: colors.warnText },
  compteur: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: 0.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  compteurLivre: { fontSize: 18, color: colors.successDark, paddingVertical: 4 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 6 },
  ligneLibelle: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  ligneValeur: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  fort: { fontFamily: fonts.bold, color: colors.ink },
  fortValeur: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },
  detail: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.textMuted, marginTop: 2 },
  mention: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.textMuted, marginTop: 12 },
});
