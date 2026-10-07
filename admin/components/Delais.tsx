'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * ⏱️ Délais (2026-10-07) — médianes RÉELLES par restaurant et par tranche horaire, et
 * comparaison avec l'estimation figée donnée au client à la création de la commande.
 *
 * Source : `admin_delais_estime_vs_reel(p_jours)` (is_admin, sinon 42501). Commandes
 * livrées seulement, hors compte admin (tests ET commandes téléphone), hors restaurants
 * masqués, hors commandes de plus de 180 min ; chaque composante aberrante est écartée.
 * Écart = réel − estimé (positif : plus long que prévu). « Dans les temps » = livrée au
 * plus tard 5 min après l'heure annoncée. Les commandes antérieures au 2026-10-07 n'ont
 * pas d'estimation : elles comptent dans le réel, pas dans la comparaison.
 */

type Ligne = {
  restaurant_id: string | null;
  restaurant: string | null;
  tranche: string | null;
  nb_commandes: number;
  prepa_reel_med: number | null;
  attente_reel_med: number | null;
  trajet_reel_med: number | null;
  livraison_reel_med: number | null;
  total_reel_med: number | null;
  nb_estimees: number;
  prepa_estime_med: number | null;
  livraison_estime_med: number | null;
  total_estime_med: number | null;
  ecart_prepa_med: number | null;
  ecart_livraison_med: number | null;
  ecart_total_med: number | null;
  pct_dans_les_temps: number | null;
};

function mn(v: number | null): string {
  return v == null ? '—' : `${Math.round(Number(v))} min`;
}

function ecart(v: number | null): string {
  if (v == null) return '—';
  const n = Math.round(Number(v));
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} min`;
}

export function Delais() {
  const [jours, setJours] = useState(90);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    setLignes(null);
    const { data, error } = await supabase.rpc('admin_delais_estime_vs_reel', { p_jours: jours });
    if (error) { setErreur(error.message); return; }
    setLignes((data ?? []) as Ligne[]);
  }, [jours]);

  useEffect(() => { void charger(); }, [charger]);

  const global = (lignes ?? []).find((l) => l.restaurant_id === null);
  const visibles = (lignes ?? []).filter((l) => l.restaurant_id !== null && (detail || l.tranche === null));

  return (
    <>
      <div className="stat-row">
        <div className="stat"><div className="label">Commandes livrées analysées</div><div className="value">{global?.nb_commandes ?? '…'}</div></div>
        <div className="stat"><div className="label">Durée totale médiane</div><div className="value">{global ? mn(global.total_reel_med) : '…'}</div></div>
        <div className="stat"><div className="label">Avec estimation</div><div className="value">{global?.nb_estimees ?? '…'}</div></div>
        <div className="stat"><div className="label">Livrées dans les temps (± 5 min)</div><div className="value">{global?.pct_dans_les_temps != null ? `${global.pct_dans_les_temps} %` : '—'}</div></div>
      </div>

      <div className="card">
        <h2>⏱️ Délais réels et estimés</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Prépa = commande → prête ; attente = prête → récupérée ; trajet = récupérée → livrée ; total = commande → livrée.
          Écart = réel − estimé (positif : plus long que prévu). Hors compte admin, hors commandes &gt; 180 min.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label className="muted" style={{ fontSize: 13 }}>
            Période :{' '}
            <select value={jours} onChange={(e) => setJours(Number(e.target.value))} style={{ fontSize: 14, padding: 4 }}>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
              <option value={365}>1 an</option>
            </select>
          </label>
          <label className="muted" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Détail par tranche horaire
          </label>
          <button className="btn ghost" onClick={() => void charger()}>Rafraîchir</button>
        </div>
        {erreur ? <div style={{ color: 'var(--red)' }}>{erreur}</div> : null}
        {lignes === null && !erreur ? <div className="muted">Chargement…</div> : null}
        {lignes && visibles.length === 0 ? <div className="muted">Aucune commande livrée sur la période.</div> : null}
        {visibles.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Restaurant</th><th>Tranche</th><th className="num">Cmd</th>
                <th className="num">Prépa</th><th className="num">Attente</th><th className="num">Trajet</th><th className="num">Total</th>
                <th className="num">Estimées</th><th className="num">Total estimé</th>
                <th className="num">Écart prépa</th><th className="num">Écart livraison</th><th className="num">Écart total</th>
                <th className="num">Dans les temps</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={`${l.restaurant_id}-${l.tranche ?? 'tout'}`} style={l.tranche === null ? { fontWeight: 600 } : undefined}>
                  <td data-label="Restaurant">{l.restaurant ?? '—'}</td>
                  <td data-label="Tranche">{l.tranche ? l.tranche.replace(/^\d · /, '') : 'Toutes'}</td>
                  <td className="num" data-label="Commandes">{l.nb_commandes}</td>
                  <td className="num" data-label="Prépa">{mn(l.prepa_reel_med)}</td>
                  <td className="num" data-label="Attente livreur">{mn(l.attente_reel_med)}</td>
                  <td className="num" data-label="Trajet">{mn(l.trajet_reel_med)}</td>
                  <td className="num" data-label="Total">{mn(l.total_reel_med)}</td>
                  <td className="num" data-label="Estimées">{l.nb_estimees}</td>
                  <td className="num" data-label="Total estimé">{mn(l.total_estime_med)}</td>
                  <td className="num" data-label="Écart prépa">{ecart(l.ecart_prepa_med)}</td>
                  <td className="num" data-label="Écart livraison">{ecart(l.ecart_livraison_med)}</td>
                  <td className="num" data-label="Écart total">{ecart(l.ecart_total_med)}</td>
                  <td className="num" data-label="Dans les temps">{l.pct_dans_les_temps != null ? `${l.pct_dans_les_temps} %` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
