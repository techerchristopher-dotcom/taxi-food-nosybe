import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { ProductThumb } from '../../components/ProductThumb';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import {
  getMyRestaurant,
  getRestaurantMenu,
  setProductAvailable,
  setRestaurantHours,
  setRestaurantOpen,
} from '../../data/api';
import { formatTime } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

/** « 22:30:00 » ou « 22:30 » -> « 22:30 » pour la saisie. */
function pourSaisie(h: string): string {
  return h ? h.slice(0, 5) : '';
}

/**
 * Une heure saisie à la main est acceptée sous plusieurs formes — « 8 »,
 * « 8h », « 8h30 », « 08:30 ». Le restaurateur tape vite, sur un téléphone,
 * en plein service : lui imposer un format exact ferait échouer une saisie
 * sur deux.
 * Renvoie « HH:MM », ou null si on ne peut vraiment rien en tirer.
 */
export function normaliserHeure(saisie: string): string | null {
  const s = saisie.trim().replace(/\s/g, '');
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?:[h:.,]?(\d{1,2}))?h?$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Espace restaurant — Réglages : ouverture, horaires, ruptures de stock. */
export default function RestaurantSettingsScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');

  const { data, loading, reload } = useLoad(async () => {
    const resto = await getMyRestaurant(restaurantId);
    const menu = restaurantId ? await getRestaurantMenu(restaurantId) : null;
    return { resto, menu };
  }, [restaurantId]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ouvre, setOuvre] = useState<string | null>(null);
  const [ferme, setFerme] = useState<string | null>(null);

  const resto = data?.resto ?? null;
  const menu = data?.menu ?? null;

  // Les champs suivent la base tant que le restaurateur n'a rien tapé.
  const valOuvre = ouvre ?? pourSaisie(resto?.opensAt ?? '');
  const valFerme = ferme ?? pourSaisie(resto?.closesAt ?? '');

  async function run(key: string, fn: () => Promise<void>, msg: string) {
    setError(null);
    setBusy(key);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as { message?: string })?.message || msg);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function enregistrerHoraires(auto: boolean) {
    const o = normaliserHeure(valOuvre);
    const f = normaliserHeure(valFerme);
    if (valOuvre || valFerme) {
      if (!o || !f) {
        setError("Heures non comprises. Écrivez par exemple 8h30 et 22h.");
        return;
      }
    }
    await run('horaires', async () => {
      await setRestaurantHours(o, f, auto);
      setOuvre(null);
      setFerme(null);
    }, 'Enregistrement impossible.');
  }

  return (
    <View style={styles.container}>
      <RestaurantHeader title="Réglages" />

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.screen, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* ---------------------------------------------------- Ouverture */}
          <Text style={styles.section}>Votre restaurant</Text>

          <View style={styles.carte}>
            <View style={styles.ligne}>
              <Icon
                name={resto?.isOpen ? 'storefront' : 'pause_circle'}
                size={24}
                color={resto?.isOpen ? colors.success : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.ligneTitre}>
                  {resto?.isOpen ? 'Ouvert en ce moment' : 'Fermé en ce moment'}
                </Text>
                <Text style={styles.ligneSous}>
                  {resto?.autoOpen
                    ? 'Suit vos horaires automatiquement.'
                    : 'Vous ouvrez et fermez à la main.'}
                </Text>
              </View>
            </View>

            <View style={styles.separateur} />

            <View style={styles.ligne}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ligneTitre}>Ouverture automatique</Text>
                <Text style={styles.ligneSous}>
                  Votre restaurant s'ouvre et se ferme tout seul, selon les horaires ci-dessous.
                </Text>
              </View>
              <Switch
                value={resto?.autoOpen ?? false}
                disabled={busy !== null}
                onValueChange={(v) => enregistrerHoraires(v)}
                trackColor={{ true: colors.success, false: colors.borderStrong }}
                thumbColor={colors.white}
              />
            </View>

            {/* La bascule manuelle n'a de sens qu'en mode manuel : en
                automatique, elle serait écrasée à la minute suivante. */}
            {!resto?.autoOpen ? (
              <>
                <View style={styles.separateur} />
                <View style={styles.ligne}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ligneTitre}>Je suis ouvert</Text>
                    <Text style={styles.ligneSous}>
                      Fermé, votre restaurant reste visible mais n'accepte plus de commande.
                    </Text>
                  </View>
                  <Switch
                    value={resto?.isOpen ?? false}
                    disabled={busy !== null}
                    onValueChange={(v) => run('ouvert', () => setRestaurantOpen(v), 'Bascule impossible.')}
                    trackColor={{ true: colors.success, false: colors.borderStrong }}
                    thumbColor={colors.white}
                  />
                </View>
              </>
            ) : null}
          </View>

          {/* ----------------------------------------------------- Horaires */}
          <Text style={styles.section}>Vos horaires</Text>

          <View style={styles.carte}>
            <View style={styles.heuresRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.champLabel}>Ouverture</Text>
                <TextInput
                  value={valOuvre}
                  onChangeText={setOuvre}
                  placeholder="8h30"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                  style={styles.champ}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.champLabel}>Fermeture</Text>
                <TextInput
                  value={valFerme}
                  onChangeText={setFerme}
                  placeholder="22h"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                  style={styles.champ}
                />
              </View>
            </View>

            <Text style={styles.aide}>
              Si vous fermez après minuit, indiquez-le tel quel — par exemple 18h et 2h.
            </Text>

            <Pressable
              onPress={() => enregistrerHoraires(resto?.autoOpen ?? false)}
              disabled={busy !== null}
              style={[styles.bouton, busy === 'horaires' && { opacity: 0.6 }]}
            >
              <Text style={styles.boutonTexte}>
                {busy === 'horaires' ? 'Enregistrement…' : 'Enregistrer les horaires'}
              </Text>
            </Pressable>
          </View>

          {/* ------------------------------------------------------- La carte */}
          <Text style={styles.section}>Votre carte</Text>
          <Text style={styles.intro}>
            Un produit en rupture reste visible par vos clients, avec la mention
            « Bientôt de retour ». Il n'est simplement plus commandable.
          </Text>

          {menu?.categories.map((cat) => {
            const produits = menu.products.filter((p) => p.categoryId === cat.id);
            if (!produits.length) return null;
            return (
              <View key={cat.id} style={styles.carte}>
                <Text style={styles.categorie}>
                  {cat.icon ? `${cat.icon}  ` : ''}
                  {cat.name}
                </Text>
                {produits.map((p, i) => (
                  <View key={p.id}>
                    {i ? <View style={styles.separateur} /> : null}
                    <View style={styles.ligne}>
                      <ProductThumb uri={p.photoUrl} size={44} radius={12} muted={!p.isAvailable} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.produitNom, !p.isAvailable && styles.produitCoupe]}>
                          {p.name}
                        </Text>
                        <Text style={styles.produitPrix}>
                          {formatAr(p.price)}
                          {p.isAvailable ? '' : '  ·  Bientôt de retour'}
                        </Text>
                      </View>
                      <Switch
                        value={p.isAvailable}
                        disabled={busy !== null}
                        onValueChange={(v) =>
                          run(p.id, () => setProductAvailable(p.id, v), 'Modification impossible.')
                        }
                        trackColor={{ true: colors.success, false: colors.borderStrong }}
                        thumbColor={colors.white}
                      />
                    </View>
                  </View>
                ))}
              </View>
            );
          })}

          {resto?.opensAt && resto?.closesAt ? (
            <Text style={styles.pied}>
              Horaires enregistrés : {formatTime(resto.opensAt)} – {formatTime(resto.closesAt)}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  intro: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginBottom: 10 },
  carte: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  ligneTitre: { fontFamily: fonts.bold, fontSize: 15, color: colors.textDark },
  ligneSous: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  separateur: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  heuresRow: { flexDirection: 'row', gap: 12 },
  champLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  champ: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textDark,
    backgroundColor: colors.bg,
  },
  aide: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 10 },
  bouton: {
    marginTop: 12,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boutonTexte: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.white },
  categorie: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textDark, marginBottom: 6 },
  produitNom: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.textDark },
  produitCoupe: { color: colors.textMuted },
  produitPrix: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  pied: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 8 },
  error: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
});
