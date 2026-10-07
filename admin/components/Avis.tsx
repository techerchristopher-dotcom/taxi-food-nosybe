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
  /** Photo du plat prise par le client (bucket public `avis`), ou null. */
  photo_url: string | null;
  /**
   * Message PRIVÉ du client au restaurant (table `avis_messages_prives`) : jamais
   * publié, jamais dans le texte de publication ni le visuel. Null s'il n'y en a pas.
   */
  message_prive: string | null;
};

const SITE = 'https://taxifoodnosybe.distripro207.com';

type Filtre = 'tous' | 'consentis_non_utilises' | 'faibles' | 'masques' | 'messages_prives';

const FILTRES: { id: Filtre; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'consentis_non_utilises', label: 'À publier (consentis, pas encore utilisés)' },
  { id: 'faibles', label: '≤ 2 étoiles' },
  { id: 'masques', label: 'Masqués' },
  { id: 'messages_prives', label: '🔒 Messages privés' },
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

/**
 * Le texte COMPLET d'une publication Facebook : la citation, puis l'appel à
 * commander avec le lien de partage du restaurant (`/r/<id>`, page de partage
 * avec image). ⚠️ L'agent de partage ajoute `?g=<slug>` PAR GROUPE — jamais ici,
 * sinon tous les groupes compteraient sous la même étiquette.
 */
function textePublication(a: Ligne) {
  return `${texteAPartager(a)}\n\nEnvie de goûter ? Commande chez ${a.restaurant} sur Taxi Food, livré chez toi à Nosy Be :\n${SITE}/r/${a.restaurant_id}`;
}

/** Découpe un texte en lignes qui tiennent dans `largeur` (canvas 2D). */
function lignesDe(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split('\n')) {
    let ligne = '';
    for (const mot of paragraphe.split(' ')) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (ctx.measureText(essai).width > largeur && ligne) {
        lignes.push(ligne);
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    lignes.push(ligne);
  }
  return lignes;
}

function chargerImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Le visuel citation 1080×1080, généré dans le navigateur — aucun serveur, aucune
 * dépendance. Fond : la photo du client si elle existe (assombrie), sinon l'encre
 * Taxi Food. La citation en grand, les étoiles en jaune Taxi Food, le prénom, le
 * restaurant, et l'appel à commander en pied.
 */
async function telechargerVisuel(a: Ligne) {
  const W = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');

  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(0, 0, W, W);
  if (a.photo_url) {
    const img = await chargerImage(a.photo_url);
    if (img) {
      const r = Math.max(W / img.width, W / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, (W - dw) / 2, (W - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, 0, W, W);
    }
  }

  const marge = 90;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFC72C';
  ctx.font = '700 34px Arial, Helvetica, sans-serif';
  ctx.fillText('TAXI FOOD · NOSY BE', marge, marge);

  ctx.fillStyle = '#FFFFFF';
  const corps = a.commentaire ?? '';
  let taille = corps.length > 220 ? 40 : corps.length > 120 ? 48 : 58;
  ctx.font = `700 ${taille}px Georgia, "Times New Roman", serif`;
  let lignes = lignesDe(ctx, `« ${corps} »`, W - marge * 2);
  // Trop long pour la case : on réduit une fois, puis on tronque proprement.
  if (lignes.length * taille * 1.25 > 520) {
    taille = Math.max(32, Math.floor(taille * 0.8));
    ctx.font = `700 ${taille}px Georgia, "Times New Roman", serif`;
    lignes = lignesDe(ctx, `« ${corps} »`, W - marge * 2);
    const max = Math.floor(520 / (taille * 1.25));
    if (lignes.length > max) lignes = [...lignes.slice(0, max - 1), `${lignes[max - 1]}…`];
  }
  const hauteurTexte = lignes.length * taille * 1.25;
  let y = Math.max(200, (W - hauteurTexte) / 2 - 60);
  for (const l of lignes) {
    ctx.fillText(l, marge, y);
    y += taille * 1.25;
  }

  y += 40;
  ctx.fillStyle = '#FFC72C';
  ctx.font = '400 56px Arial, Helvetica, sans-serif';
  ctx.fillText(etoiles(Number(a.note_restaurant)), marge, y);
  y += 80;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 36px Arial, Helvetica, sans-serif';
  ctx.fillText(`— ${a.prenom}, chez ${a.restaurant}`, marge, y);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '400 30px Arial, Helvetica, sans-serif';
  ctx.fillText('Commande sur taxifoodnosybe.distripro207.com', marge, W - marge - 34);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('export impossible');
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `avis-${a.prenom}-${a.restaurant}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

  async function copier(a: Ligne, mode: 'citation' | 'publication') {
    try {
      await navigator.clipboard.writeText(mode === 'publication' ? textePublication(a) : texteAPartager(a));
      setCopie(`${a.id}:${mode}`);
      setTimeout(() => setCopie(null), 1500);
    } catch {
      setErreur('Copie impossible dans ce navigateur.');
    }
  }

  async function visuel(a: Ligne) {
    if (busy) return;
    setBusy(a.id);
    try {
      await telechargerVisuel(a);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Visuel impossible.');
    } finally {
      setBusy(null);
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
                  {a.photo_url ? (
                    <a href={a.photo_url} target="_blank" rel="noreferrer" title="Photo du client — ouvrir en grand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.photo_url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginTop: 6, display: 'block' }} />
                    </a>
                  ) : null}
                  {a.message_prive ? (
                    <div style={{ fontSize: 12, marginTop: 6, padding: '6px 8px', border: '1px dashed var(--border)', borderRadius: 6 }}
                      title="Message privé : lu par le restaurant et Taxi Food seulement. Ne jamais le publier.">
                      <strong>🔒 Privé — le client ne l’a pas publié</strong>
                      <div style={{ whiteSpace: 'pre-wrap' }}>« {a.message_prive} »</div>
                    </div>
                  ) : null}
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
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!a.commentaire} onClick={() => copier(a, 'citation')}>
                      {copie === `${a.id}:citation` ? 'Copié ✓' : 'Copier la citation'}
                    </button>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!a.commentaire || !a.consentement}
                      title={!a.consentement ? 'Le client n’a pas autorisé la publication' : 'Texte complet avec le lien /r/ du restaurant — ajouter ?g=<groupe> par groupe'}
                      onClick={() => copier(a, 'publication')}>
                      {copie === `${a.id}:publication` ? 'Copié ✓' : 'Texte de publication'}
                    </button>
                    <button className="btn ghost" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!a.commentaire || !a.consentement || busy === a.id}
                      title={!a.consentement ? 'Le client n’a pas autorisé la publication' : 'Carte citation 1080×1080 (PNG)'}
                      onClick={() => visuel(a)}>
                      {busy === a.id ? 'Génération…' : 'Télécharger le visuel'}
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
