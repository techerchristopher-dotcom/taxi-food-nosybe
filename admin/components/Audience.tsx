'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 📈 Audience — combien de gens installent l'app, et ce qu'ils y font.
 *
 * ⚠️ TROIS ORIGINES, ET ON NE LES MELANGE PAS. L'ecran le dit ligne par ligne,
 * parce qu'un chiffre dont on ne sait pas d'ou il vient ne sert a rien :
 *
 * 1. **Apple** — rapports de ventes App Store Connect, releves chaque jour par
 *    la fonction Edge `collecter-telechargements` (pg_cron, 12 h 30 a Nosy Be).
 *    Un « premier telechargement » est un appareil qui installe l'app pour la
 *    premiere fois : les mises a jour et les re-installations sont comptees a
 *    part, jamais additionnees avec.
 * 2. **Notre base** — comptes, commandes, clients ayant commande. Immediat.
 * 3. **Umami** — frequentation des sites. Tant qu'aucune cle d'API n'est
 *    deposee, l'ecran renvoie vers les deux tableaux de bord plutot que
 *    d'inventer des chiffres.
 *
 * ⚠️ Google Play n'est PAS branche : il faudra un compte de service Google
 * Cloud que seul le porteur du projet peut creer. La colonne `magasin` existe
 * deja en base, la place est prete.
 */

type Resume = {
  premiers_telechargements_total: number;
  premiers_telechargements_30j: number;
  dernier_releve: { jour: string; statut: string; fait_le: string } | null;
  releves_recents: { jour: string; statut: string; lignes: number; message: string | null; fait_le: string }[];
  comptes: number;
  comptes_30j: number;
  commandes: number;
  commandes_30j: number;
  commandes_livrees: number;
  clients_ayant_commande: number;
  appareils_notifiables: number;
};

type Jour = { jour: string; magasin: string; premiers: number; mises_a_jour: number; autres: number };

const UMAMI_VITRINE = 'https://cloud.umami.is/websites/8be3907d-295a-4b7f-ac06-c398d6a20c57';
const UMAMI_APP = 'https://cloud.umami.is/websites/bff7e721-dac8-4030-b295-5960d0842930';

