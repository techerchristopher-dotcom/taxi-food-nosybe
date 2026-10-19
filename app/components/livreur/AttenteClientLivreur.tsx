import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../Button';
import { colors, fonts } from '../../theme/tokens';
import { leverAttenteClient, signalerClientInjoignable } from '../../data/api';
import { Order } from '../../data/types';

/**
 * Client injoignable (2026-10-19), sur une course du livreur — ou une commande du restaurant.
 *
 * Pas bloquée : un petit bouton « Client injoignable » ; deux temps (on écrit éventuellement
 * ce qu'on a essayé, puis on confirme), parce que signaler déclenche push + e-mail au client
 * et une alerte admin. Bloquée : un bandeau qui le dit, avec la durée et les relances, et
 * « Client joint » pour reprendre. Le client, lui, peut lever le blocage depuis son suivi.
 */
export function AttenteClientLivreur({
  order,
  onChange,
}: {
  order: Order;
  onChange: () => unknown;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function agir(fn: () => Promise<void>) {
    setEnvoi(true);
    setErreur(null);
    try {
      await fn();
      setOuvert(false);
      setNote('');
      await onChange();
    } catch (e) {
      setErreur((e as { message?: string })?.message || 'Action impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (order.attenteClientDepuis) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(order.attenteClientDepuis).getTime()) / 60000));
    const relances = order.attenteClientRelances ?? 1;
    return (
      <View style={styles.bloque}>
        <Text style={styles.bloqueTitre}>⏸ En attente du client · {minutes} min</Text>
        <Text style={styles.bloqueTexte}>
          {Math.min(relances, 3)} relance(s) envoyée(s) au client (notification + e-mail). Taxi Food est prévenu
          {relances >= 4 ? ' et doit trancher : garder ou annuler.' : '.'}
        </Text>
        <Button label="Client joint, je reprends" variant="dark" onPress={() => agir(() => leverAttenteClient(order.id))} loading={envoi} />
        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      </View>
    );
  }

  if (!ouvert) {
    return <Button label="Client injoignable" icon="phone_missed" variant="outline" onPress={() => setOuvert(true)} />;
  }
  return (
    <View style={styles.form}>
      <Text style={styles.formTitre}>Le client ne répond pas ?</Text>
      <Text style={styles.formTexte}>
        On le relance (notification + e-mail, 3 fois en 15 min) et on prévient Taxi Food. La commande reste à toi.
      </Text>
      <TextInput
        value={note}
        onChangeText={(t) => setNote(t.slice(0, 300))}
        placeholder="Ce que tu as essayé (facultatif) : 2 appels, WhatsApp…"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        multiline
      />
      <View style={styles.row}>
        <Button label="Annuler" variant="outline" onPress={() => setOuvert(false)} style={{ flex: 1 }} />
        <Button
          label="Signaler"
          icon="phone_missed"
          onPress={() => agir(() => signalerClientInjoignable(order.id, note))}
          loading={envoi}
          style={{ flex: 1.3 }}
        />
      </View>
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { backgroundColor: colors.warnBg, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1.5, borderColor: colors.warnTextAlt },
  bloqueTitre: { fontFamily: fonts.bold, fontSize: 15, color: colors.warnText },
  bloqueTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warnText },
  form: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
  formTitre: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  formTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: 10 },
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText },
});
