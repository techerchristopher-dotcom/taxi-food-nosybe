'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 📢 Bandeau — l'annonce affichée en haut de l'accueil de l'APP et du SITE (2026-10-03).
 *
 * Différent de 📣 Annonce : une annonce part une fois et ne se reprend pas ; un bandeau reste
 * affiché, se corrige, s'éteint. Rien ne part sur les téléphones : il est lu à l'ouverture.
 *
 * - UN SEUL bandeau visible : le plus récemment modifié parmi ceux qui sont allumés et dans
 *   leurs dates (`bandeau_actif()`).
 * - Les DATES sont des jours, heure de Madagascar ; la fin est le DERNIER jour d'affichage.
 *   Passé ce jour, il disparaît tout seul — aucune tâche planifiée, c'est la base qui filtre.
 * - Le titre et le texte sont traduits en anglais et en italien par le dictionnaire du menu
 *   (traduction automatique dès que la clé Claude est posée) ; sinon le français s'affiche.
 * - Toute modification change la « version » : un client qui avait fermé le bandeau le revoit.
 */

const TITRE_MAX = 60;
const TEXTE_MAX = 140;

type Bandeau = {
  id: string;
  titre: string;
  texte: string | null;
  route: string | null;
  actif: boolean;
  debut: string;
  fin: string | null;
  maj_le: string;
};
type Restaurant = { id: string; name: string; listing_status: string };

