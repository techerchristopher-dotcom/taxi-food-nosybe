/**
 * Choix du mode de paiement, à la SAISIE d'une commande.
 *
 * ⚠️ « À la saisie » est la nuance importante. Ce composant décide de ce qu'on
 * PROPOSE aujourd'hui ; il ne décide pas de ce qu'on sait AFFICHER. Trois
 * commandes déjà en base portent `orange_money` : l'espace livreur
 * (`components/DeliverSheet.tsx`) et le tableau de bord (`admin/lib/util.ts`)
 * doivent continuer à les nommer normalement. Griser une option ici n'efface
 * pas l'historique, et ces deux fichiers ne sont pas touchés.
 *
 * Trois états possibles pour une ligne :
 *   - sélectionnable    → rond de sélection, pleine opacité ;
 *   - sélectionnée      → bordure rouge ;
 *   - « bientôt »       → estompée, icône grise, pastille à la place du rond.
 * L'indisponibilité doit se voir SANS lire le texte : quelqu'un qui parcourt
 * l'écran des yeux ne doit jamais essayer de toucher une option morte.
 *
 * La carte, elle, n'est pas grisée : elle est ABSENTE quand la base ne
 * l'autorise pas (`payment_config.carte_active`). C'est l'arrêt d'urgence du
 * paiement en ligne — une option grisée inviterait à demander pourquoi.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import { colors, fonts, radius } from '../../theme/tokens';
import { PaymentMethod } from '../../data/types';

const METHODS: {
  key: PaymentMethod;
  icon: string;
  iconColor: string;
  subKey: string;
  /** Affichée, mais non sélectionnable, avec une pastille « Bientôt ». */
  bientot?: boolean;
}[] = [
  { key: 'cb', icon: 'credit_card', iconColor: colors.textDark, subKey: 'checkout.cbSub' },
  { key: 'especes', icon: 'payments', iconColor: colors.textDark, subKey: 'checkout.especesSub' },
  {
    key: 'orange_money',
    icon: 'smartphone',
    iconColor: colors.secondary,
    subKey: 'checkout.orangeSub',
    bientot: true,
  },
];

export function ChoixModePaiement({
  valeur,
  onChange,
  carteProposable,
}: {
  valeur: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  /** Faux = la carte n'apparaît pas du tout (interrupteur base, ou montant trop faible). */
  carteProposable: boolean;
}) {
  const { t } = useTranslation();
  const visibles = METHODS.filter((m) => m.key !== 'cb' || carteProposable);

  return (
    <View style={{ gap: 10 }}>
      {visibles.map((m) => {
        const active = m.key === valeur;
        const bientot = m.bientot === true;
        return (
          <Pressable
            key={m.key}
            onPress={bientot ? undefined : () => onChange(m.key)}
            disabled={bientot}
            accessibilityRole="radio"
            accessibilityState={{ disabled: bientot, selected: active }}
            style={[
              styles.payRow,
              { borderColor: active ? colors.primary : colors.border },
              bientot && styles.payRowBientot,
            ]}
          >
            <Icon name={m.icon} size={24} color={bientot ? colors.textFaint : m.iconColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.payTitle, bientot && styles.payTexteBientot]}>
                {t(`payment.${m.key}`)}
              </Text>
              <Text style={[styles.paySub, bientot && styles.payTexteBientot]}>{t(m.subKey)}</Text>
            </View>
            {bientot ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTexte}>{t('payment.bientot')}</Text>
              </View>
            ) : (
              <Icon
                name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                size={22}
                color={active ? colors.primary : colors.borderStrong}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  payRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payRowBientot: { opacity: 0.55, backgroundColor: colors.fieldBg },
  payTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  paySub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  payTexteBientot: { color: colors.textFaint },
  badge: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeTexte: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3, color: colors.warnTextAlt },
});
