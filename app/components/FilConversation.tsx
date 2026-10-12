import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { PhotoPleinEcran } from './PhotoPleinEcran';
import { colors, fonts } from '../theme/tokens';
import { codeErreurMessagerie, lienPhotoMessage, MessageCommande, RoleMessagerie } from '../data/messagerie';
import { supabase } from '../lib/supabase';
import { useSondage } from '../lib/useSondage';

/**
 * Une conversation (2026-10-13) : celle d'une commande, ou le fil client ↔ Taxi Food.
 * L'écran fournit comment lire, écrire et déposer une photo ; ce composant s'occupe du
 * reste — bulles, photos, messages rapides, traduction, temps réel.
 *
 * Fraîcheur : signal Realtime Broadcast PRIVÉ sur `canal` (la base l'émet à chaque message
 * et à chaque traduction ; il ne porte aucun contenu, on relit par la RPC), et
 * interrogation régulière en filet de sécurité — toutes les 4 s sans signal, 15 s avec.
 * Le curseur suit la création OU la mise à jour : une traduction arrivée après coup est
 * relue sans recharger tout le fil.
 */

export type ChargementFil = {
  peutEcrire: boolean;
  messages: MessageCommande[];
  titre?: string;
  sousTitre?: string;
};

type Props = {
  titreParDefaut: string;
  charger: (depuis: string | null) => Promise<ChargementFil>;
  envoyer: (texte: string | null, photoPath: string | null) => Promise<MessageCommande>;
  deposerPhoto: (uri: string, mime?: string | null) => Promise<string>;
  rapides: string[];
  vide: string;
  quiLit: string;
  fermee: string;
  canal: string;
  /** Une notification reçue concerne-t-elle ce fil ? (relecture immédiate) */
  concerne: (data: Record<string, unknown>) => boolean;
  onRetour: () => void;
  longueurMax?: number;
};

