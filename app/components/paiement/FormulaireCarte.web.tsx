/**
 * Formulaire de carte — VERSION WEB (taxifood.distripro207.com).
 *
 * Stripe a fermé la question lui-même : « we do not plan on supporting the web
 * with this SDK. Please use Stripe.js » (stripe/stripe-react-native#1556). On
 * monte donc le Payment Element de `@stripe/react-stripe-js`.
 *
 * Payment Element et NON Checkout hébergé : il consomme le MÊME PaymentIntent
 * que le natif, créé par la même Edge Function. Une seule logique serveur, un
 * seul webhook, un seul endroit où le montant est calculé.
 *
 * Le client ne quitte pas la page : `redirect: 'if_required'` laisse Stripe
 * présenter un éventuel 3-D Secure dans sa propre iframe. `return_url` n'est là
 * que pour les moyens de paiement qui exigent vraiment une redirection ; au
 * retour, l'écran de paiement relit le verdict en base comme dans tous les
 * autres cas.
 *
 * ⚠️ Ce fichier rend du DOM (`<div>`) au milieu de composants React Native. Ce
 * n'est pas une entorse : sur le web, react-native-web REND avec react-dom, donc
 * `<View>` est déjà un `<div>`. Stripe a besoin d'un vrai nœud DOM pour monter
 * son iframe, et c'est le seul moyen de le lui donner.
 *
 * ⚠️ `presentPaymentSheet`/`confirmPayment` qui réussit NE VEUT PAS DIRE PAYÉ.
 * On renvoie `confirme_cote_client` ; le verdict vient du webhook.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import { colors, fonts } from '../../theme/tokens';
import { ProprietesFormulaireCarte, ResultatPaiement } from './contrat';

export function FormulaireCarte(props: ProprietesFormulaireCarte) {
  const { i18n } = useTranslation();
  // `loadStripe` injecte le script js.stripe.com : une fois par clé, pas par rendu.
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        // Stripe traduit son formulaire ; on lui donne la langue choisie dans
        // l'app plutôt que celle du navigateur, sinon un francophone sur un
        // ordinateur en anglais verrait deux langues sur le même écran.
        locale: (i18n.language as 'fr' | 'en' | 'it') ?? 'fr',
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: colors.primary,
            colorText: colors.ink,
            borderRadius: '14px',
            fontFamily: 'system-ui, sans-serif',
          },
        },
      }}
    >
      <Interieur {...props} />
    </Elements>
  );
}

function Interieur({ libelleBouton, onResultat, occupe }: ProprietesFormulaireCarte) {
  const stripe = useStripe();
  const elements = useElements();
  const [pret, setPret] = useState(false);
  const [enCours, setEnCours] = useState(false);
  // Erreur de SAISIE (champ incomplet, carte mal formée) : elle reste sur le
  // formulaire, on ne remonte pas un « paiement échoué » à l'écran parent pour
  // un numéro tapé à moitié.
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);

  async function payer() {
    if (!stripe || !elements || enCours) return;
    setEnCours(true);
    setErreurSaisie(null);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          // Utilisé seulement si un moyen de paiement impose une redirection.
          return_url:
            typeof window !== 'undefined'
              ? `${window.location.origin}${window.location.pathname}${window.location.search}`
              : undefined,
        },
      });

      if (error) {
        if (error.type === 'validation_error' || error.type === 'card_error') {
          setErreurSaisie(error.message ?? null);
          return;
        }
        onResultat({ etat: 'echoue', message: error.message ?? '' });
        return;
      }

      onResultat(verdictDepuisIntent(paymentIntent?.status));
    } catch (e) {
      onResultat({ etat: 'echoue', message: (e as { message?: string })?.message ?? '' });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View>
      {/* Nœud DOM réel : Stripe y monte son iframe. */}
      <div style={{ width: '100%' }}>
        <PaymentElement onReady={() => setPret(true)} options={{ layout: 'tabs' }} />
      </div>
      <View style={{ marginTop: 16 }}>
        <Button
          label={libelleBouton}
          icon="lock"
          onPress={payer}
          loading={!pret || enCours || occupe}
          disabled={!stripe || !elements}
        />
      </View>
      {erreurSaisie ? <Text style={styles.erreur}>{erreurSaisie}</Text> : null}
    </View>
  );
}

/** Vocabulaire Stripe → verdict côté client. Aucun de ces états ne signifie « payé ». */
function verdictDepuisIntent(status?: string): ResultatPaiement {
  switch (status) {
    case 'succeeded':
    case 'requires_capture':
      return { etat: 'confirme_cote_client' };
    case 'processing':
    case 'requires_action':
      return { etat: 'en_cours' };
    case 'canceled':
      return { etat: 'annule' };
    default:
      // `requires_payment_method` : la banque a refusé, Stripe attend une autre carte.
      return { etat: 'echoue', message: '' };
  }
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
