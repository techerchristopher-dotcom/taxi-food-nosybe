import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../Button';
import { colors, fonts, formatAr } from '../../theme/tokens';
import { ApercuTournee, apercuTournee, finDeTournee } from '../../data/api';

/**
 * 🛵 Fin de tournée (2026-10-19, lot 3 de la clôture de service).
 *
 * Le livreur compte les espèces qu'il a sur lui et les déclare. La base calcule ce qu'il
 * devrait avoir (commandes livrées en espèces depuis sa dernière fin de tournée, 18 h au
 * plus) et envoie le bilan, écart compris, dans le groupe Telegram des clôtures. On ne lui
 * montre PAS le montant attendu avant qu'il ait déclaré : sinon il recopie le chiffre au
 * lieu de compter.
 */
export function FinDeTournee() {
  const [ouvert, setOuvert] = useState(false);
  const [apercu, setApercu] = useState<ApercuTournee | null>(null);
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ dues: number; ecart: number } | null>(null);

  async function ouvrir() {
    setOuvert(true);
    setResultat(null);
    setErreur(null);
    try {
      setApercu(await apercuTournee());
    } catch (e) {
      setErreur((e as { message?: string })?.message || 'Lecture impossible.');
    }
  }

  async function declarer() {
    const n = Number(montant.replace(/[^\d]/g, ''));
    if (!montant.trim() || !Number.isFinite(n)) {
      setErreur('Indique le montant en espèces que tu as sur toi (0 si rien).');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await finDeTournee(n, note);
      if (!r.ok) {
        setErreur(r.raison === 'aucune_course' ? 'Aucune course livrée depuis ta dernière fin de tournée.' : 'Refusé.');
      } else {
        setResultat({ dues: n - (r.ecart ?? 0), ecart: r.ecart ?? 0 });
        setMontant('');
        setNote('');
      }
    } catch (e) {
      setErreur((e as { message?: string })?.message || 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>🏁 Fin de tournée</Text>
        <Text style={styles.texte}>Ta tournée est finie ? Déclare les espèces que tu as sur toi.</Text>
        <Button label="Terminer ma tournée" variant="dark" onPress={ouvrir} />
      </View>
    );
  }

  if (resultat) {
    const juste = resultat.ecart === 0;
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>{juste ? '✅ Caisse juste, merci !' : '📨 Tournée enregistrée'}</Text>
        <Text style={styles.texte}>
          Espèces attendues : {formatAr(resultat.dues)}
          {juste ? '' : `\nÉcart : ${resultat.ecart > 0 ? '+' : '−'}${formatAr(Math.abs(resultat.ecart))} ${resultat.ecart > 0 ? '(en trop)' : '(manquant)'}`}
        </Text>
        <Text style={styles.texte}>Le bilan est parti chez Taxi Food. Remets les espèces comme d’habitude.</Text>
        <Button label="Fermer" variant="outline" onPress={() => setOuvert(false)} />
      </View>
    );
  }

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>🏁 Fin de tournée</Text>
      {!apercu && !erreur ? <ActivityIndicator color={colors.primary} /> : null}
      {apercu ? (
        <Text style={styles.texte}>
          {apercu.courses} course(s) livrée(s) depuis{' '}
          {new Date(apercu.debut).toLocaleTimeString('fr-FR', { timeZone: 'Indian/Antananarivo', hour: '2-digit', minute: '2-digit' })}
          {apercu.en_cours > 0 ? `\n⚠️ Encore ${apercu.en_cours} course(s) en cours : livre-les d’abord si tu peux.` : ''}
        </Text>
      ) : null}
      <Text style={styles.label}>Espèces que tu as sur toi (Ar)</Text>
      <TextInput
        value={montant}
        onChangeText={setMontant}
        placeholder="ex. 85000"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        value={note}
        onChangeText={(t) => setNote(t.slice(0, 300))}
        placeholder="Une remarque ? (facultatif)"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
      />
      <View style={styles.row}>
        <Button label="Annuler" variant="outline" onPress={() => setOuvert(false)} style={{ flex: 1 }} />
        <Button label="Déclarer" icon="send" onPress={declarer} loading={envoi} style={{ flex: 1.3 }} />
      </View>
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  titre: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  texte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: 10 },
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText },
});
