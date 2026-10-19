'use client';

/**
 * Faire entrer les restaurants de Nosy Be au catalogue : la même mécanique que
 * la tournée des hôtes (Prospection.tsx), pour une autre cible.
 *
 * Base : `prospects_restaurant` (422 fiches, recensement web du 2026-09-28),
 * journal append-only `prospect_restaurant_actions`, vue `prospects_restaurant_sequence`
 * (le pilotage + la prochaine étape de la séquence de contact, décidée en base par
 * `prospect_restaurant_etape` ; page /pro/<slug> et rendez-vous : migration 20261019180000)
 * (security_invoker — la RLS admin s'applique). Le geste « J'ai fait » passe par la RPC
 * `admin_prospect_restaurant_agir`, qui écrit le journal ET fait avancer le statut dans
 * la même transaction : l'écran n'écrit jamais le statut à côté.
 *
 * Écrit pour un téléphone tenu à une main, dehors : un verrou synchrone sur chaque
 * bouton d'écriture (même raison que `gestEnCours` dans Remboursements.tsx), jamais
 * d'alert(), et « + Trouvé sur place » pour les gargotes qu'aucun site ne connaît.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { distanceKm, lienCarte, lienTel, lienWhatsApp } from '../lib/prospection';

type Fiche = {
  id: string;
  nom: string;
  type_etablissement: string;
  zone: string | null;
  adresse: string | null;
  telephone: string | null;
  telephone_2: string | null;
  email: string | null;
  facebook_url: string | null;
  site_web: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  sources: string[];
  autres_noms: string | null;
  restaurant_id: string | null;
  aussi_hebergement: string | null;
  statut: string;
  priorite: string | null;
  a_verifier: string | null;
  notes: string | null;
  canal_contact: string;
  nb_actions: number;
  derniere_action_le: string | null;
  dernier_canal: string | null;
  dernier_resultat: string | null;
  km_resto_en_ligne: number | null;
  // Séquence (vue prospects_restaurant_sequence, règle prospect_restaurant_etape en base).
  etape: string | null;
  a_faire_le: string | null;
  raison: string | null;
  numero_wa: string | null;
  nb_ouvertures: number;
  derniere_ouverture: string | null;
  rdv_le: string | null;
  rang: number | null;
  slug: string;
};

type Rdv = {
  id: string; prospect_id: string; nom: string; zone: string | null; adresse: string | null;
  google_maps_url: string | null; debut: string; contact_nom: string; contact_telephone: string;
  message: string | null; statut: string;
};

const PAGE_PRO = 'https://taxifoodnosybe.distripro207.com/pro/';
const ETAPES: Record<string, string> = {
  whatsapp_1: 'WhatsApp', whatsapp_relance: 'Relance WhatsApp', appel: 'Appeler', visite: 'Passer le voir',
  messenger: 'Messenger', repondre: 'Répondre', rdv: 'Rendez-vous',
};

type Action = {
  id: string; canal: string; resultat: string; interlocuteur: string | null;
  offre_faite: string | null; note: string | null; fait_le: string;
};

type Vue = 'a_faire' | 'autour' | 'tout' | 'rdv';

const TYPES: Record<string, string> = {
  restaurant: 'Restaurant', hotel_restaurant: 'Hôtel-restaurant', bar: 'Bar / lounge', gargote: 'Gargote',
  snack: 'Snack', pizzeria: 'Pizzeria', boulangerie: 'Boulangerie / glacier', cafe: 'Café', discotheque: 'Discothèque',
};
const STATUTS: Record<string, string> = {
  a_contacter: 'À contacter', contacte: 'Contacté', interesse: 'Intéressé', rdv: 'Rendez-vous',
  partenaire: 'Partenaire', refuse: 'Refus', ferme: 'Fermé', doublon: 'Doublon', hors_zone: 'Hors zone', exclu: 'Exclu',
};
const STATUT_PILL: Record<string, string> = {
  a_contacter: 'sans_objet', contacte: 'demande', interesse: 'confirmee', rdv: 'en_preparation',
  partenaire: 'livree', refuse: 'annulee', ferme: 'annulee', doublon: 'sans_objet', hors_zone: 'sans_objet', exclu: 'sans_objet',
};
const CANAUX: { canal: string; libelle: string }[] = [
  { canal: 'appel', libelle: 'Appel' }, { canal: 'whatsapp', libelle: 'WhatsApp' },
  { canal: 'messenger', libelle: 'Messenger' }, { canal: 'visite', libelle: 'Visite' },
  { canal: 'degustation', libelle: 'Dégustation' }, { canal: 'email', libelle: 'E-mail' },
];
const RESULTATS: Record<string, string> = {
  pas_de_reponse: 'Pas de réponse', a_rappeler: 'À rappeler', interesse: 'Intéressé', rdv: 'RDV pris',
  accepte: 'Accepte', refus: 'Refus', absent: 'Patron absent', ferme: 'Fermé', mauvais_numero: 'Mauvais numéro',
};
const RESULTATS_PAR_CANAL: Record<string, string[]> = {
  appel: ['pas_de_reponse', 'a_rappeler', 'interesse', 'rdv', 'accepte', 'refus', 'mauvais_numero'],
  whatsapp: ['pas_de_reponse', 'a_rappeler', 'interesse', 'rdv', 'accepte', 'refus', 'mauvais_numero'],
  messenger: ['pas_de_reponse', 'a_rappeler', 'interesse', 'rdv', 'accepte', 'refus'],
  email: ['pas_de_reponse', 'a_rappeler', 'interesse', 'rdv', 'accepte', 'refus'],
  visite: ['absent', 'ferme', 'a_rappeler', 'interesse', 'rdv', 'accepte', 'refus'],
  degustation: ['interesse', 'accepte', 'refus'],
};
const INACTIFS = new Set(['hors_zone', 'exclu', 'doublon', 'ferme', 'refuse', 'partenaire']);

function dateCourte(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function ProspectionRestaurants() {
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('a_faire');
  const [zone, setZone] = useState('');
  const [type, setType] = useState('');
  const [canal, setCanal] = useState('');
  const [texte, setTexte] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [ouverte, setOuverte] = useState<Fiche | null>(null);
  const [ajout, setAjout] = useState(false);
  const finDuJour = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }, []);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('prospects_restaurant_sequence').select('*').limit(2000);
    if (error) setErreur(error.message);
    else { setFiches((data ?? []) as Fiche[]); setErreur(null); }
    setChargement(false);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  function localiser() {
    if (!navigator.geolocation) { setErreur('Géolocalisation indisponible sur cet appareil.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setVue('autour'); },
      () => setErreur('Position refusée ou introuvable.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const zones = useMemo(() => [...new Set(fiches.map((f) => f.zone).filter(Boolean) as string[])].sort(), [fiches]);

  const liste = useMemo(() => {
    const q = texte.trim().toLowerCase();
    let l = fiches.filter((f) => {
      if (vue !== 'tout' && INACTIFS.has(f.statut)) return false;
      if (vue === 'a_faire' && (!f.etape || (f.a_faire_le && new Date(f.a_faire_le).getTime() > finDuJour))) return false;
      if (zone && f.zone !== zone) return false;
      if (type && f.type_etablissement !== type) return false;
      if (canal && f.canal_contact !== canal) return false;
      if (q && !(`${f.nom} ${f.autres_noms ?? ''} ${f.adresse ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
    const dist = (f: Fiche) => (position && f.latitude !== null && f.longitude !== null
      ? distanceKm(position.lat, position.lng, Number(f.latitude), Number(f.longitude)) : null);
    if (vue === 'autour' && position) {
      l = l.filter((f) => dist(f) !== null).sort((a, b) => (dist(a)! - dist(b)!));
    } else {
      // File de travail : l'ordre de la séquence (rang décidé en base : rendez-vous, répondre,
      // page ouverte, relance, premier message, appel, visite), puis les plus proches d'un resto en ligne.
      const poids = (f: Fiche) => (f.rang ?? 20) * 100 + Math.min(f.km_resto_en_ligne ?? 50, 99);
      l = [...l].sort((a, b) => poids(a) - poids(b) || a.nom.localeCompare(b.nom));
    }
    return l.map((f) => ({ f, d: dist(f) }));
  }, [fiches, vue, zone, type, canal, texte, position, finDuJour]);

  const compte = (s: string) => fiches.filter((f) => f.statut === s).length;
  const pagesOuvertes = fiches.filter((f) => f.nb_ouvertures > 0).length;

  return (
    <div>
      <div className="stat-row">
        {(['a_contacter', 'contacte', 'interesse', 'rdv', 'partenaire'] as const).map((s) => (
          <div className="stat" key={s}><div className="label">{STATUTS[s]}</div><div className="value">{compte(s)}</div></div>
        ))}
        <div className="stat"><div className="label">Pages ouvertes</div><div className="value">{pagesOuvertes}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="gestes" style={{ marginBottom: 10 }}>
          <button className={`btn petit ${vue === 'a_faire' ? '' : 'ghost'}`} onClick={() => setVue('a_faire')}>À faire</button>
          <button className={`btn petit ${vue === 'autour' ? '' : 'ghost'}`} onClick={localiser}>📍 Autour de moi</button>
          <button className={`btn petit ${vue === 'tout' ? '' : 'ghost'}`} onClick={() => setVue('tout')}>Toutes les fiches</button>
          <button className={`btn petit ${vue === 'rdv' ? '' : 'ghost'}`} onClick={() => setVue('rdv')}>📅 Rendez-vous</button>
          <button className="btn petit ghost" style={{ marginLeft: 'auto' }} onClick={() => setAjout(true)}>+ Trouvé sur place</button>
        </div>
        <div className="gestes">
          <input className="champ" style={{ flex: '2 1 180px' }} placeholder="Chercher un nom…" value={texte} onChange={(e) => setTexte(e.target.value)} />
          <select className="champ" style={{ flex: '1 1 120px' }} value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">Toutes zones</option>{zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <select className="champ" style={{ flex: '1 1 120px' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="champ" style={{ flex: '1 1 120px' }} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="">Tous canaux</option><option value="telephone">Téléphone</option>
            <option value="facebook">Facebook</option><option value="visite">Sur place seulement</option>
          </select>
        </div>
      </div>

      {erreur ? <div className="warn" style={{ marginBottom: 12 }}>{erreur}</div> : null}
      {vue === 'rdv' ? <RendezVous onMaj={charger} /> : <>
      {chargement ? <p className="muted">Chargement…</p> : null}
      {!chargement && liste.length === 0 ? <p className="empty">Aucune fiche pour ces filtres.</p> : null}

      <div className="card" style={{ padding: 0 }}>
        {liste.slice(0, 300).map(({ f, d }) => (
          <div key={f.id} className="resultat" style={{ cursor: 'pointer', padding: '11px 14px' }} onClick={() => setOuverte(f)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{f.nom}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {TYPES[f.type_etablissement]} · {f.zone ?? 'zone ?'}
                {d !== null ? ` · ${d.toFixed(1)} km de moi` : (f.km_resto_en_ligne !== null ? ` · ${Number(f.km_resto_en_ligne).toFixed(1)} km d'un resto en ligne` : '')}
                {f.derniere_action_le ? ` · ${RESULTATS[f.dernier_resultat ?? ''] ?? ''} ${dateCourte(f.derniere_action_le)}` : ''}
              </div>
              {f.etape ? (
                <div style={{ fontSize: 12, marginTop: 3 }}>
                  <strong>→ {ETAPES[f.etape] ?? f.etape}</strong>
                  {f.etape === 'rdv' ? ` ${dateCourte(f.rdv_le)}` : f.a_faire_le && new Date(f.a_faire_le).getTime() > Date.now() ? ` le ${dateCourte(f.a_faire_le)}` : ''}
                  {f.nb_ouvertures > 0 ? ` · 👀 page ouverte ${f.nb_ouvertures} fois` : ''}
                </div>
              ) : null}
            </div>
            <span className={`pill ${f.canal_contact === 'telephone' ? 'confirmee' : f.canal_contact === 'facebook' ? 'en_livraison' : 'sans_objet'}`}>
              {f.canal_contact === 'telephone' ? '☎' : f.canal_contact === 'facebook' ? 'FB' : 'sur place'}
            </span>
            <span className={`pill ${STATUT_PILL[f.statut]}`}>{STATUTS[f.statut]}</span>
          </div>
        ))}
        {liste.length > 300 ? <p className="muted" style={{ padding: 12 }}>{liste.length - 300} fiches de plus : affinez les filtres.</p> : null}
      </div>
      </>}

      {ouverte ? <FicheRestaurant fiche={ouverte} onFermer={() => setOuverte(null)} onMaj={async () => { await charger(); }} /> : null}
      {ajout ? <AjoutSurPlace position={position} onFermer={() => setAjout(false)} onFait={async () => { setAjout(false); await charger(); }} /> : null}
    </div>
  );
}

function FicheRestaurant({ fiche, onFermer, onMaj }: { fiche: Fiche; onFermer: () => void; onMaj: () => Promise<void> }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [canal, setCanal] = useState<string | null>(null);
  const [interlocuteur, setInterlocuteur] = useState('');
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [tel, setTel] = useState(fiche.telephone ?? '');
  const [statut, setStatut] = useState(fiche.statut);
  const [notes, setNotes] = useState(fiche.notes ?? '');
  const verrou = useRef(false);

  const chargerJournal = useCallback(async () => {
    const { data } = await supabase.from('prospect_restaurant_actions').select('id,canal,resultat,interlocuteur,offre_faite,note,fait_le')
      .eq('prospect_id', fiche.id).order('fait_le', { ascending: false });
    setActions((data ?? []) as Action[]);
  }, [fiche.id]);
  useEffect(() => { chargerJournal(); }, [chargerJournal]);

  async function agir(resultat: string) {
    if (verrou.current || !canal) return;
    verrou.current = true; setErreur(null);
    const { error } = await supabase.rpc('admin_prospect_restaurant_agir', {
      p_prospect: fiche.id, p_canal: canal, p_resultat: resultat,
      p_interlocuteur: interlocuteur.trim() || null, p_note: note.trim() || null,
    });
    verrou.current = false;
    if (error) { setErreur(error.message); return; }
    setFait(`${RESULTATS[resultat]} — noté.`); setCanal(null); setNote('');
    await chargerJournal(); await onMaj();
  }

  async function enregistrer() {
    if (verrou.current) return;
    verrou.current = true; setErreur(null);
    const t = tel.trim() || null;
    const maj: Record<string, unknown> = { statut, notes: notes.trim() || null, telephone: t };
    if (t && t !== fiche.telephone) maj.contact_source = `saisi dans l'admin le ${new Date().toISOString().slice(0, 10)}`;
    if (statut === 'partenaire' && !fiche.restaurant_id) {
      verrou.current = false;
      setErreur('« Partenaire » se pose quand le restaurant est créé au catalogue (Restaurants & menus), pas ici.');
      return;
    }
    const { error } = await supabase.from('prospects_restaurant').update(maj).eq('id', fiche.id);
    verrou.current = false;
    if (error) { setErreur(error.message); return; }
    setEdition(false); setFait('Fiche mise à jour.'); await onMaj();
  }

  const etapeWa = fiche.etape === 'whatsapp_relance' ? 'whatsapp_relance' : 'whatsapp_1';
  const [texteWa, setTexteWa] = useState('');
  useEffect(() => {
    supabase.rpc('admin_texte_whatsapp_prospect', { p_prospect: fiche.id, p_etape: etapeWa })
      .then(({ data }) => setTexteWa((data as string) ?? ''));
  }, [fiche.id, etapeWa]);
  const wa = lienWhatsApp(fiche.numero_wa ? `+${fiche.numero_wa}` : (fiche.telephone ?? fiche.telephone_2), texteWa);
  const pagePro = PAGE_PRO + fiche.slug;

  async function waEnvoye() {
    if (verrou.current) return;
    verrou.current = true; setErreur(null);
    const { error } = await supabase.rpc('admin_prospect_whatsapp_envoye', { p_prospect: fiche.id, p_etape: etapeWa });
    verrou.current = false;
    if (error) { setErreur(error.message); return; }
    setFait('Message WhatsApp noté comme envoyé.');
    await chargerJournal(); await onMaj();
  }
  const appel = lienTel(fiche.telephone ?? fiche.telephone_2);
  const carte = fiche.google_maps_url ?? lienCarte(fiche.latitude, fiche.longitude);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="boite" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
          <div>
            <h3>{fiche.nom}</h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
              {TYPES[fiche.type_etablissement]} · {fiche.zone ?? 'zone inconnue'}{fiche.adresse ? ` · ${fiche.adresse}` : ''}
            </p>
            {fiche.autres_noms ? <p className="muted" style={{ margin: '2px 0 0', fontSize: 11 }}>Aussi : {fiche.autres_noms}</p> : null}
          </div>
          <button className="btn ghost petit" onClick={onFermer}>Fermer</button>
        </div>

        {fiche.a_verifier ? <div className="warn" style={{ marginTop: 10 }}>{fiche.a_verifier}</div> : null}
        {fiche.aussi_hebergement ? <p className="muted" style={{ fontSize: 12 }}>Aussi dans la prospection hébergements ({fiche.aussi_hebergement}) : un seul passage pour les deux.</p> : null}

        <div className="gestes" style={{ marginTop: 12 }}>
          {appel ? <a className="btn petit" href={appel}>☎ {fiche.telephone ?? fiche.telephone_2}</a> : null}
          {wa ? <a className="btn petit ghost" href={wa} target="_blank" rel="noreferrer">WhatsApp</a> : null}
          {fiche.telephone_2 && fiche.telephone ? <a className="btn petit ghost" href={lienTel(fiche.telephone_2) ?? '#'}>☎ 2ᵉ numéro</a> : null}
          {fiche.facebook_url ? <a className="btn petit ghost" href={fiche.facebook_url} target="_blank" rel="noreferrer">Facebook</a> : null}
          {fiche.site_web && fiche.site_web.startsWith('http') ? <a className="btn petit ghost" href={fiche.site_web} target="_blank" rel="noreferrer">Site</a> : null}
          {carte ? <a className="btn petit ghost" href={carte} target="_blank" rel="noreferrer">📍 Carte</a> : null}
        </div>

        <div className="recap" style={{ marginTop: 12 }}>
          {fiche.etape ? (
            <p style={{ margin: '0 0 6px', fontSize: 13 }}>
              <strong>Prochaine étape : {ETAPES[fiche.etape] ?? fiche.etape}</strong>
              {fiche.a_faire_le ? ` · ${new Date(fiche.a_faire_le).getTime() > Date.now() ? 'le ' : 'depuis le '}${dateCourte(fiche.a_faire_le)}` : ''}
              {fiche.raison ? <><br /><span className="muted">{fiche.raison}</span></> : null}
            </p>
          ) : <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>Aucune étape automatique pour cette fiche.</p>}
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Sa page : <a href={`${pagePro}?apercu=1`} target="_blank" rel="noreferrer">{pagePro.replace('https://', '')}</a>
            {' · '}{fiche.nb_ouvertures > 0 ? `👀 ouverte ${fiche.nb_ouvertures} fois (dernière : ${dateCourte(fiche.derniere_ouverture)})` : 'pas encore ouverte'}
          </p>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 11 }}>Le lien de l&apos;admin porte « ?apercu=1 » : ton ouverture n&apos;est pas comptée.</p>
        </div>

        {fiche.numero_wa && (fiche.etape === 'whatsapp_1' || fiche.etape === 'whatsapp_relance') ? (
          <div className="recap" style={{ marginTop: 10 }}>
            <strong style={{ fontSize: 13 }}>{etapeWa === 'whatsapp_relance' ? 'Relance WhatsApp' : 'Premier message WhatsApp'}</strong>
            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{texteWa || '…'}</p>
            <div className="gestes">
              {wa ? <a className="btn petit" href={wa} target="_blank" rel="noreferrer">Ouvrir dans WhatsApp</a> : null}
              <button className="btn petit ghost" onClick={waEnvoye}>Envoyé ✓</button>
            </div>
            <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>D&apos;habitude, c&apos;est la compétence WhatsApp Web qui envoie et note. « Envoyé ✓ » sert si tu l&apos;as envoyé toi-même.</p>
          </div>
        ) : null}

        <div className="recap" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 13 }}>J&apos;ai fait</strong>
          <div className="gestes" style={{ marginTop: 8 }}>
            {CANAUX.map((c) => (
              <button key={c.canal} className={`btn petit ${canal === c.canal ? '' : 'ghost'}`} onClick={() => { setCanal(c.canal); setFait(null); }}>{c.libelle}</button>
            ))}
          </div>
          {canal ? (
            <>
              <input className="champ" style={{ marginTop: 8 }} placeholder="Qui avez-vous eu ? (prénom du patron, du gérant…)" value={interlocuteur} onChange={(e) => setInterlocuteur(e.target.value)} />
              <input className="champ" style={{ marginTop: 8 }} placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="gestes" style={{ marginTop: 8 }}>
                {RESULTATS_PAR_CANAL[canal].map((r) => (
                  <button key={r} className={`btn petit ${r === 'refus' || r === 'ferme' ? 'ghost danger' : ''}`} onClick={() => agir(r)}>{RESULTATS[r]}</button>
                ))}
              </div>
            </>
          ) : null}
          {fait ? <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>✓ {fait}</p> : null}
        </div>

        {erreur ? <div className="warn" style={{ marginTop: 10 }}>{erreur}</div> : null}

        <div style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 13 }}>Historique</strong>
          {actions.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>Aucun contact pour l&apos;instant.</p> : actions.map((a) => (
            <div key={a.id} className="muted" style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              {dateCourte(a.fait_le)} · {CANAUX.find((c) => c.canal === a.canal)?.libelle ?? (a.canal === 'page' ? 'Sa page' : a.canal)} · <strong>{RESULTATS[a.resultat] ?? a.resultat}</strong>
              {a.interlocuteur ? ` · ${a.interlocuteur}` : ''}{a.note ? ` — ${a.note}` : ''}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          {!edition ? (
            <button className="btn ghost petit" onClick={() => setEdition(true)}>Corriger la fiche</button>
          ) : (
            <div className="recap">
              <input className="champ" placeholder="Téléphone" value={tel} onChange={(e) => setTel(e.target.value)} />
              <select className="champ" style={{ marginTop: 8 }} value={statut} onChange={(e) => setStatut(e.target.value)}>
                {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <textarea className="champ" style={{ marginTop: 8 }} rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="pied">
                <button className="btn ghost petit" onClick={() => setEdition(false)}>Annuler</button>
                <button className="btn petit" onClick={enregistrer}>Enregistrer</button>
              </div>
            </div>
          )}
        </div>

        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>Sources : {fiche.sources.join(', ') || '—'}</p>
      </div>
    </div>
  );
}

function AjoutSurPlace({ position, onFermer, onFait }: { position: { lat: number; lng: number } | null; onFermer: () => void; onFait: () => Promise<void> }) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState('gargote');
  const [zone, setZone] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [ici, setIci] = useState(position);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);

  function prendrePosition() {
    navigator.geolocation?.getCurrentPosition(
      (p) => setIci({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setErreur('Position refusée ou introuvable.'), { enableHighAccuracy: true, timeout: 15000 });
  }

  async function ajouter() {
    if (verrou.current) return;
    if (!nom.trim()) { setErreur('Le nom est obligatoire.'); return; }
    verrou.current = true; setErreur(null);
    const jour = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('prospects_restaurant').insert({
      nom: nom.trim(), type_etablissement: type, zone: zone.trim() || null,
      telephone: tel.trim() || null, contact_source: tel.trim() ? `relevé sur place le ${jour}` : null,
      latitude: ici ? Number(ici.lat.toFixed(6)) : null, longitude: ici ? Number(ici.lng.toFixed(6)) : null,
      sources: ['Terrain'], notes: note.trim() || null,
    });
    verrou.current = false;
    if (error) { setErreur(error.message); return; }
    await onFait();
  }

  return (
    <div className="voile" onClick={onFermer}>
      <div className="boite" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3>Trouvé sur place</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Un établissement qu&apos;aucun site ne connaît : il entre dans la file tout de suite.</p>
        <input className="champ" placeholder="Nom (celui de l'enseigne)" value={nom} onChange={(e) => setNom(e.target.value)} />
        <select className="champ" style={{ marginTop: 8 }} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="champ" style={{ marginTop: 8 }} placeholder="Zone (Ambatoloaka, Hell-Ville…)" value={zone} onChange={(e) => setZone(e.target.value)} />
        <input className="champ" style={{ marginTop: 8 }} placeholder="Téléphone affiché (facultatif)" value={tel} onChange={(e) => setTel(e.target.value)} />
        <input className="champ" style={{ marginTop: 8 }} placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="gestes" style={{ marginTop: 8 }}>
          <button className="btn ghost petit" onClick={prendrePosition}>📍 {ici ? 'Position relevée ✓' : 'Relever ma position'}</button>
        </div>
        {erreur ? <div className="warn" style={{ marginTop: 10 }}>{erreur}</div> : null}
        <div className="pied">
          <button className="btn ghost petit" onClick={onFermer}>Annuler</button>
          <button className="btn petit" onClick={ajouter}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

/** Les rendez-vous pris par les restaurateurs sur leur page /pro/<slug>. */
function RendezVous({ onMaj }: { onMaj: () => Promise<void> }) {
  const [liste, setListe] = useState<Rdv[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);
  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_rdv_prospects');
    if (error) setErreur(error.message); else setListe((data ?? []) as Rdv[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function marquer(id: string, statut: string) {
    if (verrou.current) return;
    verrou.current = true; setErreur(null);
    const { error } = await supabase.rpc('admin_rdv_marquer', { p_rdv: id, p_statut: statut });
    verrou.current = false;
    if (error) { setErreur(error.message); return; }
    await charger(); await onMaj();
  }

  const avenir = liste.filter((r) => r.statut === 'confirme');
  const passes = liste.filter((r) => r.statut !== 'confirme');
  return (
    <div>
      {erreur ? <div className="warn" style={{ marginBottom: 12 }}>{erreur}</div> : null}
      <p className="muted" style={{ fontSize: 12 }}>Pris par les restaurateurs sur leur page. Créneaux proposés : lun.–sam., 9h30–11h30 et 14h30–17h (table rdv_disponibilites).</p>
      {avenir.length === 0 ? <p className="empty">Aucun rendez-vous à venir.</p> : null}
      {avenir.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{dateCourte(r.debut)} · {r.nom}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {r.contact_nom} · <a href={lienTel(r.contact_telephone) ?? '#'}>{r.contact_telephone}</a>{r.zone ? ` · ${r.zone}` : ''}
          </div>
          {r.message ? <p style={{ fontSize: 13, margin: '6px 0 0' }}>« {r.message} »</p> : null}
          <div className="gestes" style={{ marginTop: 8 }}>
            {r.google_maps_url ? <a className="btn petit ghost" href={r.google_maps_url} target="_blank" rel="noreferrer">📍 Y aller</a> : null}
            <button className="btn petit" onClick={() => marquer(r.id, 'fait')}>Fait</button>
            <button className="btn petit ghost" onClick={() => marquer(r.id, 'absent')}>Absent</button>
            <button className="btn petit ghost danger" onClick={() => marquer(r.id, 'annule')}>Annulé</button>
          </div>
        </div>
      ))}
      {passes.length ? <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>14 derniers jours : {passes.map((r) => `${r.nom} (${r.statut})`).join(' · ')}</p> : null}
    </div>
  );
}
