import { MaterialIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

/**
 * La maquette utilise Material Symbols (noms en snake_case, ex. "location_on").
 * @expo/vector-icons/MaterialIcons attend des noms en kebab-case ("location-on").
 * Ce wrapper convertit automatiquement, pour pouvoir reprendre les noms de la maquette tels quels.
 */
type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export function Icon({
  name,
  size = 22,
  color = '#1A1A1A',
  style,
}: {
  name: string;
  size?: number;
  color?: ComponentProps<typeof MaterialIcons>['color'];
  style?: ComponentProps<typeof MaterialIcons>['style'];
}) {
  const kebab = name.replace(/_/g, '-') as MaterialIconName;
  return <MaterialIcons name={kebab} size={size} color={color} style={style} />;
}
