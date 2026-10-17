/**
 * Écran — Paiement Orange Money EN LIGNE (API Orange Money WebPay).
 *
 * S'intercale entre la validation et la confirmation, UNIQUEMENT pour une
 * commande née en `orange_money`. La commande existe déjà : on peut réessayer,
 * passer en espèces ou revenir plus tard sans la recréer.
 *
 * Le paiement lui-même se fait sur la page d'Orange (code secret + code reçu
 * par l'USSD #144#), ouverte :
 *   - sur téléphone, dans une session de navigateur (`openAuthSessionAsync`) qui
 *     se referme quand Orange renvoie vers `/om/<commande>` → `taxifood://paiement-om` ;
 *   - sur le web, dans l'onglet lui-même ; Orange renvoie vers `/om/<commande>?w=1`,
 *     qui ramène ici avec `retour=1`.
 *
 * ⚠️ CET ÉCRAN NE DÉCLARE JAMAIS UNE COMMANDE PAYÉE. Au retour, il demande au
 * serveur de revérifier auprès d'Orange (`verifier`), et lit `payment_status`.
 * Un retour de navigateur n'est qu'un signal, jamais une preuve.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Card, Divider } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { colors, fonts, formatAr, spacing } from '../theme/tokens';
import { basculerEnEspeces } from '../data/paiement';
import { getOrderById } from '../data/api';
import {
  creerPaiementOM,
  ErreurPaiementOM,
  MotifEchecOM,
  verifierPaiementOM,
} from '../data/paiementOrangeMoney';
import { useSession } from '../store/session';

type Etape =
  /** Rien n'est encore ouvert : on montre le montant et le bouton « Payer ». */
  | 'pret'
  /** On demande la page de paiement à Orange. */
  | 'ouverture'
  /** Le client est (ou était) sur la page d'Orange : on attend son retour. */
  | 'sur_orange'
  /** On redemande le verdict au serveur. */
  | 'verification'
  | 'paye'
  | 'echec'
  /** Orange Money en ligne coupé, ou commande plus payable. */
  | 'indisponible';

const ORANGE = { fond: '#FFF3E8', bord: '#FFB27A', texte: '#8A3B00', accent: '#E06A00' };

