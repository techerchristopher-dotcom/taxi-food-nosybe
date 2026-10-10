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
import { afficherNumeroOM } from '../lib/versement';
import type { MoyenReversement, MoyenRestaurant } from '../lib/versement';

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

export function BoutonCopier({ code }: { code: string }) {
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


// ───────────────────────────────────────────── Moyen de reversement (2026-10-10)
//
// Code marchand, numéro Orange Money, ou « réglé à la commande » (payé sur place en
// passant la commande : rien à reverser). L'écriture passe UNIQUEMENT par
// `admin_set_moyen_reversement` ; la base normalise le numéro (032 / 037, 10 chiffres,
// avec ou sans +261) et refuse toute autre forme.

const LIBELLE_MOYEN: Record<MoyenReversement, string> = {
  code_marchand: 'Code marchand Orange Money',
  orange_money: 'Numéro Orange Money',
  regle_a_la_commande: 'Réglé à la commande (rien à reverser)',
};

function messageMoyen(m: string): string {
  if (m.includes('numero_orange_money:forme')) return 'Numéro refusé : un 032 ou 037 à 10 chiffres (avec ou sans +261).';
  if (m.includes('numero_orange_money:manquant')) return 'Entre le numéro Orange Money.';
  if (m.includes('code_marchand:manquant')) return 'Entre le code marchand.';
  return messageErreur(m);
}

/** Le moyen d'un restaurant : lecture, copie, modification. */
export function MoyenReversementCarte({ moyen, nom, onChange }: {
  /** `undefined` : illisible. */
  moyen: MoyenRestaurant | undefined;
  nom?: string;
  onChange: (m: MoyenRestaurant) => void;
}) {
  const [edition, setEdition] = useState(false);
  const [choix, setChoix] = useState<MoyenReversement | ''>('');
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (moyen === undefined) return <div className="cm-ligne muted">Moyen de reversement : lecture impossible.</div>;

  function ouvrir() {
    const m = moyen!;
    setChoix(m.moyen ?? '');
    setSaisie(m.moyen === 'orange_money' ? (m.numero_orange_money ?? '') : (m.code_marchand ?? ''));
    setErr(null);
    setEdition(true);
  }

  async function enregistrer() {
    if (envoi) return;
    setEnvoi(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_set_moyen_reversement', {
      p_restaurant_id: moyen!.restaurant_id,
      p_moyen: choix || null,
      p_valeur: choix === 'code_marchand' || choix === 'orange_money' ? saisie : null,
    });
    setEnvoi(false);
    if (error) { setErr(messageMoyen(error.message)); return; }
    onChange(data as MoyenRestaurant);
    setEdition(false);
  }

  if (edition) {
    return (
      <div className="cm-edition">
        {nom ? <div style={{ fontWeight: 700, marginBottom: 6 }}>{nom}</div> : null}
        <label className="sel-champ-bloc" style={{ marginBottom: 8 }}>
          <span className="sel-label">Moyen de reversement</span>
          <select className="sel-champ" value={choix} onChange={(e) => { setChoix(e.target.value as MoyenReversement | ''); setSaisie(''); }}>
            <option value="">— Aucun —</option>
            <option value="code_marchand">{LIBELLE_MOYEN.code_marchand}</option>
            <option value="orange_money">{LIBELLE_MOYEN.orange_money}</option>
            <option value="regle_a_la_commande">{LIBELLE_MOYEN.regle_a_la_commande}</option>
          </select>
        </label>
        {choix === 'code_marchand' || choix === 'orange_money' ? (
          <label className="sel-champ-bloc" style={{ marginBottom: 8 }}>
            <span className="sel-label">{choix === 'code_marchand' ? 'Code marchand (3 à 20 chiffres ou lettres)' : 'Numéro Orange Money (032 ou 037)'}</span>
            <input
              className="sel-champ"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              inputMode={choix === 'orange_money' ? 'tel' : 'text'}
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              placeholder={choix === 'orange_money' ? 'ex. 037 12 345 67' : 'ex. 378970'}
            />
          </label>
        ) : null}
        {choix === 'regle_a_la_commande' ? (
          <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>
            Chaque commande livrée sera classée « réglée à la commande » toute seule : rien à reverser, aucun message.
          </p>
        ) : null}
        {err ? <p className="sel-erreur-texte" style={{ margin: '0 0 8px' }}>{err}</p> : null}
        <div className="cm-gestes">
          <button type="button" className="btn petit" disabled={envoi} onClick={() => void enregistrer()}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn ghost petit" disabled={envoi} onClick={() => setEdition(false)}>Annuler</button>
        </div>
      </div>
    );
  }

  const m = moyen;
  const valeur = m.moyen === 'code_marchand' ? m.code_marchand
    : m.moyen === 'orange_money' && m.numero_orange_money ? afficherNumeroOM(m.numero_orange_money) : null;
  return (
    <div className="cm-ligne">
      <span className="cm-texte">
        {nom ? <strong>{nom} · </strong> : null}
        {!m.moyen ? <span className="cm-absent">Moyen de reversement non renseigné</span>
          : m.moyen === 'regle_a_la_commande' ? <>Réglé à la commande <span className="muted">(rien à reverser)</span></>
          : <>{LIBELLE_MOYEN[m.moyen]} : <strong className="cm-code">{valeur ?? '—'}</strong></>}
      </span>
      <span className="cm-gestes">
        {valeur ? <BoutonCopier code={m.moyen === 'orange_money' ? (m.numero_orange_money ?? valeur) : valeur} /> : null}
        <button type="button" className="btn ghost petit" onClick={ouvrir}>{m.moyen ? 'Modifier' : 'Ajouter'}</button>
      </span>
    </div>
  );
}

/** Le moyen dans la fenêtre « Marquer reversé » : sur quoi payer, avec copie. */
export function MoyenReversementFenetre({ moyen }: { moyen: MoyenRestaurant | null | undefined }) {
  if (moyen === undefined) {
    return <div className="cm-fenetre cm-manque">Moyen de reversement illisible pour l’instant : vérifie-le avant de payer.</div>;
  }
  if (!moyen || !moyen.moyen) {
    return (
      <div className="cm-fenetre cm-manque">
        Aucun moyen de reversement enregistré pour ce restaurant (ni code marchand, ni numéro Orange Money).
        Ajoute-le dans « Moyens de reversement » avant de payer — le versement reste possible.
      </div>
    );
  }
  if (moyen.moyen === 'regle_a_la_commande') {
    return (
      <div className="cm-fenetre cm-manque">
        Ce restaurant est réglé à la commande : ses commandes livrées sont classées toutes seules, il n’y a rien à lui virer.
      </div>
    );
  }
  const brut = moyen.moyen === 'code_marchand' ? moyen.code_marchand : moyen.numero_orange_money;
  if (!brut) return <div className="cm-fenetre cm-manque">{LIBELLE_MOYEN[moyen.moyen]} non renseigné.</div>;
  return (
    <div className="cm-fenetre">
      <div>
        <div className="sel-label" style={{ marginBottom: 2 }}>{LIBELLE_MOYEN[moyen.moyen]}</div>
        <strong className="cm-code grand">{moyen.moyen === 'orange_money' ? afficherNumeroOM(brut) : brut}</strong>
      </div>
      <BoutonCopier code={brut} />
    </div>
  );
}
