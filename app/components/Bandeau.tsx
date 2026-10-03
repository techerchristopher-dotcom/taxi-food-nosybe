import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import type { Bandeau as BandeauDonnees } from '../data/api';

const CLE_FERME = 'bandeau_ferme';

/** « 2 000 Ar » ne se coupe jamais entre ses chiffres. */
const insecable = (t: string) => t.replace(/(\d) (?=\d{3}\b)/g, '$1\u00A0');

/**
 * 📢 Bandeau d'annonce, en haut de l'accueil (2026-10-03).
 *
 * Écrit dans l'admin (onglet 📢 Bandeau), lu par `bandeau_actif()` — jamais en dur : changer
 * ou retirer une annonce ne demande ni build ni OTA. La date de fin est tenue par la base.
 *
 * Fermable : la croix retient la `version` du bandeau (AsyncStorage). Un bandeau RÉÉCRIT dans
 * l'admin change de version et réapparaît ; le même bandeau, fermé, ne revient plus.
 *
 * Au tap : la route choisie dans l'admin (une fiche restaurant). La route `/` est l'accueil où
 * l'on se trouve déjà — le bandeau n'est alors qu'une information, sans flèche.
 */
export function Bandeau({ b }: { b: BandeauDonnees }) {
  const router = useRouter();
  const { t } = useTranslation();
  // `undefined` = pas encore lu : on n'affiche rien plutôt qu'un bandeau qui clignote.
  const [ferme, setFerme] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(CLE_FERME).then(setFerme, () => setFerme(null));
  }, []);

  if (ferme === undefined || ferme === b.version) return null;

  const cliquable = b.route !== '/';
  const fermer = () => {
    setFerme(b.version);
    void AsyncStorage.setItem(CLE_FERME, b.version).catch(() => {});
  };

  return (
    <Pressable
      disabled={!cliquable}
      onPress={() => router.push(b.route as never)}
      accessibilityRole={cliquable ? 'button' : 'text'}
      style={styles.wrap}
    >
      <LinearGradient
        colors={[colors.ink, '#3A2A22']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.carte}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.titre}>{insecable(b.titre)}</Text>
          {b.texte ? <Text style={styles.texte}>{insecable(b.texte)}</Text> : null}
        </View>
        {cliquable ? <Icon name="chevron_right" size={20} color={colors.accent} /> : null}
        <Pressable
          onPress={fermer}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('bandeau.fermer')}
          style={styles.croix}
        >
          <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  titre: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.white },
  texte: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.82)' },
  croix: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
