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
  archiveProduct,
  getFeaturedLibrary,
  getMyRestaurant,
  getMenu,
  saveFeaturedProduct,
  setProductAvailable,
  setProductFeatured,
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

/**
 * Fiche de mise à l'affiche en cours d'édition. `productId` null = création ;
 * sinon on reprend une fiche déjà en bibliothèque, pré-remplie — c'est tout
 * l'intérêt : remettre le plat de jeudi à l'affiche vendredi sans rien ressaisir.
 */
type FicheAffiche = {
  productId: string | null;
  name: string;
  label: string;
  price: string;
  stock: string;
  description: string;
  photoUrl: string | null;
};

const FICHE_VIDE: FicheAffiche = {
  productId: null,
  name: '',
  label: 'Plat du jour',
  price: '',
  stock: '',
  description: '',
  photoUrl: null,
};

function ficheDepuis(p: Product): FicheAffiche {
  return {
    productId: p.id,
    name: p.name,
    label: p.featuredLabel ?? 'Plat du jour',
    price: String(p.price),
    stock: p.stockQuantity == null ? '' : String(p.stockQuantity),
    description: p.description ?? '',
    photoUrl: p.photoUrl ?? null,
  };
}

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
    const bibliotheque = await getFeaturedLibrary(restaurantId);
    return { resto, menu, bibliotheque };
  }, [restaurantId]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [fiche, setFiche] = useState<FicheAffiche | null>(null);

  const resto = data?.resto ?? null;
  const menu = data?.menu ?? null;
  const bibliotheque = data?.bibliotheque ?? [];
  const alAffiche = menu?.featured ?? [];
  // Créations dormantes : déjà prêtes (photo, prix, description), il suffit d'un
  // tap pour les remettre à l'affiche.
  const dormantes = bibliotheque.filter((p) => !p.isFeatured);

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

  /**
   * Choisit une photo, la recadre au bon format (le recadrage est fait par iOS/Android,
   * ce qui garantit un cadre homogène sans cropper maison) et la dépose dans le bucket
   * `partenaires`, sous le dossier du restaurant. Renvoie l'URL publique, ou null si
   * l'utilisateur a annulé.
   */
  async function choisirEtEnvoyer(
    prefixe: string,
    aspect: [number, number],
  ): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Autorisation d'accès aux photos refusée.");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return null;

    const uri = result.assets[0].uri;
    const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());
    const isPng = uri.toLowerCase().endsWith('.png');
    // L'horodatage dans le nom évite tout souci de cache d'image côté client.
    const path = `${restaurantId}/${prefixe}-${Date.now()}.${isPng ? 'png' : 'jpg'}`;
    const { error: upErr } = await supabase.storage.from('partenaires').upload(path, arraybuffer, {
      contentType: isPng ? 'image/png' : 'image/jpeg',
      upsert: true,
    });
    if (upErr) throw upErr;
    return supabase.storage.from('partenaires').getPublicUrl(path).data.publicUrl;
  }

  async function pickAndUpload(kind: 'logo' | 'cover') {
    await run(
      kind,
      async () => {
        const url = await choisirEtEnvoyer(kind, kind === 'logo' ? [1, 1] : [16, 9]);
        if (url) await setRestaurantPhoto(kind, url);
      },
      'Envoi de la photo impossible.',
    );
  }

  async function photoDeLaFiche() {
    if (!fiche) return;
    setError(null);
    setBusy('photo-fiche');
    try {
      const url = await choisirEtEnvoyer('plat', [4, 3]);
      if (url) setFiche({ ...fiche, photoUrl: url });
    } catch (e) {
      setError((e as { message?: string })?.message || 'Envoi de la photo impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function enregistrerFiche() {
    if (!fiche) return;
    const prix = Number(fiche.price.replace(/\s/g, '').replace(',', '.'));
    if (!fiche.name.trim()) {
      setError('Donnez un nom à votre plat.');
      return;
    }
    if (!Number.isFinite(prix) || prix <= 0) {
      setError('Indiquez un prix, par exemple 28000.');
      return;
    }
    const stockBrut = fiche.stock.trim();
    const stock = stockBrut === '' ? null : Number(stockBrut);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
      setError('La quantité doit être un nombre entier, ou vide si vous ne comptez pas.');
      return;
    }

    await run(
      'fiche',
      async () => {
        await saveFeaturedProduct({
          productId: fiche.productId,
          name: fiche.name.trim(),
          description: fiche.description.trim() || null,
          price: Math.round(prix),
          stockQuantity: stock,
          photoUrl: fiche.photoUrl,
          featuredLabel: fiche.label.trim() || null,
        });
        setFiche(null);
      },
      'Enregistrement impossible.',
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

          {/* ------------------------------------------------------ À l'affiche */}
          <Text style={styles.section}>À l'affiche</Text>
          <Text style={styles.intro}>
            Vos plats mis en avant en haut de votre page. Retirer un plat ne l'efface pas :
            il retourne dans votre bibliothèque, prêt à être remis à l'affiche en un tap.
          </Text>

          {alAffiche.length ? (
            <View style={styles.carte}>
              {alAffiche.map((p, i) => (
                <View key={p.id}>
                  {i ? <View style={styles.separateur} /> : null}
                  <View style={styles.ligne}>
                    <ProductThumb uri={p.photoUrl} size={52} radius={12} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {p.featuredLabel ? (
                        <Text style={styles.badgeAffiche}>{p.featuredLabel.toUpperCase()}</Text>
                      ) : null}
                      <Text style={styles.produitNom}>{p.name}</Text>
                      <Text style={styles.produitPrix}>
                        {formatAr(p.price)}
                        {p.stockQuantity != null ? `  ·  ${p.stockQuantity} restant${p.stockQuantity > 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Pressable
                        onPress={() => setFiche(ficheDepuis(p))}
                        disabled={busy !== null}
                        style={styles.miniBouton}
                      >
                        <Text style={styles.miniBoutonTexte}>Modifier</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          run(p.id, () => setProductFeatured(p.id, false), 'Retrait impossible.')
                        }
                        disabled={busy !== null}
                        style={[styles.miniBouton, styles.miniBoutonSecondaire]}
                      >
                        <Text style={[styles.miniBoutonTexte, { color: colors.textDark }]}>Retirer</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.carte}>
              <Text style={styles.ligneSous}>Aucun plat à l'affiche en ce moment.</Text>
            </View>
          )}

          {!fiche ? (
            <Pressable onPress={() => setFiche(FICHE_VIDE)} disabled={busy !== null} style={styles.bouton}>
              <Text style={styles.boutonTexte}>Ajouter un plat à l'affiche</Text>
            </Pressable>
          ) : (
            <View style={styles.carte}>
              <Text style={styles.categorie}>
                {fiche.productId ? 'Remettre à l\'affiche' : 'Nouveau plat à l\'affiche'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <PhotoEditable
                  uri={fiche.photoUrl}
                  width={84}
                  height={64}
                  radiusValue={12}
                  icon="photo_camera"
                  busy={busy === 'photo-fiche'}
                  onPick={photoDeLaFiche}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput
                    value={fiche.name}
                    onChangeText={(v) => setFiche({ ...fiche, name: v })}
                    placeholder="Nom du plat"
                    placeholderTextColor={colors.textFaint}
                    style={styles.champ}
                  />
                  <TextInput
                    value={fiche.label}
                    onChangeText={(v) => setFiche({ ...fiche, label: v })}
                    placeholder="Plat du jour, Pizza de la semaine…"
                    placeholderTextColor={colors.textFaint}
                    style={styles.champ}
                  />
                </View>
              </View>

              <View style={[styles.heuresRow, { marginTop: 8 }]}>
                <TextInput
                  value={fiche.price}
                  onChangeText={(v) => setFiche({ ...fiche, price: v })}
                  placeholder="Prix en Ar"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  style={[styles.champ, { flex: 1 }]}
                />
                <TextInput
                  value={fiche.stock}
                  onChangeText={(v) => setFiche({ ...fiche, stock: v })}
                  placeholder="Quantité (option.)"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  style={[styles.champ, { flex: 1 }]}
                />
              </View>

              <TextInput
                value={fiche.description}
                onChangeText={(v) => setFiche({ ...fiche, description: v })}
                placeholder="Description (facultative)"
                placeholderTextColor={colors.textFaint}
                style={[styles.champ, { marginTop: 8, height: 60, paddingTop: 12 }]}
                multiline
              />

              <Text style={styles.aide}>
                Laissez la quantité vide si vous ne comptez pas les portions. À zéro, le plat
                passe automatiquement en indisponible.
              </Text>

              <Pressable
                onPress={enregistrerFiche}
                disabled={busy !== null}
                style={[styles.bouton, busy === 'fiche' && { opacity: 0.6 }]}
              >
                <Text style={styles.boutonTexte}>
                  {busy === 'fiche' ? 'Enregistrement…' : 'Mettre à l\'affiche'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setFiche(null)} disabled={busy !== null} style={styles.lienAnnuler}>
                <Text style={styles.lienAnnulerTexte}>Annuler</Text>
              </Pressable>
            </View>
          )}

          {/* --------------------------------------------------- Bibliothèque */}
          {dormantes.length ? (
            <>
              <Text style={styles.section}>Votre bibliothèque</Text>
              <Text style={styles.intro}>
                Vos plats déjà préparés. Un tap les remet à l'affiche avec leur photo et leur
                prix — vous pouvez ajuster avant de valider.
              </Text>
              <View style={styles.carte}>
                {dormantes.map((p, i) => (
                  <View key={p.id}>
                    {i ? <View style={styles.separateur} /> : null}
                    <View style={styles.ligne}>
                      <ProductThumb uri={p.photoUrl} size={52} radius={12} muted />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.produitNom}>{p.name}</Text>
                        <Text style={styles.produitPrix}>{formatAr(p.price)}</Text>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Pressable
                          onPress={() => setFiche(ficheDepuis(p))}
                          disabled={busy !== null}
                          style={styles.miniBouton}
                        >
                          <Text style={styles.miniBoutonTexte}>Remettre</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            run(p.id, () => archiveProduct(p.id), 'Suppression impossible.')
                          }
                          disabled={busy !== null}
                          style={[styles.miniBouton, styles.miniBoutonSecondaire]}
                        >
                          <Text style={[styles.miniBoutonTexte, { color: colors.textMuted }]}>
                            Supprimer
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ------------------------------------------------------- La carte */}
          <Text style={styles.section}>Votre carte</Text>
          <Text style={styles.intro}>
            Un produit en rupture reste visible par vos clients, avec la mention
            « Bientôt de retour ». Il n'est simplement plus commandable. L'étoile met un plat
            de votre carte en avant, sans le sortir de sa catégorie.
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
                      {/* Mise en avant d'un plat de la carte permanente : il reste
                          dans sa catégorie ET remonte en tête de page. */}
                      <Pressable
                        onPress={() =>
                          run(
                            `star-${p.id}`,
                            () => setProductFeatured(p.id, !p.isFeatured, cat.name),
                            'Mise en avant impossible.',
                          )
                        }
                        disabled={busy !== null}
                        style={styles.etoile}
                        hitSlop={6}
                      >
                        <Icon
                          name={p.isFeatured ? 'star' : 'star_outline'}
                          size={22}
                          color={p.isFeatured ? colors.accent : colors.textFaint}
                        />
                      </Pressable>
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
  badgeAffiche: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.primary,
    marginBottom: 2,
  },
  miniBouton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBoutonSecondaire: { backgroundColor: colors.fieldBg },
  miniBoutonTexte: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  lienAnnuler: { alignItems: 'center', paddingVertical: 10 },
  lienAnnulerTexte: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  etoile: { padding: 6 },
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
