'use client';

/**
 * Le code marchand Orange Money d'un restaurant : là où on le paie.
 *
 * Deux endroits, un seul sens : sur la carte du restaurant (lecture, copie,
 * modification) et dans la fenêtre « Marquer reversé » (lecture, copie), parce
 * que c'est au moment de payer qu'on en a besoin — une erreur d'un chiffre
 * envoie l'argent à quelqu'un d'autre.
 *
 * L'écriture passe UNIQUEMENT par `admin_set_code_marchand` (admin seulement,
 * retire les espaces, vide = efface, journalisée). La forme est vérifiée ici
 * pour dire l'erreur avant l'appel, et la base la revérifie de toute façon.
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const FORME = /^[0-9A-Za-z]{3,20}$/;

/** Même nettoyage que la base : tous les blancs retirés. */
export function nettoyerCode(s: string): string {
  return s.replace(/\s/g, '');
}

/** Message clair pour ce que la base peut répondre. */
function messageErreur(m: string): string {
  if (m.includes('code_marchand:forme')) return 'Forme refusée : 3 à 20 chiffres ou lettres, sans tiret ni autre signe.';
  if (m.includes('Reserve aux administrateurs')) return 'Réservé aux administrateurs.';
  if (m.includes('Restaurant introuvable')) return 'Restaurant introuvable.';
  return m;
}

/** Copie dans le presse-papiers ; « Copié » pendant 2 s, ou l'échec dit tel quel. */
function useCopie() {
  const [etat, setEtat] = useState<'repos' | 'copie' | 'echec'>('repos');
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current); }, []);
  async function copier(texte: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texte);
      ok = true;
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, vieux navigateur) : l'ancienne voie.
      try {
        const t = document.createElement('textarea');
        t.value = texte;
        t.setAttribute('readonly', '');
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        ok = document.execCommand('copy');
        document.body.removeChild(t);
      } catch {
        ok = false;
      }
    }
    setEtat(ok ? 'copie' : 'echec');
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEtat('repos'), 2000);
  }
  return { etat, copier };
}

function BoutonCopier({ code }: { code: string }) {
  const { etat, copier } = useCopie();
  return (
    <button
      type="button"
      className={`btn ghost petit cm-copier${etat === 'copie' ? ' fait' : ''}`}
      onClick={() => void copier(code)}
      aria-live="polite"
    >
      {etat === 'copie' ? '✓ Copié' : etat === 'echec' ? 'Copie refusée' : 'Copier'}
    </button>
  );
}

/** La ligne du code, sur la carte d'un restaurant : lecture, copie, modification. */
export function CodeMarchandCarte({ restaurantId, code, onChange }: {
  restaurantId: string;
  /** `undefined` : pas encore lu (ou illisible). `null` : non renseigné. */
  code: string | null | undefined;
  onChange: (nouveau: string | null) => void;
}) {
  const [edition, setEdition] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const propre = nettoyerCode(saisie);
  const formeOk = propre === '' || FORME.test(propre);

  function ouvrir() {
    setSaisie(code ?? '');
    setErr(null);
    setEdition(true);
  }

  async function enregistrer() {
    if (envoi) return;
    if (!formeOk) { setErr('Forme refusée : 3 à 20 chiffres ou lettres, sans tiret ni autre signe.'); return; }
    setEnvoi(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_set_code_marchand', { p_restaurant_id: restaurantId, p_code: propre });
    setEnvoi(false);
    if (error) { setErr(messageErreur(error.message)); return; }
    onChange((data as string | null) ?? null);
    setEdition(false);
  }

  if (code === undefined && !edition) {
    return <div className="cm-ligne muted">Code marchand : lecture impossible.</div>;
  }

  if (edition) {
    return (
      <div className="cm-edition">
        <label className="sel-champ-bloc" style={{ marginBottom: 8 }}>
          <span className="sel-label">Code marchand Orange Money (vide = effacer)</span>
          <input
            className="sel-champ"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={40}
            placeholder="ex. 378970"
            aria-invalid={!formeOk}
          />
          {!formeOk ? <span className="sel-erreur-texte">3 à 20 chiffres ou lettres, sans tiret ni autre signe.</span> : null}
        </label>
        {err ? <p className="sel-erreur-texte" style={{ margin: '0 0 8px' }}>{err}</p> : null}
        <div className="cm-gestes">
          <button type="button" className="btn petit" disabled={envoi || !formeOk} onClick={() => void enregistrer()}>
            {envoi ? 'Enregistrement…' : propre === '' && code ? 'Effacer le code' : 'Enregistrer'}
          </button>
          <button type="button" className="btn ghost petit" disabled={envoi} onClick={() => setEdition(false)}>Annuler</button>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="cm-ligne">
        <span className="cm-absent">Code marchand non renseigné</span>
        <button type="button" className="btn ghost petit" onClick={ouvrir}>Ajouter</button>
      </div>
    );
  }

  return (
    <div className="cm-ligne">
      <span className="cm-texte">
        Code marchand Orange Money : <strong className="cm-code">{code}</strong>
      </span>
      <span className="cm-gestes">
        <BoutonCopier code={code} />
        <button type="button" className="btn ghost petit" onClick={ouvrir}>Modifier</button>
      </span>
    </div>
  );
}

/** Le code dans la fenêtre « Marquer reversé » : lecture et copie, sans bloquer. */
export function CodeMarchandFenetre({ code }: { code: string | null | undefined }) {
  if (code === undefined) {
    return <div className="cm-fenetre cm-manque">Code marchand illisible pour l’instant : vérifie-le avant de payer.</div>;
  }
  if (!code) {
    return (
      <div className="cm-fenetre cm-manque">
        Aucun code marchand enregistré pour ce restaurant. Demande-le avant de payer
        (ajout possible depuis sa carte) — le versement reste possible.
      </div>
    );
  }
  return (
    <div className="cm-fenetre">
      <div>
        <div className="sel-label" style={{ marginBottom: 2 }}>Code marchand Orange Money</div>
        <strong className="cm-code grand">{code}</strong>
      </div>
      <BoutonCopier code={code} />
    </div>
  );
}
