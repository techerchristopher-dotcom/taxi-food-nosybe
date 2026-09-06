/**
 * Écran 07 bis — Paiement par carte.
 *
 * S'intercale entre la validation de la commande et la confirmation, UNIQUEMENT
 * pour les commandes « cb ». La commande existe déjà quand on arrive ici : c'est
 * ce qui permet de réessayer, de basculer en espèces ou de revenir plus tard
 * sans jamais la recréer (et donc sans reconsommer le code promo ni changer le
 * numéro TF-xx déjà annoncé au restaurant).
 *
 * ⚠️ POURQUOI UN ÉCRAN, ET PAS UNE MODALE LANCÉE DEPUIS LA VALIDATION.
 * Un écran porte une URL. Sur le web, le client qui recharge la page pendant le
 * paiement, ou qui revient d'une authentification bancaire, retombe ici et
 * l'écran relit l'état réel. Une modale n'aurait rien survécu à la coupure
 * réseau que le cahier des charges demande de gérer.
 *
 * ⚠️ CET ÉCRAN NE DÉCLARE JAMAIS UNE COMMANDE PAYÉE. `onResultat` dit seulement
 * ce que l'appareil du client a vu. Le verdict est lu dans `orders.payment_status`,
 * que seul le trigger de la base écrit, à partir des lignes que seul le webhook
 * Stripe (signature vérifiée côté serveur) modifie.
 *
 * Le montant en euros affiché ici est celui que l'Edge Function a calculé en
 * base — pas un calcul local. Montrer le total en ariary, le montant exact en
 * euros ET le taux appliqué avant de payer n'est pas une politesse : c'est une
 * exigence de revue Apple et la meilleure protection contre une contestation
 * bancaire (« je n'ai jamais accepté d'être débité en euros »).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Card, Divider } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { FormulaireCarte } from '../components/paiement/FormulaireCarte';
import { ResultatPaiement } from '../components/paiement/contrat';
import { colors, fonts, formatAr, spacing } from '../theme/tokens';
import {
  attendreVerdictPaiement,
  basculerEnEspeces,
  ErreurPreparationPaiement,
  formatMontantMineur,
  formatTaux,
  lireStatutPaiement,
  MotifEchecPreparation,
  PreparationPaiement,
  preparerPaiementCarte,
} from '../data/paiement';
import { useSession } from '../store/session';

type Etape =
  /** On demande le `client_secret` à l'Edge Function. */
  | 'preparation'
  /** Formulaire affiché, on attend le client. */
  | 'formulaire'
  /** Le client a confirmé : on attend le verdict du webhook. */
  | 'attente'
  /** Le webhook a confirmé l'encaissement. */
  | 'paye'
  /** Refus, ou préparation impossible. */
  | 'echec'
  /** Canal fermé (interrupteur, config absente, montant hors bornes). */
  | 'indisponible';

/**
 * Motifs qui ferment le canal carte sans que le client y soit pour quelque
 * chose. Dans tous ces cas la seule issue utile est le repli espèces.
 */
const MOTIFS_CANAL_FERME: MotifEchecPreparation[] = [
  'paiement_non_configure',
  'carte_inactive',
  'montant_invalide',
];

/**
 * Motifs où la panne est de NOTRE côté : rien n'a été débité, et réessayer dans
 * un instant est le bon geste. On garde alors « Réessayer » en action
 * principale.
 *
 * ⚠️ Sur tous les AUTRES échecs — c'est-à-dire un refus de la banque — c'est
 * l'inverse : rejouer la même carte ne sert à rien, et mettre « Réessayer » en
 * avant enferme le client dans une boucle. L'action principale devient alors
 * « Payer en espèces ». Les deux boutons restent présents dans les deux cas ;
 * seule leur hiérarchie change, parce que la conduite à tenir, elle, change.
 */
const MOTIFS_DE_NOTRE_COTE: MotifEchecPreparation[] = [
  'erreur_serveur',
  'stripe_indisponible',
  'reseau',
];

