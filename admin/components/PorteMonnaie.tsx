'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';

/**
 * 💰 Porte-monnaie des clients (2026-10-07).
 *
 * Chaque avis déposé crédite 1 000 Ar ; le client dépense son solde sur les PLATS au
 * moment de payer. C'est TAXI FOOD qui finance : le restaurant est reversé du prix
 * plein (voir le Rapport de clôture, ligne « Porte-monnaie des clients »).
 *
 * Lecture : `admin_porte_monnaie_soldes()` et `admin_porte_monnaie_mouvements(user)`.
 * Geste manuel : `admin_porte_monnaie_geste(user, montant signé, motif)` — motif
 * obligatoire, journalisé dans `admin_actions`, refusé s'il rendrait le solde négatif.
 * Tout est décidé par la base (is_admin) : cet écran ne fait que montrer.
 */

type Solde = {
  user_id: string;
  client: string | null;
  email: string | null;
  solde: number;
  credits: number;
  debits: number;
  nb_mouvements: number;
  dernier_mouvement: string;
};

type Mouvement = {
  id: string;
  montant: number;
  motif: string;
  note: string | null;
  commande: string | null;
  restaurant: string | null;
  code: string | null;
  created_at: string;
};

const MOTIFS: Record<string, string> = {
  avis: 'Avis déposé',
  utilisation: 'Utilisé sur une commande',
  remboursement_annulation: 'Rendu (commande annulée)',
  annulation_levee: 'Repris (commande réactivée)',
  reprise_code_avis: 'Ancien code AVIS converti',
  geste_admin: 'Geste manuel',
};

const ERREURS: Record<string, string> = {
  'porte_monnaie:montant_invalide': 'Montant invalide (non nul, 100 000 Ar au plus).',
  'porte_monnaie:motif_obligatoire': 'Le motif est obligatoire.',
  'porte_monnaie:solde_insuffisant': 'Ce débit rendrait le solde négatif.',
  'porte_monnaie:client_introuvable': 'Client introuvable.',
};

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Indian/Antananarivo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function PorteMonnaie() {
  const [soldes, setSoldes] = useState<Solde[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const { data, error } = await supabase.rpc('admin_porte_monnaie_soldes');
    if (error) { setErreur(error.message); return; }
    setSoldes((data ?? []) as Solde[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const total = (soldes ?? []).reduce((s, x) => s + x.solde, 0);

  return (
    <>
      <div className="stat-row">
        <div className="stat"><div className="label">Clients avec un porte-monnaie</div><div className="value">{soldes?.length ?? '…'}</div></div>
        <div className="stat"><div className="label">Encours (ce que Taxi Food doit encore)</div><div className="value" style={{ color: 'var(--accent)' }}>{formatAr(total)}</div></div>
      </div>

      <div className="card">
        <h2>Soldes par client</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          +1 000 Ar par avis déposé, sans expiration. Dépensé sur les plats seulement, payé par Taxi Food :
          le restaurant est reversé du prix plein.
        </div>
        {erreur ? <div style={{ color: 'var(--red)' }}>{erreur}</div> : null}
        {soldes && soldes.length === 0 ? <div className="muted">Aucun mouvement pour le moment.</div> : null}
        {(soldes ?? []).length > 0 ? (
          <table>
            <thead>
              <tr><th>Client</th><th className="num">Solde</th><th className="num">Crédité</th><th className="num">Dépensé</th><th>Dernier mouvement</th><th></th></tr>
            </thead>
            <tbody>
              {(soldes ?? []).map((s) => (
                <LigneClient key={s.user_id} s={s} ouvert={ouvert === s.user_id}
                  onToggle={() => setOuvert(ouvert === s.user_id ? null : s.user_id)} onChange={charger} />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}

function LigneClient({ s, ouvert, onToggle, onChange }: {
  s: Solde; ouvert: boolean; onToggle: () => void; onChange: () => Promise<void>;
}) {
  return (
    <>
      <tr>
        <td data-label="Client">{s.client ?? '—'}<div className="muted" style={{ fontSize: 12 }}>{s.email ?? ''}</div></td>
        <td className="num" data-label="Solde" style={{ fontWeight: 700 }}>{formatAr(s.solde)}</td>
        <td className="num" data-label="Crédité">{formatAr(s.credits)}</td>
        <td className="num" data-label="Dépensé">{formatAr(s.debits)}</td>
        <td data-label="Dernier mouvement">{dateHeure(s.dernier_mouvement)}</td>
        <td><button className="btn ghost" onClick={onToggle}>{ouvert ? 'Fermer' : 'Détail'}</button></td>
      </tr>
      {ouvert ? (
        <tr><td colSpan={6}><Detail userId={s.user_id} onChange={onChange} /></td></tr>
      ) : null}
    </>
  );
}

function Detail({ userId, onChange }: { userId: string; onChange: () => Promise<void> }) {
  const [mouvements, setMouvements] = useState<Mouvement[] | null>(null);
  const [montant, setMontant] = useState('');
  const [motif, setMotif] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_porte_monnaie_mouvements', { p_user: userId });
    if (error) { setMsg(error.message); return; }
    setMouvements((data ?? []) as Mouvement[]);
  }, [userId]);

  useEffect(() => { void charger(); }, [charger]);

  async function geste() {
    const n = Number(montant.replace(/\s/g, ''));
    if (!Number.isInteger(n) || n === 0) { setMsg('Montant entier, positif pour créditer, négatif pour débiter.'); return; }
    if (!motif.trim()) { setMsg('Le motif est obligatoire.'); return; }
    if (!window.confirm(`${n > 0 ? 'Créditer' : 'Débiter'} ${formatAr(Math.abs(n))} ?\nMotif : ${motif.trim()}`)) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc('admin_porte_monnaie_geste', { p_user: userId, p_montant: n, p_note: motif.trim() });
    setBusy(false);
    if (error) {
      const cle = Object.keys(ERREURS).find((k) => error.message.includes(k));
      setMsg(cle ? ERREURS[cle] : error.message);
      return;
    }
    setMsg(`Enregistré. Nouveau solde : ${formatAr(data as number)}.`);
    setMontant(''); setMotif('');
    await charger();
    await onChange();
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {mouvements === null ? <div className="muted">Chargement…</div> : (
        <table>
          <tbody>
            {mouvements.map((m) => (
              <tr key={m.id}>
                <td>{dateHeure(m.created_at)}</td>
                <td>
                  {MOTIFS[m.motif] ?? m.motif}
                  <span className="muted">
                    {m.commande ? ` · ${m.commande}` : ''}{m.restaurant ? ` · ${m.restaurant}` : ''}
                    {m.code ? ` · ${m.code}` : ''}{m.note ? ` · ${m.note}` : ''}
                  </span>
                </td>
                <td className="num" style={{ color: m.montant > 0 ? 'var(--green)' : undefined }}>
                  {m.montant > 0 ? '+' : '−'}{formatAr(Math.abs(m.montant))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <input value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant (ex. 1000 ou -1000)"
          inputMode="numeric" style={{ fontSize: 16, padding: 8, width: 200 }} />
        <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (obligatoire)" maxLength={300}
          style={{ fontSize: 16, padding: 8, flex: '1 1 220px' }} />
        <button className="btn" onClick={() => void geste()} disabled={busy}>Geste manuel</button>
      </div>
      {msg ? <div className="muted" style={{ marginTop: 6 }}>{msg}</div> : null}
    </div>
  );
}
