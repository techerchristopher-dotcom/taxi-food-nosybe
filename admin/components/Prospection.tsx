'use client';

/**
 * La tournée des hôtes : ce que la serveuse est à l'app de commande,
 * l'admin (souvent seul, à scooter) l'est ici. Trois écrans, un pour chaque
 * façon d'aborder 671 fiches à visiter : la file qu'on n'a pas à choisir
 * (« À faire »), celle qui dit quoi faire pendant qu'on est déjà dehors
 * (« Autour de moi »), et la recherche pour retrouver une adresse précise.
 *
 * Écrit pour un téléphone tenu à une main, dehors, avec un réseau qui lâche :
 * jamais d'alert() bloquante, un bandeau de reprise permanent plutôt qu'un
 * geste perdu, et un verrou synchrone sur chaque bouton d'écriture — voir
 * `gestEnCours` dans Remboursements.tsx, même raison ici.
 *
 * La base reste l'autorité : `prochaine_action`/`rang` viennent de
 * `prospects_pilotage`, jamais recalculés ici. Cet écran ne fait qu'agir
 * (`admin_prospect_agir`, `admin_prospect_creer_code`) et afficher.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  CANAL_LABEL, RESULTAT_LABEL, distanceKm, estEnRetard, faitAussiRestaurant,
  langueProbable, lienCarte, lienMailto, lienMessenger, lienTel, lienWhatsApp,
  libelleProchaineAction, script,
} from '../lib/prospection';
import type { Prospect } from '../lib/prospection';

type Vue = 'a_faire' | 'autour' | 'chercher';

type Action = {
  id: string;
  canal: string;
  sens: string;
  resultat: string;
  note: string | null;
  interlocuteur: string | null;
  flyers_deposes: number;
  fait_le: string;
};

type CodeInfo = {
  code_id: string;
  code: string;
  adresse: string;
  fiches: number;
  max_utilisations: number;
  expire_le: string;
};

const CANAUX_BOUTONS: { canal: string; libelle: string }[] = [
  { canal: 'whatsapp', libelle: 'WhatsApp' },
  { canal: 'appel', libelle: 'Appel' },
  { canal: 'messenger', libelle: 'Messenger' },
  { canal: 'email', libelle: 'E-mail' },
  { canal: 'visite', libelle: 'Visite' },
];

const RESULTATS_PAR_CANAL: Record<string, string[]> = {
  whatsapp: ['pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus', 'mauvais_numero'],
  appel: ['pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus', 'mauvais_numero'],
  messenger: ['pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus'],
  email: ['pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus'],
  visite: ['absent', 'ferme', 'interesse', 'accepte', 'refus'],
  flyers: ['accepte'],
  controle: ['code_utilise', 'code_dormant'],
};

function dateLisible(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Copie dans le presse-papiers — même geste que CodeMarchand.tsx. */
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

