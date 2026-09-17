import { FontAwesome } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mesurer } from '../lib/mesure';

/**
 * Bulle WhatsApp flottante : le client écrit à Taxi Food en un tap, comme sur le site
 * Rentanoo. Même numéro et même message que la bulle de la vitrine
 * (`landing/js/bulle-whatsapp.js`) — décision du porteur du projet, 2026-09-17.
 *
 * ⚠️ `wa.me` et pas `whatsapp://` : il ouvre l'application si elle est installée, et
 * WhatsApp Web sinon. Le schéma natif ne fait RIEN sans l'application, en silence.
 *
 * ⚠️ Posée seulement sur les écrans CLIENT où elle ne masque aucune action : onglets
 * Accueil / Commandes / Profil, et page restaurant (au-dessus du bouton panier). Jamais
 * sur Panier, Adresse, Paiement ni dans les espaces pro : elle y couvrirait le bouton
 * qui valide.
 *
 * `bas` : distance au bas de l'écran, que l'écran calcule (barre d'onglets, bouton
 * panier flottant) — la bulle ne peut pas deviner ce qu'il y a sous elle.
 */
export const WHATSAPP_TAXI_FOOD = '261361574521';

export function BulleWhatsApp({ bas }: { bas: number }) {
  const { t } = useTranslation();
  const ouvrir = () => {
    mesurer('contact-whatsapp', { origine: 'bulle' });
    const url = `https://wa.me/${WHATSAPP_TAXI_FOOD}?text=${encodeURIComponent(t('bulleWhatsApp.message'))}`;
    void Linking.openURL(url).catch(() => {});
  };
  return (
    <Pressable
      onPress={ouvrir}
      style={({ pressed }) => [styles.bulle, { bottom: bas }, pressed && { opacity: 0.85 }]}
      hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={t('bulleWhatsApp.label')}
    >
      <FontAwesome name="whatsapp" size={30} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bulle: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 50,
  },
});
