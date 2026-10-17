import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon';
import { colors, fonts, radius } from '../../theme/tokens';
import { getSuiviLivreur, SuiviLivreur } from '../../data/suivi';
import { CarteSuivi } from './CarteSuivi';

/**
 * Suivi du livreur sur une carte (option 2 décidée le 2026-10-16) :
 *   - relecture AUTOMATIQUE toutes les 60 s, toutes les 20 s quand il arrive
 *     (« J'arrive » appuyé ou moins d'1 km) ;
 *   - bouton « Actualiser » pour relire tout de suite, puis grisé 15 s ;
 *   - rien quand l'app est en arrière-plan, relecture immédiate au retour.
 * Chaque lecture = un appel à NOTRE base (gratuit) ; aucune API Google n'est appelée.
 *
 * Le bloc ne s'affiche que si le livreur partage vraiment sa position (app Taxi Food
 * Livreur) : sinon, rien — pas de carte vide ni de « signal perdu » trompeur.
 */
const LENT_MS = 60_000;
const RAPIDE_MS = 20_000;
const PAUSE_BOUTON_MS = 15_000;
const SIGNAL_PERDU_S = 180;

function ageTexte(s: number, t: (k: string, o?: Record<string, unknown>) => string) {
  return s < 60 ? t('suivi.secondes', { n: s }) : t('suivi.minutes', { n: Math.round(s / 60) });
}

export function BlocSuiviLivreur({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const [suivi, setSuivi] = useState<SuiviLivreur | null>(null);
  const [charge, setCharge] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [pauseJusqua, setPauseJusqua] = useState(0);
  const [maintenant, setMaintenant] = useState(Date.now());
  const actifRef = useRef(AppState.currentState === 'active');

  const lire = useCallback(async () => {
    setLecture(true);
    try {
      const r = await getSuiviLivreur(orderId);
      setSuivi(r.suivi ? r : null);
    } catch {
      /* réseau : on garde la dernière lecture */
    } finally {
      setLecture(false);
      setCharge(true);
    }
  }, [orderId]);

  const rapide = !!suivi && (suivi.phase === 'arrive' || suivi.phase === 'devant_chez_toi' || (suivi.kmRestants != null && suivi.kmRestants < 1));
  const periode = rapide ? RAPIDE_MS : LENT_MS;

  // Relecture automatique, suspendue en arrière-plan.
  useEffect(() => {
    void lire();
  }, [lire]);
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (actifRef.current) void lire();
    }, periode);
    const sub = AppState.addEventListener('change', (etat) => {
      const avant = actifRef.current;
      actifRef.current = etat === 'active';
      if (!avant && actifRef.current) void lire();
    });
    return () => {
      clearInterval(minuterie);
      sub.remove();
    };
  }, [lire, periode]);

  // Horloge d'affichage (âge de la position, compte à rebours du bouton).
  useEffect(() => {
    const h = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);

  if (!charge || !suivi || (!suivi.position && suivi.trace.length === 0)) return null;

  const age = suivi.position ? suivi.position.age_s + Math.max(0, Math.round((maintenant - suivi.recuLe) / 1000)) : null;
  const perdu = age != null && age > SIGNAL_PERDU_S;
  const attente = Math.max(0, Math.ceil((pauseJusqua - maintenant) / 1000));

  function actualiser() {
    if (attente > 0 || lecture) return;
    setPauseJusqua(Date.now() + PAUSE_BOUTON_MS);
    void lire();
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.entete}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>
            {suivi.livreur ? t('suivi.titreNom', { name: suivi.livreur }) : t('suivi.titre')}
          </Text>
          <Text style={styles.phase}>{t(`suivi.phase.${suivi.phase}`)}</Text>
        </View>
        {suivi.etaMin != null && suivi.phase !== 'devant_chez_toi' ? (
          <View style={styles.eta}>
            <Text style={styles.etaMin}>≈ {suivi.etaMin} min</Text>
            {suivi.kmRestants != null ? <Text style={styles.etaKm}>{t('suivi.km', { km: suivi.kmRestants.toLocaleString() })}</Text> : null}
          </View>
        ) : null}
      </View>

      <CarteSuivi suivi={suivi} />

      {suivi.autresCommandes > 0 ? <Text style={styles.note}>{t('suivi.autreCommande')}</Text> : null}

      <View style={styles.pied}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.age, perdu && { color: colors.warnText }]}>
            {age == null
              ? t('suivi.attente')
              : perdu
                ? t('suivi.signalPerdu', { age: ageTexte(age, t) })
                : t('suivi.position', { age: ageTexte(age, t) })}
          </Text>
          <Text style={styles.auto}>{rapide ? t('suivi.autoRapide') : t('suivi.autoLent')}</Text>
        </View>
        <Pressable
          onPress={actualiser}
          disabled={attente > 0 || lecture}
          style={[styles.bouton, (attente > 0 || lecture) && styles.boutonGris]}
          accessibilityRole="button"
          accessibilityLabel={t('suivi.actualiser')}
        >
          <Icon name="refresh" size={18} color={attente > 0 || lecture ? colors.textMuted : colors.white} />
          <Text style={[styles.boutonTexte, (attente > 0 || lecture) && { color: colors.textMuted }]}>
            {attente > 0 ? t('suivi.actualiserDans', { s: attente }) : t('suivi.actualiser')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titre: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink, letterSpacing: -0.3 },
  phase: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDark, marginTop: 2 },
  eta: { alignItems: 'flex-end' },
  etaMin: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
  etaKm: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  pied: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  age: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.textDark },
  auto: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: colors.textMuted, marginTop: 2 },
  bouton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.ink,
  },
  boutonGris: { backgroundColor: colors.photoGrayA },
  boutonTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
});
