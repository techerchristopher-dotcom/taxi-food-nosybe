'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 🥤 Vente additionnelle (2026-10-22) — la part des commandes LIVRÉES qui contiennent une
 * boisson ou un dessert, par restaurant, avant et après la mise en avant dans l'app
 * (fenêtre « Une boisson avec ça ? » après l'ajout d'un plat, rangée au panier, rappel au
 * récapitulatif — publiée le 22/10).
 *
 * Source : `admin_vente_additionnelle(p_semaines)` (is_admin, sinon 42501), une ligne par
 * restaurant et par semaine. Montants = plats/boissons/desserts SANS emballage ni consigne.
 */

const LANCEMENT = '2026-10-22';

type Ligne = {
  restaurant_id: string;
  restaurant: string;
  semaine: string;
  nb_commandes: number;
  nb_avec_boisson: number;
  nb_avec_dessert: number;
  ca_plats: number;
  ca_boissons: number;
  ca_desserts: number;
};

type Agregat = { cmd: number; boisson: number; dessert: number; plats: number; boissons: number; desserts: number };

const vide = (): Agregat => ({ cmd: 0, boisson: 0, dessert: 0, plats: 0, boissons: 0, desserts: 0 });

function ajouter(a: Agregat, l: Ligne) {
  a.cmd += l.nb_commandes;
  a.boisson += l.nb_avec_boisson;
  a.dessert += l.nb_avec_dessert;
  a.plats += Number(l.ca_plats);
  a.boissons += Number(l.ca_boissons);
  a.desserts += Number(l.ca_desserts);
}

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((100 * n) / d)} %`;
}

function ar(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} Ar`;
}

function jj(d: string): string {
  const [, m, j] = d.split('-');
  return `${j}/${m}`;
}