function heure(iso: string): string {
  const d = new Date(iso);
  try {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Antananarivo' });
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

export function FilConversation(p: Props) {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'fr').slice(0, 2);

  const [entete, setEntete] = useState<{ titre?: string; sousTitre?: string }>({});
  const [peutEcrire, setPeutEcrire] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<MessageCommande[]>([]);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState<null | 'texte' | 'photo'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [photoOuverte, setPhotoOuverte] = useState<string | null>(null);
  const [tempsReel, setTempsReel] = useState(false);
  const curseur = useRef<string | null>(null);
  const liste = useRef<FlatList<MessageCommande>>(null);
  const chargerRef = useRef(p.charger);
  chargerRef.current = p.charger;
  const concerneRef = useRef(p.concerne);
  concerneRef.current = p.concerne;

  const fusionner = useCallback((recus: MessageCommande[]) => {
    if (!recus.length) return;
    setMessages((prev) => {
      const parId = new Map(prev.map((m) => [m.id, m]));
      for (const m of recus) parId.set(m.id, { ...parId.get(m.id), ...m });
      const tout = [...parId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const max = tout.reduce((acc, m) => (m.curseur > acc ? m.curseur : acc), curseur.current ?? '');
      curseur.current = max || null;
      return tout;
    });
  }, []);

  const relire = useCallback(async () => {
    try {
      const r = await chargerRef.current(curseur.current);
      setPeutEcrire(r.peutEcrire);
      if (r.titre || r.sousTitre) setEntete({ titre: r.titre, sousTitre: r.sousTitre });
      setErreurChargement(null);
      fusionner(r.messages);
    } catch (e) {
      const code = codeErreurMessagerie(e);
      setErreurChargement(code === 'acces_refuse' ? t('messagerie.inaccessible') : t('messagerie.erreurReseau'));
    }
  }, [fusionner, t]);

  useEffect(() => {
    curseur.current = null;
    setMessages([]);
    setPeutEcrire(null);
    void relire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.canal]);
  useSondage(relire, tempsReel ? 15000 : 4000);

  // Signal temps réel (privé : la base vérifie que l'on participe à la conversation).
  useEffect(() => {
    const ch = supabase.channel(p.canal, { config: { private: true } });
    ch.on('broadcast', { event: '*' }, () => void relire()).subscribe((statut) => setTempsReel(statut === 'SUBSCRIBED'));
    return () => {
      setTempsReel(false);
      void supabase.removeChannel(ch);
    };
  }, [p.canal, relire]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (concerneRef.current((n.request.content.data ?? {}) as Record<string, unknown>)) void relire();
    });
    return () => sub.remove();
  }, [relire]);

  function messageErreur(e: unknown): string {
    const code = codeErreurMessagerie(e);
    if (code === 'fermee') return t('messagerie.erreurFermee');
    if (code === 'trop_rapide') return t('messagerie.erreurTropRapide');
    if (code === 'trop_long') return t('messagerie.erreurTropLong');
    if (code === 'acces_refuse') return t('messagerie.inaccessible');
    return t('messagerie.erreurEnvoi');
  }

  async function envoyerTexte(contenu: string) {
    const propre = contenu.trim();
    if (!propre || envoi) return;
    setErreur(null);
    setEnvoi('texte');
    try {
      const m = await p.envoyer(propre, null);
      fusionner([m]);
      setTexte((actuel) => (actuel.trim() === propre ? '' : actuel));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(null);
    }
  }

  async function envoyerPhoto(source: 'camera' | 'galerie') {
    if (envoi) return;
    setErreur(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErreur(t(source === 'camera' ? 'messagerie.refusCamera' : 'messagerie.refusGalerie'));
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, allowsEditing: false };
    const r =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (r.canceled || !r.assets?.[0]) return;
    setEnvoi('photo');
    try {
      const path = await p.deposerPhoto(r.assets[0].uri, r.assets[0].mimeType);
      // Le texte en cours de saisie part avec la photo, comme une légende.
      const legende = texte.trim() || null;
      const m = await p.envoyer(legende, path);
      fusionner([m]);
      if (legende) setTexte('');
    } catch (e) {
      setErreur(codeErreurMessagerie(e) ? messageErreur(e) : t('messagerie.erreurPhoto'));
    } finally {
      setEnvoi(null);
    }
  }

  const nomRole = (r: RoleMessagerie) => t(`messagerie.role.${r}`);
  const charge = peutEcrire !== null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={p.onRetour} style={styles.back} accessibilityRole="button" accessibilityLabel={t('messagerie.retour')}>
          <Icon name="arrow_back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {entete.titre ?? p.titreParDefaut}
          </Text>
          {entete.sousTitre ? (
            <Text style={styles.sub} numberOfLines={2}>
              {entete.sousTitre}
            </Text>
          ) : null}
        </View>
      </View>

      {!charge && !erreurChargement ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !charge && erreurChargement ? (
        <View style={styles.center}>
          <Icon name="forum" size={40} color={colors.textFaint} />
          <Text style={styles.vide}>{erreurChargement}</Text>
        </View>
      ) : (
        <FlatList
          ref={liste}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12, flexGrow: 1 }}
          onContentSizeChange={() => liste.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={styles.info}>
              <Icon name="lock" size={16} color={colors.textMuted} />
              <Text style={styles.infoTxt}>{p.quiLit}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="forum" size={40} color={colors.textFaint} />
              <Text style={styles.vide}>{p.vide}</Text>
            </View>
          }
          renderItem={({ item }) => <Bulle m={item} lang={lang} nomRole={nomRole} onPhoto={setPhotoOuverte} />}
        />
      )}

      {erreurChargement && charge ? <Text style={styles.warn}>{erreurChargement}</Text> : null}

      {charge && !peutEcrire ? (
        <View style={[styles.fermee, { paddingBottom: insets.bottom + 12 }]}>
          <Icon name="lock_clock" size={18} color={colors.textMuted} />
          <Text style={styles.fermeeTxt}>{p.fermee}</Text>
        </View>
      ) : charge ? (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {p.rapides.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rapides} keyboardShouldPersistTaps="handled">
              {p.rapides.map((r) => (
                <Pressable key={r} onPress={() => envoyerTexte(r)} disabled={!!envoi} style={({ pressed }) => [styles.rapide, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.rapideTxt}>{r}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          {envoi === 'photo' ? <Text style={styles.envoiPhoto}>{t('messagerie.envoiPhoto')}</Text> : null}
          <View style={styles.saisieRow}>
            {Platform.OS !== 'web' ? (
              <Pressable onPress={() => envoyerPhoto('camera')} disabled={!!envoi} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('messagerie.prendrePhoto')}>
                <Icon name="photo_camera" size={24} color={envoi ? colors.textFaint : colors.ink} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => envoyerPhoto('galerie')} disabled={!!envoi} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('messagerie.choisirPhoto')}>
              <Icon name="image" size={24} color={envoi ? colors.textFaint : colors.ink} />
            </Pressable>
            <TextInput
              value={texte}
              onChangeText={setTexte}
              placeholder={t('messagerie.placeholder')}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              multiline
              maxLength={p.longueurMax ?? 500}
            />
            <Pressable
              onPress={() => envoyerTexte(texte)}
              disabled={!texte.trim() || !!envoi}
              style={[styles.envoyer, (!texte.trim() || !!envoi) && { backgroundColor: colors.borderStrong }]}
              accessibilityRole="button"
              accessibilityLabel={t('messagerie.envoyer')}
            >
              {envoi === 'texte' ? <ActivityIndicator color={colors.white} size="small" /> : <Icon name="send" size={20} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      ) : null}

      <PhotoPleinEcran uri={photoOuverte} onClose={() => setPhotoOuverte(null)} />
    </KeyboardAvoidingView>
  );
}

function Bulle({
  m,
  lang,
  nomRole,
  onPhoto,
}: {
  m: MessageCommande;
  lang: string;
  nomRole: (r: RoleMessagerie) => string;
  onPhoto: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [original, setOriginal] = useState(false);
  const auteur =
    m.auteurRole === 'restaurant' || m.auteurRole === 'admin'
      ? m.auteurNom ?? nomRole(m.auteurRole)
      : m.auteurNom
        ? `${m.auteurNom} · ${nomRole(m.auteurRole)}`
        : nomRole(m.auteurRole);
  // Traduction : seulement pour les messages des autres, écrits dans une autre langue.
  const traduction =
    !m.estMoi && m.texte && m.langueSource && m.langueSource !== lang
      ? (m.traductions?.[lang as 'fr' | 'en' | 'it'] ?? null)
      : null;
  const texteAffiche = traduction && !original ? traduction : m.texte;
  const nomLangue = m.langueSource ? t(`messagerie.langues.${m.langueSource}`, { defaultValue: `(${m.langueSource.toUpperCase()})` }) : '';
  return (
    <View style={[styles.bulleLigne, m.estMoi ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
      {!m.estMoi ? <Text style={styles.auteur}>{auteur}</Text> : null}
      <View style={[styles.bulle, m.estMoi ? styles.bulleMoi : styles.bulleAutre, m.auteurRole === 'admin' && !m.estMoi && styles.bulleAdmin]}>
        {m.photoPath ? <PhotoMessage path={m.photoPath} onOpen={onPhoto} /> : null}
        {texteAffiche ? <Text style={[styles.bulleTxt, m.estMoi && { color: colors.white }]}>{texteAffiche}</Text> : null}
        {traduction ? (
          <Pressable onPress={() => setOriginal((o) => !o)} hitSlop={6}>
            <Text style={styles.traduit}>
              {original ? t('messagerie.voirTraduction') : t('messagerie.traduitDe', { langue: nomLangue })}
            </Text>
          </Pressable>
        ) : null}
        <Text style={[styles.heure, m.estMoi && { color: 'rgba(255,255,255,0.8)' }]}>{heure(m.createdAt)}</Text>
      </View>
    </View>
  );
}

function PhotoMessage({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  useEffect(() => {
    let vivant = true;
    void lienPhotoMessage(path).then((u) => {
      if (!vivant) return;
      if (u) setUrl(u);
      else setEchec(true);
    });
    return () => {
      vivant = false;
    };
  }, [path]);
  if (echec) {
    return (
      <View style={[styles.photo, styles.photoVide]}>
        <Icon name="broken_image" size={28} color={colors.textFaint} />
      </View>
    );
  }
  return (
    <Pressable
      onPress={async () => {
        const grand = await lienPhotoMessage(path, true);
        if (grand) onOpen(grand);
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.photo} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.photo, styles.photoVide]}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  vide: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    marginBottom: 14,
  },
  infoTxt: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  bulleLigne: { marginBottom: 10 },
  auteur: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, marginBottom: 3, marginHorizontal: 6 },
  bulle: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  bulleMoi: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bulleAutre: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  bulleAdmin: { backgroundColor: colors.warnBg, borderColor: colors.warnBg },
  bulleTxt: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  traduit: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textDecorationLine: 'underline' },
  heure: { fontFamily: fonts.regular, fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end' },
  photo: { width: 220, height: 220, borderRadius: 12, backgroundColor: colors.photoGrayA },
  photoVide: { alignItems: 'center', justifyContent: 'center' },
  warn: { fontFamily: fonts.medium, fontSize: 12, color: colors.warnText, textAlign: 'center', paddingVertical: 4 },
  fermee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fermeeTxt: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, flexShrink: 1, textAlign: 'center' },
  composer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  rapides: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  rapide: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  rapideTxt: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center', paddingHorizontal: 12, paddingBottom: 6 },
  envoiPhoto: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingBottom: 6 },
  saisieRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  envoyer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