export function Prospection() {
  const [vue, setVue] = useState<Vue>('a_faire');
  const [liste, setListe] = useState<Prospect[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [resultatsRecherche, setResultatsRecherche] = useState<Prospect[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [erreurGeo, setErreurGeo] = useState<string | null>(null);
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [compteurJour, setCompteurJour] = useState(0);

  // La liste peut bouger sous les pieds (temps réel désactivé ici volontairement :
  // un admin seul à scooter n'a pas besoin d'un rafraîchissement qui lui fait perdre
  // sa position de lecture au milieu d'une fiche). On recharge après chaque geste.
  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase
      .from('prospects_pilotage')
      .select('*')
      .not('prochaine_action', 'is', null)
      .order('rang', { ascending: true })
      .limit(200);
    setChargement(false);
    if (error) { setErr(error.message); return; }
    setErr(null);
    setListe((data ?? []) as Prospect[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    const jour = new Date().toISOString().slice(0, 10);
    const clef = `prospection-compteur-${jour}`;
    try {
      setCompteurJour(Number(localStorage.getItem(clef) ?? '0'));
    } catch {
      // localStorage indisponible (navigation privée) : le compteur repart de zéro, sans bloquer.
    }
  }, []);

  function noterGeste() {
    const jour = new Date().toISOString().slice(0, 10);
    const clef = `prospection-compteur-${jour}`;
    setCompteurJour((n) => {
      const suivant = n + 1;
      try { localStorage.setItem(clef, String(suivant)); } catch { /* tant pis */ }
      return suivant;
    });
  }

  const topTrente = useMemo(() => liste.slice(0, 30), [liste]);

  const autourDeMoi = useMemo(() => {
    if (!position) return [];
    return liste
      .map((p) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { p, d: distanceKm(position.lat, position.lng, lat, lng) };
      })
      .filter((x): x is { p: Prospect; d: number } => x !== null)
      .sort((a, b) => a.d - b.d)
      .slice(0, 30);
  }, [liste, position]);

  function localiser() {
    setErreurGeo(null);
    if (!navigator.geolocation) { setErreurGeo('Géolocalisation non disponible sur cet appareil.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setErreurGeo('Position refusée. Autorise la géolocalisation pour voir les fiches autour de toi.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function chercher(q: string) {
    setRecherche(q);
    const propre = q.trim();
    if (propre.length < 2) { setResultatsRecherche([]); return; }
    const { data, error } = await supabase
      .from('prospects_pilotage')
      .select('*')
      .or(`nom.ilike.%${propre}%,etablissement.ilike.%${propre}%,zone.ilike.%${propre}%`)
      .order('nom', { ascending: true })
      .limit(50);
    if (error) { setErr(error.message); return; }
    setResultatsRecherche((data ?? []) as Prospect[]);
  }

  const ficheOuverte = ficheId
    ? liste.find((p) => p.id === ficheId)
      ?? resultatsRecherche.find((p) => p.id === ficheId)
      ?? autourDeMoi.find((x) => x.p.id === ficheId)?.p
      ?? null
    : null;

  return (
    <div className="card">
      <h2>🏨 Prospection des hébergements</h2>
      {err ? (
        <div className="warn" style={{ marginBottom: 14 }}>
          Chargement interrompu : {err}. <button className="btn ghost petit" onClick={() => void charger()}>Réessayer</button>
        </div>
      ) : null}

      <div className="gestes" style={{ marginBottom: 16 }}>
        <button className={`btn petit ${vue === 'a_faire' ? '' : 'ghost'}`} onClick={() => setVue('a_faire')}>À faire</button>
        <button className={`btn petit ${vue === 'autour' ? '' : 'ghost'}`} onClick={() => setVue('autour')}>Autour de moi</button>
        <button className={`btn petit ${vue === 'chercher' ? '' : 'ghost'}`} onClick={() => setVue('chercher')}>Chercher</button>
        <span className="pill code-actif" style={{ marginLeft: 'auto' }}>{compteurJour} fait{compteurJour > 1 ? 's' : ''} aujourd'hui</span>
      </div>

      {chargement && liste.length === 0 ? <div className="empty">Chargement…</div> : null}

      {vue === 'a_faire' ? (
        topTrente.length === 0 && !chargement ? (
          <div className="empty">Rien à faire pour l'instant — toutes les fiches actionnables ont une prochaine action datée dans le futur.</div>
        ) : (
          <ListeFiches items={topTrente} onOuvrir={setFicheId} />
        )
      ) : null}

      {vue === 'autour' ? (
        <div>
          {!position ? (
            <div style={{ marginBottom: 14 }}>
              <button className="btn" onClick={localiser}>Utiliser ma position</button>
              {erreurGeo ? <p className="sel-erreur-texte" style={{ marginTop: 8 }}>{erreurGeo}</p> : null}
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 10, fontSize: 12 }}>
                {autourDeMoi.length} fiches les plus proches, avec position connue.
                {' '}<button className="btn ghost petit" onClick={localiser}>Recalculer</button>
              </p>
              <ListeFiches items={autourDeMoi.map((x) => x.p)} distances={autourDeMoi} onOuvrir={setFicheId} />
            </>
          )}
        </div>
      ) : null}

      {vue === 'chercher' ? (
        <div>
          <input
            className="champ"
            style={{ marginBottom: 14 }}
            placeholder="Nom, établissement ou zone…"
            value={recherche}
            onChange={(e) => void chercher(e.target.value)}
          />
          {recherche.trim().length >= 2 && resultatsRecherche.length === 0 ? (
            <div className="empty">Aucune fiche ne correspond.</div>
          ) : (
            <ListeFiches items={resultatsRecherche} onOuvrir={setFicheId} />
          )}
        </div>
      ) : null}

      {ficheOuverte ? (
        <FicheProspect
          prospect={ficheOuverte}
          onFermer={() => setFicheId(null)}
          onAgi={() => { noterGeste(); void charger(); }}
        />
      ) : null}
    </div>
  );
}

function ListeFiches({ items, distances, onOuvrir }: {
  items: Prospect[];
  distances?: { p: Prospect; d: number }[];
  onOuvrir: (id: string) => void;
}) {
  const distanceDe = (id: string) => distances?.find((x) => x.p.id === id)?.d;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((p) => {
        const retard = estEnRetard(p);
        const d = distanceDe(p.id) ?? p.km_restaurant;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOuvrir(p.id)}
            style={{
              textAlign: 'left', background: 'var(--panel-2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '10px 14px', cursor: 'pointer', minHeight: 44,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <strong style={{ fontSize: 14 }}>{p.nom}</strong>
              {retard ? <span className="badge-late">EN RETARD</span> : null}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {p.zone ? `${p.zone} · ` : ''}{typeof d === 'number' ? `${d.toFixed(1)} km` : ''}
              {p.capacite ? ` · ${p.capacite} couchages` : ''}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--accent)' }}>
              {libelleProchaineAction(p)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FicheProspect({ prospect, onFermer, onAgi }: {
  prospect: Prospect;
  onFermer: () => void;
  onAgi: () => void;
}) {
  const [historique, setHistorique] = useState<Action[] | null>(null);
  const [canalChoisi, setCanalChoisi] = useState<string | null>(prospect.prochain_canal);
  const [scriptOuvert, setScriptOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [code, setCode] = useState<CodeInfo | null>(null);
  const [creationCode, setCreationCode] = useState(false);
  const [apercuCode, setApercuCode] = useState<{ valeur: number; jours: number } | null>(null);
  const gestEnCours = useRef(false);
  const { etat: etatCopie, copier } = useCopie();

  const langue = langueProbable(prospect);
  const sujet = canalChoisi ? script(canalChoisi, langue, prospect) : null;
  const restaurant = faitAussiRestaurant(prospect);

  const chargerHistorique = useCallback(async () => {
    const { data, error } = await supabase
      .from('prospect_actions')
      .select('id, canal, sens, resultat, note, interlocuteur, flyers_deposes, fait_le')
      .eq('prospect_id', prospect.id)
      .order('fait_le', { ascending: false });
    if (error) { setErr(error.message); return; }
    setHistorique((data ?? []) as Action[]);
  }, [prospect.id]);

  const chargerCode = useCallback(async () => {
    if (!prospect.code_promo_id) { setCode(null); return; }
    const { data } = await supabase
      .from('promo_codes')
      .select('id, code, description, max_utilisations, expire_le')
      .eq('id', prospect.code_promo_id)
      .maybeSingle();
    if (data) {
      setCode({
        code_id: data.id, code: data.code,
        adresse: prospect.etablissement ?? prospect.nom,
        fiches: 0, max_utilisations: data.max_utilisations, expire_le: data.expire_le,
      });
    }
  }, [prospect.code_promo_id, prospect.etablissement, prospect.nom]);

  useEffect(() => {
    setHistorique(null);
    setCanalChoisi(prospect.prochain_canal);
    setScriptOuvert(false);
    setErr(null);
    setInfo(null);
    setCode(null);
    setCreationCode(false);
    void chargerHistorique();
    void chargerCode();
  }, [prospect.id, chargerHistorique, chargerCode]);

  async function agir(resultat: string, flyers = 0) {
    if (!canalChoisi || gestEnCours.current) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    const { error } = await supabase.rpc('admin_prospect_agir', {
      p_prospect_id: prospect.id,
      p_canal: canalChoisi,
      p_resultat: resultat,
      p_flyers: flyers,
    });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    setInfo(`Enregistré : ${CANAL_LABEL[canalChoisi] ?? canalChoisi} — ${RESULTAT_LABEL[resultat] ?? resultat}.`);
    onAgi();
    await chargerHistorique();
  }

  async function creerCode() {
    if (gestEnCours.current || !apercuCode) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_prospect_creer_code', {
      p_prospect_id: prospect.id,
      p_valeur: apercuCode.valeur,
      p_jours: apercuCode.jours,
    });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    const ligne = Array.isArray(data) ? data[0] : data;
    if (ligne) {
      setCode(ligne as CodeInfo);
      setInfo(`Code ${ligne.code} créé pour ${ligne.fiches} fiche${ligne.fiches > 1 ? 's' : ''} (${ligne.adresse}).`);
    }
    setCreationCode(false);
    setApercuCode(null);
    onAgi();
  }

  const lienW = canalChoisi === 'whatsapp' && sujet ? lienWhatsApp(prospect.telephone, sujet.corps) : null;
  const lienA = canalChoisi === 'appel' ? lienTel(prospect.telephone) : null;
  const lienM = canalChoisi === 'messenger' ? lienMessenger(prospect.facebook_url) : null;
  const lienE = canalChoisi === 'email' && sujet ? lienMailto(prospect.email, 'Taxi Food — livraison de repas', sujet.corps) : null;
  const carte = lienCarte(prospect.latitude, prospect.longitude);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="boite" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
          <div>
            <h3>{prospect.nom}</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
              {prospect.hote_prenom ? `${prospect.hote_prenom} · ` : ''}{prospect.zone ?? 'zone inconnue'}
              {prospect.capacite ? ` · ${prospect.capacite} couchages` : ''}
              {typeof prospect.km_restaurant === 'number' ? ` · ${prospect.km_restaurant.toFixed(1)} km` : ''}
            </p>
          </div>
          <button className="btn ghost petit" onClick={onFermer}>Fermer</button>
        </div>

        {restaurant ? (
          <div className="warn" style={{ marginTop: 10 }}>
            Fait aussi restaurant — ne jamais laisser de flyers dans sa salle.
          </div>
        ) : null}

        {carte ? (
          <p style={{ margin: '8px 0 0' }}>
            <a className="btn ghost petit" href={carte} target="_blank" rel="noreferrer">📍 Voir sur la carte</a>
          </p>
        ) : null}

        <div className="pied" style={{ justifyContent: 'flex-start', marginTop: 14, marginBottom: 4 }}>
          <strong style={{ fontSize: 13 }}>{libelleProchaineAction(prospect)}</strong>
        </div>

        <div className="gestes" style={{ marginTop: 8, marginBottom: 4 }}>
          {CANAUX_BOUTONS.filter((c) => {
            if (c.canal === 'whatsapp') return !!prospect.telephone;
            if (c.canal === 'appel') return !!prospect.telephone;
            if (c.canal === 'messenger') return !!prospect.facebook_url;
            if (c.canal === 'email') return !!prospect.email;
            return true;
          }).map((c) => (
            <button
              key={c.canal}
              className={`btn petit ${canalChoisi === c.canal ? '' : 'ghost'}`}
              onClick={() => { setCanalChoisi(c.canal); setScriptOuvert(false); }}
            >
              {c.libelle}
            </button>
          ))}
        </div>

        {canalChoisi && sujet ? (
          <div style={{ marginTop: 10 }}>
            <button className="btn ghost petit" onClick={() => setScriptOuvert((v) => !v)}>
              {scriptOuvert ? 'Cacher le script ▲' : 'Voir le script ▼'}
              {langue !== 'fr' ? ` (${langue === 'it' ? 'italien' : 'anglais'})` : ''}
            </button>
            {scriptOuvert ? (
              <div className="recap" style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {sujet.corps}
                <div style={{ marginTop: 10 }}>
                  <button className="btn ghost petit" onClick={() => void copier(sujet.corps)}>
                    {etatCopie === 'copie' ? '✓ Copié' : 'Copier le texte'}
                  </button>
                </div>
                {sujet.objections.length ? (
                  <div style={{ marginTop: 12, fontSize: 12 }}>
                    {sujet.objections.map((o) => (
                      <p key={o.question} style={{ margin: '6px 0' }}><strong>{o.question}</strong><br />{o.reponse}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="gestes" style={{ marginTop: 10 }}>
              {lienW ? <a className="btn petit" href={lienW} target="_blank" rel="noreferrer">Ouvrir WhatsApp</a> : null}
              {lienA ? <a className="btn petit" href={lienA}>Appeler</a> : null}
              {lienM ? <a className="btn petit" href={lienM} target="_blank" rel="noreferrer">Ouvrir Messenger</a> : null}
              {lienE ? <a className="btn petit" href={lienE}>Ouvrir l'e-mail</a> : null}
            </div>
          </div>
        ) : null}

        {canalChoisi ? (
          <div style={{ marginTop: 16 }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>J'ai fait :</p>
            <div className="gestes">
              {(RESULTATS_PAR_CANAL[canalChoisi] ?? []).map((r) => (
                <button
                  key={r}
                  className="btn petit ghost"
                  disabled={envoi}
                  onClick={() => void agir(r, r === 'accepte' && canalChoisi === 'flyers' ? 10 : 0)}
                >
                  {RESULTAT_LABEL[r] ?? r}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {err ? <p className="sel-erreur-texte" style={{ marginTop: 10 }}>{err}</p> : null}
        {info ? <p style={{ marginTop: 10, color: 'var(--green)', fontSize: 13 }}>{info}</p> : null}

        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Code de réduction</p>
          {code ? (
            <div className="gestes">
              <span className="pill code-actif">{code.code}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                max {code.max_utilisations} util. · expire le {dateLisible(code.expire_le)}
              </span>
              <button className="btn ghost petit" onClick={() => void copier(code.code)}>Copier</button>
            </div>
          ) : creationCode ? (
            apercuCode ? (
              <div>
                <p style={{ fontSize: 13, margin: '0 0 10px' }}>
                  Créer un code pour <strong>{prospect.etablissement ?? prospect.nom}</strong>, valable {apercuCode.jours} jours,
                  {' '}{apercuCode.valeur}% de remise sur la livraison. Il sera posé sur toutes les fiches du même établissement.
                </p>
                <div className="gestes">
                  <button className="btn petit" disabled={envoi} onClick={() => void creerCode()}>
                    {envoi ? 'Création…' : 'Confirmer la création'}
                  </button>
                  <button className="btn ghost petit" onClick={() => setApercuCode(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <button className="btn petit" onClick={() => setApercuCode({ valeur: 50, jours: 90 })}>
                Prévisualiser le code
              </button>
            )
          ) : (
            <button className="btn ghost petit" onClick={() => setCreationCode(true)}>Créer un code</button>
          )}
        </div>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Historique</p>
          {historique === null ? (
            <p className="muted" style={{ fontSize: 12 }}>Chargement…</p>
          ) : historique.length === 0 ? (
            <p className="muted" style={{ fontSize: 12 }}>Aucun contact enregistré.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historique.map((a) => (
                <div key={a.id} className="resultat" style={{ padding: '6px 0' }}>
                  <span className="dot-avail" />
                  <span style={{ fontSize: 13 }}>
                    {dateLisible(a.fait_le)} · {CANAL_LABEL[a.canal] ?? a.canal} · {RESULTAT_LABEL[a.resultat] ?? a.resultat}
                    {a.note ? ` — ${a.note}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
