import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FilConversation } from '../../components/FilConversation';
import {
  deposerPhotoMessage,
  envoyerMessage,
  estRoleMessagerie,
  lireConversation,
  RoleMessagerie,
} from '../../data/messagerie';

/**
 * Conversation d'une commande (2026-10-13) : client, livreur, restaurant et Taxi Food.
 * `role` dit EN TANT QUE QUI on parle — la base le vérifie. L'affichage, la traduction et
 * le temps réel vivent dans `FilConversation`.
 */
const RAPIDES: Record<RoleMessagerie, string[]> = {
  client: ['rapideClient1', 'rapideClient2', 'rapideClient3'],
  livreur: ['rapideLivreur1', 'rapideLivreur2', 'rapideLivreur3', 'rapideLivreur4'],
  restaurant: ['rapideResto1', 'rapideResto2', 'rapideResto3'],
  admin: [],
};

export default function ConversationCommandeScreen() {
  const params = useLocalSearchParams<{ id: string; role?: string }>();
  const id = params.id!;
  const role: RoleMessagerie = estRoleMessagerie(params.role) ? params.role : 'client';
  const router = useRouter();
  const { t } = useTranslation();
  const nomRole = (r: RoleMessagerie) => t(`messagerie.role.${r}`);

  return (
    <FilConversation
      titreParDefaut={t('messagerie.titreCourt')}
      canal={`commande:${id}`}
      charger={async (depuis) => {
        const c = await lireConversation(id, role, depuis);
        const sousTitre = [
          c.participants.client ? `${c.participants.client} (${nomRole('client')})` : null,
          c.participants.livreur ? `${c.participants.livreur} (${nomRole('livreur')})` : null,
          c.participants.restaurant,
        ]
          .filter(Boolean)
          .join(' · ');
        return { peutEcrire: c.peutEcrire, messages: c.messages, titre: t('messagerie.titre', { numero: c.orderNumber }), sousTitre };
      }}
      envoyer={(texte, photo) => envoyerMessage(id, role, texte, photo)}
      deposerPhoto={(uri, mime) => deposerPhotoMessage(id, uri, mime)}
      rapides={RAPIDES[role].map((cle) => t(`messagerie.${cle}`))}
      vide={t(`messagerie.vide.${role}`)}
      quiLit={t('messagerie.quiLit')}
      fermee={t('messagerie.fermee')}
      concerne={(data) => data.orderId === id}
      onRetour={() => (router.canGoBack() ? router.back() : router.replace(role === 'client' ? `/order/${id}` : '/'))}
    />
  );
}
