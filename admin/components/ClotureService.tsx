'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';

/**
 * 🏁 Clôture de service (2026-10-19), en tête de l'onglet Temps réel.
 *
 * Le bouton fige en base le bilan des commandes passées depuis la clôture précédente
 * (`admin_cloturer_service` → `cloturer_service_core`) et l'envoie dans le groupe Telegram
 * « Taxi Food — Clôtures de service ». S'il reste des commandes en cours, la base refuse
 * d'abord et les liste : on peut alors clôturer quand même (elles figurent « à regarder »).
 * Sans clic, la base clôture seule à 15 h 45 et 22 h 45 (heure de Nosy Be).
 */
type Apercu = {
  commandes: number;
  livrees: number;
  annulees: number;
  en_cours: number;
  facture: number;
  marge: number;
  debut: string;
};
type Cloture = { id: string; service: string; jour: string; mode: string; texte: string; created_at: string };

export function ClotureService() {
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState<{ numero: string; resto: string; statut: string }[] | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [historique, setHistorique] = useState<Cloture[]>([]);
  const [voirHisto, setVoirHisto] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc('admin_apercu_cloture');
    if (data) setApercu(data as Apercu);
    const h = await supabase.rpc('admin_lister_clotures', { p_limite: 10 });
    if (h.data) setHistorique(h.data as Cloture[]);
  }, []);

  useEffect(() => {
    void charger();
    const t = setInterval(() => void charger(), 60000);
    return () => clearInterval(t);
  }, [charger]);

  async function cloturer(forcer: boolean) {
    if (!forcer && !window.confirm('Clôturer le service maintenant ? Le rapport partira dans le groupe Telegram des clôtures.')) return;
    setOccupe(true);
    setErreur(null);
    setResultat(null);
    const { data, error } = await supabase.rpc('admin_cloturer_service', { p_note: note.trim() || null, p_forcer: forcer });
    setOccupe(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    const r = data as { ok: boolean; raison?: string; en_cours?: { numero: string; resto: string; statut: string }[]; texte?: string };
    if (!r.ok && r.raison === 'commandes_en_cours') {
      setEnCours(r.en_cours ?? []);
      return;
    }
    setEnCours(null);
    setNote('');
    setResultat(r.texte ?? 'Service clôturé.');
    void charger();
  }

  const depuis = apercu?.debut
    ? new Date(apercu.debut).toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo', weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : '…';

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0 }}>🏁 Fin de service</h2>
      {apercu ? (
        <p style={{ margin: '0 0 10px' }}>
          Depuis la dernière clôture ({depuis}) : <b>{apercu.commandes}</b> commande(s), <b>{apercu.livrees}</b> livrée(s),{' '}
          {apercu.annulees} annulée(s), <b style={{ color: apercu.en_cours ? 'var(--red)' : undefined }}>{apercu.en_cours} en cours</b>{' '}
          · facturé <b>{formatAr(apercu.facture)}</b> · marge {formatAr(apercu.marge)}
        </p>
      ) : null}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="Note pour le rapport (facultatif) : pluie, livreur absent…"
        rows={2}
        style={{ width: '100%', fontSize: 16, padding: 8, boxSizing: 'border-box', marginBottom: 8 }}
      />
      <button className="btn" onClick={() => void cloturer(false)} disabled={occupe}>
        {occupe ? 'Clôture…' : '🏁 Clôturer le service'}
      </button>
      <span style={{ marginLeft: 10, opacity: 0.7, fontSize: 13 }}>Sinon clôture automatique à 15 h 45 et 22 h 45.</span>

      {enCours ? (
        <div style={{ marginTop: 12, padding: 10, background: 'var(--warn-bg, #FFF3E2)', borderRadius: 8 }}>
          <b>{enCours.length} commande(s) encore en cours :</b>{' '}
          {enCours.map((c) => `${c.numero} (${c.resto}, ${c.statut})`).join(' · ')}
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => void cloturer(true)} disabled={occupe}>Clôturer quand même</button>
            <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setEnCours(null)}>Attendre</button>
          </div>
        </div>
      ) : null}
      {erreur ? <p style={{ color: 'var(--red)' }}>Erreur : {erreur}</p> : null}
      {resultat ? (
        <div style={{ marginTop: 12 }}>
          <b>✅ Clôturé — rapport envoyé sur Telegram :</b>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#f6f3ef', padding: 10, borderRadius: 8 }}>{resultat}</pre>
        </div>
      ) : null}

      {historique.length ? (
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={() => setVoirHisto((v) => !v)}>
            {voirHisto ? 'Masquer' : 'Voir'} les {historique.length} dernières clôtures
          </button>
          {voirHisto
            ? historique.map((c) => (
                <details key={c.id} style={{ marginTop: 8 }}>
                  <summary>
                    {c.jour} · {c.service} · {c.mode}
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{c.texte}</pre>
                </details>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
