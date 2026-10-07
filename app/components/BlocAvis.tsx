import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Etoiles } from './Etoiles';
import { Icon } from './Icon';
import { Card } from './primitives';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import { deposerAvis, envoyerPhotoAvis, monAvis } from '../data/api';
import { CodeRemerciement, MonAvis, Order } from '../data/types';
import { useLoad } from '../lib/useLoad';
import { oublierApercuPorteMonnaie } from '../store/porteMonnaie';

/** Une commande se note pendant sept jours (règle posée en base par `deposer_avis`). */
const FENETRE_JOURS = 7;

/** JJ/MM/AAAA sans dépendre d'Intl. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * « Alors, c'était comment ? » — le bloc de notation d'une commande LIVRÉE.
 *
 * Trois notes de 1 à 5 (cuisine, préparation, livraison), DEUX champs de texte
 * bien distincts — 🌍 l'avis public (`commentaire`, affiché sur la fiche avec le
 * prénom) et 🔒 le message privé au restaurant (table `avis_messages_prives`, lu
 * par le restaurant et Taxi Food seulement, jamais publié) —, une photo du plat (facultative, bucket `avis`, dossier du client) et la case de
 * consentement à la publication. La base vérifie tout (client de la commande,
 * livrée, sept jours, un seul avis, photo dans SON dossier) et crédite 1 000 Ar
 * au porte-monnaie (avant le 2026-10-07 : un code promo) — l'écran ne fait que
 * montrer. Voir docs/NOTATION-AVIS.md.
 */