export default function PaiementScreen() {
  const params = useLocalSearchParams<{
    orderId: string;
    orderNumber?: string;
    total?: string;
  }>();
  const orderId = params.orderId;
  const totalAr = params.total ? Number(params.total) : null;
  const router = useRouter();
  const session = useSession((s) => s.session);
  const { t, i18n } = useTranslation();

  const [etape, setEtape] = useState<Etape>('preparation');
  const [prep, setPrep] = useState<PreparationPaiement | null>(null);
  const [motif, setMotif] = useState<MotifEchecPreparation | null>(null);
  const [detailServeur, setDetailServeur] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** `payment_intents.id` de la tentative ratée, quand le serveur en a une. */
  const [reference, setReference] = useState<string | null>(null);
  const [verdictLent, setVerdictLent] = useState(false);
  const [bascule, setBascule] = useState(false);

  const vivant = useRef(true);
  useEffect(() => () => { vivant.current = false; }, []);

  // La clé d'idempotence est DÉRIVÉE de la commande, pas tirée au hasard : deux
  // appuis, un rechargement de page ou une reprise le lendemain doivent
  // reprendre le même paiement. Le vrai garde-fou reste l'index unique de la
  // base — cette clé ne sert qu'à relier un appel de l'app à un PaymentIntent
  // lors d'une enquête.
  const cleIdempotence = `taxifood-order-${orderId}`;

  const allerConfirmation = useCallback(
    (methode: 'cb' | 'especes') => {
      router.replace({
        pathname: '/confirmation',
        params: {
          orderId,
          orderNumber: params.orderNumber ?? '',
          total: params.total ?? '',
          payment: methode,
        },
      });
    },
    [router, orderId, params.orderNumber, params.total],
  );

  /** Prépare (ou reprend) le paiement. Rejouable : c'est le bouton « Réessayer ». */
  const preparer = useCallback(async () => {
    if (!orderId) return;
    setEtape('preparation');
    setMotif(null);
    setDetailServeur(null);
    setReference(null);
    // ⚠️ `note` AUSSI. Elle ne l'était pas, et elle survivait à la tentative
    // suivante : après un refus de banque, un appui sur « Réessayer » qui
    // retombait sur une panne serveur affichait « Ta banque a refusé le
    // paiement » — une accusation fausse, pour une panne qui n'a jamais
    // atteint la banque.
    setNote(null);
    try {
      // Le paiement a pu aboutir pendant qu'on avait le dos tourné (réseau coupé
      // juste après la confirmation, app fermée). On lit l'état AVANT de
      // proposer un second paiement.
      const dejaPaye = await lireStatutPaiement(orderId);
      if (!vivant.current) return;
      if (dejaPaye === 'paye') {
        setEtape('paye');
        return;
      }

      const p = await preparerPaiementCarte(orderId, cleIdempotence);
      if (!vivant.current) return;
      if (!p.publishableKey) {
        // Sans clé publiable il n'y a pas de formulaire possible. On le dit
        // comme une indisponibilité du canal, pas comme un refus de carte.
        setMotif('paiement_non_configure');
        setEtape('indisponible');
        return;
      }
      setPrep(p);
      setEtape('formulaire');
    } catch (e) {
      if (!vivant.current) return;
      const err = e as ErreurPreparationPaiement;
      const m = (err?.motif ?? 'inconnu') as MotifEchecPreparation;
      setMotif(m);
      setDetailServeur(err?.detailServeur ?? null);
      setReference(err?.reference ?? null);
      if (m === 'deja_payee') {
        setEtape('paye');
        return;
      }
      setEtape(MOTIFS_CANAL_FERME.includes(m) ? 'indisponible' : 'echec');
    }
  }, [orderId, cleIdempotence]);

  /** Interroge la base jusqu'à ce que le webhook ait tranché. */
  const attendreVerdict = useCallback(async () => {
    setEtape('attente');
    setVerdictLent(false);
    const verdict = await attendreVerdictPaiement(orderId, {
      annule: () => !vivant.current,
    });
    if (!vivant.current) return;
    if (verdict === 'paye') {
      setEtape('paye');
      return;
    }
    if (verdict === 'echoue') {
      // ⚠️ `refus_banque`, pas `inconnu`. Le verdict vient du webhook Stripe :
      // c'est bien la banque qui a dit non, et c'est la seule chose que le
      // client a besoin de savoir pour choisir la suite (autre carte, ou
      // espèces). Le motif porte désormais cette information à lui seul, au
      // lieu de dépendre d'une `note` posée à côté.
      setMotif('refus_banque');
      setNote(t('paiement.refusBanque'));
      setEtape('echec');
      return;
    }
    // Ni payé ni refusé au bout du délai : on ne ment pas. Le paiement est
    // peut-être en cours d'authentification côté banque. On laisse l'écran en
    // attente, avec une sortie vers le suivi de commande.
    setVerdictLent(true);
  }, [orderId, t]);

  useEffect(() => {
    if (!orderId) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    // Retour d'une redirection bancaire (web) : Stripe rajoute son paramètre
    // dans l'URL. Il n'y a plus rien à confirmer, seulement un verdict à lire.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (new URLSearchParams(window.location.search).has('payment_intent_client_secret')) {
        void attendreVerdict();
        return;
      }
    }
    void preparer();
    // `preparer` et `attendreVerdict` sont mémoïsés sur orderId : pas de boucle.
  }, [orderId, session, router, preparer, attendreVerdict]);

  // Une fois payé, on ne laisse pas l'écran de paiement affiché.
  useEffect(() => {
    if (etape !== 'paye') return;
    const h = setTimeout(() => allerConfirmation('cb'), 900);
    return () => clearTimeout(h);
  }, [etape, allerConfirmation]);

  function surResultat(r: ResultatPaiement) {
    setNote(null);
    switch (r.etat) {
      case 'confirme_cote_client':
      case 'en_cours':
        void attendreVerdict();
        return;
      case 'annule':
        // Fermer la feuille n'est pas un échec : rien n'a été débité.
        setNote(t('paiement.annuleNote'));
        setEtape('formulaire');
        return;
      case 'echoue':
        // Refus rendu par le SDK Stripe sur l'appareil : la banque, là encore.
        setMotif('refus_banque');
        setNote(r.message || t('paiement.refusBanque'));
        setEtape('echec');
        return;
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
        <Header title={t('paiement.titre')} />
        <View style={styles.centre}>
          <Text style={styles.muted}>{t('tracking.notFound')}</Text>
        </View>
      </View>
    );
  }

  const montantLisible = prep
    ? formatMontantMineur(prep.montantMineur, 'eur', i18n.language)
    : null;

  // ------------------------------------------------ QUOI FAIRE, SELON LA CAUSE
  // Une commande qui n'existe plus, ou qui n'est plus payable, n'a AUCUNE des
  // deux issues : ni réessayer, ni basculer en espèces. Elle n'a qu'une sortie
  // vers le suivi.
  const sansIssue = motif === 'commande_introuvable' || motif === 'commande_non_payable';
  // La panne est de notre côté (ou on ne sait pas encore) : réessayer est le
  // bon geste, et il passe donc en premier, en plein.
  const reessayerEnTete =
    etape === 'echec' && !sansIssue && (!motif || MOTIFS_DE_NOTRE_COTE.includes(motif));
  // Sinon — refus de la banque, canal fermé — le repli espèces est la seule
  // action utile : il prend la place principale.
  const especesEnTete = !sansIssue && !reessayerEnTete;

  return (
    <View style={styles.container}>
      <Header title={t('paiement.titre')} onBack={() => router.replace(`/order/${orderId}`)} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------ CE QUI VA ÊTRE DÉBITÉ
            Les trois chiffres exigés avant tout paiement : le total en ariary,
            le montant exact en euros, et le taux qui relie les deux. */}
        <Card>
          <View style={styles.ligne}>
            <Text style={styles.label}>{t('paiement.commande')}</Text>
            <Text style={styles.valeurMono}>#{params.orderNumber || '—'}</Text>
          </View>
          {totalAr ? (
            <View style={[styles.ligne, { marginTop: 8 }]}>
              <Text style={styles.label}>{t('paiement.totalAriary')}</Text>
              <Text style={styles.valeur}>{formatAr(totalAr)}</Text>
            </View>
          ) : null}
          <Divider style={{ marginVertical: 14 }} />
          <Text style={styles.debitLabel}>{t('paiement.debitLabel')}</Text>
          <Text style={styles.debitValeur}>{montantLisible ?? '—'}</Text>
          {prep?.fxRate ? (
            <Text style={styles.taux}>
              {t('paiement.taux', { taux: formatTaux(prep.fxRate) })}
            </Text>
          ) : null}
          <Text style={styles.mention}>{t('paiement.mentionDevise')}</Text>
        </Card>

        {/* ---------------------------------------------------------- LES ÉTATS */}

        {etape === 'preparation' ? (
          <View style={styles.bloc}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.blocTexte}>{t('paiement.preparation')}</Text>
          </View>
        ) : null}

        {etape === 'formulaire' && prep?.publishableKey ? (
          <View style={{ marginTop: 16 }}>
            <FormulaireCarte
              clientSecret={prep.clientSecret}
              publishableKey={prep.publishableKey}
              montantMineur={prep.montantMineur}
              devise="eur"
              libelleBouton={t('paiement.payer', { montant: montantLisible ?? '' })}
              onResultat={surResultat}
            />
            <Text style={styles.rassurance}>
              <Icon name="lock" size={12} color={colors.textMuted} /> {t('paiement.rassurance')}
            </Text>
          </View>
        ) : null}

        {etape === 'attente' ? (
          <View style={styles.bloc}>
            {!verdictLent ? <ActivityIndicator color={colors.primary} /> : (
              <Icon name="schedule" size={28} color={colors.secondary} />
            )}
            <Text style={styles.blocTitre}>
              {verdictLent ? t('paiement.attenteLongueTitre') : t('paiement.attenteTitre')}
            </Text>
            <Text style={styles.blocTexte}>
              {verdictLent ? t('paiement.attenteLongueTexte') : t('paiement.attenteTexte')}
            </Text>
            {verdictLent ? (
              <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
                <Button label={t('paiement.verifierEncore')} variant="outline" onPress={attendreVerdict} />
                <Pressable onPress={() => router.replace(`/order/${orderId}`)}>
                  <Text style={styles.lien}>{t('paiement.voirCommande')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {etape === 'paye' ? (
          <View style={styles.bloc}>
            <Icon name="check_circle" size={34} color={colors.success} />
            <Text style={styles.blocTitre}>{t('paiement.payeTitre')}</Text>
            <Text style={styles.blocTexte}>{t('paiement.payeTexte')}</Text>
          </View>
        ) : null}

        {etape === 'echec' || etape === 'indisponible' ? (
          <View style={styles.bloc}>
            <Icon
              name={etape === 'indisponible' ? 'info' : 'error'}
              size={28}
              color={etape === 'indisponible' ? colors.secondary : colors.dangerText}
            />
            <Text style={styles.blocTitre}>
              {t(etape === 'indisponible' ? 'paiement.indisponibleTitre' : 'paiement.echecTitre')}
            </Text>
            {/* Un message d'erreur dit QUOI FAIRE. Le motif serveur passe en
                second, pour le cas où il apporterait une précision utile. */}
            <Text style={styles.blocTexte}>{messageMotif(t, motif, note, detailServeur)}</Text>
            {/* La référence de la tentative. Sans libellé traduit — un
                identifiant se lit dans toutes les langues — et préfixée `#`
                comme le numéro de commande juste au-dessus. Le client peut la
                citer ; le porteur du projet retrouve la cause en base d'une
                seule requête, sans dépendre des journaux Supabase (déjà
                indisponibles le jour de la panne). */}
            {reference ? <Text style={styles.reference}>#{reference.slice(0, 8)}</Text> : null}
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              {/* ⚠️ L'ORDRE ET LA COULEUR DES DEUX BOUTONS SUIVENT LA CAUSE.
                  Sur une panne de notre côté, réessayer est le bon geste : il
                  passe en tête, en plein. Sur un refus de la banque, rejouer la
                  même carte ne mène nulle part — le repli espèces prend la
                  première place, et « Réessayer » reste disponible en dessous
                  pour qui veut tenter une autre carte. Les deux issues restent
                  toujours offertes : c'est leur hiérarchie qui dit quoi faire. */}
              {reessayerEnTete ? (
                <Button label={t('paiement.reessayer')} icon="refresh" onPress={preparer} />
              ) : null}
              {!sansIssue ? (
                <Button
                  label={t('paiement.payerEspeces')}
                  variant={especesEnTete ? 'primary' : 'outline'}
                  icon="payments"
                  onPress={passerEnEspeces}
                  loading={bascule}
                />
              ) : (
                <Button
                  label={t('paiement.voirCommande')}
                  variant="outline"
                  onPress={() => router.replace(`/order/${orderId}`)}
                />
              )}
              {/* Le « Réessayer » du refus de banque : en second, en creux —
                  pour la personne qui veut essayer une AUTRE carte. Absent du
                  canal fermé (`indisponible`), où réessayer ne peut rien
                  donner tant que la configuration n'a pas changé. */}
              {etape === 'echec' && !sansIssue && !reessayerEnTete ? (
                <Button
                  label={t('paiement.reessayer')}
                  icon="refresh"
                  variant="outline"
                  onPress={preparer}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Note contextuelle (annulation, bascule ratée) hors des blocs d'état.
            ⚠️ Elle doit sortir sur les blocs d'ÉCHEC et d'INDISPONIBILITÉ aussi,
            pas seulement sur le formulaire. C'est là que se trouve l'autre bouton
            « Payer en espèces » : quand cette bascule échouait depuis un canal
            fermé ou un refus de carte, `note` était posée mais jamais affichée
            (`messageMotif` ne la lit que dans son cas `default`). Le bouton
            cessait simplement de tourner, et le client restait devant une
            invitation à payer en espèces qui venait de rater sans rien dire —
            le seul endroit du tunnel où l'app ne répondait pas. On ne la répète
            pas quand `messageMotif` l'a déjà rendue telle quelle. */}
        {note &&
        (etape === 'formulaire' ||
          ((etape === 'echec' || etape === 'indisponible') &&
            messageMotif(t, motif, note, detailServeur) !== note)) ? (
          <Text style={styles.note}>{note}</Text>
        ) : null}

        {/* Sortie toujours disponible tant que rien n'est payé : personne ne doit
            se sentir enfermé dans un écran de paiement. */}
        {etape === 'formulaire' ? (
          <Pressable onPress={passerEnEspeces} disabled={bascule} style={{ marginTop: 18 }}>
            <Text style={styles.lien}>
              {bascule ? t('paiement.basculeEnCours') : t('paiement.plutotEspeces')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Un motif technique → une phrase qui dit quoi faire. */
function messageMotif(
  t: (k: string, o?: Record<string, unknown>) => string,
  motif: MotifEchecPreparation | null,
  note: string | null,
  detailServeur: string | null,
): string {
  switch (motif) {
    case 'paiement_non_configure':
    case 'carte_inactive':
      return t('paiement.motif.canalFerme');
    case 'montant_invalide':
      return detailServeur || t('paiement.motif.montantInvalide');
    case 'commande_introuvable':
      return t('paiement.motif.commandeIntrouvable');
    case 'commande_non_payable':
      return t('paiement.motif.commandeNonPayable');
    case 'methode_non_carte':
      return t('paiement.motif.methodeNonCarte');
    case 'authentification_requise':
      return t('paiement.motif.authentification');
    case 'refus_banque':
      // La banque a refusé. `note` porte le message exact du SDK Stripe quand
      // il y en a un — il est plus précis que le nôtre (carte expirée, fonds
      // insuffisants) et il dit déjà quoi faire.
      return note || t('paiement.refusBanque');
    case 'stripe_indisponible':
    case 'erreur_serveur':
      // ⚠️ MÊME MESSAGE POUR LES DEUX, ET C'EST VOULU : du point de vue du
      // client, « Stripe ne répond pas » et « notre fonction a planté » sont le
      // même événement — le canal est en panne, sa carte n'y est pour rien, et
      // la conduite à tenir est identique (réessayer dans un instant, ou payer
      // en espèces). La distinction, elle, vit en base : `payment_intents.erreur`
      // porte `stripe_502`, `stripe_injoignable` ou `exception:TypeError`.
      return t('paiement.motif.stripeIndisponible');
    case 'reseau':
      return t('paiement.motif.reseau');
    default:
      return note || t('paiement.motif.inconnu');
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: fonts.semibold, color: colors.textMuted },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  valeur: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark },
  valeurMono: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.ink },
  debitLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  debitValeur: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.primary, marginTop: 4 },
  taux: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDark, marginTop: 6 },
  mention: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 8 },
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
  blocTexte: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textDark,
    textAlign: 'center',
  },
  rassurance: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  reference: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warnText,
    textAlign: 'center',
    marginTop: 14,
  },
  lien: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, textAlign: 'center' },
});
