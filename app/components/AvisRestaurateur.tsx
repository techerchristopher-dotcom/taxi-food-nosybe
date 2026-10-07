import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Etoiles } from './Etoiles';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { repondreAvis } from '../data/api';
import { AvisRestaurateur as TAvisRestaurateur } from '../data/types';

/** JJ/MM/AAAA sans dépendre d'Intl. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * L'avis d'un client, vu par le restaurateur, sous sa commande dans l'Historique —
 * avec le droit de réponse (publique, 500 caractères, modifiable) et, s'il y en a
 * un, le message PRIVÉ que le client a laissé au restaurant (jamais publié).
 *
 * Textes en français seulement : l'espace partenaire l'est aussi (décision produit).
 * La note affichée en grand est celle du RESTAURANT (cuisine + préparation) ; la
 * livraison est montrée à part, elle ne le juge pas.
 */
export function AvisRestaurateur({ avis, onChange }: { avis: TAvisRestaurateur; onChange: () => void }) {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(avis.reponseRestaurant ?? '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await repondreAvis(avis.id, texte.trim() || null);
      setEdition(false);
      onChange();
    } catch {
      setErreur('La réponse n’a pas pu être enregistrée. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.tete}>
        <Icon name="star" size={18} color={colors.accent} />
        <Text style={styles.titre}>Avis de {avis.prenom}</Text>
        <Text style={styles.date}>{dateCourte(avis.createdAt)}</Text>
      </View>
      {avis.statut === 'masque' ? (
        <Text style={styles.masque}>Masqué par Taxi Food — il n’est plus visible des clients.</Text>
      ) : null}
      <View style={styles.notes}>
        <Etoiles valeur={avis.noteRestaurant} taille={20} />
        <Text style={styles.detail}>
          Cuisine {avis.noteCuisine}/5 · Préparation {avis.notePreparation}/5 · Livraison {avis.noteLivraison}/5
        </Text>
      </View>
      {avis.commentaire ? <Text style={styles.commentaire}>« {avis.commentaire} »</Text> : null}
      {avis.photoUrl ? <Image source={{ uri: avis.photoUrl }} style={styles.photo} contentFit="cover" /> : null}
      {avis.messagePrive ? (
        <View style={styles.prive}>
          <View style={styles.priveTete}>
            <Icon name="lock" size={15} color={colors.textDark} />
            <Text style={styles.priveTitre}>Message privé — le client ne l’a pas publié</Text>
          </View>
          <Text style={styles.priveTexte}>« {avis.messagePrive} »</Text>
          <Text style={styles.priveAide}>Vous seul le lisez (et Taxi Food). Votre réponse publique ne doit pas le citer.</Text>
        </View>
      ) : null}

      {edition ? (
        <View style={{ marginTop: 10 }}>
          <TextInput
            style={styles.champ}
            value={texte}
            onChangeText={setTexte}
            placeholder="Votre réponse, visible de tous les clients"
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <View style={styles.gestes}>
            <Pressable style={styles.btnGhost} onPress={() => { setEdition(false); setTexte(avis.reponseRestaurant ?? ''); }}>
              <Text style={styles.btnGhostTexte}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.btn, envoi && { opacity: 0.5 }]} onPress={enregistrer} disabled={envoi}>
              <Text style={styles.btnTexte}>{avis.reponseRestaurant ? 'Enregistrer' : 'Répondre'}</Text>
            </Pressable>
          </View>
        </View>
      ) : avis.reponseRestaurant ? (
        <View style={styles.reponse}>
          <Text style={styles.reponseLabel}>Votre réponse{avis.reponseLe ? ` · ${dateCourte(avis.reponseLe)}` : ''}</Text>
          <Text style={styles.reponseTexte}>{avis.reponseRestaurant}</Text>
          <Pressable onPress={() => setEdition(true)} hitSlop={6}>
            <Text style={styles.lien}>Modifier</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.btnGhost} onPress={() => setEdition(true)}>
          <Icon name="reply" size={16} color={colors.ink} />
          <Text style={styles.btnGhostTexte}>Répondre publiquement</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titre: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  date: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  masque: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 4 },
  notes: { marginTop: 6, gap: 4 },
  detail: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  commentaire: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 8 },
  prive: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.tile,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    gap: 4,
  },
  priveTete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priveTitre: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.textDark },
  priveTexte: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  priveAide: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  photo: { width: 120, height: 120, borderRadius: radius.tile, marginTop: 8, backgroundColor: colors.fieldBg },
  champ: {
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
  erreur: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 8 },
  gestes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  btn: { height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  btnGhost: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  btnGhostTexte: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  reponse: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.accent, gap: 3 },
  reponseLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted },
  reponseTexte: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDark },
  lien: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary, textDecorationLine: 'underline', marginTop: 2 },
});
