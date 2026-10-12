'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';

/**
 * 📱 Paiements Orange Money encaissés à la livraison (2026-10-12).
 *
 * Le client paie à la livraison. Quand il paie par Orange Money au +261 37 34 379 12
 * (TECHER Jean Christopher), le livreur le déclare dans l'appli (ou l'admin depuis Temps
 * réel / ci-dessous) : la commande arrive ici « à vérifier ». On regarde le téléphone,
 * puis :
 *   - « Reçu » : l'argent est arrivé (référence de transaction facultative) ;
 *   - « Relancer » : un push ET un e-mail au SEUL client, une fois par jour au plus
 *     (garde-fou en base). Fonction Edge `relancer-orange-money`.
 *
 * Tout passe par des RPC `is_admin()` : `admin_paiements_orange_money`,
 * `admin_om_marquer_recu`, `admin_om_annuler_recu`, `admin_definir_encaissement`.
 */

type Relance = { le: string; statut: string; push: string | null; email: string | null };

type Ligne = {
  order_id: string;
  order_number: string;
  restaurant: string | null;
  client: string | null;
  telephone: string | null;
  par_telephone: boolean;
  montant: number;
  livree_le: string;
  jours_attente: number;
  etat: 'a_verifier' | 'recu';
  declare_role: 'livreur' | 'admin';
  recu_le: string | null;
  recu_par: string | null;
  reference: string | null;
  nb_relances: number;
  derniere_relance: string | null;
  derniere_relance_statut: string | null;
  relance_aujourdhui: boolean;
  relances: Relance[];
};

const ERREURS: Record<string, string> = {
  'orange_money:deja_recu': 'Déjà marqué reçu : annule d’abord le « reçu ».',
  'orange_money:pas_livree': 'La commande n’est pas encore livrée.',
  'orange_money:commande_carte': 'Commande payée par carte : rien à encaisser.',
  'orange_money:reference_trop_longue': 'Référence trop longue (64 caractères au plus).',
  'orange_money:introuvable_ou_deja_recu': 'Déjà reçu, ou commande introuvable.',
  deja_relance_aujourdhui: 'Déjà relancé aujourd’hui : une relance par jour au plus.',
  sans_compte_client: 'Commande par téléphone : pas de compte client à relancer. Appelle-le.',
  deja_recu: 'Déjà reçu : plus rien à relancer.',
};

function message(e: unknown): string {
  const brut = e instanceof Error ? e.message : String(e ?? '');
  for (const [cle, texte] of Object.entries(ERREURS)) if (brut.includes(cle)) return texte;
  return brut || 'Erreur inconnue';
}

