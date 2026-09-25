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
 * 3. **Nos propres compteurs** — `visites_partage` (ouvertures et passages vers
 *    l'app, par groupe Facebook) croises avec `orders.etiquette_partage` (les
 *    commandes). Immediat, et c'est le seul tableau qui dit ce qu'un groupe
 *    RAPPORTE.
 * 4. **Umami** — frequentation des sites. Son API est reservee a l'offre payante
 *    (« API access requires a Pro plan », 2026-09-25) : ses chiffres ne peuvent
 *    pas etre rapatries ici, l'ecran renvoie vers les deux tableaux de bord
 *    plutot que d'inventer quoi que ce soit. C'est precisement pour cela que la
 *    mesure par groupe, elle, est comptee dans NOTRE base.
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

/** Une ligne par groupe Facebook, rendue par `admin_audience_groupes()`. */
type LigneGroupe = {
  etiquette: string;
  ouvertures: number;
  vers_app: number;
  commandes: number;
  livrees: number;
  chiffre_affaires: number;
};
type Groupes = {
  depuis: string;
  jusqua: string;
  premiere_mesure: string | null;
  lignes: LigneGroupe[];
};

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

/** « 2026-09-25 » — le jour local, celui qui sert partout ailleurs dans ce tableau de bord. */
function jourLocal(decalage = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « 25/09 » — assez pour une phrase, pas pour un tableau. */
function jjmm(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Audience() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [jours, setJours] = useState<Jour[]>([]);
  const [groupes, setGroupes] = useState<Groupes | null>(null);
  const [fenetre, setFenetre] = useState(7);
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

  // ⚠️ Chargement SÉPARÉ du reste, et volontairement : une erreur sur les groupes
  // ne doit pas vider l'écran des installations et des commandes, qui n'ont rien à
  // voir. Il se rejoue aussi quand la période change, sans recharger le reste.
  const chargerGroupes = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_audience_groupes', {
      p_depuis: jourLocal(-(fenetre - 1)),
      p_jusqua: jourLocal(0),
    });
    if (error) { setGroupes(null); return; }
    setGroupes(data as Groupes);
  }, [fenetre]);

  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => { void chargerGroupes(); }, [chargerGroupes]);

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

      {/* ── Ce que chaque groupe Facebook rapporte ────────────────────────────
          ⚠️ CES CHIFFRES SONT LES NÔTRES, pas ceux d'Umami. Umami réserve son API
          à son offre payante (« API access requires a Pro plan », 2026-09-25) :
          impossible d'en rapatrier quoi que ce soit ici, et surtout impossible de
          croiser ses visites avec NOS commandes. On compte donc nous-mêmes
          (`visites_partage` + `orders.etiquette_partage`). Umami reste branché
          pour le reste, le bouton plus bas y mène toujours. */}
      <div className="card sel-bloc">
        <h2>Ce que rapporte chaque groupe Facebook</h2>
        <div className="sel-gestes" style={{ marginBottom: 12 }}>
          {[7, 14, 30, 90].map((n) => (
            <button
              key={n}
              className={`btn ${fenetre === n ? '' : 'ghost'} sel-btn`}
              onClick={() => setFenetre(n)}
              type="button"
            >
              {n} jours
            </button>
          ))}
        </div>

        {!groupes ? (
          <div className="empty">Chiffres indisponibles.</div>
        ) : groupes.lignes.length === 0 ? (
          <div className="empty">
            Aucune visite marquée sur la période. Les liens à publier, un par groupe, sont dans
            <code> docs/PARTAGE-FACEBOOK-GROUPES.md</code>.
          </div>
        ) : (
          <table className="cartes">
            <thead>
              <tr>
                <th>Groupe</th>
                <th>Ouvertures</th>
                <th>Vers l’app</th>
                <th>Commandes</th>
                <th>Livrées</th>
                <th>Chiffre d’affaires</th>
              </tr>
            </thead>
            <tbody>
              {groupes.lignes.map((l) => (
                <tr key={l.etiquette}>
                  <td data-label="Groupe"><strong>{l.etiquette}</strong></td>
                  <td data-label="Ouvertures">{l.ouvertures}</td>
                  <td data-label="Vers l’app">{l.vers_app}</td>
                  <td data-label="Commandes">{l.commandes}</td>
                  <td data-label="Livrées">{l.livrees}</td>
                  <td data-label="Chiffre d’affaires">{l.chiffre_affaires.toLocaleString('fr-FR')} Ar</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ⚠️ « Depuis le … » N'EST PAS UNE COQUETTERIE. Les publications faites
            AVANT la mise en place ne portent aucune étiquette : sans cette phrase,
            un zéro se lirait « ce groupe ne marche pas » alors qu'il n'a jamais
            été mesuré. La date affichée est celle de la PREMIÈRE mesure réellement
            enregistrée, pas celle du code. */}
        <p className="muted sel-texte-court">
          Mesuré depuis le <strong>{jjmm(groupes?.premiere_mesure)}</strong>. Les publications
          antérieures ne portaient pas d’étiquette : elles ne comptent nulle part, et un zéro sur un
          groupe publié avant cette date ne veut rien dire.
        </p>
        <p className="muted sel-texte-court">
          Le classement se fait sur les <strong>commandes</strong>, puis sur les passages vers
          l’application : ouvrir une page ne coûte rien, aller vers l’app est le premier geste qui
          ressemble à un client. Le chiffre d’affaires ne compte que les commandes <strong>livrées</strong>.
          Une commande est attribuée au groupe du lien par lequel le client est arrivé, dans les
          <strong> 7 jours</strong> précédents.
        </p>
        <p className="muted sel-texte-court">
          ⚠️ Un groupe n’apparaît que si son lien porte son étiquette (<code>…/jour?g=boncoin</code>).
          Partager la publication de la page dans un groupe, au lieu d’y publier le lien marqué, ne
          mesure rien — la procédure est dans <code>docs/PARTAGE-FACEBOOK-GROUPES.md</code>.
        </p>
      </div>

      <div className="card sel-bloc">
        <h2>Fréquentation des sites</h2>
        <p className="muted sel-texte-court">
          Visiteurs, pages vues, provenance et événements sont mesurés par Umami, sans cookie. Deux
          comptes distincts : le plan gratuit n’accepte qu’un site par compte.
          ⚠️ Son <strong>API est réservée à l’offre payante</strong> : ces chiffres-là ne peuvent pas
          être affichés ici, il faut ouvrir Umami. Le tableau des groupes ci-dessus, lui, vient de
          notre propre base.
        </p>
        <div className="sel-gestes">
          <a className="btn ghost sel-btn" href={UMAMI_VITRINE} target="_blank" rel="noopener noreferrer">
            Ouvrir Umami · vitrine
          </a>
          <a className="btn ghost sel-btn" href={UMAMI_APP} target="_blank" rel="noopener noreferrer">
            Ouvrir Umami · app web
          </a>
        </div>
      </div>

    </>
  );
}
