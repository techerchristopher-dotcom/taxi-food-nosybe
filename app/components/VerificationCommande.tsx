import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { Order } from '../data/types';

type Choix = 'ok' | 'manque';

/**
 * Vérifier une commande avant de l'accepter (2026-10-20, après TF-442 : acceptée en 51 s,
 * annulée 4 min plus tard faute de nuggets, client perdu).
 *
 * Deux usages :
 *  - `mode="accepter"` (commande reçue) : chaque plat se coche « Je l'ai » ou « Il manque ».
 *    Tout « Je l'ai » → on accepte. Un plat « Il manque » → le client est prévenu et choisit
 *    (retirer le plat ou annuler) ; la commande n'est PAS annulée.
 *  - `mode="manquant"` (déjà acceptée) : on coche seulement ce qui manque.
 *
 * Si tout manque, on ne propose rien d'autre que le refus : il n'y aurait plus rien à livrer.
 * Écran en français, comme tout l'espace restaurateur.
 */
export function VerificationCommande({
  order,
  mode,
  submitting,
  onCancel,
  onAccepter,
  onSignaler,
  onRefuser,
}: {
  order: Order | null;
  mode: 'accepter' | 'manquant';
  submitting?: boolean;
  onCancel: () => void;
  onAccepter: (o: Order) => void;
  onSignaler: (o: Order, itemIds: string[]) => void;
  onRefuser: (o: Order) => void;
}) {
  const insets = useSafeAreaInsets();
  const [choix, setChoix] = useState<Record<string, Choix>>({});

  // Chaque ouverture repart à zéro.
  useEffect(() => {
    setChoix({});
  }, [order?.id, mode]);

  if (!order) return null;
  const lignes = order.items.filter((it) => it.id);
  const manquants = lignes.filter((it) => choix[it.id!] === 'manque').map((it) => it.id!);
  const toutCoche = lignes.every((it) => choix[it.id!]);
  const toutManque = lignes.length > 0 && manquants.length === lignes.length;

  function choisir(id: string, c: Choix) {
    setChoix((prev) => {
      const n = { ...prev };
      // En mode « manquant », un second appui décoche.
      if (mode === 'manquant' && prev[id] === c) delete n[id];
      else n[id] = c;
      return n;
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={() => !submitting && onCancel()} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {mode === 'accepter' ? `#${order.orderNumber} : vous avez tout ?` : `Il manque un plat ? #${order.orderNumber}`}
        </Text>
        <Text style={styles.sub}>
          {mode === 'accepter'
            ? 'Vérifiez chaque plat avec la cuisine avant d’accepter.'
            : 'Cochez les plats que vous n’avez plus. Le client choisira : les retirer ou annuler.'}
        </Text>

        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 10, paddingTop: 14 }}>
          {lignes.map((it) => {
            const c = choix[it.id!];
            return (
              <View key={it.id} style={[styles.ligne, c === 'manque' && styles.ligneManque]}>
                <Text style={styles.nom}>
                  {it.quantity} × {it.name}
                </Text>
                {it.options && it.options.length > 0 ? (
                  <Text style={styles.options}>{it.options.map((o) => o.name).join(', ')}</Text>
                ) : null}
                {it.comment ? <Text style={styles.precision}>✎ {it.comment}</Text> : null}
                <View style={styles.choix}>
                  {mode === 'accepter' ? (
                    <Pressable
                      onPress={() => choisir(it.id!, 'ok')}
                      style={[styles.pilule, c === 'ok' && styles.piluleOk]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: c === 'ok' }}
                    >
                      <Text style={[styles.piluleTexte, c === 'ok' && styles.piluleTexteOk]}>✅ Je l’ai</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => choisir(it.id!, 'manque')}
                    style={[styles.pilule, c === 'manque' && styles.piluleKo]}
                    accessibilityRole={mode === 'accepter' ? 'radio' : 'checkbox'}
                    accessibilityState={{ selected: c === 'manque', checked: c === 'manque' }}
                  >
                    <Text style={[styles.piluleTexte, c === 'manque' && styles.piluleTexteKo]}>❌ Il manque</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {toutManque ? (
          <Text style={styles.alerte}>Tous les plats manquent : refusez la commande (motif « plats plus disponibles »).</Text>
        ) : manquants.length > 0 ? (
          <Text style={styles.note}>
            Le client sera prévenu et choisira : retirer {manquants.length > 1 ? 'ces plats' : 'ce plat'} ou annuler. Le plat
            passe en rupture jusqu’à demain matin.
          </Text>
        ) : mode === 'accepter' && !toutCoche ? (
          <Text style={styles.note}>Cochez chaque plat pour pouvoir accepter.</Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Retour" variant="outline" onPress={onCancel} disabled={submitting} style={{ flex: 1 }} />
          {toutManque ? (
            <Button label="Refuser la commande" onPress={() => onRefuser(order)} disabled={submitting} style={{ flex: 1.6 }} />
          ) : manquants.length > 0 ? (
            <Button
              label="Prévenir le client"
              icon="send"
              onPress={() => onSignaler(order, manquants)}
              loading={submitting}
              disabled={mode === 'accepter' && !toutCoche}
              style={{ flex: 1.6 }}
            />
          ) : mode === 'accepter' ? (
            <Button
              label="Tout est là — accepter"
              icon="check"
              onPress={() => onAccepter(order)}
              loading={submitting}
              disabled={!toutCoche}
              style={{ flex: 1.6 }}
            />
          ) : (
            <Button label="Prévenir le client" icon="send" disabled style={{ flex: 1.6 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: spacing.screen,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 4 },
  ligne: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.tile, padding: 12, gap: 2 },
  ligneManque: { borderColor: colors.primary, backgroundColor: colors.dangerBg },
  nom: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  options: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  precision: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.dangerText },
  choix: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pilule: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  piluleOk: { borderColor: '#157F3C', backgroundColor: '#E7F4EC' },
  piluleKo: { borderColor: colors.primary, backgroundColor: colors.dangerBg },
  piluleTexte: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark },
  piluleTexteOk: { color: '#157F3C', fontFamily: fonts.bold },
  piluleTexteKo: { color: colors.dangerText, fontFamily: fonts.bold },
  note: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textMuted, marginTop: 12 },
  alerte: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.dangerText, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
});
