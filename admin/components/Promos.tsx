'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 🏷️ Promos — mettre un plat en promo pour quelques jours (2026-10-15).
 *
 * - Le prix promo devient LE prix du plat pendant la période, partout : `create_order` le relit
 *   par `prix_effectif()`, les apps déjà installées sont facturées au prix promo même si elles
 *   affichent encore l'ancien (on facture moins qu'annoncé, jamais plus).
 * - La remise est payée par le RESTAURANT (décision du 2026-10-15) : commission et reversement se
 *   calculent sur le prix promo, comme une vente normale. Le prévenir avant de lancer une promo.
 * - Fin AUTOMATIQUE : le lendemain du dernier jour à 0 h, heure de Madagascar. Aucune tâche
 *   planifiée, c'est l'heure qui décide.
 * - Le plat apparaît « à la une » dans « Offres de la semaine » en haut de l'accueil de l'app.
 */

type Promo = {
  id: string; product_id: string; produit: string; restaurant: string; prix: number; prix_promo: number;
  debut: string; fin: string; libelle: string | null; actif: boolean; en_cours: boolean; commandes: number;
};
type Resto = { id: string; name: string };
type Plat = { id: string; name: string; price: number };

const ar = (n: number) => `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} Ar`;
function jourMada(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo' }).format(new Date(iso));
}
/** Minuit (heure de Madagascar, UTC+3, sans heure d'été) du jour donné. */
const minuitMada = (jour: string) => `${jour}T00:00:00+03:00`;
function lendemain(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function joli(iso: string, moinsUneMinute = false): string {
  const d = new Date(new Date(iso).getTime() - (moinsUneMinute ? 60_000 : 0));
  return d.toLocaleString('fr-FR', { timeZone: 'Indian/Antananarivo', weekday: 'long', day: 'numeric', month: 'long' });
}

const MESSAGES: Record<string, string> = {
  'promo:prix_invalide': 'Le prix promo doit être inférieur au prix normal.',
  'promo:dates_invalides': 'Le dernier jour doit être aujourd’hui ou plus tard, et après le premier jour.',
  'promo:chevauchement': 'Ce plat a déjà une promo sur cette période : arrête-la d’abord.',
  'promo:produit_introuvable': 'Plat introuvable.',
};
const messageErreur = (m: string) => Object.entries(MESSAGES).find(([k]) => m.includes(k))?.[1] ?? m;

export function Promos() {
  const [liste, setListe] = useState<Promo[]>([]);
  const [restos, setRestos] = useState<Resto[]>([]);
  const [plats, setPlats] = useState<Plat[]>([]);
  const [chargement, setChargement] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const aujourdhui = jourMada(new Date().toISOString());
  const [resto, setResto] = useState('');
  const [plat, setPlat] = useState('');
  const [prix, setPrix] = useState('');
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState('');
  const [libelle, setLibelle] = useState('');

  const charger = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.rpc('admin_lister_promotions'),
      supabase.from('restaurants').select('id, name').eq('listing_status', 'visible').order('rang_catalogue'),
    ]);
    setChargement(false);
    if (!r.error) setRestos((r.data ?? []) as Resto[]);
    if (p.error) { setErr(p.error.message); return; }
    setListe((p.data ?? []) as Promo[]);
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  useEffect(() => {
    setPlat(''); setPlats([]);
    if (!resto) return;
    void supabase.from('products').select('id, name, price')
      .eq('restaurant_id', resto).eq('is_archived', false).eq('is_available', true).gt('price', 0)
      .order('name')
      .then(({ data }) => setPlats((data ?? []) as Plat[]));
  }, [resto]);

  const choisi = plats.find((p) => p.id === plat);
  const prixNum = Number(prix.replace(/\s/g, ''));
  const remise = choisi && prixNum > 0 ? Math.round(((choisi.price - prixNum) / choisi.price) * 100) : null;

  const saisie = useMemo(() => {
    if (!choisi) return 'Choisis un restaurant puis un plat.';
    if (!prixNum || prixNum <= 0) return 'Indique le prix promo.';
    if (prixNum >= choisi.price) return `Le prix promo doit être inférieur à ${ar(choisi.price)}.`;
    if (!fin) return 'Indique le dernier jour de la promo.';
    if (fin < debut) return 'Le dernier jour doit venir après le premier.';
    if (fin < aujourdhui) return 'Le dernier jour est déjà passé.';
    return null;
  }, [choisi, prixNum, fin, debut, aujourdhui]);

  async function lancer() {
    if (occupe || saisie || !choisi) return;
    setOccupe(true); setErr(null); setInfo(null);
    const { error } = await supabase.rpc('admin_creer_promotion', {
      p_product_id: choisi.id,
      p_prix_promo: prixNum,
      // Aujourd'hui = tout de suite ; un autre jour = ce jour-là à 0 h, heure de Madagascar.
      p_debut: debut === aujourdhui ? new Date().toISOString() : minuitMada(debut),
      p_fin: minuitMada(lendemain(fin)),
      p_libelle: libelle.trim() || null,
    });
    setOccupe(false);
    if (error) { setErr(messageErreur(error.message)); return; }
    setInfo(`Promo lancée : ${choisi.name} à ${ar(prixNum)} jusqu’au ${joli(minuitMada(lendemain(fin)), true)} inclus. Elle apparaît à la une de l’app.`);
    setPlat(''); setPrix(''); setFin(''); setLibelle('');
    await charger();
  }

  async function arreter(p: Promo) {
    if (!window.confirm(`Arrêter la promo sur « ${p.produit} » ? Le prix repasse tout de suite à ${ar(p.prix)}.`)) return;
    setOccupe(true); setErr(null); setInfo(null);
    const { error } = await supabase.rpc('admin_arreter_promotion', { p_id: p.id });
    setOccupe(false);
    if (error) { setErr(messageErreur(error.message)); return; }
    setInfo(`Promo arrêtée : ${p.produit} repasse à ${ar(p.prix)}.`);
    await charger();
  }

  if (chargement) return <div className="card"><div className="empty">Chargement…</div></div>;

  const etat = (p: Promo) => !p.actif ? { l: 'arrêtée', c: 'sans_objet' }
    : p.en_cours ? { l: 'en cours', c: 'livree' }
      : new Date(p.debut).getTime() > Date.now() ? { l: 'programmée', c: 'recue' } : { l: 'terminée', c: 'annulee' };

  return (
    <>
      {err ? <div className="card sel-erreur">{err}</div> : null}
      {info ? <div className="card sel-info">{info}</div> : null}

      <div className="card sel-bloc">
        <h2>🏷️ Nouvelle promo</h2>
        <p className="muted sel-texte-court">
          Le plat passe au prix promo pour tous les clients (app, site, apps pas à jour comprises) et s’affiche
          à la une dans « Offres de la semaine ». La remise est à la charge du restaurant : préviens-le avant.
          Fin automatique le lendemain du dernier jour à 0 h.
        </p>

        <label className="sel-champ-bloc">
          <span className="sel-label">Restaurant</span>
          <select className="sel-champ" value={resto} onChange={(e) => setResto(e.target.value)}>
            <option value="">— Choisir —</option>
            {restos.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Plat</span>
          <select className="sel-champ" value={plat} disabled={!resto} onChange={(e) => setPlat(e.target.value)}>
            <option value="">{resto ? '— Choisir —' : 'Choisis d’abord un restaurant'}</option>
            {plats.map((p) => <option key={p.id} value={p.id}>{p.name} — {ar(p.price)}</option>)}
          </select>
        </label>

        <label className="sel-champ-bloc">
          <span className="sel-label">Prix promo (Ar){choisi ? ` — prix normal ${ar(choisi.price)}` : ''}</span>
          <input className="sel-champ" inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value.replace(/[^\d ]/g, ''))}
            placeholder="27000" />
        </label>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label className="sel-champ-bloc" style={{ flex: '1 1 160px' }}>
            <span className="sel-label">Premier jour</span>
            <input className="sel-champ" type="date" value={debut} min={aujourdhui} onChange={(e) => setDebut(e.target.value)} />
          </label>
          <label className="sel-champ-bloc" style={{ flex: '1 1 160px' }}>
            <span className="sel-label">Dernier jour (inclus)</span>
            <input className="sel-champ" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>

        <label className="sel-champ-bloc">
          <span className="sel-label">Nom interne (facultatif)</span>
          <input className="sel-champ" value={libelle} maxLength={60} onChange={(e) => setLibelle(e.target.value)} placeholder="Tacos du week-end" />
        </label>

        {choisi && remise !== null && remise > 0 && fin ? (
          <p className="sel-texte-court">
            <b>{choisi.name}</b> : <s>{ar(choisi.price)}</s> → <b>{ar(prixNum)}</b> (−{remise} %), du {debut === aujourdhui ? 'maintenant' : joli(minuitMada(debut))} au {joli(minuitMada(lendemain(fin)), true)} inclus.
          </p>
        ) : null}
        {saisie ? <p className="muted sel-texte-court">{saisie}</p> : null}
        <div className="sel-gestes">
          <button className="btn sel-btn" disabled={occupe || !!saisie} onClick={() => void lancer()}>Lancer la promo</button>
        </div>
      </div>

      <div className="card sel-bloc">
        <h2>Promos</h2>
        {liste.length === 0 ? <div className="empty">Aucune promo pour l’instant.</div> : (
          <div className="sel-liste">
            {liste.map((p) => {
              const e = etat(p);
              return (
                <div className={`sel-fiche${p.en_cours ? '' : ' morte'}`} key={p.id}>
                  <div className="sel-fiche-haut">
                    <span className="sel-nom">{p.produit} · {p.restaurant}</span>
                    <span className={`pill ${e.c}`}>{e.l}</span>
                  </div>
                  <div className="muted sel-detail">
                    <s>{ar(p.prix)}</s> → <b>{ar(p.prix_promo)}</b> (−{Math.round(((p.prix - p.prix_promo) / p.prix) * 100)} %)
                    {' · '}du {joli(p.debut)} au {joli(p.fin, true)} inclus
                    {p.libelle ? ` · ${p.libelle}` : ''}
                  </div>
                  <div className="muted sel-detail">{p.commandes} commande{p.commandes > 1 ? 's' : ''} pendant la promo</div>
                  {p.actif && new Date(p.fin).getTime() > Date.now() ? (
                    <div className="sel-gestes">
                      <button className="btn ghost sel-btn" disabled={occupe} onClick={() => void arreter(p)}>Arrêter</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
