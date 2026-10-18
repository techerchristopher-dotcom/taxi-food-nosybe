import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { mesurer } from '../lib/mesure';

/**
 * 😅 « Pourquoi étiez-vous fermés ? » — fenêtre d'après la pause du week-end (2026-10-18).
 *
 * Demande du porteur du projet : beaucoup de clients ont demandé pourquoi Taxi Food était
 * fermé samedi et dimanche midi. Deux versions au choix, « officielle » et « officieuse ».
 *
 * - Montée par le layout des onglets CLIENT : jamais dans les espaces restaurant / livreur.
 * - Une seule fois par appareil (AsyncStorage, localStorage sur le web) : fermée, elle ne
 *   revient plus.
 * - Plus rien après mardi 20/10 minuit (heure de Nosy Be) : FIN est la seule date à changer.
 *   Composant jetable : le retirer du layout à la prochaine publication venue.
 */
const CLE = 'tf_modale_weekend_2026_10_18';
const FIN = Date.parse('2026-10-20T21:00:00Z');

type Version = 'officielle' | 'officieuse';

export function ModaleWeekend() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [version, setVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (Date.now() > FIN) return;
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    AsyncStorage.getItem(CLE).then(
      (vu) => {
        // Un court délai : l'accueil s'affiche d'abord, la fenêtre arrive par-dessus.
        if (actif && !vu) minuteur = setTimeout(() => actif && setVisible(true), 900);
      },
      () => {},
    );
    return () => {
      actif = false;
      if (minuteur) clearTimeout(minuteur);
    };
  }, []);

  const fermer = () => {
    setVisible(false);
    void AsyncStorage.setItem(CLE, version ?? 'fermee').catch(() => {});
  };

  const choisir = (v: Version) => {
    setVersion(v);
    mesurer('modale-weekend', { version: v });
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fermer}>
      <View style={styles.voile}>
        <View style={styles.carte}>
          <Pressable
            onPress={fermer}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('modaleWeekend.fermer')}
            style={styles.croix}
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
            <Text style={styles.emoji}>😅</Text>
            <Text style={styles.titre}>{t('modaleWeekend.titre')}</Text>
            <Text style={styles.sousTitre}>{t('modaleWeekend.sousTitre')}</Text>

            <View style={styles.choix}>
              {(['officielle', 'officieuse'] as const).map((v) => {
                const actif = version === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => choisir(v)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                    style={[styles.bouton, actif && (v === 'officielle' ? styles.boutonOff : styles.boutonOffi)]}
                  >
                    <Text style={styles.boutonEmoji}>{v === 'officielle' ? '📋' : '🤫'}</Text>
                    <Text style={[styles.boutonTexte, actif && styles.boutonTexteActif]}>
                      {t(`modaleWeekend.${v}.bouton`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {version ? (
              <View style={[styles.recit, version === 'officieuse' && styles.recitOffi]}>
                <Text style={styles.recitTexte}>{t(`modaleWeekend.${version}.p1`)}</Text>
                <Text style={styles.recitTexte}>{t(`modaleWeekend.${version}.p2`)}</Text>
              </View>
            ) : null}

            <Pressable onPress={fermer} accessibilityRole="button" style={styles.cta}>
              <Text style={styles.ctaTexte}>{t('modaleWeekend.cta')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  carte: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderTopWidth: 5,
    borderTopColor: colors.accent,
    overflow: 'hidden',
  },
  croix: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenu: { padding: 22, paddingTop: 26, gap: 12 },
  emoji: { fontSize: 40, textAlign: 'center' },
  titre: { fontFamily: fonts.extrabold, fontSize: 19, lineHeight: 24, color: colors.ink, textAlign: 'center' },
  sousTitre: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  choix: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bouton: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 2,
  },
  boutonOff: { borderColor: colors.primary, backgroundColor: colors.dangerBg },
  boutonOffi: { borderColor: colors.ink, backgroundColor: '#F1ECFA' },
  boutonEmoji: { fontSize: 20 },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDark, textAlign: 'center' },
  boutonTexteActif: { color: colors.ink },
  recit: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 14, gap: 10 },
  recitOffi: { backgroundColor: '#F1ECFA' },
  recitTexte: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.textDark },
  cta: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTexte: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.white },
});
