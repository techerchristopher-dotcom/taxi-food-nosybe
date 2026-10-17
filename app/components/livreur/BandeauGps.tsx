import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { colors, fonts, radius } from '../../theme/tokens';
import { demarrerSuivi, useEtatGps } from '../../lib/livreur/suiviGps';

function depuis(iso: string | null, maintenant: number): string {
  if (!iso) return '';
  const s = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
}

/**
 * État du partage de position, toujours visible sur l'écran Livraisons.
 *
 * ⚠️ C'est aussi l'« avertissement bien visible » exigé par Google Play AVANT de demander
 * la position en arrière-plan : on dit ce qui est partagé, avec qui, et quand — puis
 * seulement on demande.
 */
export function BandeauGps({ enCourse }: { enCourse: boolean }) {
  const etat = useEtatGps();
  const [maintenant, setMaintenant] = useState(Date.now());
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  async function autoriser() {
    setOccupe(true);
    try {
      const r = await demarrerSuivi(true);
      if (r === 'refusee') Linking.openSettings().catch(() => {});
    } finally {
      setOccupe(false);
    }
  }

  // Autorisation manquante : on explique d'abord, on demande ensuite.
  if (etat.autorisation !== 'ok') {
    const refusee = etat.autorisation === 'refusee';
    return (
      <View style={[styles.carte, styles.alerte]}>
        <View style={styles.ligne}>
          <Icon name="location_on" size={22} color={colors.warnText} />
          <Text style={styles.titre}>Partage de ta position</Text>
        </View>
        <Text style={styles.texte}>
          Pendant tes courses seulement, Taxi Food Livreur partage ta position avec le client et Taxi Food, même
          quand tu utilises Google Maps ou que ton écran est verrouillé. Rien n’est partagé en dehors d’une course.
        </Text>
        {etat.autorisation === 'premier_plan' ? (
          <Text style={styles.texteFort}>
            Choisis « Toujours autoriser » dans les réglages de localisation, sinon le suivi s’arrête dès que tu quittes l’app.
          </Text>
        ) : null}
        <Button
          label={refusee ? 'Ouvrir les réglages' : etat.autorisation === 'premier_plan' ? 'Autoriser « Toujours »' : 'Autoriser la position'}
          icon="near_me"
          onPress={refusee ? () => Linking.openSettings().catch(() => {}) : autoriser}
          loading={occupe}
          style={{ marginTop: 10 }}
        />
      </View>
    );
  }

  if (!enCourse) {
    return (
      <View style={[styles.carte, styles.neutre]}>
        <View style={styles.ligne}>
          <Icon name="location_off" size={20} color={colors.textMuted} />
          <Text style={styles.texteGris}>Position non partagée : aucune course en cours.</Text>
        </View>
      </View>
    );
  }

  const perdu = !etat.actif;
  return (
    <Pressable
      onPress={perdu ? autoriser : undefined}
      style={[styles.carte, perdu ? styles.alerte : styles.ok]}
      accessibilityRole={perdu ? 'button' : undefined}
    >
      <View style={styles.ligne}>
        <Icon name={perdu ? 'location_off' : 'my_location'} size={20} color={perdu ? colors.warnText : colors.successDark} />
        <Text style={[styles.titre, { color: perdu ? colors.warnText : colors.successDark, fontSize: 14 }]}>
          {perdu
            ? 'Position coupée — touche pour la relancer'
            : `Position partagée${etat.dernierEnvoi ? ` · ${depuis(etat.dernierEnvoi, maintenant)}` : ''}`}
        </Text>
      </View>
      {etat.enAttente > 0 || etat.erreur ? (
        <Text style={styles.texteGris}>
          {etat.erreur ?? ''} {etat.enAttente > 0 ? `${etat.enAttente} position(s) en attente de réseau.` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: radius.tile, borderWidth: 1, padding: 14, marginBottom: 16, gap: 6 },
  alerte: { backgroundColor: colors.warnBg, borderColor: '#F3D9A9' },
  ok: { backgroundColor: colors.successBg, borderColor: '#BFE5CB' },
  neutre: { backgroundColor: colors.surface, borderColor: colors.border },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  texte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDark },
  texteFort: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.warnText },
  texteGris: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