function dateHeure(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Indian/Antananarivo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** « ok:1_appareil(s) » → « ✓ », le reste en clair court. */
function canal(r: string | null): string {
  if (!r) return '—';
  if (r.startsWith('ok')) return '✓';
  if (r === 'aucun_appareil') return 'pas d’appli';
  if (r === 'sans_adresse') return 'pas d’e-mail';
  if (r === 'ticket_ok_sans_recu') return 'envoyé, non confirmé';
  return '✗ ' + r;
}

export function OrangeMoney() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [voirRecus, setVoirRecus] = useState(false);
  const [numero, setNumero] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await supabase.rpc('admin_paiements_orange_money');
    setChargement(false);
    if (error) { setErr(message(error)); return; }
    setLignes((data ?? []) as Ligne[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const aVerifier = useMemo(() => lignes.filter((l) => l.etat === 'a_verifier'), [lignes]);
  const recus = useMemo(() => lignes.filter((l) => l.etat === 'recu'), [lignes]);
  const totalAVerifier = aVerifier.reduce((s, l) => s + l.montant, 0);

  async function recu(l: Ligne) {
    const ref = window.prompt(
      `${l.order_number} — ${formatAr(l.montant)} reçu sur Orange Money ?\n\n`
      + 'Référence de la transaction (facultatif, laisse vide sinon) :', '');
    if (ref === null) return;
    setOccupe(l.order_id); setErr(null); setInfo(null);
    const { error } = await supabase.rpc('admin_om_marquer_recu', { p_order_id: l.order_id, p_reference: ref });
    setOccupe(null);
    if (error) { setErr(message(error)); return; }
    setInfo(`${l.order_number} marquée reçue.`);
    await charger();
  }

  async function annulerRecu(l: Ligne) {
    if (!window.confirm(`Repasser ${l.order_number} en « à vérifier » ?`)) return;
    setOccupe(l.order_id); setErr(null);
    const { error } = await supabase.rpc('admin_om_annuler_recu', { p_order_id: l.order_id });
    setOccupe(null);
    if (error) { setErr(message(error)); return; }
    await charger();
  }

  async function relancer(l: Ligne) {
    if (!window.confirm(
      `Relancer ${l.client ?? 'le client'} pour ${l.order_number} (${formatAr(l.montant)}) ?\n\n`
      + 'Une notification et un e-mail partent à ce seul client, avec le montant, le numéro de commande '
      + 'et « Orange Money au +261 37 34 379 12 (TECHER Jean Christopher) ».')) return;
    setOccupe(l.order_id); setErr(null); setInfo(null);
    const { data, error } = await supabase.functions.invoke('relancer-orange-money', { body: { order_id: l.order_id } });
    setOccupe(null);
    if (error) {
      // 409 : refus de la base (déjà relancé aujourd'hui, etc.) — le corps porte le code.
      let code = '';
      try { code = (await (error as { context?: Response }).context?.json())?.code ?? ''; } catch { /* rien */ }
      setErr(message(code || error));
      await charger();
      return;
    }
    const r = data as { push?: string; email?: string };
    setInfo(`Relance ${l.order_number} — notification : ${canal(r.push ?? null)} · e-mail : ${canal(r.email ?? null)}`);
    await charger();
  }

  /** Une commande déjà livrée en « espèces » que le client a en fait payée par Orange Money. */
  async function declarer() {
    const n = numero.trim().toUpperCase().replace(/\s+/g, '');
    if (!n) return;
    const num = n.startsWith('TF-') ? n : `TF-${n.replace(/^TF/, '')}`;
    setErr(null); setInfo(null);
    const { data, error } = await supabase.from('orders').select('id, order_number, status, payment_method, total')
      .eq('order_number', num).maybeSingle();
    if (error || !data) { setErr(`Commande ${num} introuvable.`); return; }
    if (!window.confirm(`${num} (${formatAr(data.total)}) : payée par Orange Money ? Elle passera « à vérifier ».`)) return;
    const { error: e2 } = await supabase.rpc('admin_definir_encaissement', { p_order_id: data.id, p_mode: 'orange_money' });
    if (e2) { setErr(message(e2)); return; }
    setNumero('');
    setInfo(`${num} déclarée en Orange Money, à vérifier.`);
    await charger();
  }

  async function repasserEspeces(l: Ligne) {
    if (!window.confirm(`${l.order_number} a finalement été payée en ESPÈCES ? Elle sortira de cette liste.`)) return;
    setOccupe(l.order_id); setErr(null);
    const { error } = await supabase.rpc('admin_definir_encaissement', { p_order_id: l.order_id, p_mode: 'especes' });
    setOccupe(null);
    if (error) { setErr(message(error)); return; }
    await charger();
  }

  const affichees = voirRecus ? recus : aVerifier;

  return (
    <div>
      <div className="stat-row">
        <div className="stat"><div className="label">À vérifier</div><div className="value" style={{ color: 'var(--accent)' }}>{aVerifier.length}</div></div>
        <div className="stat"><div className="label">Montant à vérifier</div><div className="value">{formatAr(totalAVerifier)}</div></div>
        <div className="stat"><div className="label">Reçus</div><div className="value" style={{ color: 'var(--green)' }}>{recus.length}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>📱 Paiements Orange Money</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Payés à la livraison au +261 37 34 379 12 (TECHER Jean Christopher). Le livreur les déclare, toi seul confirmes
          la réception. « À vérifier » n’est pas compté comme encaissé dans le Rapport de clôture.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`tab ${!voirRecus ? 'active' : ''}`} onClick={() => setVoirRecus(false)}>À vérifier ({aVerifier.length})</button>
          <button className={`tab ${voirRecus ? 'active' : ''}`} onClick={() => setVoirRecus(true)}>Reçus ({recus.length})</button>
          <button className="btn ghost" onClick={() => void charger()} disabled={chargement}>Actualiser</button>
        </div>
        {err ? <div style={{ color: 'var(--red)', marginTop: 10, fontWeight: 600 }}>{err}</div> : null}
        {info ? <div style={{ color: 'var(--green)', marginTop: 10, fontWeight: 600 }}>{info}</div> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {chargement ? (
          <div className="empty">Chargement…</div>
        ) : affichees.length === 0 ? (
          <div className="empty">{voirRecus ? 'Aucun paiement reçu pour l’instant.' : 'Rien à vérifier. 👍'}</div>
        ) : (
          <table className="cartes">
            <thead>
              <tr>
                <th>Commande</th><th>Client</th><th>Téléphone</th><th className="num">Montant</th>
                <th>Livrée</th><th>Attente</th><th>État</th><th></th>
              </tr>
            </thead>
            <tbody>
              {affichees.map((l) => (
                <tr key={l.order_id}>
                  <td data-label="Commande">
                    <strong>{l.order_number}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{l.restaurant ?? ''}</div>
                  </td>
                  <td data-label="Client">{l.client ?? '—'}{l.par_telephone ? <span className="muted"> · ☎ tél.</span> : null}</td>
                  <td data-label="Téléphone">{l.telephone ? <a href={`tel:${l.telephone.replace(/\s+/g, '')}`}>{l.telephone}</a> : '—'}</td>
                  <td data-label="Montant" className="num" style={{ fontWeight: 700 }}>{formatAr(l.montant)}</td>
                  <td data-label="Livrée">{dateHeure(l.livree_le)}</td>
                  <td data-label="Attente">{l.etat === 'recu' ? '—' : l.jours_attente === 0 ? 'aujourd’hui' : `${l.jours_attente} j`}</td>
                  <td data-label="État">
                    {l.etat === 'recu' ? (
                      <span className="pill paye">Reçu le {dateHeure(l.recu_le)}{l.recu_par ? ` · ${l.recu_par}` : ''}{l.reference ? ` · réf. ${l.reference}` : ''}</span>
                    ) : (
                      <span className="pill a-reverser">
                        À vérifier{l.nb_relances > 0 ? ` · relancé ${l.nb_relances} fois` : ''}
                      </span>
                    )}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Déclaré par {l.declare_role === 'livreur' ? 'le livreur' : 'l’admin'}
                    </div>
                    {l.relances.length > 0 ? (
                      <details style={{ fontSize: 12, marginTop: 4 }}>
                        <summary>Relances</summary>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                          {l.relances.map((r) => (
                            <li key={r.le}>
                              {dateHeure(r.le)} — notification {canal(r.push)} · e-mail {canal(r.email)}
                              {r.statut === 'echec' ? ' (échec)' : r.statut === 'en_cours' ? ' (en cours)' : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                  <td data-label="">
                    {l.etat === 'a_verifier' ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn petit" disabled={occupe === l.order_id} onClick={() => void recu(l)}>Reçu</button>
                        <button
                          className="btn ghost petit"
                          disabled={occupe === l.order_id || l.relance_aujourdhui || l.par_telephone}
                          title={l.relance_aujourdhui ? 'Déjà relancé aujourd’hui' : l.par_telephone ? 'Commande par téléphone : appelle le client' : ''}
                          onClick={() => void relancer(l)}
                        >
                          {occupe === l.order_id ? '…' : l.relance_aujourdhui ? 'Relancé aujourd’hui' : 'Relancer'}
                        </button>
                        <button className="btn ghost petit" disabled={occupe === l.order_id} onClick={() => void repasserEspeces(l)}>Payé en espèces</button>
                      </div>
                    ) : (
                      <button className="btn ghost petit" disabled={occupe === l.order_id} onClick={() => void annulerRecu(l)}>Annuler « reçu »</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Déclarer une commande déjà livrée</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Un client a payé par Orange Money une commande enregistrée en espèces ? Saisis son numéro.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="TF-123" style={{ maxWidth: 180 }} />
          <button className="btn" onClick={() => void declarer()} disabled={!numero.trim()}>Déclarer en Orange Money</button>
        </div>
      </div>
    </div>
  );
}
