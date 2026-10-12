/**
 * Textes des reversements vus par le restaurant (Historique, « Mes versements »).
 * L'espace restaurateur est en français ; ces textes-là suivent `restaurants.langue`
 * (italien pour Les Siciliens), comme leurs messages Telegram de versement.
 */
const FR = {
  reverse: (date: string) => `Reversé le ${date}`,
  ref: 'réf.',
  regle: 'Réglé à la commande',
  aReverser: 'À reverser',
  pourCetteCommande: 'pour cette commande',
  versement: (montant: string, n: number) =>
    `versement de ${montant} pour ${n} commande${n > 1 ? 's' : ''}`,
  voirCalcul: 'Voir le calcul',
  masquerCalcul: 'Masquer le calcul',
  plats: 'Plats',
  emballage: 'Emballage',
  commission: (taux: string) => `Commission Taxi Food (${taux})`,
  offert: 'Offert par vous (code client)',
  total: 'Reversé à vous',
  totalAVenir: 'À vous reverser',
  mesVersements: 'Mes versements',
  mesVersementsTexte: 'Chaque versement de Taxi Food, avec ses commandes.',
  aucunVersement: 'Aucun versement pour l’instant.',
  commandes: (n: number) => `${n} commande${n > 1 ? 's' : ''}`,
  retour: 'Retour',
};

const IT: typeof FR = {
  reverse: (date) => `Versato il ${date}`,
  ref: 'rif.',
  regle: 'Pagato all’ordine',
  aReverser: 'Da versare',
  pourCetteCommande: 'per questo ordine',
  versement: (montant, n) => `versamento di ${montant} per ${n} ordin${n > 1 ? 'i' : 'e'}`,
  voirCalcul: 'Vedi il calcolo',
  masquerCalcul: 'Nascondi il calcolo',
  plats: 'Piatti',
  emballage: 'Imballaggio',
  commission: (taux) => `Commissione Taxi Food (${taux})`,
  offert: 'Offerto da voi (codice cliente)',
  total: 'Versato a voi',
  totalAVenir: 'Da versarvi',
  mesVersements: 'I miei versamenti',
  mesVersementsTexte: 'Ogni versamento di Taxi Food, con i suoi ordini.',
  aucunVersement: 'Nessun versamento per ora.',
  commandes: (n) => `${n} ordin${n > 1 ? 'i' : 'e'}`,
  retour: 'Indietro',
};

export function textesReversement(langue: string | null | undefined) {
  return langue === 'it' ? IT : FR;
}

/** 12/10 en heure de Nosy Be. */
export function dateCourte(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Indian/Antananarivo', day: '2-digit', month: '2-digit' });
  } catch {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

export function pourcent(taux: number): string {
  return `${Math.round(taux * 1000) / 10} %`.replace('.', ',');
}
