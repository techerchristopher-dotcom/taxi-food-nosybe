'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';
import {
  entierSaisi, etatDuCode, lienWhatsApp, messageWhatsApp, nomDeCodePropose,
  normaliserNomDeCode, numeroASurveiller, numeroDeCommande, telephoneLisible,
} from '../lib/codeOffert';
import type { EtatCode } from '../lib/codeOffert';

/**
 * Offrir un repas ou une livraison à UN client, dans UN restaurant.
 *
 * Le geste commercial du 2026-09-14 (retard, erreur, fidélité) n'avait qu'un
 * outil : un code promo public, valable pour tout le monde et payé par Taxi
 * Food. Le code offert est nominatif, à usage unique, et un repas offert est
 * payé par le restaurant qui fait le geste.
 *
 * Cinq partis pris.
 *
 * 1. LA BASE DÉCIDE, L'ÉCRAN MONTRE. Le nom final, le suffixe en cas de
 *    collision, les refus : tout vient d'`admin_creer_codes_offerts`. L'écran
 *    ne fait qu'annoncer ce que la base va faire, pour qu'on valide en
 *    connaissance de cause.
 * 2. LE PAYEUR SUIT L'OFFRE, ET NE SE CHOISIT PAS. Repas → restaurant ;
 *    livraison → Taxi Food. La base refuse une livraison payée par un
 *    restaurant (elle lui ferait payer une course qu'il n'encaisse pas) ;
 *    proposer le choix, ce serait proposer un geste que la base refusera.
 * 3. DEUX TEMPS AVANT CE QUI ENGAGE. Créer un code, écrire à un client,
 *    désactiver : même modèle que `Remboursements.tsx` — une boîte relit ce qui
 *    va partir, un verrou synchrone empêche le double clic.
 * 4. JAMAIS « ENVOYÉ ». La base ne reçoit aucun retour : ni de n8n pour
 *    l'e-mail, ni de WhatsApp. Elle sait qu'un e-mail a été DEMANDÉ et qu'une
 *    conversation a été OUVERTE ; l'écran n'en dit pas plus.
 * 5. WHATSAPP PAR UN VRAI LIEN. Un `window.open` lancé après un appel réseau
 *    perd le geste de l'utilisateur et se fait bloquer par le navigateur. Un
 *    `<a href>` ouvre la conversation à coup sûr ; la trace part à côté.
 */

type Resto = { id: string; name: string };

type Client = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  telephone: string | null;
  nb_commandes: number;
  derniere_commande: string | null;
};

type CodeOffert = {
  code_id: string;
  code: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  telephone: string | null;
  restaurant_nom: string | null;
  offre: string;
  plafond: number | null;
  inclut_boissons: boolean;
  pris_en_charge_par: string;
  expire_le: string | null;
  actif: boolean;
  utilise: boolean;
  order_number: string | null;
  email_demande_le: string | null;
  whatsapp_ouvert_le: string | null;
  motif: string | null;
  created_at: string;
};

type Formulaire = {
  restaurantId: string;
  offre: 'repas' | 'livraison';
  inclutBoissons: boolean;
  plafond: string;
  validite: string;
  commande: string;
  motif: string;
};

// Les défauts sont ceux de la base (plafond 37 000 Ar, 30 jours, boissons
// exclues) : un admin qui ne touche à rien obtient ce que la décision du
// 2026-09-14 a fixé.
const FORMULAIRE_INITIAL: Formulaire = {
  restaurantId: '', offre: 'repas', inclutBoissons: false,
  plafond: '37000', validite: '30', commande: '', motif: '',
};

type Boite =
  | { type: 'generer'; commande: { id: string; numero: string; restaurantId: string } | null }
  | { type: 'email'; code: CodeOffert }
  | { type: 'desactiver'; code: CodeOffert }
  | { type: 'message'; code: CodeOffert; message: string };

const ETAT_LIBELLE: Record<EtatCode, string> = {
  actif: 'Actif', utilise: 'Utilisé', expire: 'Expiré', desactive: 'Désactivé',
};

// Même délai que la frappe d'un numéro de téléphone : assez pour ne pas
// interroger la base à chaque chiffre, assez court pour paraître immédiat.
const ANTI_REBOND_MS = 350;