export function BlocAvis({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const { data: existant, loading, reload } = useLoad(() => monAvis(order.id), [order.id]);

  const [cuisine, setCuisine] = useState<number | null>(null);
  const [preparation, setPreparation] = useState<number | null>(null);
  const [livraison, setLivraison] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [messagePrive, setMessagePrive] = useState('');
  const [consentement, setConsentement] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<CodeRemerciement | null>(null);

  if (order.status !== 'livree') return null;
  if (loading && !existant) return null;

  // Déjà noté (relu en base) ou tout juste envoyé : on remercie, on montre le code.
  if (existant || resultat) {
    const remerciement: CodeRemerciement | null = resultat
      ?? (existant
        ? {
            code: existant.code,
            valeur: existant.codeValeur ?? 0,
            expireLe: existant.codeExpireLe,
            creditPorteMonnaie: existant.creditPorteMonnaie,
          }
        : null);
    return <Merci avis={existant} code={remerciement} />;
  }

  // Passé la fenêtre, on n'insiste pas : pas de formulaire mort à l'écran.
  const livreeLe = order.deliveredAt ? new Date(order.deliveredAt).getTime() : null;
  if (livreeLe != null && Date.now() - livreeLe > FENETRE_JOURS * 86_400_000) return null;

  const complet = cuisine != null && preparation != null && livraison != null;

  async function choisirPhoto() {
    setErreur(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErreur(t('avis.photoRefus'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
  }

  async function envoyer() {
    if (!complet || envoi) return;
    setEnvoi(true);
    setErreur(null);
    let photoUrl: string | null = null;
    // La photo part d'abord ; si elle échoue, l'avis part quand même sans elle —
    // on ne perd pas trois notes et un texte pour une image.
    if (photoUri) {
      setPhotoBusy(true);
      try {
        photoUrl = await envoyerPhotoAvis(photoUri);
      } catch {
        photoUrl = null;
        setErreur(t('avis.photoErreur'));
      } finally {
        setPhotoBusy(false);
      }
    }
    try {
      const r = await deposerAvis({
        orderId: order.id,
        cuisine: cuisine!,
        preparation: preparation!,
        livraison: livraison!,
        commentaire: commentaire.trim() || null,
        consentement,
        langue: i18n.language.slice(0, 2),
        photoUrl,
        messagePrive: messagePrive.trim() || null,
      });
      setResultat(r);
      // Le solde vient de bouger : l'aperçu du récapitulatif est périmé.
      oublierApercuPorteMonnaie();
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setErreur(
        msg.includes('deja_depose') ? t('avis.dejaDepose')
          : msg.includes('trop_tard') ? t('avis.tropTard')
            : t('avis.erreur'),
      );
      if (msg.includes('deja_depose')) reload();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.titre}>{t('avis.titre')}</Text>
      <Text style={styles.sousTitre}>{t('avis.sousTitre')}</Text>

      <Ligne label={t('avis.cuisine')} valeur={cuisine} onChange={setCuisine} />
      <Ligne label={t('avis.preparation')} valeur={preparation} onChange={setPreparation} />
      <Ligne label={t('avis.livraison')} valeur={livraison} onChange={setLivraison} />

      {/* 🌍 Ce qui est PUBLIC : le texte, la photo et le consentement vont ensemble. */}
      <EnTeteChamp icone="public" titre={t('avis.publicTitre')} aide={t('avis.publicAide')} />
      <TextInput
        style={styles.commentaire}
        placeholder={t('avis.commentaire')}
        placeholderTextColor={colors.textFaint}
        value={commentaire}
        onChangeText={setCommentaire}
        multiline
        maxLength={500}
        textAlignVertical="top"
        accessibilityLabel={t('avis.publicTitre')}
        accessibilityHint={t('avis.publicAide')}
      />

      {photoUri ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: photoUri }} style={styles.photoMini} contentFit="cover" />
          <Pressable onPress={() => setPhotoUri(null)} hitSlop={8} style={styles.photoBtn}>
            <Icon name="close" size={16} color={colors.ink} />
            <Text style={styles.photoBtnTexte}>{t('avis.photoRetirer')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={choisirPhoto} style={styles.photoBtn} disabled={photoBusy}>
          <Icon name="add_a_photo" size={18} color={colors.ink} />
          <Text style={styles.photoBtnTexte}>{t('avis.photoAjouter')}</Text>
        </Pressable>
      )}

      <Pressable style={styles.consentRow} onPress={() => setConsentement((v) => !v)} accessibilityRole="checkbox"
        accessibilityState={{ checked: consentement }}>
        <Icon name={consentement ? 'check_box' : 'check_box_outline_blank'} size={22}
          color={consentement ? colors.primary : colors.textMuted} />
        <Text style={styles.consentTexte}>{t('avis.consentement')}</Text>
      </Pressable>

      {/* 🔒 Ce qui est PRIVÉ : encadré à part, fond différent, jamais publié. */}
      <View style={styles.priveBox}>
        <EnTeteChamp icone="lock" titre={t('avis.priveTitre')} aide={t('avis.priveAide')} prive />
        <TextInput
          style={[styles.commentaire, styles.priveChamp]}
          placeholder={t('avis.privePlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={messagePrive}
          onChangeText={setMessagePrive}
          multiline
          maxLength={500}
          textAlignVertical="top"
          accessibilityLabel={t('avis.priveTitre')}
          accessibilityHint={t('avis.priveAide')}
        />
      </View>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <Button label={t('avis.envoyer')} onPress={envoyer} disabled={!complet} loading={envoi} icon="star"
        style={{ marginTop: 14 }} />
    </Card>
  );
}

/** Titre d'un champ de texte + la phrase qui dit QUI le lira. */
function EnTeteChamp({ icone, titre, aide, prive }: { icone: string; titre: string; aide: string; prive?: boolean }) {
  return (
    <View style={[styles.champTete, prive && { marginTop: 0 }]}>
      <View style={styles.champTitreLigne}>
        <Icon name={icone} size={18} color={prive ? colors.textDark : colors.primary} />
        <Text style={styles.champTitre}>{titre}</Text>
      </View>
      <Text style={styles.champAide}>{aide}</Text>
    </View>
  );
}

function Ligne({ label, valeur, onChange }: { label: string; valeur: number | null; onChange: (n: number) => void }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLabel}>{label}</Text>
      <Etoiles valeur={valeur} onChange={onChange} taille={28} />
    </View>
  );
}

function Merci({ avis, code }: { avis: MonAvis | null; code: CodeRemerciement | null }) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.merciHead}>
        <Icon name="celebration" size={22} color={colors.secondary} />
        <Text style={styles.titre}>{t('avis.merciTitre')}</Text>
      </View>
      <Text style={styles.sousTitre}>{t('avis.merciTexte')}</Text>
      {avis ? (
        <View style={styles.recap}>
          <Recap label={t('avis.cuisine')} n={avis.noteCuisine} />
          <Recap label={t('avis.preparation')} n={avis.notePreparation} />
          <Recap label={t('avis.livraison')} n={avis.noteLivraison} />
          {avis.commentaire ? (
            <>
              <View style={[styles.champTitreLigne, { marginTop: 6 }]}>
                <Icon name="public" size={15} color={colors.primary} />
                <Text style={styles.recapLabelFort}>{t('avis.publicTitre')}</Text>
              </View>
              <Text style={styles.recapCommentaire}>« {avis.commentaire} »</Text>
            </>
          ) : null}
          {avis.photoUrl ? <Image source={{ uri: avis.photoUrl }} style={styles.photoRecap} contentFit="cover" /> : null}
          {avis.messagePrive ? (
            <View style={[styles.priveBox, { marginTop: 8 }]}>
              <View style={styles.champTitreLigne}>
                <Icon name="lock" size={15} color={colors.textDark} />
                <Text style={styles.recapLabelFort}>{t('avis.priveTitre')}</Text>
              </View>
              <Text style={styles.champAide}>{t('avis.priveRelu')}</Text>
              <Text style={styles.recapCommentaire}>« {avis.messagePrive} »</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {/* Depuis le 2026-10-07 : un crédit de porte-monnaie. Les avis plus anciens
          gardent l'affichage de leur code AVIS<PRENOM>. */}
      {!code?.code && (code?.creditPorteMonnaie ?? 0) > 0 ? (
        <View style={styles.codeBox}>
          <Icon name="account_balance_wallet" size={20} color={colors.primary} />
          <Text style={styles.codeTexte}>
            {t('avis.merciCredit', { montant: formatAr(code?.creditPorteMonnaie ?? 0) })}
          </Text>
        </View>
      ) : null}
      {code?.code ? (
        <View style={styles.codeBox}>
          <Icon name="confirmation_number" size={20} color={colors.primary} />
          <Text style={styles.codeTexte}>
            {t('avis.merciCode', {
              code: code.code,
              montant: formatAr(code.valeur),
              date: code.expireLe ? dateCourte(code.expireLe) : '',
            })}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function Recap({ label, n }: { label: string; n: number }) {
  return (
    <View style={styles.recapLigne}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Etoiles valeur={n} taille={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, borderWidth: 1.5, borderColor: colors.accent },
  titre: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  sousTitre: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 3 },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  ligneLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textDark, flexShrink: 1 },
  champTete: { marginTop: 16, gap: 2 },
  champTitreLigne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  champTitre: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  champAide: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  priveBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  priveChamp: { backgroundColor: colors.surface },
  recapLabelFort: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDark },
  commentaire: {
    marginTop: 8,
    minHeight: 84,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  photoMini: { width: 64, height: 64, borderRadius: radius.tile, backgroundColor: colors.fieldBg },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  photoBtnTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  photoRecap: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, marginTop: 8, backgroundColor: colors.fieldBg },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  consentTexte: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textDark },
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 10 },
  merciHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recap: { marginTop: 12, gap: 6 },
  recapLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recapLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  recapCommentaire: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 13, lineHeight: 18, color: colors.ink, marginTop: 4 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.warnBg,
  },
  codeTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: colors.warnText },
});