/** « 16/09 » — l'axe d'une courbe de 30 jours ne tient pas des dates completes. */
function jourCourt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function quand(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Audience() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [jours, setJours] = useState<Jour[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const [r, j] = await Promise.all([
      supabase.rpc('admin_audience_resume'),
      supabase.rpc('admin_telechargements', { p_jours: 30 }),
    ]);
    setChargement(false);
    if (r.error) { setErr(r.error.message); return; }
    if (j.error) { setErr(j.error.message); return; }
    setResume(r.data as Resume);
    setJours((j.data ?? []) as Jour[]);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  if (chargement) return <div className="card"><div className="empty">Chargement…</div></div>;
  if (err) return <div className="card sel-erreur">{err}</div>;
  if (!resume) return <div className="card"><div className="empty">Rien à afficher.</div></div>;

  const appStore = jours.filter((x) => x.magasin === 'app_store');
  const maxi = Math.max(1, ...appStore.map((x) => x.premiers + x.mises_a_jour));
  const retard = resume.dernier_releve
    ? Math.floor((Date.now() - new Date(`${resume.dernier_releve.jour}T12:00:00Z`).getTime()) / 86400000)
    : null;

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Installations iPhone (total)</div>
          <div className="value">{resume.premiers_telechargements_total}</div>
        </div>
        <div className="stat">
          <div className="label">Installations · 30 jours</div>
          <div className="value">{resume.premiers_telechargements_30j}</div>
        </div>
        <div className="stat">
          <div className="label">Comptes créés</div>
          <div className="value">{resume.comptes}</div>
          <div className="label">dont {resume.comptes_30j} sur 30 jours</div>
        </div>
        <div className="stat">
          <div className="label">Commandes</div>
          <div className="value">{resume.commandes}</div>
          <div className="label">{resume.commandes_30j} sur 30 jours · {resume.commandes_livrees} livrées</div>
        </div>
        <div className="stat">
          <div className="label">Clients ayant commandé</div>
          <div className="value">{resume.clients_ayant_commande}</div>
        </div>
        <div className="stat">
          <div className="label">Appareils notifiables</div>
          <div className="value">{resume.appareils_notifiables}</div>
        </div>
      </div>

      <div className="card sel-bloc">
        <h2>App Store · 30 derniers jours</h2>
        {appStore.length === 0 ? (
          <div className="empty">Aucun relevé pour l’instant.</div>
        ) : (
          <div className="aud-courbe">
            {/* ⚠️ Une date sous CHAQUE colonne est illisible a 375 px : trente
                etiquettes se chevauchent et ne forment plus qu'une bouillie
                (« 0/081/082/08… »). Une sur cinq, plus la derniere. */}
            {appStore.map((x, i) => (
              <div className="aud-colonne" key={x.jour} title={`${jourCourt(x.jour)} · ${x.premiers} installation(s), ${x.mises_a_jour} mise(s) à jour`}>
                <div className="aud-barres">
                  <div className="aud-barre premiers" style={{ height: `${(x.premiers / maxi) * 100}%` }} />
                  <div className="aud-barre maj" style={{ height: `${(x.mises_a_jour / maxi) * 100}%` }} />
                </div>
                <div className="aud-jour">
                  {i % 5 === 0 || i === appStore.length - 1 ? jourCourt(x.jour) : '\u00a0'}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="aud-legende">
          <span><i className="aud-puce premiers" /> premières installations</span>
          <span><i className="aud-puce maj" /> mises à jour</span>
        </div>
        <p className="muted sel-texte-court">
          Source : rapports de ventes App Store Connect, relevés automatiquement chaque jour à 12 h 30.
          Une journée sans aucune installation n’a pas de rapport chez Apple : elle est notée « vide »,
          ce qui n’est pas la même chose qu’une panne. Google Play n’est pas encore branché.
        </p>
      </div>

      <div className="card sel-bloc">
        <h2>Les relevés</h2>
        <div className="recap">
          <div>
            Dernier jour relevé : <strong>{resume.dernier_releve?.jour ?? '—'}</strong>
            {resume.dernier_releve ? ` (${resume.dernier_releve.statut})` : ''}
            {retard !== null && retard > 2 ? <span className="badge-late" style={{ marginLeft: 8 }}>{retard} jours de retard</span> : null}
          </div>
          <div className="muted">Relevé le {quand(resume.dernier_releve?.fait_le)}</div>
        </div>
        <div className="sel-liste">
          {(resume.releves_recents ?? []).map((r) => (
            <div className="sel-fiche" key={r.jour}>
              <div className="sel-fiche-haut">
                <span className="sel-nom">{r.jour}</span>
                <span className={`pill ${r.statut === 'ok' ? 'livree' : r.statut === 'vide' ? 'sans_objet' : 'annulee'}`}>
                  {r.statut === 'ok' ? `${r.lignes} ligne(s)` : r.statut === 'vide' ? 'rien ce jour-là' : 'échec'}
                </span>
              </div>
              {r.message ? <div className="muted sel-detail">{r.message}</div> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="card sel-bloc">
        <h2>Fréquentation des sites</h2>
        <p className="muted sel-texte-court">
          Visiteurs, pages vues, provenance et événements (télécharger, vers-app, partage, WhatsApp) sont
          mesurés par Umami, sans cookie. Deux comptes distincts : le plan gratuit n’accepte qu’un site
          par compte.
        </p>
        <div className="sel-gestes">
          <a className="btn sel-btn" href={UMAMI_VITRINE} target="_blank" rel="noopener noreferrer">
            Vitrine et pages de partage
          </a>
          <a className="btn ghost sel-btn" href={UMAMI_APP} target="_blank" rel="noopener noreferrer">
            App web
          </a>
        </div>
        <p className="muted sel-texte-court">
          Pour voir ces chiffres ICI plutôt que là-bas, il faut une clé d’API Umami par compte
          (profil → Settings → API keys → Create key). Une fois créées, elles se déposent dans le
          coffre du serveur — elles ne doivent jamais passer par le navigateur ni par le dépôt.
        </p>
      </div>
    </>
  );
}