// ⚠️ À l'heure de Nosy Be, pas du navigateur : l'admin peut ouvrir l'écran depuis la France
// (1 à 2 h de décalage), et le message remis au client raisonne déjà en heure de Nosy Be
// (`dernierJourValable`). Sans fuseau imposé, « Expire le » et la date annoncée au client
// pouvaient différer d'un jour.
const FORMAT_NOSY_BE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Indian/Antananarivo',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateHeure(iso: string | null): string {
  if (!iso) return '—';
  const p = Object.fromEntries(FORMAT_NOSY_BE.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const anneeCourante = FORMAT_NOSY_BE.formatToParts(new Date()).find((x) => x.type === 'year')?.value;
  const annee = p.year !== anneeCourante ? `/${p.year}` : '';
  return `${p.day}/${p.month}${annee} ${p.hour}h${p.minute}`;
}

function libelleOffre(c: CodeOffert): string {
  if (c.offre === 'livraison') return 'Livraison offerte';
  return c.inclut_boissons ? 'Repas offert, boissons incluses' : 'Repas offert';
}

export function CodesOfferts() {
  const [restos, setRestos] = useState<Resto[]>([]);
  const [codes, setCodes] = useState<CodeOffert[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState<Formulaire>(FORMULAIRE_INITIAL);
  const [selection, setSelection] = useState<Client[]>([]);
  const [nomCode, setNomCode] = useState('');

  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Client[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  // Une réponse lente ne doit pas écraser celle d'une frappe plus récente :
  // « Su » peut revenir après « Sulli » et remplacer la bonne liste.
  const rechercheSeq = useRef(0);

  const [crees, setCrees] = useState<string[]>([]);
  const [filtre, setFiltre] = useState('');
  const [copie, setCopie] = useState<string | null>(null);

  const [boite, setBoite] = useState<Boite | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [preparation, setPreparation] = useState(false);

  // ⚠️ Double clic : `setEnvoi(true)` ne désactive le bouton qu'au rendu
  // suivant. Deux clics rapprochés créeraient deux codes pour le même client
  // (MERCISULLI et MERCISULLI2), ou demanderaient deux e-mails. Même verrou
  // synchrone que dans Remboursements.tsx.
  const gestEnCours = useRef(false);
  // WhatsApp : le lien s'ouvre à chaque clic, mais la trace n'a pas à doubler.
  const whatsappNote = useRef(new Map<string, number>());

  const charger = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from('restaurants').select('id, name').order('name'),
      supabase.rpc('admin_lister_codes_offerts'),
    ]);
    setChargement(false);
    if (r.error) { setErr(r.error.message); return; }
    if (c.error) { setErr(c.error.message); return; }
    setRestos((r.data ?? []) as Resto[]);
    setCodes((c.data ?? []) as CodeOffert[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    const q = recherche.trim();
    const seq = ++rechercheSeq.current;
    // La base ne cherche pas en dessous de deux caractères (une lettre
    // ramènerait tout le fichier client) : inutile de l'appeler pour rien.
    if (q.length < 2) {
      setResultats([]);
      setRechercheEnCours(false);
      return;
    }
    setRechercheEnCours(true);
    const minuterie = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_chercher_clients', { p_q: q });
      if (seq !== rechercheSeq.current) return;
      setRechercheEnCours(false);
      if (error) { setErr(error.message); return; }
      setResultats((data ?? []) as Client[]);
    }, ANTI_REBOND_MS);
    return () => clearTimeout(minuterie);
  }, [recherche]);

  const repas = form.offre === 'repas';
  const plafond = entierSaisi(form.plafond);
  const validite = entierSaisi(form.validite);
  const restoChoisi = restos.find((r) => r.id === form.restaurantId) ?? null;

  const clientUnique = selection.length === 1 ? selection[0] : null;
  const nomPropose = clientUnique ? nomDeCodePropose(clientUnique.full_name) : '';

  // Nouveau client, nouveau nom : garder celui tapé pour le client précédent
  // offrirait « MERCISULLI » à Hery.
  useEffect(() => { setNomCode(nomPropose); }, [nomPropose, clientUnique?.user_id]);

  const nomNormalise = clientUnique ? normaliserNomDeCode(nomCode) : '';
  // Le nom n'est IMPOSÉ que s'il a été modifié. Laissé tel quel, la base garde
  // la main : nom déjà pris → MERCISULLI2. Imposé, elle refuse plutôt que de
  // le changer — c'est ce qu'on veut quand l'admin a choisi « MERCIFAMILLE ».
  const nomImpose = clientUnique && nomNormalise !== nomPropose ? nomNormalise : null;

  const erreurFormulaire =
    !form.restaurantId ? 'Choisis le restaurant.'
    : selection.length === 0 ? 'Choisis au moins un client.'
    : repas && (Number.isNaN(plafond) || plafond <= 0) ? 'Plafond : un montant en ariary, supérieur à zéro.'
    : Number.isNaN(validite) || validite < 1 || validite > 365 ? 'Validité : entre 1 et 365 jours.'
    : clientUnique && (nomNormalise.length < 4 || nomNormalise.length > 30) ? 'Nom du code : 4 à 30 lettres ou chiffres.'
    : null;

  function ouvrir(b: Boite) {
    setErr(null);
    setInfo(null);
    setBoite(b);
  }

  function fermer() {
    if (gestEnCours.current) return;
    setBoite(null);
    setErr(null);
  }

  function ajouterClient(c: Client) {
    setSelection((s) => (s.some((x) => x.user_id === c.user_id) ? s : [...s, c]));
  }

  /**
   * Première étape de « Générer » : retrouver la commande d'origine AVANT la
   * boîte de confirmation. Un numéro mal tapé doit se lire ici, pas revenir en
   * erreur Postgres après validation.
   */
  async function preparer() {
    if (erreurFormulaire || preparation) return;
    setErr(null);
    setInfo(null);
    const numero = numeroDeCommande(form.commande);
    if (!numero) {
      setBoite({ type: 'generer', commande: null });
      return;
    }
    setPreparation(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, restaurant_id')
      .eq('order_number', numero)
      .maybeSingle();
    setPreparation(false);
    if (error) { setErr(error.message); return; }
    const o = data as { id: string; order_number: string; restaurant_id: string } | null;
    if (!o) {
      setErr(`Commande ${numero} introuvable. Vérifie le numéro, ou laisse le champ vide.`);
      return;
    }
    setBoite({ type: 'generer', commande: { id: o.id, numero: o.order_number, restaurantId: o.restaurant_id } });
  }

  async function creer() {
    if (!boite || boite.type !== 'generer' || gestEnCours.current || erreurFormulaire) return;
    gestEnCours.current = true;
    setEnvoi(true);
    const { data, error } = await supabase.rpc('admin_creer_codes_offerts', {
      p_user_ids: selection.map((c) => c.user_id),
      p_restaurant_id: form.restaurantId,
      p_offre: form.offre,
      p_plafond: repas ? plafond : null,
      p_inclut_boissons: repas && form.inclutBoissons,
      p_validite_jours: validite,
      p_motif: form.motif.trim() || null,
      p_commande_origine_id: boite.commande?.id ?? null,
      // Écrit en toutes lettres plutôt que laissé au défaut de la base : ce qui
      // part est exactement ce que la boîte vient d'afficher.
      p_pris_en_charge_par: repas ? 'restaurant' : 'taxi_food',
      p_code_force: nomImpose,
    });
    gestEnCours.current = false;
    setEnvoi(false);
    // La boîte reste ouverte sur une erreur : « le code existe déjà » se
    // corrige en revenant au formulaire, pas en recommençant tout.
    if (error) { setErr(error.message); return; }

    const lignes = (data ?? []) as { code_id: string; code: string }[];
    setBoite(null);
    setErr(null);
    setCrees(lignes.map((l) => l.code_id));
    setSelection([]);
    setRecherche('');
    setForm((f) => ({ ...f, commande: '', motif: '' }));
    const n = lignes.length;
    setInfo(`${n} code${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''} : ${lignes.map((l) => l.code).join(', ')}. Rien n'est encore parti chez le client.`);
    await charger();
  }

  async function demanderEmail() {
    if (!boite || boite.type !== 'email' || gestEnCours.current) return;
    const code = boite.code;
    gestEnCours.current = true;
    setEnvoi(true);
    const { data, error } = await supabase.rpc('admin_envoyer_codes_email', { p_code_ids: [code.code_id] });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    setBoite(null);
    // La base ne crée aucune demande pour un code qui ne servirait plus à rien :
    // le client recevrait un cadeau refusé à la caisse. Zéro n'est pas une panne.
    if (Number(data ?? 0) === 0) {
      setErr(`Aucune demande enregistrée pour ${code.code} : le code n'est plus actif, a expiré, a déjà servi, ou le client n'a pas d'e-mail.`);
    } else {
      setErr(null);
      setInfo(`E-mail demandé pour ${code.code} à ${dateHeure(new Date().toISOString()).slice(-5)}. La demande est transmise au service d'envoi : aucune confirmation de réception ne revient ici.`);
    }
    await charger();
  }

  async function desactiver() {
    if (!boite || boite.type !== 'desactiver' || gestEnCours.current) return;
    const code = boite.code;
    gestEnCours.current = true;
    setEnvoi(true);
    const { error } = await supabase.rpc('admin_desactiver_code_offert', { p_code_id: code.code_id });
    gestEnCours.current = false;
    setEnvoi(false);
    if (error) { setErr(error.message); return; }
    setBoite(null);
    setErr(null);
    setInfo(`${code.code} désactivé : ${code.full_name ?? 'le client'} ne peut plus l'utiliser.`);
    await charger();
  }

  function noterWhatsapp(code: CodeOffert) {
    // Pas de preventDefault : le lien s'ouvre quoi qu'il arrive, la trace suit.
    const dernier = whatsappNote.current.get(code.code_id) ?? 0;
    if (Date.now() - dernier < 10_000) return;
    whatsappNote.current.set(code.code_id, Date.now());
    void (async () => {
      const { error } = await supabase.rpc('admin_noter_whatsapp', { p_code_id: code.code_id });
      if (error) {
        setErr(`WhatsApp ouvert pour ${code.code}, mais la trace n'a pas été enregistrée : ${error.message}`);
        return;
      }
      await charger();
    })();
  }

  async function copier(code: CodeOffert) {
    const message = messageWhatsApp(code);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Presse-papiers refusé (permission, contexte non sécurisé) : on montre le
      // texte à copier à la main plutôt que d'échouer sans rien dire.
      ouvrir({ type: 'message', code, message });
      return;
    }
    setCopie(code.code_id);
    setTimeout(() => setCopie((c) => (c === code.code_id ? null : c)), 2500);
  }

  function contact(c: { email: string | null; telephone: string | null }) {
    const tel = c.telephone ? telephoneLisible(c.telephone) : null;
    return (
      <>
        {[c.email, tel].filter(Boolean).join(' · ') || 'ni e-mail ni téléphone'}
        {numeroASurveiller(c.telephone) ? (
          <span style={{ color: 'var(--amber)' }}> · numéro à vérifier avant WhatsApp</span>
        ) : null}
      </>
    );
  }

  function suivi(c: CodeOffert) {
    if (!c.email_demande_le && !c.whatsapp_ouvert_le) return null;
    return (
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        {c.email_demande_le ? `E-mail demandé le ${dateHeure(c.email_demande_le)}` : ''}
        {c.email_demande_le && c.whatsapp_ouvert_le ? ' · ' : ''}
        {c.whatsapp_ouvert_le ? `WhatsApp ouvert le ${dateHeure(c.whatsapp_ouvert_le)}` : ''}
      </div>
    );
  }

  /**
   * Les gestes sur un code. Seulement sur un code actif : remettre au client un
   * code expiré, utilisé ou désactivé, c'est lui promettre un cadeau que la
   * caisse refusera.
   */
  function gestes(c: CodeOffert) {
    if (etatDuCode(c) !== 'actif') return <span className="muted" style={{ fontSize: 12 }}>—</span>;
    const lien = lienWhatsApp(c.telephone, messageWhatsApp(c));
    return (
      <div className="gestes">
        {c.email ? (
          <button className="btn ghost petit" disabled={envoi} onClick={() => ouvrir({ type: 'email', code: c })}>
            Envoyer par e-mail
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 11 }}>pas d&apos;e-mail</span>
        )}
        {lien ? (
          <a className="btn ghost petit" href={lien} target="_blank" rel="noopener noreferrer"
             onClick={() => noterWhatsapp(c)}>
            WhatsApp
          </a>
        ) : (
          <span className="muted" style={{ fontSize: 11 }}>pas de téléphone</span>
        )}
        <button className="btn ghost petit" onClick={() => void copier(c)}>
          {copie === c.code_id ? 'Message copié' : 'Copier le message'}
        </button>
        <button className="btn ghost petit danger" disabled={envoi} onClick={() => ouvrir({ type: 'desactiver', code: c })}>
          Désactiver
        </button>
      </div>
    );
  }

  const codesCrees = codes.filter((c) => crees.includes(c.code_id));
  const q = filtre.trim().toLowerCase();
  const visibles = codes.filter((c) => !q
    || [c.code, c.full_name, c.email, c.telephone, c.restaurant_nom, c.order_number]
      .some((v) => (v ?? '').toLowerCase().includes(q)));

  return (
    <>
      {err && !boite ? <div className="card" style={{ marginBottom: 16, color: 'var(--red)' }}>Erreur : {err}</div> : null}
      {info ? <div className="card" style={{ marginBottom: 16, color: 'var(--green)' }}>{info}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Offrir un code à un client</h2>
        <div className="grid moitie" style={{ alignItems: 'start' }}>
          <div>
            <Champ label="Restaurant (obligatoire)">
              <select className="champ" value={form.restaurantId}
                      onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}>
                <option value="">Choisir…</option>
                {restos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Champ>

            <div className="muted" style={{ fontSize: 12, margin: '14px 0 4px' }}>Offre</div>
            <label className="choix">
              <input type="radio" name="offre" checked={repas}
                     onChange={() => setForm({ ...form, offre: 'repas' })} />
              Repas offert (plats, suppléments, emballage)
            </label>
            <label className="choix">
              <input type="radio" name="offre" checked={!repas}
                     onChange={() => setForm({ ...form, offre: 'livraison', inclutBoissons: false })} />
              Livraison offerte
            </label>

            <div className={`payeur ${repas ? 'restaurant' : 'taxi-food'}`}>
              <strong>{repas ? 'Payé par le restaurant' : 'Payé par Taxi Food'}</strong>
              <div className="muted" style={{ marginTop: 2 }}>
                {repas
                  ? 'Le reversement du restaurant baisse du montant offert, et Taxi Food ne prend aucune commission sur cette part.'
                  : 'La livraison revient à Taxi Food : la remise sort de ta marge, le restaurant est payé plein tarif.'}
              </div>
            </div>

            {repas ? (
              <>
                <label className="choix">
                  <input type="checkbox" checked={form.inclutBoissons}
                         onChange={(e) => setForm({ ...form, inclutBoissons: e.target.checked })} />
                  Boissons incluses
                </label>
                <div className="muted" style={{ fontSize: 11, margin: '0 0 12px 24px' }}>
                  Décochée : les Bières et les Softs restent à payer par le client.
                </div>
                <Champ label="Plafond du repas offert (Ar)">
                  <input className="champ" inputMode="numeric" value={form.plafond}
                         onChange={(e) => setForm({ ...form, plafond: e.target.value })} />
                </Champ>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {Number.isNaN(plafond) ? '' : `${formatAr(plafond)} au plus. `}Au-delà, le client paie la différence.
                </div>
              </>
            ) : null}

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <Champ label="Validité (jours)">
                <input className="champ" inputMode="numeric" value={form.validite}
                       onChange={(e) => setForm({ ...form, validite: e.target.value })} />
              </Champ>
              <Champ label="Commande d'origine (facultatif)">
                <input className="champ" placeholder="TF-…" value={form.commande}
                       onChange={(e) => setForm({ ...form, commande: e.target.value })} />
              </Champ>
            </div>
            <div style={{ marginTop: 12 }}>
              <Champ label="Motif (facultatif, conservé avec le code)">
                <input className="champ" placeholder="Ex. : retard de livraison" value={form.motif}
                       onChange={(e) => setForm({ ...form, motif: e.target.value })} />
              </Champ>
            </div>
          </div>

          <div>
            <Champ label="Client : nom, e-mail ou téléphone">
              <input className="champ" placeholder="2 caractères au moins" value={recherche}
                     onChange={(e) => setRecherche(e.target.value)} />
            </Champ>

            {recherche.trim().length >= 2 ? (
              <div style={{ margin: '6px 0 10px' }}>
                {rechercheEnCours ? (
                  <div className="muted" style={{ fontSize: 12, padding: '8px 4px' }}>Recherche…</div>
                ) : resultats.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, padding: '8px 4px' }}>Aucun client trouvé.</div>
                ) : (
                  resultats.map((c) => {
                    const choisi = selection.some((s) => s.user_id === c.user_id);
                    return (
                      <div className="resultat" key={c.user_id}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{c.full_name ?? 'Client sans nom'}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>{contact(c)}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {c.nb_commandes} commande{c.nb_commandes > 1 ? 's' : ''}
                            {c.derniere_commande ? `, la dernière le ${new Date(c.derniere_commande).toLocaleDateString('fr-FR')}` : ''}
                          </div>
                        </div>
                        <button className="btn ghost petit" disabled={choisi} onClick={() => ajouterClient(c)}>
                          {choisi ? 'Choisi' : 'Choisir'}
                        </button>
                      </div>
                    );
                  })
                )}
                {!rechercheEnCours && resultats.length >= 25 ? (
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    Seuls les 25 premiers clients s&apos;affichent : précise la recherche.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="muted" style={{ fontSize: 12, margin: '12px 0 6px' }}>
              {selection.length === 0
                ? 'Aucun client choisi.'
                : `${selection.length} client${selection.length > 1 ? 's' : ''} choisi${selection.length > 1 ? 's' : ''} : un code chacun.`}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selection.map((c) => (
                <span className="puce" key={c.user_id}>
                  {c.full_name ?? c.email ?? 'Client sans nom'}
                  {!c.telephone ? <span className="muted" style={{ fontSize: 11 }}>sans téléphone</span> : null}
                  {!c.email ? <span className="muted" style={{ fontSize: 11 }}>sans e-mail</span> : null}
                  <button type="button" aria-label={`Retirer ${c.full_name ?? 'ce client'}`}
                          onClick={() => setSelection((s) => s.filter((x) => x.user_id !== c.user_id))}>
                    ×
                  </button>
                </span>
              ))}
            </div>

            {clientUnique ? (
              <div style={{ marginTop: 14 }}>
                <Champ label="Nom du code">
                  <input className="champ" value={nomCode} onChange={(e) => setNomCode(e.target.value)} />
                </Champ>
                <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                  {nomImpose !== null ? (
                    <>Nom imposé : <strong>{nomNormalise || '—'}</strong>. S&apos;il existe déjà, la création est refusée.</>
                  ) : (
                    <>Proposé : <strong>{nomPropose}</strong>. S&apos;il est déjà pris, la base ajoute un chiffre ({nomPropose}2).</>
                  )}
                </div>
              </div>
            ) : selection.length > 1 ? (
              <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
                Plusieurs clients : chaque code s&apos;appelle MERCI + prénom, avec un chiffre si le nom est pris.
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn" disabled={erreurFormulaire !== null || preparation} onClick={() => void preparer()}>
            {preparation ? 'Vérification…' : selection.length > 1 ? `Générer ${selection.length} codes` : 'Générer'}
          </button>
          {erreurFormulaire ? <span className="muted" style={{ fontSize: 12 }}>{erreurFormulaire}</span> : null}
        </div>
      </div>

      {codesCrees.length ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--green)' }}>
          <h2>Codes créés à l&apos;instant</h2>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Rien n&apos;est encore parti chez le client. Remets chaque code par e-mail ou par WhatsApp.
          </p>
          {codesCrees.map((c) => (
            <div className="resultat" key={c.code_id} style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>{c.code}</div>
                <div className="muted" style={{ fontSize: 12 }}>{c.full_name ?? '—'} · {contact(c)}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {libelleOffre(c)} · {c.restaurant_nom ?? '—'} · expire le {dateHeure(c.expire_le)}
                </div>
                {suivi(c)}
              </div>
              {gestes(c)}
            </div>
          ))}
        </div>
      ) : null}

      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Codes offerts</h2>
          <input className="champ" placeholder="Code, client, restaurant…" value={filtre}
                 onChange={(e) => setFiltre(e.target.value)}
                 style={{ width: 220, fontSize: 13, padding: '6px 10px' }} />
        </div>

        {chargement ? (
          <div className="empty">Chargement…</div>
        ) : visibles.length === 0 ? (
          <div className="empty">{codes.length ? 'Aucun code ne correspond.' : 'Aucun code offert pour l’instant.'}</div>
        ) : (
          <div className="defile">
            <table>
              <thead>
                <tr>
                  <th>Code</th><th>Client</th><th>Restaurant</th><th>Offre</th>
                  <th className="num">Plafond</th><th>Expire le</th><th>État</th>
                  <th>E-mail demandé le</th><th>WhatsApp ouvert le</th><th>Agir</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => {
                  const etat = etatDuCode(c);
                  return (
                    <tr key={c.code_id}>
                      <td>
                        <strong>{c.code}</strong>
                        {c.motif ? <div className="muted" style={{ fontSize: 11 }}>{c.motif}</div> : null}
                      </td>
                      <td>
                        {c.full_name ?? '—'}
                        <div className="muted" style={{ fontSize: 11 }}>{contact(c)}</div>
                      </td>
                      <td>{c.restaurant_nom ?? '—'}</td>
                      <td>
                        {libelleOffre(c)}
                        <div className="muted" style={{ fontSize: 11 }}>
                          {c.pris_en_charge_par === 'restaurant' ? 'payé par le restaurant' : 'payé par Taxi Food'}
                        </div>
                      </td>
                      <td className="num">{c.plafond != null ? formatAr(c.plafond) : '—'}</td>
                      <td>{dateHeure(c.expire_le)}</td>
                      <td>
                        <span className={`pill code-${etat}`}>
                          {etat === 'utilise' && c.order_number ? `Utilisé ${c.order_number}` : ETAT_LIBELLE[etat]}
                        </span>
                      </td>
                      <td>{c.email_demande_le ? dateHeure(c.email_demande_le) : <span className="muted">—</span>}</td>
                      <td>{c.whatsapp_ouvert_le ? dateHeure(c.whatsapp_ouvert_le) : <span className="muted">—</span>}</td>
                      <td>{gestes(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          <strong>« E-mail demandé »</strong> : la demande est enregistrée et transmise au service d&apos;envoi
          automatique. Tant que ce service n&apos;est pas branché, elle peut ne pas partir, et aucun accusé de
          réception ne revient jusqu&apos;ici — l&apos;écran n&apos;affiche donc jamais « envoyé ». En cas de doute,
          remets aussi le code par WhatsApp.
          {' '}<strong>« WhatsApp ouvert »</strong> : tu as ouvert la conversation depuis cet écran ; le message ne
          part que si tu appuies sur Envoyer dans WhatsApp.
          {' '}Un code est rendu au client si sa commande est refusée ou annulée avant la livraison.
        </p>
      </div>

      {boite ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            {boite.type === 'generer' ? (() => {
              const n = selection.length;
              const autreResto = boite.commande && boite.commande.restaurantId !== form.restaurantId
                ? (restos.find((r) => r.id === boite.commande?.restaurantId)?.name ?? 'un autre restaurant')
                : null;
              return (
                <>
                  <h3>{n > 1 ? `Créer ${n} codes offerts` : 'Créer le code offert'}</h3>
                  <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Dernière étape. Relis, puis valide.</p>
                  <div className="recap">
                    <div>Pour : <strong>{selection.map((c) => c.full_name ?? c.email ?? 'client sans nom').join(', ')}</strong></div>
                    <div>Restaurant : <strong>{restoChoisi?.name ?? '—'}</strong></div>
                    <div>
                      Offre : <strong>
                        {repas
                          ? `Repas offert (plats, suppléments, emballage${form.inclutBoissons ? ', boissons incluses' : ''})`
                          : 'Livraison offerte'}
                      </strong>
                    </div>
                    {repas ? <div>Plafond : <strong>{formatAr(plafond)}</strong>{n > 1 ? ' par code' : ''}</div> : null}
                    <div>
                      <strong style={{ color: repas ? 'var(--accent)' : 'var(--green)' }}>
                        {repas ? 'Payé par le restaurant' : 'Payé par Taxi Food'}
                      </strong>
                    </div>
                    <div>Utilisable une fois, pendant {validite} jour{validite > 1 ? 's' : ''}</div>
                    <div>
                      {clientUnique
                        ? <>Nom du code : <strong>{nomNormalise}</strong>{nomImpose !== null ? ' (imposé)' : ''}</>
                        : 'Noms : MERCI + prénom de chaque client'}
                    </div>
                    {boite.commande ? <div>Commande d&apos;origine : {boite.commande.numero}</div> : null}
                    {form.motif.trim() ? <div className="muted">Motif : {form.motif.trim()}</div> : null}
                  </div>
                  {autreResto ? (
                    <div className="warn" style={{ marginBottom: 12 }}>
                      La commande {boite.commande?.numero} a été passée chez {autreResto}, pas chez {restoChoisi?.name}.
                      Vérifie le restaurant avant de valider.
                    </div>
                  ) : null}
                  <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                    Le code est utilisable dès la validation. Il n&apos;est pas remis au client : tu l&apos;envoies
                    ensuite, code par code.
                  </p>
                  {err ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{err}</p> : null}
                  <div className="pied">
                    <button className="btn ghost" disabled={envoi} onClick={fermer}>Revenir</button>
                    <button className="btn" disabled={envoi || erreurFormulaire !== null} onClick={() => void creer()}>
                      {envoi ? 'Création…' : n > 1 ? `Créer ${n} codes` : 'Créer le code'}
                    </button>
                  </div>
                </>
              );
            })() : boite.type === 'email' ? (
              <>
                <h3>Envoyer {boite.code.code} par e-mail</h3>
                <div className="recap">
                  <div>Client : <strong>{boite.code.full_name ?? '—'}</strong></div>
                  <div>Adresse : <strong>{boite.code.email}</strong></div>
                  <div>{libelleOffre(boite.code)} chez {boite.code.restaurant_nom ?? '—'}</div>
                  {boite.code.email_demande_le
                    ? <div className="muted">Déjà demandé le {dateHeure(boite.code.email_demande_le)}</div>
                    : null}
                </div>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                  La demande part vers le service d&apos;envoi automatique. Tant que ce service n&apos;est pas
                  branché, elle peut ne pas partir, et aucun accusé de réception ne revient ici : la liste
                  affichera « e-mail demandé », pas « envoyé ».
                </p>
                {err ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{err}</p> : null}
                <div className="pied">
                  <button className="btn ghost" disabled={envoi} onClick={fermer}>Annuler</button>
                  <button className="btn" disabled={envoi} onClick={() => void demanderEmail()}>
                    {envoi ? 'Demande…' : 'Demander l’e-mail'}
                  </button>
                </div>
              </>
            ) : boite.type === 'desactiver' ? (
              <>
                <h3>Désactiver {boite.code.code} ?</h3>
                <div className="recap">
                  <div>Client : <strong>{boite.code.full_name ?? '—'}</strong></div>
                  <div>{libelleOffre(boite.code)} chez {boite.code.restaurant_nom ?? '—'}</div>
                  <div className="muted">Expire le {dateHeure(boite.code.expire_le)}</div>
                </div>
                <div className="warn">
                  {boite.code.full_name ?? 'Le client'} ne pourra plus utiliser ce code. Cet écran ne sait pas le
                  réactiver : il faudrait en créer un nouveau.
                </div>
                {err ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{err}</p> : null}
                <div className="pied">
                  <button className="btn ghost" disabled={envoi} onClick={fermer}>Annuler</button>
                  <button className="btn" disabled={envoi} onClick={() => void desactiver()}>
                    {envoi ? 'Désactivation…' : 'Désactiver le code'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Message pour {boite.code.code}</h3>
                <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                  Le navigateur a refusé la copie automatique. Sélectionne le texte et copie-le.
                </p>
                <textarea className="champ" rows={9} readOnly value={boite.message} autoFocus
                          onFocus={(e) => e.currentTarget.select()} />
                <div className="pied">
                  <button className="btn ghost" onClick={fermer}>Fermer</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}
