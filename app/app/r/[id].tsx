import { Redirect, useLocalSearchParams } from 'expo-router';

/** Idem pour un restaurant : `/r/<id>` → écran `/restaurant/<id>`. Voir `app/p/[id].tsx`. */
export default function LienRestaurant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)" />;
  return <Redirect href={{ pathname: '/restaurant/[id]', params: { id } }} />;
}