export function VenteAdditionnelle() {
  const [semaines, setSemaines] = useState(12);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    setLignes(null);
    const { data, error } = await supabase.rpc('admin_vente_additionnelle', { p_semaines: semaines });
    if (error) { setErreur(error.message); return; }
    setLignes((data ?? []) as Ligne[]);
  }, [semaines]);

  useEffect(() => { void charger(); }, [charger]);

  // Avant / après le lancement, tous restaurants et par restaurant. La semaine du lancement
  // (lundi 19/10) est comptée « après » : elle contient le jour de mise en ligne.
  const lundiLancement = '2026-10-19';
  const { avant, apres, parResto, parSemaine } = useMemo(() => {
    const avant = vide();
    const apres = vide();
    const parResto = new Map<string, { nom: string; avant: Agregat; apres: Agregat }>();
    const parSemaine = new Map<string, Agregat>();
    for (const l of lignes ?? []) {
      const apresLancement = l.semaine >= lundiLancement;
      ajouter(apresLancement ? apres : avant, l);
      const r = parResto.get(l.restaurant_id) ?? { nom: l.restaurant, avant: vide(), apres: vide() };
      ajouter(apresLancement ? r.apres : r.avant, l);
      parResto.set(l.restaurant_id, r);
      const s = parSemaine.get(l.semaine) ?? vide();
      ajouter(s, l);
      parSemaine.set(l.semaine, s);
    }
    return {
      avant,
      apres,
      parResto: [...parResto.values()].sort((a, b) => b.avant.cmd + b.apres.cmd - (a.avant.cmd + a.apres.cmd)),
      parSemaine: [...parSemaine.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    };
  }, [lignes]);

  const total = vide();
  for (const l of lignes ?? []) ajouter(total, l);

  return (
    <>
      <div className="stat-row">
        <div className="stat"><div className="label">Commandes livrées</div><div className="value">{lignes ? total.cmd : '…'}</div></div>
        <div className="stat"><div className="label">Avec boisson — avant le {jj(LANCEMENT)}</div><div className="value">{lignes ? pct(avant.boisson, avant.cmd) : '…'}</div></div>
        <div className="stat"><div className="label">Avec boisson — depuis</div><div className="value">{lignes ? pct(apres.boisson, apres.cmd) : '…'}</div></div>
        <div className="stat"><div className="label">Boissons + desserts vendus</div><div className="value">{lignes ? ar(total.boissons + total.desserts) : '…'}</div></div>
      </div>

      <div className="card">
        <h2>🥤 Vente additionnelle</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Part des commandes livrées qui contiennent au moins une boisson (ou un dessert). Depuis le {jj(LANCEMENT)},
          l&apos;app propose les boissons juste après l&apos;ajout d&apos;un plat, au panier et avant le paiement.
          Montants sans emballage ni consigne. Taxi Be (tests) exclu.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label className="muted" style={{ fontSize: 13 }}>
            Période :{' '}
            <select value={semaines} onChange={(e) => setSemaines(Number(e.target.value))} style={{ fontSize: 14, padding: 4 }}>
              <option value={4}>4 semaines</option>
              <option value={12}>12 semaines</option>
              <option value={26}>6 mois</option>
              <option value={52}>1 an</option>
            </select>
          </label>
          <button className="btn ghost" onClick={() => void charger()}>Rafraîchir</button>
        </div>
        {erreur ? <div style={{ color: 'var(--red)' }}>{erreur}</div> : null}
        {lignes === null && !erreur ? <div className="muted">Chargement…</div> : null}
        {lignes && lignes.length === 0 ? <div className="muted">Aucune commande livrée sur la période.</div> : null}

        {parResto.length > 0 ? (
          <>
            <h3 style={{ marginTop: 6 }}>Par restaurant, avant / depuis le {jj(LANCEMENT)}</h3>
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th className="num">Cmd avant</th><th className="num">Boisson avant</th>
                  <th className="num">Cmd depuis</th><th className="num">Boisson depuis</th>
                  <th className="num">Dessert depuis</th><th className="num">Boissons vendues</th><th className="num">Desserts vendus</th>
                </tr>
              </thead>
              <tbody>
                {parResto.map((r) => (
                  <tr key={r.nom}>
                    <td data-label="Restaurant">{r.nom}</td>
                    <td className="num" data-label="Commandes avant">{r.avant.cmd}</td>
                    <td className="num" data-label="Avec boisson avant">{pct(r.avant.boisson, r.avant.cmd)}</td>
                    <td className="num" data-label="Commandes depuis">{r.apres.cmd}</td>
                    <td className="num" data-label="Avec boisson depuis" style={{ fontWeight: 600 }}>{pct(r.apres.boisson, r.apres.cmd)}</td>
                    <td className="num" data-label="Avec dessert depuis">{pct(r.apres.dessert, r.apres.cmd)}</td>
                    <td className="num" data-label="Boissons vendues">{ar(r.avant.boissons + r.apres.boissons)}</td>
                    <td className="num" data-label="Desserts vendus">{ar(r.avant.desserts + r.apres.desserts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ marginTop: 18 }}>Semaine par semaine, tous restaurants</h3>
            <table>
              <thead>
                <tr>
                  <th>Semaine du</th><th className="num">Cmd</th><th className="num">Avec boisson</th>
                  <th className="num">Avec dessert</th><th className="num">Boissons</th><th className="num">Desserts</th>
                  <th className="num">Part du CA</th>
                </tr>
              </thead>
              <tbody>
                {parSemaine.map(([s, a]) => (
                  <tr key={s} style={s >= lundiLancement ? { fontWeight: 600 } : undefined}>
                    <td data-label="Semaine du">{jj(s)}{s === lundiLancement ? ' 🚀' : ''}</td>
                    <td className="num" data-label="Commandes">{a.cmd}</td>
                    <td className="num" data-label="Avec boisson">{pct(a.boisson, a.cmd)}</td>
                    <td className="num" data-label="Avec dessert">{pct(a.dessert, a.cmd)}</td>
                    <td className="num" data-label="Boissons">{ar(a.boissons)}</td>
                    <td className="num" data-label="Desserts">{ar(a.desserts)}</td>
                    <td className="num" data-label="Part du CA">{pct(a.boissons + a.desserts, a.plats + a.boissons + a.desserts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </>
  );
}
