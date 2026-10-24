import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '../components/Icon';
import { compteConnecte } from '../distripro/api';
import { dp } from '../distripro/contexte';
import { EcranCatalogue } from '../distripro/ecrans/Catalogue';

export default function Accueil() {
  const router = useRouter();
  const { rayon } = useLocalSearchParams<{ rayon?: string }>();
  const [nom, setNom] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { compteConnecte().then((c) => setNom(c?.nom ?? null)); }, []));
  return (
    <EcranCatalogue
      sousTitre={nom ? `Connecté : ${nom}` : 'Emballages, frites et légumes, livrés à Nosy Be'}
      rayonInitial={rayon ?? null}
      droiteEnPlus={
        <Pressable onPress={() => router.push('/connexion')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Mon compte" hitSlop={6}>
          <Icon name={nom ? 'account_circle' : 'login'} size={22} color={dp.blanc} />
        </Pressable>
      }
    />
  );
}