/** Le jour (AAAA-MM-JJ) d'un instant, vu de Nosy Be. */
function jourMada(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date(iso));
}
/** `fin` est stockée au lendemain 00:00 : le dernier jour affiché est la veille. */
function dernierJour(fin: string): string {
  return jourMada(new Date(new Date(fin).getTime() - 60_000).toISOString());
}
function joli(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function etat(b: Bandeau): { libelle: string; pill: string } {
  const now = Date.now();
  if (!b.actif) return { libelle: 'éteint', pill: 'sans_objet' };
  if (new Date(b.debut).getTime() > now) return { libelle: 'programmé', pill: 'recue' };
  if (b.fin && new Date(b.fin).getTime() <= now) return { libelle: 'terminé', pill: 'annulee' };
  return { libelle: 'en ligne', pill: 'livree' };
}

const MESSAGES: Record<string, string> = {
  'bandeau:titre_invalide': `Le titre est obligatoire, ${TITRE_MAX} caractères au plus.`,
  'bandeau:texte_invalide': `Le texte fait ${TEXTE_MAX} caractères au plus.`,
  'bandeau:dates_invalides': 'Le dernier jour doit venir après le premier.',
  'bandeau:route_invalide': 'Destination inconnue.',
};
const messageErreur = (m: string) => Object.entries(MESSAGES).find(([k]) => m.includes(k))?.[1] ?? m;

export function Bandeaux() {
  const [liste, setListe] = useState<Bandeau[]>([]);
  const [restos, setRestos] = useState<Restaurant[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  // Formulaire : `id` null = nouveau bandeau.
  const [id, setId] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [route, setRoute] = useState('/');
  const [debut, setDebut] = useState(jourMada(new Date().toISOString()));
  const [fin, setFin] = useState('');

  const charger = useCallback(async () => {
    const [b, r] = await Promise.all([
      supabase.rpc('admin_lister_bandeaux'),
      supabase.from('restaurants').select('id, name, listing_status').neq('listing_status', 'hidden').order('rang_catalogue'),
    ]);
    setChargement(false);
    if (!r.error) setRestos((r.data ?? []) as Restaurant[]);
    if (b.error) { setErr(b.error.message); return; }
    setListe((b.data ?? []) as Bandeau[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  function vider() {
    setId(null); setTitre(''); setTexte(''); setRoute('/');
    setDebut(jourMada(new Date().toISOString())); setFin('');
  }

  function modifier(b: Bandeau) {
    setId(b.id); setTitre(b.titre); setTexte(b.texte ?? ''); setRoute(b.route ?? '/');
    setDebut(jourMada(b.debut)); setFin(b.fin ? dernierJour(b.fin) : '');
    setInfo(null); setErr(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const saisie =
    titre.trim().length < 1 ? 'Écris un titre.'
      : titre.trim().length > TITRE_MAX ? `Titre trop long (${TITRE_MAX} au plus).`
        : texte.trim().length > TEXTE_MAX ? `Texte trop long (${TEXTE_MAX} au plus).`
          : fin && fin < debut ? 'Le dernier jour doit venir après le premier.'
            : null;

  async function enregistrer() {
    if (occupe || saisie) return;
    setOccupe(true); setErr(null); setInfo(null);
    const { error } = await supabase.rpc('admin_enregistrer_bandeau', {
      p_id: id,
      p_titre: titre.trim(),
      p_texte: texte.trim() || null,
      p_route: route,
      p_debut: debut || null,
      p_fin: fin || null,
      p_actif: true,
    });
    setOccupe(false);
    if (error) { setErr(messageErreur(error.message)); return; }
    setInfo(id
      ? 'Bandeau modifié. Il réapparaît aussi chez ceux qui l’avaient fermé.'
      : 'Bandeau publié. Il s’affiche à la prochaine ouverture de l’app et du site.');
    vider();
    await charger();
  }

  async function basculer(b: Bandeau) {
    setOccupe(true); setErr(null); setInfo(null);
    const { error } = await supabase.rpc('admin_activer_bandeau', { p_id: b.id, p_actif: !b.actif });
    setOccupe(false);
    if (error) { setErr(messageErreur(error.message)); return; }
    setInfo(b.actif ? 'Bandeau éteint : il disparaît de l’app et du site.' : 'Bandeau rallumé.');
    await charger();
  }

  if (chargement) return <div className="card"><div className="empty">Chargement…</div></div>;

  const enLigne = liste.filter((b) => etat(b).libelle === 'en ligne');

  return (
    <>
      {err ? <div className="card sel-erreur">{err}</div> : null}
      {info ? <div className="card sel-info">{info}</div> : null}

      <div className="card sel-bloc">
        <h2>{id ? '✏️ Modifier le bandeau' : '📢 Nouveau bandeau'}</h2>
        <p className="muted sel-texte-court">
          Affiché en haut de l’accueil de l’app et du site, en français, anglais et italien. Un seul à
          la fois : le dernier modifié parmi ceux en ligne. Le client peut le fermer d’une croix.
        </p>

        <label className="sel-champ-bloc">
          <span className="sel-label">Titre</span>
          <input className="sel-champ" value={titre} maxLength={TITRE_MAX * 2}
            onChange={(e) => setTitre(e.target.value)} placeholder="🛵 On casse les prix en octobre !" />
          <span className={`sel-compteur${titre.trim().length > TITRE_MAX ? ' trop' : ''}`}>
            {titre.trim().length} / {TITRE_MAX}
          </span>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Texte (facultatif)</span>
          <textarea className="sel-champ ann-corps" rows={2} value={texte} maxLength={TEXTE_MAX * 2}
            onChange={(e) => setTexte(e.target.value)} placeholder="Livraison à partir de 2 000 Ar tout le mois." />
          <span className={`sel-compteur${texte.trim().length > TEXTE_MAX ? ' trop' : ''}`}>
            {texte.trim().length} / {TEXTE_MAX}
          </span>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Au tap, ouvrir</span>
          <select className="sel-champ" value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="/">L’accueil (simple information dans l’app)</option>
            {restos.map((r) => (
              <option key={r.id} value={`/restaurant/${r.id}`}>
                La fiche de {r.name}{r.listing_status === 'coming_soon' ? ' (en négociation)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label className="sel-champ-bloc" style={{ flex: '1 1 160px' }}>
            <span className="sel-label">Premier jour</span>
            <input className="sel-champ" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </label>
          <label className="sel-champ-bloc" style={{ flex: '1 1 160px' }}>
            <span className="sel-label">Dernier jour (inclus) — vide = sans fin</span>
            <input className="sel-champ" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>

        <div className="sel-label">Aperçu</div>
        <div style={{
          background: 'linear-gradient(100deg,#1A1A1A,#3A2A22)', color: '#fff', borderLeft: '4px solid #FFC72C',
          borderRadius: 14, padding: '12px 14px', maxWidth: 420,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{titre.trim() || 'Titre du bandeau'}</div>
          {texte.trim() ? <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>{texte.trim()}</div> : null}
        </div>
        <p className="muted sel-texte-court">
          {fin ? `Visible jusqu’au ${joli(fin)} inclus, puis il disparaît tout seul.` : 'Visible jusqu’à ce que tu l’éteignes.'}
        </p>

        {saisie ? <p className="muted sel-texte-court">{saisie}</p> : null}
        <div className="sel-gestes">
          {id ? <button className="btn ghost sel-btn" disabled={occupe} onClick={vider}>Annuler</button> : null}
          <button className="btn sel-btn" disabled={occupe || !!saisie} onClick={() => void enregistrer()}>
            {id ? 'Enregistrer la modification' : 'Publier le bandeau'}
          </button>
        </div>
      </div>

      <div className="card sel-bloc">
        <h2>Bandeaux</h2>
        {enLigne.length > 1 ? (
          <p className="muted sel-texte-court">
            {enLigne.length} bandeaux sont en ligne : seul le plus récemment modifié s’affiche.
          </p>
        ) : null}
        {liste.length === 0 ? (
          <div className="empty">Aucun bandeau pour l’instant.</div>
        ) : (
          <div className="sel-liste">
            {liste.map((b) => {
              const e = etat(b);
              const affiche = e.libelle === 'en ligne' && enLigne[0]?.id === b.id;
              return (
                <div className={`sel-fiche${e.libelle === 'en ligne' ? '' : ' morte'}`} key={b.id}>
                  <div className="sel-fiche-haut">
                    <span className="sel-nom">{b.titre}</span>
                    <span className={`pill ${e.pill}`}>{e.libelle}</span>
                    {affiche ? <span className="pill livree">affiché</span> : null}
                  </div>
                  {b.texte ? <div className="muted sel-detail">{b.texte}</div> : null}
                  <div className="muted sel-detail">
                    du {joli(jourMada(b.debut))} {b.fin ? `au ${joli(dernierJour(b.fin))}` : '· sans fin'}
                    {b.route && b.route !== '/' ? ` · ouvre ${restos.find((r) => b.route === `/restaurant/${r.id}`)?.name ?? b.route}` : ''}
                  </div>
                  <div className="sel-gestes">
                    <button className="btn ghost sel-btn" disabled={occupe} onClick={() => modifier(b)}>Modifier</button>
                    <button className="btn ghost sel-btn" disabled={occupe} onClick={() => void basculer(b)}>
                      {b.actif ? 'Éteindre' : 'Rallumer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
