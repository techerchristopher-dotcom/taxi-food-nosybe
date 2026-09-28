/**
 * Ce qu'on écrit sous un restaurant fermé : « Ouvre dans 35 min », « Ouvre à 19h »,
 * « Ouvre demain à 10h », ou « Fermé ».
 *
 * UNE règle pour la carte restaurant ET les plats du jour : deux libellés écrits
 * séparément finissent par se contredire sur le même écran d'accueil.
 *
 * ⚠️ `opensAt` / `opensInDays` viennent de la base (`ouvre_a`, `ouvre_dans_jours`),
 * qui ignore les services déjà passés — c'est elle qui a corrigé « Ouvre à 12h »
 * affiché à 18 h 20 pour un service du soir à 19 h. Ici on ne décide RIEN de
 * l'état ouvert/fermé : `isOpen` reste le verdict de la base. Le compte à rebours
 * est le seul calcul fait sur l'appareil, et il est cosmétique : si l'horloge du
 * téléphone est fausse au point d'inverser le sens, on retombe sur « Ouvre à 19h »,
 * jamais sur un nombre négatif.
 *
 * ⚠️ Au-delà de demain on ne nomme PAS le jour (sept noms × trois langues pour un
 * cas qui n'arrive qu'au lendemain d'un jour de repos) : « Fermé », et c'est tout —
 * demandé tel quel par le porteur du projet le 2026-09-28 : « si c'est son jour de
 * fermeture on laisse ainsi ».
 */
import { formatTime } from '../data/types';

export const FUSEAU_NOSY_BE = 'Indian/Antananarivo';

/** En dessous, on compte les minutes plutôt que d'annoncer l'heure. */
export const SEUIL_COMPTE_A_REBOURS_MIN = 60;

export type EtatOuverture = {
  isOpen: boolean;
  /** 'HH:MM[:SS]', ou null : fermeture manuelle, ou rien sous sept jours. */
  opensAt: string | null;
  /** 0 = aujourd'hui, 1 = demain… null quand la base ne promet rien. */
  opensInDays: number | null;
};

/** Minutes écoulées depuis minuit À NOSY BE, quel que soit le fuseau du téléphone. */
export function minutesNosyBe(maintenant: Date = new Date()): number {
  try {
    const parties = new Intl.DateTimeFormat('en-GB', {
      timeZone: FUSEAU_NOSY_BE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(maintenant);
    const h = Number(parties.find((p) => p.type === 'hour')?.value);
    const m = Number(parties.find((p) => p.type === 'minute')?.value);
    if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
  } catch {
    // Intl sans fuseaux (vieux moteur) : l'heure locale, faute de mieux.
  }
  return maintenant.getHours() * 60 + maintenant.getMinutes();
}

/**
 * Minutes d'ici « HH:MM » aujourd'hui, à Nosy Be. Null si l'heure est déjà
 * passée (ou illisible) : l'appelant annonce alors l'heure, pas un délai.
 */
export function minutesAvant(heure: string, maintenant: Date = new Date()): number | null {
  const [h, m] = heure.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const delta = h * 60 + m - minutesNosyBe(maintenant);
  return delta > 0 ? delta : null;
}

export function libelleOuverture(
  e: EtatOuverture,
  t: (cle: string, options?: Record<string, unknown>) => string,
  maintenant: Date = new Date(),
): string {
  if (e.isOpen) return '';
  if (!e.opensAt) return t('restaurantCard.closed');
  if (e.opensInDays === 0) {
    const min = minutesAvant(e.opensAt, maintenant);
    if (min !== null && min <= SEUIL_COMPTE_A_REBOURS_MIN) {
      return t('restaurantCard.opensIn', { min });
    }
    return t('restaurantCard.opensAt', { time: formatTime(e.opensAt) });
  }
  if (e.opensInDays === 1) return t('platsDuJour.opensTomorrow', { time: formatTime(e.opensAt) });
  return t('restaurantCard.closed');
}
