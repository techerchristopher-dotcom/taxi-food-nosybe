'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * ⭐ Avis — ce que les clients ont dit, et ce qu'on a le droit d'en faire.
 *
 * Tout vient de `admin_avis_lister(filtre)` ; les trois gestes passent par des RPC
 * admin qui revérifient elles-mêmes (`admin_avis_statut`, `admin_avis_utilise`).
 *
 * ⚠️ « Utilisé sur les réseaux » est REFUSÉ par la base sans le consentement du
 * client : l'écran grise le bouton, mais c'est la RPC qui protège. Le filtre
 * « À publier » ne montre que les avis consentis, publiés, avec un texte, pas
 * encore utilisés — c'est le vivier pour Facebook (docs/NOTATION-AVIS.md).
 */

type Ligne = {
  id: string;
  created_at: string;
  restaurant_id: string;
  restaurant: string;
  order_id: string;
  order_number: string;
  prenom: string;
  client: string | null;
  note_cuisine: number;
  note_preparation: number;
  note_livraison: number;
  note_restaurant: number | string;
  commentaire: string | null;
  langue: string;
  consentement: boolean;
  statut: 'publie' | 'masque';
  reponse_restaurant: string | null;
  reponse_le: string | null;
  utilise_reseaux_le: string | null;
  code: string | null;
};

type Filtre = 'tous' | 'consentis_non_utilises' | 'faibles' | 'masques';

const FILTRES: { id: Filtre; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'consentis_non_utilises', label: 'À publier (consentis, pas encore utilisés)' },
  { id: 'faibles', label: '≤ 2 étoiles' },
  { id: 'masques', label: 'Masqués' },
];

function etoiles(n: number) {
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
}

function date(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Le texte prêt à coller dans une publication. */
function texteAPartager(a: Ligne) {
  return `« ${a.commentaire ?? ''} »\n— ${a.prenom}, ${etoiles(Number(a.note_restaurant))} chez ${a.restaurant}, via Taxi Food`;
}

export function Avis() {
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase.rpc('admin_avis_lister', { p_filtre: filtre });
    setChargement(false);
    if (error) { setErreur(error.message); return; }
    setErreur(null);
    setLignes((data ?? []) as Ligne[]);
  }, [filtre]);

  useEffect(() => { charger(); }, [charger]);

  async function geste(id: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    if (busy) return;
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    if (error) { setErreur(error.message); return; }
    await charger();
  }

  const statut = (a: Ligne) =>
    geste(a.id, () => supabase.rpc('admin_avis_statut', { p_avis_id: a.id, p_statut: a.statut === 'publie' ? 'masque' : 'publie' }));
  const utilise = (a: Ligne) =>
    geste(a.id, () => supabase.rpc('admin_avis_utilise', { p_avis_id: a.id, p_utilise: !a.utilise_reseaux_le }));

  async function copier(a: Ligne) {
    try {
      await navigator.clipboard.writeText(texteAPartager(a));
      setCopie(a.id);
      setTimeout(() => setCopie(null), 1500);
    } catch {
      setErreur('Copie impossible dans ce navigateur.');
    }
  }

  const total = lignes.length;
  const moyenne = total ? lignes.reduce((s, a) => s + Number(a.note_restaurant), 0) / total : null;

  return (
    <div className="card">
      <h2>⭐ Avis clients</h2>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Note restaurant = cuisine + préparation (la livraison est notée à part). Un avis ne se
        réutilise sur les réseaux que si le client a coché la case — la base refuse sinon.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {FILTRES.map((f) => (
          <button key={f.id} className={`btn ${filtre === f.id ? '' : 'ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setFiltre(f.id)}>
            {f.label}
          </button>
        ))}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {total} avis{moyenne != null ? ` · moyenne ${moyenne.toFixed(1).replace('.', ',')} / 5` : ''}
        </span>
      </div>

      {erreur ? <div style={{ color: 'var(--red)', marginBottom: 12 }}>Erreur : {erreur}</div> : null}

      {chargement && lignes.length === 0 ? (
        <div className="empty">Chargement…</div>
      ) : lignes.length === 0 ? (
        <div className="empty">Aucun avis dans ce filtre.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Quand</th><th>Restaurant · commande</th><th>Client</th><th>Notes</th><th>Avis</th><th></th></tr>
          </thead>
          <tbody>
            {lignes.map((a) => (
              <tr key={a.id} style={a.statut === 'masque' ? { opacity: 0.55 } : undefined}>
                <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{date(a.created_at)}</td>
                <td>
                  <div>{a.restaurant}</div>
                  <div className="muted" style={{ fontSize: 12 }}>#{a.order_number}{a.code ? ` · code ${a.code}` : ''}</div>
                </td>
                <td>
                  <div>{a.prenom}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{a.client ?? '—'} · {a.langue}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  <div title="Note restaurant (cuisine + préparation)">{etoiles(Number(a.note_restaurant))} {Number(a.note_restaurant).toFixed(1).replace('.', ',')}</div>
                  <div className="muted">cuisine {a.note_cuisine} · prépa {a.note_preparation} · livraison {a.note_livraison}</div>
                </td>
                <td style={{ maxWidth: 360 }}>
                  {a.commentaire ? <div>« {a.commentaire} »</div> : <span className="muted">(sans commentaire)</span>}
                  {a.reponse_restaurant ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4, borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                      Réponse du restaurant : {a.reponse_restaurant}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {a.consentement
                      ? <span className="pill confirmee">publication autorisée</span>
                      : <span className="pill annulee">sans consentement</span>}
                    {a.statut === 'masque' ? <span className="pill annulee">masqué</span> : null}
                    {a.utilise_reseaux_le ? <span className="pill en_livraison">utilisé le {date(a.utilise_reseaux_le)}</span> : null}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!a.commentaire} onClick={() => copier(a)}>
                      {copie === a.id ? 'Copié ✓' : 'Copier le texte'}
                    </button>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }}
                      disabled={busy === a.id || (!a.consentement && !a.utilise_reseaux_le)}
                      title={!a.consentement ? 'Le client n’a pas autorisé la publication' : undefined}
                      onClick={() => utilise(a)}>
                      {a.utilise_reseaux_le ? 'Annuler « utilisé »' : 'Utilisé sur les réseaux'}
                    </button>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={busy === a.id} onClick={() => statut(a)}>
                      {a.statut === 'publie' ? 'Masquer' : 'Republier'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
