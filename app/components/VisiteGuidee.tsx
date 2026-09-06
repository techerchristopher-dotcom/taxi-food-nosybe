import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Button } from './Button';
import { RestaurantOrderCard } from './RestaurantOrderCard';
import { colors, fonts, radius, spacing, shadow } from '../theme/tokens';
import { getMapsNavigationUrl, Order } from '../data/types';
import { getMyRestaurant } from '../data/api';
import { useSession } from '../store/session';
import { NomZone, useVisiteGuidee } from '../store/visiteGuidee';

/**
 * VISITE GUIDEE DE L'ESPACE PARTENAIRE
 *
 * Cinq etapes, jouees a la premiere entree du restaurateur dans son espace, et
 * rejouables depuis les Reglages. Objectif dicte par le porteur du projet :
 * « il faut qu'il comprenne comment fonctionne son application rapidement ».
 *
 * Trois regles qui expliquent la forme de ce fichier :
 *
 *  1. ⚠️ LE REPERE NE MASQUE JAMAIS CE QU'IL DESIGNE. Le voile est fait de
 *     QUATRE bandes posees AUTOUR de la cible, jamais d'un rectangle plein
 *     par-dessus. La cible reste a sa luminosite normale, entouree d'un simple
 *     contour, et la bulle se place A COTE — au-dessus si la cible est en bas
 *     de l'ecran, en dessous si elle est en haut. L'erreur inverse a deja ete
 *     commise sur le guide restaurateur du site vitrine : un halo plein
 *     recouvrait le lien qu'il montrait.
 *
 *  2. ⚠️ LA COMMANDE D'EXEMPLE N'EXISTE PAS EN BASE. L'ecran « Commandes » est
 *     vide a la premiere connexion : la premiere etape ne montrerait rien. On
 *     affiche donc une carte rendue par le VRAI composant
 *     (`RestaurantOrderCard`, purement presentatif, aucun appel reseau) a
 *     partir d'un objet en memoire, sous un badge « Exemple ». Ecrire une vraie
 *     commande polluerait le rapport journalier et les commissions, et
 *     declencherait e-mail + Telegram + push chez un vrai restaurant.
 *
 *  3. ⚠️ ON N'ANNONCE QUE CE QUI EXISTE, AVEC LES MOTS DE L'ECRAN. Une promesse
 *     fausse dans une visite est pire que pas de visite : le restaurateur
 *     cherchera un bouton absent. Trois ecueils deja payes ici :
 *
 *     - Le VOCABULAIRE. L'ecran Reglages ecrit « Couverture » et « A l'affiche »,
 *       jamais « devanture » ni « plat du jour ». La visite reprend donc ses
 *       mots. Sur le fond : `save_featured_product` cree bien un plat AVEC son
 *       prix, mais en `in_menu = false` — il vit « a l'affiche », pas dans la
 *       carte permanente ; et le prix d'un plat DE LA CARTE devient modifiable
 *       des qu'il est etoile, puisqu'il rejoint « A l'affiche » et son bouton
 *       « Modifier ». Ne pas repeter que « l'app ne sait pas changer un prix ».
 *
 *     - Les LIBELLES CITES entre guillemets, interpoles depuis la cle reellement
 *       rendue et jamais recopies : les versions anglaise et italienne
 *       renvoyaient vers « My partner space » / « Il mio spazio partner » quand
 *       le Profil affiche « My partner area » / « La mia area partner ».
 *
 *     - Ce qui n'est VRAI QU'ENSUITE. Une commande entre dans l'onglet
 *       « En livraison » des qu'elle est marquee prete, donc AVANT qu'un livreur
 *       l'ait prise : 5 des 6 commandes en livraison de la base n'ont pas encore
 *       de livreur. La visite dit « des qu'un livreur la prend », pas « vous y
 *       voyez le livreur ».
 */

// ---------------------------------------------------------------------------
// Les cinq etapes
// ---------------------------------------------------------------------------

type Etape = {
  zone: NomZone;
  /** Racine des clés i18n : `visitePro.<cle>Titre` / `<cle>Texte`. */
  cle: string;
  /** La commande d'exemple n'a de sens qu'à l'étape « Commandes ». */
  exemple?: boolean;
};

