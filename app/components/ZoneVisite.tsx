import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { NomZone, useVisiteGuidee } from '../store/visiteGuidee';

type Marge = { haut?: number; bas?: number; gauche?: number; droite?: number };

/**
 * Enveloppe un élément que la visite guidée de l'espace partenaire désignera,
 * et publie sa position en coordonnées FENÊTRE dans `store/visiteGuidee`.
 *
 * Dans un fichier à part, et pas dans `VisiteGuidee.tsx` : les deux appelants
 * sont la barre d'onglets et l'en-tête partenaire, montés sur tous les écrans
 * pro. Les faire dépendre de la visite entière — donc de la carte de commande
 * d'exemple et de `data/api` — n'apporterait rien et rapprocherait le graphe
 * d'imports d'un cycle.
 *
 * `marge` élargit la mise en évidence au-delà de l'élément mesuré. C'est
 * indispensable pour les onglets : on ne peut mesurer que l'ICÔNE (24 px),
 * alors que la cellule d'onglet occupe un quart de la largeur et porte son
 * intitulé juste en dessous. Sans marge, le contour serrerait une icône et
 * laisserait le mot « Historique » dans l'ombre.
 */
export function ZoneVisite({
  nom,
  marge,
  children,
}: {
  nom: NomZone;
  marge?: Marge;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  const signalerZone = useVisiteGuidee((s) => s.signalerZone);
  const { width: largeurFenetre, height: hauteurFenetre } = useWindowDimensions();

  const mesurer = useCallback(() => {
    // `requestAnimationFrame` : mesurer depuis le `onLayout` lui-même renvoie
    // des zéros sur Android tant que la vue n'est pas posée dans sa fenêtre.
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, largeur, hauteur) => {
        if (!largeur || !hauteur) return;
        signalerZone(nom, {
          x: x - (marge?.gauche ?? 0),
          y: y - (marge?.haut ?? 0),
          largeur: largeur + (marge?.gauche ?? 0) + (marge?.droite ?? 0),
          hauteur: hauteur + (marge?.haut ?? 0) + (marge?.bas ?? 0),
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nom, signalerZone, marge?.gauche, marge?.droite, marge?.haut, marge?.bas]);

  /**
   * ⚠️ `onLayout` NE SUFFIT PAS, et le défaut est visible.
   *
   * On publie des coordonnées de FENÊTRE, alors qu'`onLayout` ne se déclenche que
   * si la vue bouge DANS SON PARENT. Quand la fenêtre change de hauteur sans que
   * la barre d'onglets change de taille — fenêtre du navigateur redimensionnée sur
   * taxifood.distripro207.com, Split View de l'iPad, apparition du clavier —, la
   * position en fenêtre bouge et personne ne le dit : la visite dessine alors son
   * contour dans le vide, au-dessus de l'onglet, qui reste lui dans l'ombre.
   * Constaté en navigateur en passant de 360×640 à 375×667, visite ouverte.
   */
  useEffect(() => {
    mesurer();
  }, [largeurFenetre, hauteurFenetre, mesurer]);

  // `collapsable={false}` : sans lui, Android fusionne cette vue sans style avec
  // son parent, et la ref ne désigne plus rien à mesurer.
  return (
    <View ref={ref} collapsable={false} onLayout={mesurer}>
      {children}
    </View>
  );
}
