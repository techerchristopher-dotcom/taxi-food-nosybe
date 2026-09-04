import { useState } from 'react';
import {
  ActivityIndicator,
  DimensionValue,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '../../components/Icon';
import { RestaurantHeader } from '../../components/RestaurantHeader';
import { ProductThumb } from '../../components/ProductThumb';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import {
  getMyRestaurant,
  getMenu,
  setProductAvailable,
  setRestaurantAutoOpen,
  setRestaurantOpen,
  setRestaurantPhoto,
  setRestaurantWeekHours,
} from '../../data/api';
import { Category, DayHours, Product } from '../../data/types';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';
import { supabase } from '../../lib/supabase';

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

/** Lundi -> Dimanche à l'affichage ; la base indexe 0=dimanche..6=samedi (extract(dow from ...)). */
const JOURS: { weekday: number; label: string }[] = [
  { weekday: 1, label: 'Lundi' },
  { weekday: 2, label: 'Mardi' },
  { weekday: 3, label: 'Mercredi' },
  { weekday: 4, label: 'Jeudi' },
  { weekday: 5, label: 'Vendredi' },
  { weekday: 6, label: 'Samedi' },
  { weekday: 0, label: 'Dimanche' },
];

type Brouillon = Record<number, { opensAt: string; closesAt: string; isClosed: boolean }>;

function versBrouillon(weekHours: DayHours[]): Brouillon {
  const b: Brouillon = {};
  for (const h of weekHours) {
    b[h.weekday] = { opensAt: pourSaisie(h.opensAt), closesAt: pourSaisie(h.closesAt), isClosed: h.isClosed };
  }
  return b;
}

/** Zone tap-pour-changer (logo carré ou couverture panoramique), avec badge crayon superposé. */
function PhotoEditable({
  uri,
  width,
  height,
  radiusValue,
  icon,
  busy,
  onPick,
}: {
  uri?: string | null;
  width: DimensionValue;
  height: DimensionValue;
  radiusValue: number;
  icon: string;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <Pressable onPress={onPick} disabled={busy} style={{ width, height }}>
      <View style={[styles.photoBox, { width, height, borderRadius: radiusValue }]}>
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
            style={{ width, height, borderRadius: radiusValue }}
          />
        ) : (
          <Icon name={icon} size={28} color={colors.textFaint} />
        )}
        {busy ? (
          <View style={[styles.photoOverlay, { borderRadius: radiusValue }]}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <View style={styles.photoBadge}>
            <Icon name="edit" size={14} color={colors.white} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Espace restaurant — Réglages : ouverture, horaires, visuels, ruptures de stock. */
export default function RestaurantSettingsScreen() {
  const restaurantId = useSession((s) => s.session?.restaurantId ?? '');

  const { data, loading, reload } = useLoad(async () => {
    const resto = await getMyRestaurant(restaurantId);
    const menu = restaurantId ? await getMenu(restaurantId) : null;
    return { resto, menu };
  }, [restaurantId]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  const resto = data?.resto ?? null;
  const menu = data?.menu ?? null;

  // Les champs suivent la base tant que le restaurateur n'a rien tapé.
  const jours = brouillon ?? (resto ? versBrouillon(resto.weekHours) : {});

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

  function majJour(weekday: number, patch: Partial<{ opensAt: string; closesAt: string; isClosed: boolean }>) {
    setBrouillon({ ...jours, [weekday]: { ...jours[weekday], ...patch } });
  }

  async function enregistrerHoraires() {
    const days: DayHours[] = [];
    for (const { weekday } of JOURS) {
      const j = jours[weekday] ?? { opensAt: '', closesAt: '', isClosed: false };
      if (j.isClosed) {
        days.push({ weekday, opensAt: '', closesAt: '', isClosed: true });
        continue;
      }
      if (!j.opensAt && !j.closesAt) {
        days.push({ weekday, opensAt: '', closesAt: '', isClosed: false });
        continue;
      }
      const o = normaliserHeure(j.opensAt);
      const f = normaliserHeure(j.closesAt);
      if (!o || !f) {
        setError(`Horaire du ${JOURS.find((x) => x.weekday === weekday)?.label} incompris. Écrivez par exemple 8h30 et 22h.`);
        return;
      }
      days.push({ weekday, opensAt: o, closesAt: f, isClosed: false });
    }
    await run(
      'horaires',
      async () => {
        await setRestaurantWeekHours(days);
        setBrouillon(null);
      },
      'Enregistrement impossible.',
    );
  }

  async function pickAndUpload(kind: 'logo' | 'cover') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Autorisation d\'accès aux photos refusée.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;

    await run(
      kind,
      async () => {
        const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());
        const isPng = uri.toLowerCase().endsWith('.png');
        const path = `${restaurantId}/${kind}-${Date.now()}.${isPng ? 'png' : 'jpg'}`;
        const { error: upErr } = await supabase.storage.from('partenaires').upload(path, arraybuffer, {
          contentType: isPng ? 'image/png' : 'image/jpeg',
          upsert: true,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('partenaires').getPublicUrl(path);
        await setRestaurantPhoto(kind, pub.publicUrl);
      },
      'Envoi de la photo impossible.',
    );
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

          {/* ------------------------------------------------------ Visuels */}
          <Text style={styles.section}>Logo et couverture</Text>
          <View style={[styles.carte, { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }]}>
            <PhotoEditable
              uri={resto?.logoUrl}
              width={72}
              height={72}
              radiusValue={radius.tile}
              icon="storefront"
              busy={busy === 'logo'}
              onPick={() => pickAndUpload('logo')}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.ligneSous}>Logo carré — appuyez pour changer.</Text>
              <View style={{ height: 10 }} />
              <PhotoEditable
                uri={resto?.coverUrl}
                width="100%"
                height={72}
                radiusValue={radius.lg}
                icon="image"
                busy={busy === 'cover'}
                onPick={() => pickAndUpload('cover')}
              />
              <Text style={styles.ligneSous}>Couverture — appuyez pour changer.</Text>
            </View>
          </View>

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
                onValueChange={(v) => run('auto', () => setRestaurantAutoOpen(v), 'Bascule impossible.')}
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
          <Text style={styles.intro}>
            Un jour sans horaire renseigné est considéré fermé si l'ouverture automatique est activée.
          </Text>

          <View style={styles.carte}>
            {JOURS.map(({ weekday, label }, i) => {
              const j = jours[weekday] ?? { opensAt: '', closesAt: '', isClosed: false };
              return (
                <View key={weekday}>
                  {i ? <View style={styles.separateur} /> : null}
                  <View style={styles.jourLigne}>
                    <View style={styles.jourEntete}>
                      <Text style={styles.jourLabel}>{label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.fermeLabel}>Fermé</Text>
                        <Switch
                          value={j.isClosed}
                          disabled={busy !== null}
                          onValueChange={(v) => majJour(weekday, { isClosed: v })}
                          trackColor={{ true: colors.textMuted, false: colors.borderStrong }}
                          thumbColor={colors.white}
                        />
                      </View>
                    </View>
                    {!j.isClosed ? (
                      <View style={styles.heuresRow}>
                        <TextInput
                          value={j.opensAt}
                          onChangeText={(v) => majJour(weekday, { opensAt: v })}
                          placeholder="8h30"
                          placeholderTextColor={colors.textFaint}
                          keyboardType="numbers-and-punctuation"
                          style={[styles.champ, { flex: 1 }]}
                        />
                        <TextInput
                          value={j.closesAt}
                          onChangeText={(v) => majJour(weekday, { closesAt: v })}
                          placeholder="22h"
                          placeholderTextColor={colors.textFaint}
                          keyboardType="numbers-and-punctuation"
                          style={[styles.champ, { flex: 1 }]}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            <Text style={styles.aide}>
              Si vous fermez après minuit, indiquez-le tel quel — par exemple 18h et 2h.
            </Text>

            <Pressable
              onPress={enregistrerHoraires}
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

          {menu?.categories.map((cat: Category) => {
            const produits = menu.products.filter((p: Product) => p.categoryId === cat.id);
            if (!produits.length) return null;
            return (
              <View key={cat.id} style={styles.carte}>
                <Text style={styles.categorie}>
                  {cat.icon ? `${cat.icon}  ` : ''}
                  {cat.name}
                </Text>
                {produits.map((p: Product, i: number) => (
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
  jourLigne: { paddingVertical: 4 },
  jourEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  jourLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textDark },
  fermeLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  heuresRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  champ: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
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
  error: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.dangerText,
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  photoBox: {
    backgroundColor: colors.fieldBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26,26,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
