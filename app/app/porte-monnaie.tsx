import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { Card, SectionLabel } from '../components/primitives';
import { colors, fonts, formatAr, spacing } from '../theme/tokens';
import { monPorteMonnaie } from '../data/api';
import { MouvementPorteMonnaie } from '../data/types';
import { useLoad } from '../lib/useLoad';
import { useSession } from '../store/session';
import { signInFor } from '../store/authIntent';

/** JJ/MM/AAAA sans dépendre d'Intl (même parti pris que BlocAvis). */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Mon porte-monnaie (2026-10-07) : solde + historique, lus en base par
 * `mon_porte_monnaie()`. Lecture seule : le solde ne bouge que par la base
 * (avis déposé, commande, annulation, geste de Taxi Food).
 */
export default function PorteMonnaieScreen() {
  const session = useSession((s) => s.session);
  return <Contenu connecte={!!session} />;
}

/**
 * Page d'explication ET porte-monnaie (2026-10-07). C'est aussi la page ouverte par
 * l'annonce « Nouveau : ton porte-monnaie » : elle doit donc se lire SANS compte — un
 * visiteur voit comment ça marche et un bouton pour se connecter, au lieu d'être
 * renvoyé ailleurs sans explication.
 */
function Contenu({ connecte }: { connecte: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Header title={t('porteMonnaie.titre')} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32 }}>
        {connecte ? (
          <Solde />
        ) : (
          <Card style={styles.soldeCard}>
            <Icon name="account_balance_wallet" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.soldeLabel}>{t('porteMonnaie.invite')}</Text>
              <Pressable onPress={() => signInFor(router, '/porte-monnaie')} hitSlop={8}>
                <Text style={styles.connexion}>{t('porteMonnaie.seConnecter')}</Text>
              </Pressable>
            </View>
          </Card>
        )}

        <SectionLabel style={{ marginTop: 22, marginBottom: 10 }}>{t('porteMonnaie.commentTitre')}</SectionLabel>
        <Card style={{ gap: 14 }}>
          {(['avis', 'payer', 'plats', 'jamais'] as const).map((k) => (
            <View key={k} style={styles.etape}>
              <Text style={styles.etapeEmoji}>{t(`porteMonnaie.etapes.${k}.emoji`)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.etapeTitre}>{t(`porteMonnaie.etapes.${k}.titre`)}</Text>
                <Text style={styles.etapeTexte}>{t(`porteMonnaie.etapes.${k}.texte`)}</Text>
              </View>
            </View>
          ))}
        </Card>

        {connecte ? <Historique /> : null}
      </ScrollView>
    </View>
  );
}

function Solde() {
  const { t } = useTranslation();
  const { data } = useLoad(() => monPorteMonnaie(), []);
  return (
    <Card style={styles.soldeCard}>
      <Icon name="account_balance_wallet" size={28} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.soldeLabel}>{t('porteMonnaie.solde')}</Text>
        <Text style={styles.soldeValeur}>{formatAr(data?.solde ?? 0)}</Text>
      </View>
    </Card>
  );
}

function Historique() {
  const { t } = useTranslation();
  const { data, loading, error } = useLoad(() => monPorteMonnaie(), []);
  return (
    <>
      <SectionLabel style={{ marginTop: 22, marginBottom: 10 }}>{t('porteMonnaie.historique')}</SectionLabel>
      {loading && !data ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      ) : error && !data ? (
        <Text style={styles.vide}>{t('porteMonnaie.erreur')}</Text>
      ) : (data?.mouvements ?? []).length === 0 ? (
        <Text style={styles.vide}>{t('porteMonnaie.vide')}</Text>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {(data?.mouvements ?? []).map((m, i) => (
            <Ligne key={m.id} m={m} bordure={i > 0} />
          ))}
        </Card>
      )}
    </>
  );
}

function Ligne({ m, bordure }: { m: MouvementPorteMonnaie; bordure: boolean }) {
  const { t } = useTranslation();
  const credit = m.montant > 0;
  const detail = [m.commande, m.restaurant, dateCourte(m.createdAt)].filter(Boolean).join(' · ');
  return (
    <View style={[styles.ligne, bordure && styles.ligneBordure]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ligneMotif}>{t(`porteMonnaie.motifs.${m.motif}`)}</Text>
        <Text style={styles.ligneDetail}>{detail}</Text>
      </View>
      <Text style={[styles.ligneMontant, { color: credit ? colors.secondary : colors.textDark }]}>
        {credit ? '+' : '−'}
        {formatAr(Math.abs(m.montant))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  soldeCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  soldeLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  soldeValeur: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.primary, marginTop: 2 },
  connexion: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary, marginTop: 4 },
  etape: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  etapeEmoji: { fontSize: 22, lineHeight: 26 },
  etapeTitre: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  etapeTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.5, color: colors.textMuted, marginTop: 2 },
  explication: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textMuted, marginTop: 12 },
  vide: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  ligneBordure: { borderTopWidth: 1, borderTopColor: colors.border },
  ligneMotif: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  ligneDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  ligneMontant: { fontFamily: fonts.bold, fontSize: 15 },
});