export default function PaiementOrangeMoneyScreen() {
  const params = useLocalSearchParams<{
    orderId: string;
    orderNumber?: string;
    total?: string;
    retour?: string;
  }>();
  const orderId = params.orderId;
  const router = useRouter();
  const session = useSession((s) => s.session);
  const { t } = useTranslation();

  const [etape, setEtape] = useState<Etape>(params.retour ? 'verification' : 'pret');
  const [motif, setMotif] = useState<MotifEchecOM | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [numero, setNumero] = useState(params.orderNumber ?? '');
  const [total, setTotal] = useState<number | null>(params.total ? Number(params.total) : null);
  const [bascule, setBascule] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const vivant = useRef(true);
  useEffect(() => () => {
    vivant.current = false;
  }, []);

  // Retour du web : seul l'identifiant revient dans l'URL, on relit le reste.
  useEffect(() => {
    if (!orderId || (numero && total)) return;
    getOrderById(orderId)
      .then((o) => {
        if (!vivant.current || !o) return;
        setNumero(o.orderNumber);
        setTotal(o.total);
      })
      .catch(() => {});
  }, [orderId, numero, total]);

  const allerConfirmation = useCallback(
    (methode: 'orange_money' | 'especes') => {
      router.replace({
        pathname: '/confirmation',
        params: { orderId, orderNumber: numero, total: total != null ? String(total) : '', payment: methode },
      });
    },
    [router, orderId, numero, total],
  );

  /** Redemande le verdict, quelques fois : PENDING → SUCCESS est rapide mais pas instantané. */
  const verifier = useCallback(async () => {
    if (!orderId) return;
    setEtape('verification');
    setMotif(null);
    for (let i = 0; i < 6; i++) {
      try {
        const v = await verifierPaiementOM(orderId);
        if (!vivant.current) return;
        if (v.paymentStatus === 'paye') {
          setEtape('paye');
          return;
        }
        if (v.statutCommande === 'annulee') {
          setMotif('commande_non_payable');
          setEtape('indisponible');
          return;
        }
      } catch (e) {
        if (!vivant.current) return;
        if (e instanceof ErreurPaiementOM && e.motif === 'commande_introuvable') {
          setMotif('commande_introuvable');
          setEtape('indisponible');
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 2500));
      if (!vivant.current) return;
    }
    // Pas de paiement constaté : le client a pu fermer la page, ou Orange n'a
    // pas encore fini. On ne parle pas d'échec : on propose de payer ou de revérifier.
    setNote(t('paiementOm.pasEncore'));
    setEtape('pret');
  }, [orderId, t]);

  useEffect(() => {
    if (!orderId) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (params.retour) void verifier();
    // Monté une fois par commande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, session]);

  useEffect(() => {
    if (etape !== 'paye') return;
    const h = setTimeout(() => allerConfirmation('orange_money'), 900);
    return () => clearTimeout(h);
  }, [etape, allerConfirmation]);

  async function payer() {
    if (!orderId) return;
    setEtape('ouverture');
    setMotif(null);
    setNote(null);
    setReference(null);
    const web = Platform.OS === 'web';
    try {
      const p = await creerPaiementOM(orderId, web);
      if (!vivant.current) return;
      if (web && typeof window !== 'undefined') {
        // L'onglet part chez Orange ; le retour se fait par /om/<commande>?w=1.
        window.location.assign(p.paymentUrl);
        return;
      }
      setEtape('sur_orange');
      await WebBrowser.openAuthSessionAsync(p.paymentUrl, 'taxifood://paiement-om');
      if (!vivant.current) return;
      // Fermé par le retour d'Orange OU par le client : dans les deux cas on
      // demande au serveur, qui seul sait.
      await verifier();
    } catch (e) {
      if (!vivant.current) return;
      const err = e as ErreurPaiementOM;
      const m = (err?.motif ?? 'inconnu') as MotifEchecOM;
      setReference(err?.reference ?? null);
      if (m === 'deja_payee') {
        setEtape('paye');
        return;
      }
      if (m === 'paiement_en_cours') {
        await verifier();
        return;
      }
      setMotif(m);
      setEtape(
        ['orange_money_inactif', 'paiement_non_configure', 'commande_non_payable', 'commande_introuvable', 'methode_non_orange_money'].includes(m)
          ? 'indisponible'
          : 'echec',
      );
    }
  }

  async function passerEnEspeces() {
    setBascule(true);
    try {
      await basculerEnEspeces(orderId);
      allerConfirmation('especes');
    } catch {
      if (vivant.current) {
        setNote(t('paiement.basculeEchouee'));
        setBascule(false);
      }
    }
  }

  if (!orderId) {
    return (
      <View style={styles.container}>
        <Header title={t('paiementOm.titre')} />
        <View style={styles.centre}>
          <Text style={styles.muted}>{t('tracking.notFound')}</Text>
        </View>
      </View>
    );
  }

  const sansIssue = motif === 'commande_introuvable' || motif === 'commande_non_payable';

  return (
    <View style={styles.container}>
      <Header title={t('paiementOm.titre')} onBack={() => router.replace(`/order/${orderId}`)} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.ligne}>
            <Text style={styles.label}>{t('paiement.commande')}</Text>
            <Text style={styles.valeurMono}>#{numero || '—'}</Text>
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <Text style={styles.debitLabel}>{t('paiementOm.aPayer')}</Text>
          <Text style={styles.debitValeur}>{total != null ? formatAr(total) : '—'}</Text>
          <Text style={styles.mention}>{t('paiementOm.mention')}</Text>
        </Card>

        {etape === 'pret' ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={styles.etapes}>
              <Text style={styles.etapesTitre}>{t('paiementOm.commentTitre')}</Text>
              <Text style={styles.etapesTexte}>{t('paiementOm.comment1')}</Text>
              <Text style={styles.etapesTexte}>{t('paiementOm.comment2')}</Text>
              <Text style={styles.etapesTexte}>{t('paiementOm.comment3')}</Text>
            </View>
            <Pressable
              onPress={payer}
              accessibilityRole="button"
              style={({ pressed }) => [styles.boutonOm, pressed && { opacity: 0.85 }]}
            >
              <Icon name="smartphone" size={22} color="#FFFFFF" />
              <Text style={styles.boutonOmTexte}>{t('paiementOm.payer')}</Text>
            </Pressable>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            {params.retour || note ? (
              <Button label={t('paiementOm.dejaPaye')} variant="outline" icon="refresh" onPress={verifier} />
            ) : null}
          </View>
        ) : null}

        {etape === 'ouverture' || etape === 'sur_orange' || etape === 'verification' ? (
          <View style={styles.bloc}>
            <ActivityIndicator color={ORANGE.accent} />
            <Text style={styles.blocTitre}>
              {t(etape === 'verification' ? 'paiementOm.verification' : etape === 'sur_orange' ? 'paiementOm.surOrange' : 'paiementOm.ouverture')}
            </Text>
            {etape === 'sur_orange' ? <Text style={styles.blocTexte}>{t('paiementOm.surOrangeTexte')}</Text> : null}
          </View>
        ) : null}

        {etape === 'paye' ? (
          <View style={styles.bloc}>
            <Icon name="check_circle" size={34} color={colors.success} />
            <Text style={styles.blocTitre}>{t('paiementOm.payeTitre')}</Text>
            <Text style={styles.blocTexte}>{t('paiement.payeTexte')}</Text>
          </View>
        ) : null}

        {etape === 'echec' || etape === 'indisponible' ? (
          <View style={styles.bloc}>
            <Icon name={etape === 'indisponible' ? 'info' : 'error'} size={28} color={etape === 'indisponible' ? colors.secondary : colors.dangerText} />
            <Text style={styles.blocTitre}>
              {t(etape === 'indisponible' ? 'paiementOm.indisponibleTitre' : 'paiementOm.echecTitre')}
            </Text>
            <Text style={styles.blocTexte}>{t(`paiementOm.motif.${cleMotif(motif)}`)}</Text>
            {reference ? <Text style={styles.reference}>#{reference.slice(0, 8)}</Text> : null}
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              {etape === 'echec' && !sansIssue ? (
                <Button label={t('paiement.reessayer')} icon="refresh" onPress={payer} />
              ) : null}
              {!sansIssue ? (
                <Button
                  label={t('paiement.payerEspeces')}
                  variant={etape === 'indisponible' ? 'primary' : 'outline'}
                  icon="payments"
                  onPress={passerEnEspeces}
                  loading={bascule}
                />
              ) : (
                <Button label={t('paiement.voirCommande')} variant="outline" onPress={() => router.replace(`/order/${orderId}`)} />
              )}
            </View>
            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
        ) : null}

        {etape === 'pret' ? (
          <Pressable onPress={passerEnEspeces} disabled={bascule} style={{ marginTop: 18 }}>
            <Text style={styles.lien}>{bascule ? t('paiement.basculeEnCours') : t('paiement.plutotEspeces')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function cleMotif(m: MotifEchecOM | null): string {
  switch (m) {
    case 'orange_money_inactif':
    case 'paiement_non_configure':
    case 'methode_non_orange_money':
      return 'canalFerme';
    case 'commande_introuvable':
      return 'commandeIntrouvable';
    case 'commande_non_payable':
      return 'commandeNonPayable';
    case 'authentification_requise':
      return 'authentification';
    case 'reseau':
      return 'reseau';
    case 'orange_indisponible':
    case 'erreur_serveur':
      return 'orangeIndisponible';
    default:
      return 'inconnu';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: fonts.semibold, color: colors.textMuted },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  valeurMono: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  debitLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted },
  debitValeur: { fontFamily: fonts.extrabold, fontSize: 30, color: ORANGE.accent, marginTop: 4 },
  mention: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 8 },
  etapes: { backgroundColor: ORANGE.fond, borderColor: ORANGE.bord, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  etapesTitre: { fontFamily: fonts.bold, fontSize: 13, color: ORANGE.texte, marginBottom: 2 },
  etapesTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: ORANGE.texte },
  boutonOm: {
    backgroundColor: ORANGE.accent,
    borderRadius: 16,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  boutonOmTexte: { fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' },
  bloc: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  blocTitre: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, textAlign: 'center' },
  blocTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDark, textAlign: 'center' },
  reference: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.5, color: colors.textMuted, textAlign: 'center' },
  note: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.warnText, textAlign: 'center' },
  lien: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, textAlign: 'center' },
});
