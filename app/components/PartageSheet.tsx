import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import {
  copierLien,
  lienWhatsApp,
  ouvrirPartage,
  partageNatifDisponible,
  partagerFacebook,
  partageSysteme,
} from '../lib/partage';

/**
 * Feuille de partage d'un plat ou d'un restaurant.
 *
 * ⚠️ POURQUOI ELLE EXISTE, alors qu'une feuille système existe déjà. Sur le web
 * de bureau, `navigator.share` est absent — vérifié en production le 2026-09-07 :
 * `typeof navigator.share === 'undefined'`. Le bouton de partage n'y faisait donc
 * RIEN, en silence. Or c'est exactement là qu'un restaurateur pousse son plat sur
 * la page Facebook de son établissement : depuis un ordinateur.
 *
 * Les trois destinations sont donc explicites, et fonctionnent partout :
 * WhatsApp et Facebook par leurs liens de partage universels, et la copie du lien
 * pour tout le reste (Instagram, un SMS, un mail, une affiche).
 *
 * La feuille système reste proposée en dernier, mais UNIQUEMENT là où elle marche.
 */
export function PartageSheet({
  visible,
  titre,
  texte,
  url,
  onClose,
}: {
  visible: boolean;
  /** Nom du plat ou du restaurant — sert de titre à la feuille système. */
  titre: string;
  /** La phrase qui accompagne le lien (ignorée par Facebook, voir `lienFacebook`). */
  texte: string;
  url: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [copie, setCopie] = useState(false);

  // La confirmation « Lien copié » ne doit pas survivre à la fermeture : sinon
  // elle s'affiche déjà cochée à la réouverture, sur un autre plat.
  useEffect(() => {
    if (!visible) setCopie(false);
  }, [visible]);

  async function copier() {
    const ok = await copierLien(url);
    setCopie(ok);
    // On ne ferme PAS tout de suite : le client doit voir que c'est copié,
    // sinon rien à l'écran ne distingue un succès d'un tap dans le vide.
    if (ok) setTimeout(onClose, 900);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
          <Text style={styles.title}>{t('partage.titre')}</Text>
          <Text style={styles.sujet} numberOfLines={2}>
            {titre}
          </Text>

          <View style={{ gap: 10, marginTop: 18 }}>
            <Ligne
              icone="chat"
              teinte="#25D366"
              libelle={t('partage.whatsapp')}
              onPress={() => {
                ouvrirPartage(lienWhatsApp(texte, url));
                onClose();
              }}
            />
            <Ligne
              icone="facebook"
              teinte="#1877F2"
              libelle={t('partage.facebook')}
              onPress={() => {
                partagerFacebook(titre, texte, url);
                onClose();
              }}
            />
            <Ligne
              icone={copie ? 'check_circle' : 'link'}
              teinte={copie ? colors.success : colors.textDark}
              libelle={copie ? t('partage.copie') : t('partage.copier')}
              onPress={copier}
            />
            {partageNatifDisponible() ? (
              <Ligne
                icone="ios_share"
                teinte={colors.textDark}
                libelle={t('partage.plus')}
                onPress={() => {
                  partageSysteme(titre, texte, url);
                  onClose();
                }}
              />
            ) : null}
          </View>

          <Pressable onPress={onClose} style={styles.annuler} hitSlop={8}>
            <Text style={styles.annulerTexte}>{t('partage.fermer')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Ligne({
  icone,
  teinte,
  libelle,
  onPress,
}: {
  icone: string;
  teinte: string;
  libelle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ligne}>
      <View style={styles.pastille}>
        <Icon name={icone} size={22} color={teinte} />
      </View>
      <Text style={styles.ligneTexte}>{libelle}</Text>
      <Icon name="chevron_right" size={22} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,26,26,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  sujet: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.tile,
    backgroundColor: colors.bg,
  },
  pastille: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  annuler: { alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 24, marginTop: 6 },
  annulerTexte: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.textMuted },
});

/**
 * Partage EN LIGNE, visible sans rien ouvrir : « Partager sur : » suivi de trois
 * pastilles. Un appui part directement dans WhatsApp, Facebook, ou copie le lien.
 *
 * ⚠️ Pourquoi en plus de la feuille. Une icône de partage seule ne se remarque
 * pas : le restaurateur qui veut pousser son plat sur la page Facebook de son
 * établissement ne va pas la chercher. Sur la fiche produit — le seul écran qui
 * a la place — les destinations sont donc annoncées et atteignables d'un tap.
 * La feuille reste pour les lignes du menu, où trois pastilles par plat
 * satureraient l'écran.
 */
export function PartageEnLigne({
  titre,
  texte,
  url,
}: {
  titre: string;
  texte: string;
  url: string;
}) {
  const { t } = useTranslation();
  const [copie, setCopie] = useState(false);

  async function copier() {
    const ok = await copierLien(url);
    setCopie(ok);
    if (ok) setTimeout(() => setCopie(false), 2000);
  }

  return (
    <View style={enLigne.bloc}>
      <Text style={enLigne.label}>{t('partage.surLabel')}</Text>
      <View style={enLigne.pastilles}>
        <Pastille
          icone="chat"
          teinte="#25D366"
          libelle={t('partage.whatsapp')}
          onPress={() => ouvrirPartage(lienWhatsApp(texte, url))}
        />
        <Pastille
          icone="facebook"
          teinte="#1877F2"
          libelle={t('partage.facebook')}
          onPress={async () => {
            // ⚠️ Sur mobile ce bouton COPIE puis ouvre Facebook. Le dire est
            // indispensable : sans un mot, le client arrive dans le composeur
            // sans savoir qu'il n'a qu'a coller.
            if (await partagerFacebook(titre, texte, url)) {
              setCopie(true);
              setTimeout(() => setCopie(false), 4000);
            }
          }}
        />
        <Pastille
          icone={copie ? 'check' : 'link'}
          teinte={copie ? colors.success : colors.textDark}
          libelle={copie ? t('partage.copie') : t('partage.copier')}
          onPress={copier}
        />
        {partageNatifDisponible() ? (
          <Pastille
            icone="ios_share"
            teinte={colors.textDark}
            libelle={t('partage.plus')}
            onPress={() => partageSysteme(titre, texte, url)}
          />
        ) : null}
      </View>
      {copie ? <Text style={enLigne.confirme}>{t('partage.copieColler')}</Text> : null}
    </View>
  );
}

function Pastille({
  icone,
  teinte,
  libelle,
  onPress,
}: {
  icone: string;
  teinte: string;
  libelle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={enLigne.pastille}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={libelle}
    >
      <Icon name={icone} size={20} color={teinte} />
    </Pressable>
  );
}

const enLigne = StyleSheet.create({
  bloc: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textMuted },
  pastilles: { flexDirection: 'row', gap: 8 },
  pastille: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirme: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.success },
});
