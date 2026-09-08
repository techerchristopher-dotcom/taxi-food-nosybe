/**
 * Formulaire de carte — VERSION NATIVE (iOS / Android).
 *
 * PaymentSheet de `@stripe/stripe-react-native` : une feuille modale servie par
 * le SDK Stripe, DANS l'application. C'est une exigence explicite du porteur du
 * projet — pas de renvoi vers un navigateur. Le 3-D Secure, quand la banque le
 * demande, est présenté par la feuille elle-même : il n'y a rien à coder ici
 * pour l'authentification forte, et `presentPaymentSheet()` ne rend la main
 * qu'une fois le défi passé.
 *
 * ⚠️ `presentPaymentSheet()` sans erreur NE MARQUE RIEN COMME PAYÉ. On renvoie
 * `confirme_cote_client`, et c'est l'écran appelant qui va lire le verdict du
 * webhook en base. Écrire « payé » ici reviendrait à croire l'appareil du
 * client sur parole.
 *
 * ⚠️ Ce fichier importe le SDK natif : il ne doit JAMAIS entrer dans le bundle
 * web. C'est le jumeau `FormulaireCarte.web.tsx` qui garantit ça (voir
 * `contrat.ts`).
 *
 * ⚠️ APPLE PAY. Il ne s'affiche dans la feuille QUE si les trois pièces sont
 * réunies : le `merchantIdentifier` passé à `initStripe` (il vient du plugin
 * dans `app.json`, qui pose aussi l'entitlement Apple Pay dans le binaire), le
 * bloc `applePay` ci-dessous, ET un certificat Apple Pay valide côté Stripe
 * pour ce même identifiant marchand. S'il en manque une, la feuille s'ouvre
 * normalement mais SANS le bouton — sans la moindre erreur. C'est exactement ce
 * qui s'est passé au premier test du 2026-09-07 : aucune des trois n'existait.
 *
 * ⚠️ GOOGLE PAY, lui, ne demande NI identifiant marchand NI certificat : il
 * suffit de `enableGooglePay` dans `app.json` (qui ouvre l'API Wallet dans le
 * manifeste Android) et du bloc `googlePay` plus bas. Rien de la lourdeur du
 * montage Apple Pay n'a d'équivalent ici — ne pas aller chercher un certificat
 * Google Pay, il n'en existe pas.
 *
 * `merchantCountryCode` est le pays du compte Stripe, PAS celui du client :
 * compte Rentanoo immatriculé en France, donc « FR ». Un code qui ne
 * correspond pas au compte fait échouer le paiement à la confirmation.
 *
 * `initStripe` plutôt que `<StripeProvider>` : la clé publiable vient du Vault,
 * via la réponse de `creer-paiement`, donc elle n'existe qu'au moment du
 * paiement. Envelopper toute l'app dans un provider obligerait à la connaître au
 * démarrage — et à la recopier dans une variable d'environnement, soit une
 * seconde source de vérité.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import { Button } from '../Button';
import { colors, fonts } from '../../theme/tokens';
import { ProprietesFormulaireCarte } from './contrat';

/**
 * Identifiant marchand Apple, cree dans le portail developpeur Apple et
 * rattache a un certificat Apple Pay dans le tableau de bord Stripe.
 * ⚠️ Il doit etre IDENTIQUE a celui declare dans `app.json` (plugin Stripe) :
 * c'est ce dernier qui pose l'entitlement dans le binaire. Deux valeurs
 * differentes = feuille sans Apple Pay, en silence.
 */
const MARCHAND_APPLE = 'merchant.com.chris97416.taxi-food-nosybe';

/** Pays du compte Stripe Rentanoo (verifie via l'API : `country: "FR"`). */
const PAYS_COMPTE_STRIPE = 'FR';

export function FormulaireCarte({
  clientSecret,
  publishableKey,
  libelleBouton,
  onResultat,
  occupe,
}: ProprietesFormulaireCarte) {
  const [pret, setPret] = useState(false);
  const [prepaEnCours, setPrepaEnCours] = useState(true);
  const [erreurPrepa, setErreurPrepa] = useState<string | null>(null);
  const [enFeuille, setEnFeuille] = useState(false);
  // Le composant peut être démonté pendant l'attente asynchrone (retour arrière,
  // navigation). Sans ce garde, on appellerait setState sur un écran disparu.
  const vivant = useRef(true);
  useEffect(() => () => { vivant.current = false; }, []);

  useEffect(() => {
    let annule = false;
    (async () => {
      setPrepaEnCours(true);
      setErreurPrepa(null);
      try {
        await initStripe({ publishableKey, merchantIdentifier: MARCHAND_APPLE });
        const { error } = await initPaymentSheet({
          merchantDisplayName: 'Taxi Food',
          paymentIntentClientSecret: clientSecret,
          // Le retour depuis une éventuelle authentification bancaire hors app
          // atterrit sur le schéma déclaré dans app.json (`scheme: "taxifood"`).
          // Sans lui, un 3-D Secure qui sort de l'app ne saurait pas revenir.
          returnURL: 'taxifood://paiement',
          allowsDelayedPaymentMethods: false,
          // Chaque bloc est ignoré par le SDK sur l'autre plateforme : pas de
          // garde `Platform.OS` a ecrire, et donc pas de garde a oublier.
          applePay: { merchantCountryCode: PAYS_COMPTE_STRIPE },
          googlePay: {
            merchantCountryCode: PAYS_COMPTE_STRIPE,
            currencyCode: 'EUR',
            // ⚠️ `false` = vrai reseau bancaire. A `true`, Google ne renvoie que
            // des cartes de test, refusees a la confirmation par Stripe.
            testEnv: false,
          },
        });
        if (annule || !vivant.current) return;
        if (error) setErreurPrepa(error.message);
        else setPret(true);
      } catch (e) {
        if (!annule && vivant.current) {
          setErreurPrepa((e as { message?: string })?.message ?? 'init');
        }
      } finally {
        if (!annule && vivant.current) setPrepaEnCours(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [clientSecret, publishableKey]);

  async function payer() {
    if (!pret || enFeuille) return;
    setEnFeuille(true);
    try {
      const { error } = await presentPaymentSheet();
      if (!vivant.current) return;
      if (!error) {
        onResultat({ etat: 'confirme_cote_client' });
        return;
      }
      // `Canceled` = le client a fermé la feuille lui-même. Ce n'est pas un
      // échec : lui afficher « paiement refusé » serait un mensonge, et il
      // rappellerait le restaurant pour rien.
      if (error.code === 'Canceled') {
        onResultat({ etat: 'annule' });
        return;
      }
      onResultat({ etat: 'echoue', message: error.message });
    } finally {
      if (vivant.current) setEnFeuille(false);
    }
  }

  return (
    <View>
      <Button
        label={libelleBouton}
        icon="lock"
        onPress={payer}
        loading={prepaEnCours || enFeuille || occupe}
        disabled={!pret || !!erreurPrepa}
      />
      {erreurPrepa ? <Text style={styles.erreur}>{erreurPrepa}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  erreur: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.dangerText,
    marginTop: 10,
    textAlign: 'center',
  },
});