const ETAPES: Etape[] = [
  { zone: 'commandes', cle: 'commandes', exemple: true },
  { zone: 'livraison', cle: 'livraison' },
  { zone: 'historique', cle: 'historique' },
  { zone: 'reglages', cle: 'reglages' },
  { zone: 'bascule', cle: 'bascule' },
];

// ---------------------------------------------------------------------------
// Mouvement réduit
// ---------------------------------------------------------------------------

/**
 * Respect de « Réduire les animations » (iOS/Android) et de
 * `prefers-reduced-motion` (web, via react-native-web). Quand c'est actif : pas
 * de fondu à l'ouverture, pas de transition entre les étapes, et le contour ne
 * pulse pas — il s'affiche à pleine opacité.
 */
function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => vivant && setReduit(v))
      .catch(() => undefined);
    let abonnement: { remove: () => void } | undefined;
    try {
      abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    } catch {
      /* plateforme sans notification de changement : la valeur initiale suffit */
    }
    return () => {
      vivant = false;
      abonnement?.remove();
    };
  }, []);
  return reduit;
}

// ---------------------------------------------------------------------------
// La visite
// ---------------------------------------------------------------------------

export function VisiteGuidee({
  visible,
  onFermer,
}: {
  visible: boolean;
  /** `memoriser` = ne plus proposer la visite d'elle-même à ce compte. */
  onFermer: (memoriser: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const reduit = useMouvementReduit();
  const zones = useVisiteGuidee((s) => s.zones);

  /**
   * Libelle EXACT de la ligne de retour, dans le Profil. Cite par la derniere
   * etape, il doit venir de la cle que le Profil rend vraiment : recopie a la
   * main, il s'etait deja desynchronise en anglais et en italien. Et le Profil
   * ne montre « Mon espace partenaire » qu'a un restaurateur SEUL — avec un role
   * livreur actif en plus, la ligne devient « Mes espaces professionnels ».
   */
  const roles = useSession((s) => s.session?.roles);
  const cleLienProfil = roles?.some((r) => r.role === 'livreur' && r.status === 'active')
    ? 'profile.proChooseLabel'
    : 'profile.proRestaurantLabel';

  const [index, setIndex] = useState(0);
  const [memoriser, setMemoriser] = useState(true);

  // Chaque ouverture repart de la première étape, case recochée.
  useEffect(() => {
    if (visible) {
      setIndex(0);
      setMemoriser(true);
    }
  }, [visible]);

  const etape = ETAPES[index];
  const derniere = index === ETAPES.length - 1;
  const cible = zones[etape.zone];

  // La bulle se place SOUS la cible quand celle-ci occupe la moitié haute de
  // l'écran (le bouton « App client » de l'en-tête), au-dessus sinon (les
  // onglets, en bas). Elle ne recouvre donc jamais ce qu'elle explique.
  const sousLaCible = !!cible && cible.y + cible.hauteur / 2 < hauteurEcran / 2;

  // Fondu + léger glissement à chaque changement d'étape.
  const apparition = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduit) {
      apparition.setValue(1);
      return;
    }
    apparition.setValue(0);
    Animated.timing(apparition, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [index, reduit, apparition]);

  // Halo respirant autour du contour — c'est lui qui attire l'œil vers la cible.
  const halo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible || reduit) {
      halo.setValue(1);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(halo, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [visible, reduit, halo]);

  function suivant() {
    if (derniere) onFermer(memoriser);
    else setIndex((i) => i + 1);
  }

  return (
    <Modal
      visible={visible}
      transparent
      // ⚠️ `statusBarTranslucent` : sans lui, la fenêtre de la modale démarre
      // SOUS la barre d'état sur Android, alors que `measureInWindow` compte
      // depuis le haut de la fenêtre. Tous les contours seraient décalés vers le
      // bas de la hauteur de la barre d'état.
      statusBarTranslucent
      animationType={reduit ? 'none' : 'fade'}
      onRequestClose={() => onFermer(true)}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* -------------------------------------------------- Voile + contour */}
        {cible ? (
          <>
            {/* Quatre bandes AUTOUR de la cible : elle reste pleinement lisible. */}
            <View style={[styles.voile, { left: 0, right: 0, top: 0, height: Math.max(cible.y, 0) }]} />
            <View
              style={[
                styles.voile,
                { left: 0, right: 0, top: cible.y + cible.hauteur, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.voile,
                { left: 0, width: Math.max(cible.x, 0), top: cible.y, height: cible.hauteur },
              ]}
            />
            <View
              style={[
                styles.voile,
                {
                  left: cible.x + cible.largeur,
                  right: 0,
                  top: cible.y,
                  height: cible.hauteur,
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  left: cible.x - 6,
                  top: cible.y - 6,
                  width: cible.largeur + 12,
                  height: cible.hauteur + 12,
                  opacity: halo,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.contour,
                { left: cible.x, top: cible.y, width: cible.largeur, height: cible.hauteur },
              ]}
            />
          </>
        ) : (
          // Repli : la cible n'a pas encore été mesurée (premier rendu). On
          // assombrit tout plutôt que d'afficher un contour à un mauvais endroit.
          <View style={[styles.voile, { left: 0, right: 0, top: 0, bottom: 0 }]} />
        )}

        {/* --------------------------------------------------------- Contenu */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Cale au-dessus de la bulle : hauteur fixe quand la bulle passe SOUS
              la cible, élastique sinon (c'est cet espace qui reçoit l'exemple). */}
          {sousLaCible ? (
            <View pointerEvents="none" style={{ height: cible!.y + cible!.hauteur + 14 }} />
          ) : (
            <View style={styles.zoneExemple} pointerEvents="box-none">
              {etape.exemple ? <CommandeExemple margeHaute={insets.top + 14} /> : null}
            </View>
          )}

          <Animated.View
            style={[
              styles.bulle,
              {
                opacity: apparition,
                transform: [
                  {
                    translateY: apparition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [sousLaCible ? -10 : 10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.bulleEntete}>
              <View style={styles.points}>
                {ETAPES.map((_, i) => (
                  <View key={i} style={[styles.point, i === index && styles.pointActif]} />
                ))}
              </View>
              <Text style={styles.compteur}>
                {t('visitePro.etape', { n: index + 1, total: ETAPES.length })}
              </Text>
            </View>

            <Text style={styles.titre}>{t(`visitePro.${etape.cle}Titre`)}</Text>
            <Text style={styles.texte}>
              {t(`visitePro.${etape.cle}Texte`, { lien: t(cleLienProfil) })}
            </Text>

            {derniere ? (
              <Pressable
                onPress={() => setMemoriser((v) => !v)}
                style={styles.caseLigne}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: memoriser }}
                accessibilityLabel={t('visitePro.nePlusAfficher')}
                hitSlop={6}
              >
                <View style={[styles.case, memoriser && styles.caseCochee]}>
                  {memoriser ? <Icon name="check" size={14} color={colors.white} /> : null}
                </View>
                <Text style={styles.caseTexte}>{t('visitePro.nePlusAfficher')}</Text>
              </Pressable>
            ) : (
              /*
                ⚠️ SANS CETTE LIGNE, L'ÉCRAN MENT PAR OMISSION.

                « Fermer la visite » mémorise SUR-LE-CHAMP, à n'importe quelle
                étape — c'est l'arbitrage voulu (se represser la visite un soir de
                service serait pire que rien). Mais la case « Ne plus afficher »
                n'apparaît qu'à la DERNIÈRE étape, et sa seule existence enseigne
                le contraire : « je ferme sans cocher, donc elle reviendra ». Le
                cas est concret — une vraie commande arrive pendant la visite, il
                ferme pour la servir, il ne la revoit jamais ; et le repêchage lui
                est présenté à l'étape 4, celle qu'il n'a pas vue.

                On ne change donc pas le comportement, on cesse de le cacher. La
                ligne ne vit que sur les étapes 1 à 4, là où la case est absente :
                la bulle ne dépasse jamais la hauteur qu'elle atteint déjà à
                l'étape 5, dont la mise en page est déjà éprouvée.

                Le libellé « Découvrir votre espace » est INTERPOLÉ depuis la clé
                que l'écran Réglages rend vraiment, jamais recopié (piège déjà payé
                en anglais et en italien sur « Mon espace partenaire »).
              */
              <Text style={styles.noteFermer}>
                {t('visitePro.fermerNote', { revoir: t('visitePro.revoirTitre') })}
              </Text>
            )}

            {/* Fermeture possible à TOUTE étape, et logée dans la bulle : une
                croix flottante viendrait forcément buter, selon l'étape, sur le
                badge « Espace partenaire » ou sur le bouton « App client » —
                les deux coins hauts sont pris. */}
            <View style={styles.pied}>
              <Pressable
                onPress={() => onFermer(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('visitePro.fermer')}
              >
                <Text style={styles.lienFermer}>{t('visitePro.fermer')}</Text>
              </Pressable>
              <Button
                label={derniere ? t('visitePro.terminer') : t('visitePro.suivant')}
                iconRight={derniere ? undefined : 'arrow_forward'}
                onPress={suivant}
                style={{ flex: 1 }}
              />
            </View>
          </Animated.View>

          {/* Cale sous la bulle : élastique quand la bulle est déjà collée sous
              une cible du haut, calée sur la cible quand celle-ci est en bas. */}
          {sousLaCible ? (
            <View pointerEvents="none" style={{ flex: 1 }} />
          ) : (
            <View
              pointerEvents="none"
              style={{ height: Math.max(hauteurEcran - (cible?.y ?? hauteurEcran) + 14, 0) }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// La commande d'exemple
// ---------------------------------------------------------------------------

/**
 * Carte de commande de DEMONSTRATION, rendue par le composant réel.
 *
 * ⚠️ Rien de tout ça n'est écrit en base : c'est un objet en mémoire, qui
 * disparaît avec la visite.
 *
 * Les frais de livraison, eux, sont LUS en base. Ils valent 10 000 Ar
 * aujourd'hui et ne vivent que dans `restaurants.delivery_fee` — les figer ici
 * ferait mentir la démonstration le jour où le tarif bougera. Le reste (deux
 * plats, un client) est du décor assumé, annoncé par le badge « Exemple ».
 */
function CommandeExemple({ margeHaute }: { margeHaute: number }) {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const [fraisLivraison, setFraisLivraison] = useState<number | null>(null);
  /**
   * ⚠️ Sans cet etat, un reseau coupe faisait tourner l'indicateur INDEFINIMENT :
   * `fraisLivraison` restait null et la premiere etape n'affichait qu'une roue.
   * A Nosy Be la liaison tombe ; on renonce alors a l'exemple et on laisse la
   * bulle seule, qui explique deja l'etape. Mieux vaut pas d'exemple qu'un
   * chargement qui n'aboutit jamais.
   */
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (!session?.restaurantId) {
      setEchec(true);
      return;
    }
    setEchec(false);
    getMyRestaurant(session.restaurantId)
      .then((r) => {
        if (!vivant) return;
        if (r) setFraisLivraison(r.deliveryFee);
        else setEchec(true);
      })
      .catch(() => vivant && setEchec(true));
    return () => {
      vivant = false;
    };
  }, [session?.restaurantId]);

  if (echec) return null;

  if (fraisLivraison === null) {
    return (
      <View style={styles.exempleAttente}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  const sousTotal = 2 * 22000 + 8000;
  const commande: Order = {
    id: 'exemple',
    orderNumber: 'TF-000',
    restaurantId: session?.restaurantId ?? 'exemple',
    restaurantName: session?.restaurantName ?? '',
    restaurantInitials: '',
    clientName: t('visitePro.exempleClient'),
    items: [
      { productId: 'exemple-1', name: t('visitePro.exemplePlat1'), quantity: 2, unitPrice: 22000 },
      {
        productId: 'exemple-2',
        name: t('visitePro.exemplePlat2'),
        quantity: 1,
        unitPrice: 8000,
        options: [
          { optionId: null, name: t('visitePro.exempleOption'), priceDelta: 0, quantity: 1 },
        ],
      },
    ],
    subtotal: sousTotal,
    packagingFee: 0,
    deliveryFee: fraisLivraison,
    promoDiscount: 0,
    total: sousTotal + fraisLivraison,
    paymentMethod: 'especes',
    paymentStatus: 'non_requis',
    status: 'recue',
    // Nom de quartier : une donnée, jamais traduite (cf. règle i18n du projet).
    addressLabel: 'Hell-Ville',
    addressDetail: t('visitePro.exempleDetail'),
    createdLabel: t('visitePro.exempleHeure'),
    // Coordonnées de Hell-Ville : la puce « Itinéraire » apparaît, au lieu du
    // message rouge « Position GPS manquante » qui enseignerait le contraire de
    // ce qu'il verra sur une vraie commande.
    mapsUrl: getMapsNavigationUrl(-13.4048, 48.2661),
    clientPhone: '+261 32 00 00 000',
  };

  return (
    // Dégage la barre d'état et la croix de fermeture, posée juste au-dessus.
    <View style={[styles.exempleCadre, { marginTop: margeHaute }]}>
      {/*
        ⚠️ LE PANNEAU « EXEMPLE » EST ÉPINGLÉ HORS DU ScrollView, ET C'EST TOUT
        L'INTÉRÊT.

        Sur un écran de 667 pt (iPhone SE 2/3, iPhone 8 — et le mode compatibilité
        iPhone dans lequel le relecteur Apple teste sur iPad), la carte réclame plus
        de hauteur que la zone ne lui en laisse : il faut faire défiler pour
        atteindre « Refuser » / « Accepter », les deux boutons que la bulle explique
        mot pour mot. Tant que cette légende défilait AVEC la carte, ce geste la
        chassait de l'écran — il restait une commande #TF-000 d'apparence
        parfaitement réelle, dont les boutons ne font rien. Épinglée, la mention
        « Cette commande n'existe pas » reste lisible quelle que soit la position du
        défilement. À 812 pt rien ne défile et le rendu est inchangé.

        Le panneau est opaque : la carte flotte au-dessus de l'en-tête assombri,
        dont le titre transparaîtrait sinon sous cette légende.
      */}
      <View style={styles.exempleEntete}>
        <View style={styles.exempleBadge}>
          <Icon name="visibility" size={13} color={colors.ink} />
          <Text style={styles.exempleBadgeTexte}>{t('visitePro.exempleBadge')}</Text>
        </View>
        <Text style={styles.exempleNote}>{t('visitePro.exempleNote')}</Text>
      </View>

      <ScrollView
        // `flex: 1` explicite : sans lui, la ScrollView se dimensionne sur son
        // contenu et déborde du cadre au lieu de défiler dedans.
        style={styles.exempleDefilement}
        contentContainerStyle={styles.exempleContenu}
        // Affichée, contrairement au reste de l'app : ici, rien d'autre ne laisse
        // deviner qu'il faut défiler pour voir les deux boutons dont parle la bulle.
        showsVerticalScrollIndicator
      >
        {/* `pointerEvents="none"` : la carte est une vitrine. Sans ça, la puce
            « Itinéraire » ouvrirait vraiment Google Maps et le numéro lancerait un
            appel, en pleine visite. Les gestes traversent jusqu'à la ScrollView,
            qui reste donc défilable sur un petit écran. */}
        <View pointerEvents="none">
          <RestaurantOrderCard
            order={commande}
            footer={
              <View style={styles.exempleActions}>
                <Button
                  label={t('visitePro.exempleRefuser')}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button label={t('visitePro.exempleAccepter')} icon="check" style={{ flex: 1.3 }} />
              </View>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  voile: { position: 'absolute', backgroundColor: 'rgba(16,12,10,0.72)' },
  // Contour FIN, jamais un aplat : la cible doit rester lisible sous le repère.
  contour: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.lg,
  },
  halo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.card,
  },
  zoneExemple: { flex: 1, minHeight: 0 },
  exempleAttente: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // La marge horizontale est portée par le CADRE, pas par le contenu défilant :
  // la légende épinglée et la carte doivent rester alignées au pixel près.
  exempleCadre: { flex: 1, minHeight: 0, paddingHorizontal: spacing.screen },
  exempleDefilement: { flex: 1, minHeight: 0 },
  exempleContenu: { paddingBottom: 12 },
  exempleEntete: {
    backgroundColor: 'rgba(10,7,5,0.92)',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
  },
  exempleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginBottom: 8,
  },
  exempleBadgeTexte: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  exempleNote: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.86)',
  },
  exempleActions: { flexDirection: 'row', gap: 10 },
  bulle: {
    marginHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 18,
    ...shadow.floating,
  },
  bulleEntete: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  points: { flexDirection: 'row', gap: 5, flex: 1 },
  point: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.border },
  pointActif: { backgroundColor: colors.primary, width: 18 },
  compteur: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textMuted },
  titre: { fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.4, color: colors.ink },
  texte: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textDark,
    marginTop: 6,
  },
  caseLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  case: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseCochee: { backgroundColor: colors.primary, borderColor: colors.primary },
  caseTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.textDark },
  noteFermer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 12,
  },
  pied: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  lienFermer: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
});
