/**
 * Etat de la visite guidee de l'espace partenaire.
 *
 * Deux choses, qui n'ont rien a voir l'une avec l'autre :
 *
 *  - `zones` — ou se trouvent A L'ECRAN les elements que la visite designe. Les
 *    quatre onglets sont dessines par le layout d'onglets, et le bouton
 *    « App client » par l'en-tete : aucun des deux n'appartient a l'ecran qui
 *    joue la visite. Ils se signalent donc eux-memes, en coordonnees FENETRE
 *    (`measureInWindow`), et la visite lit ce registre. Faire descendre des refs
 *    a travers expo-router n'est pas possible ; deviner les positions a partir
 *    de constantes de mise en page le serait, mais casserait au premier
 *    changement de hauteur de barre.
 *
 *  - `demandee` — le bouton « Revoir la visite » vit dans les Reglages, alors
 *    que la visite se joue sur l'ecran Commandes (c'est la que la commande
 *    d'exemple a un sens). Le bouton pose ce drapeau puis change d'onglet ;
 *    l'ecran Commandes le consomme a l'arrivee.
 */
import { create } from 'zustand';

/** Les cinq reperes de la visite, dans l'ordre ou elle les parcourt. */
export type NomZone = 'commandes' | 'livraison' | 'historique' | 'reglages' | 'bascule';

/** Rectangle en coordonnees fenetre, marges de confort deja appliquees. */
export type Zone = { x: number; y: number; largeur: number; hauteur: number };

type VisiteGuideeState = {
  zones: Partial<Record<NomZone, Zone>>;
  signalerZone: (nom: NomZone, zone: Zone) => void;
  /** Une rediffusion a ete demandee depuis les Reglages. */
  demandee: boolean;
  demanderVisite: () => void;
  consommerDemande: () => void;
};

/** Un demi-pixel d'ecart ne vaut pas un rendu : evite les boucles de mesure. */
function memeZone(a: Zone | undefined, b: Zone): boolean {
  return (
    !!a &&
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.largeur - b.largeur) < 1 &&
    Math.abs(a.hauteur - b.hauteur) < 1
  );
}

export const useVisiteGuidee = create<VisiteGuideeState>((set, get) => ({
  zones: {},
  signalerZone: (nom, zone) => {
    if (memeZone(get().zones[nom], zone)) return;
    set((s) => ({ zones: { ...s.zones, [nom]: zone } }));
  },
  demandee: false,
  demanderVisite: () => set({ demandee: true }),
  consommerDemande: () => set({ demandee: false }),
}));
