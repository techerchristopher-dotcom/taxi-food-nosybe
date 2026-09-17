'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatAr } from '../lib/util';
import {
  ZONES, articlesPourLaBase, cleLigne, dansNosyBe, groupeIncomplet, lirePosition, messageErreur,
  prixUnitaire, totalEstime,
} from '../lib/commandeTelephone';
import type { Categorie, Groupe, Ligne, Option, Plat } from '../lib/commandeTelephone';

/**
 * Commande par TÉLÉPHONE : un client appelle, on saisit, ça part.
 *
 * Quatre partis pris.
 *
 * 1. LE MÊME CIRCUIT QUE L'APP. L'envoi appelle `admin_commande_telephone`, qui
 *    appelle `create_order` : mêmes gardes (restaurant ouvert, heures de
 *    service, disponibilité, options obligatoires, prix relus), mêmes triggers
 *    (Telegram du restaurant avec ses boutons, push, copie au patron). Aucune
 *    écriture directe dans `orders` ici.
 * 2. PENDANT L'APPEL. Une seule colonne, dans l'ordre de la conversation :
 *    numéro, nom, où livrer, restaurant, plats. Le numéro d'un client déjà
 *    servi par téléphone ramène son nom, sa zone, son repère et sa position.
 * 3. LA POSITION N'EST PAS DEVINÉE. `create_order` exige le GPS ; on colle un
 *    lien Google Maps ou la localisation WhatsApp, et hors de Nosy Be l'écran
 *    refuse (inversion latitude / longitude). Jamais un « centre de zone » :
 *    le livreur irait au mauvais endroit.
 * 4. LES MONTANTS AFFICHÉS SONT UNE ESTIMATION. Le total qui fait foi est
 *    celui que la base renvoie, affiché après l'envoi — à relire au client.
 */

type Resto = {
  id: string; name: string; listing_status: string; delivery_fee: number | null;
  zone_served: string | null; commandable_maintenant: boolean | null;
};
type Envoyee = { numero: string; total: number; resto: string; client: string };

export function CommandeTelephone() {
  // Client
  const [telephone, setTelephone] = useState('');
  const [nom, setNom] = useState('');
  const [connu, setConnu] = useState<string | null>(null);
  // Livraison
  const [zone, setZone] = useState('');
  const [repere, setRepere] = useState('');
  const [positionTexte, setPositionTexte] = useState('');
  // Restaurant et carte
  const [restos, setRestos] = useState<Resto[]>([]);
  const [restoId, setRestoId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [plats, setPlats] = useState<Plat[]>([]);
  const [groupes, setGroupes] = useState<Record<string, Groupe[]>>({});
  const [recherche, setRecherche] = useState('');
  const [chargementCarte, setChargementCarte] = useState(false);
  // Plat en cours de configuration
  const [enCours, setEnCours] = useState<Plat | null>(null);
  const [choix, setChoix] = useState<Record<string, string[]>>({});
  const [quantite, setQuantite] = useState(1);
  // Panier et envoi
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState<Envoyee | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ⚠️ Double appui sur « Envoyer » : `setEnvoi(true)` ne désactive le bouton
  // qu'au rendu suivant. Deux commandes partiraient au restaurant.
  const gestEnCours = useRef(false);
  const seqCarte = useRef(0);

  const chargerRestos = useCallback(async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, listing_status, delivery_fee, zone_served, commandable_maintenant')
      .neq('listing_status', 'hidden')
      .order('rang_catalogue', { ascending: true });
    if (error) { setErr(error.message); return; }
    setRestos((data ?? []) as Resto[]);
  }, []);

  useEffect(() => { void chargerRestos(); }, [chargerRestos]);

  // La carte du restaurant choisi : mêmes filtres que `getMenu` dans l'app.
  useEffect(() => {
    if (!restoId) { setCategories([]); setPlats([]); setGroupes({}); return; }
    const seq = ++seqCarte.current;
    setChargementCarte(true);
    void (async () => {
      const [c, p] = await Promise.all([
        supabase.from('categories')
          .select('id, name, icon, sort_order, categorie_servie_maintenant')
          .eq('restaurant_id', restoId).eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('products')
          .select('id, name, price, category_id, is_available, in_menu, is_featured, photo_url, packaging_fee, stock_quantity')
          .eq('restaurant_id', restoId).eq('is_archived', false)
          .order('sort_order', { ascending: true }).order('name', { ascending: true }),
      ]);
      if (seq !== seqCarte.current) return;
      if (c.error || p.error) { setChargementCarte(false); setErr((c.error ?? p.error)!.message); return; }
      const cats = (c.data ?? []) as Categorie[];
      const actives = new Set(cats.map((x) => x.id));
      const tous = ((p.data ?? []) as Plat[]).filter(
        (x) => x.is_featured || (x.in_menu !== false && x.category_id != null && actives.has(x.category_id)),
      );
      const ids = tous.map((x) => x.id);
      const g = ids.length
        ? await supabase.from('product_option_groups')
          .select('id, product_id, name, min_select, max_select, required, sort_order, product_options ( id, name, price_delta, is_available, sort_order )')
          .in('product_id', ids)
        : { data: [], error: null };
      if (seq !== seqCarte.current) return;
      setChargementCarte(false);
      if (g.error) { setErr(g.error.message); return; }
      const parPlat: Record<string, Groupe[]> = {};
      for (const row of (g.data ?? []) as (Groupe & { product_id: string })[]) {
        (parPlat[row.product_id] ??= []).push({
          ...row,
          product_options: [...(row.product_options ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        });
      }
      // Obligatoires d'abord, comme dans l'app.
      for (const k of Object.keys(parPlat)) {
        parPlat[k].sort((a, b) => Number(b.required) - Number(a.required) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
      }
      setCategories(cats);
      setPlats(tous);
      setGroupes(parPlat);
    })();
  }, [restoId]);

  async function chercherClient() {
    const t = telephone.trim();
    if (t.replace(/\D/g, '').length < 8) return;
    const { data, error } = await supabase.rpc('admin_client_telephone_connu', { p_telephone: t });
    if (error || !Array.isArray(data) || data.length === 0) { setConnu(null); return; }
    const d = data[0] as { client_nom: string; zone: string | null; repere: string | null; latitude: number | null; longitude: number | null; derniere_commande: string };
    // Pré-remplit, n'écrase jamais une saisie déjà faite.
    if (!nom.trim()) setNom(d.client_nom);
    if (!zone.trim() && d.zone) setZone(d.zone);
    if (!repere.trim() && d.repere) setRepere(d.repere);
    if (!positionTexte.trim() && d.latitude != null && d.longitude != null) setPositionTexte(`${d.latitude}, ${d.longitude}`);
    setConnu(`Déjà servi par téléphone le ${new Date(d.derniere_commande).toLocaleDateString('fr-FR')} : vérifie l’adresse avec lui.`);
  }

  const resto = restos.find((r) => r.id === restoId) ?? null;
  const position = lirePosition(positionTexte);
  const positionHorsZone = position ? !dansNosyBe(position) : false;
  const montants = totalEstime(lignes, resto?.delivery_fee ?? 0);
  const categorieServie = (id: string | null) => (id ? categories.find((c) => c.id === id)?.categorie_servie_maintenant !== false : true);

  const platsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? plats.filter((p) => p.name.toLowerCase().includes(q)) : plats;
  }, [plats, recherche]);

  const sections = useMemo(() => {
    const aLaffiche = platsFiltres.filter((p) => p.is_featured);
    const parCat = categories
      .map((c) => ({ titre: `${c.icon ? c.icon + ' ' : ''}${c.name}`, plats: platsFiltres.filter((p) => p.category_id === c.id && p.in_menu !== false) }))
      .filter((s) => s.plats.length > 0);
    return aLaffiche.length ? [{ titre: 'Offre du jour', plats: aLaffiche }, ...parCat] : parCat;
  }, [platsFiltres, categories]);

  const manque = [
    telephone.replace(/\D/g, '').length < 8 ? 'le numéro' : null,
    !nom.trim() ? 'le nom' : null,
    !zone.trim() ? 'la zone' : null,
    !position ? 'la position GPS' : positionHorsZone ? 'une position DANS Nosy Be' : null,
    !resto ? 'le restaurant' : null,
    lignes.length === 0 ? 'au moins un plat' : null,
  ].filter(Boolean) as string[];

  function choisirResto(id: string) {
    if (id === restoId) return;
    // Le panier est mono-restaurant, comme dans l'app.
    setLignes([]);
    setEnCours(null);
    setRecherche('');
    setRestoId(id);
  }

  function ouvrirPlat(p: Plat) {
    setErr(null);
    const gs = groupes[p.id] ?? [];
    // Même règle que l'app : un groupe obligatoire à une seule option dispo se pré-remplit.
    const auto: Record<string, string[]> = {};
    for (const g of gs) {
      const dispo = g.product_options.filter((o) => o.is_available);
      if (g.required && dispo.length === 1 && g.product_options.length === 1) auto[g.id] = [dispo[0].id];
    }
    if (gs.length === 0) { ajouter(p, [], 1); return; }
    setChoix(auto);
    setQuantite(1);
    setEnCours(p);
  }

  function basculerOption(g: Groupe, o: Option) {
    const actuelles = choix[g.id] ?? [];
    if (g.max_select === 1) { setChoix({ ...choix, [g.id]: actuelles[0] === o.id && !g.required ? [] : [o.id] }); return; }
    if (actuelles.includes(o.id)) { setChoix({ ...choix, [g.id]: actuelles.filter((x) => x !== o.id) }); return; }
    if (actuelles.length >= g.max_select) return;
    setChoix({ ...choix, [g.id]: [...actuelles, o.id] });
  }

  function ajouter(p: Plat, options: Option[], q: number) {
    const cle = cleLigne(p.id, options.map((o) => o.id));
    const existe = lignes.find((l) => l.cle === cle);
    setLignes(existe
      ? lignes.map((l) => (l.cle === cle ? { ...l, quantite: l.quantite + q } : l))
      : [...lignes, { cle, plat: p, options, quantite: q }]);
    setEnCours(null);
  }

  function validerPlat() {
    if (!enCours) return;
    const gs = groupes[enCours.id] ?? [];
    if (groupeIncomplet(gs, choix)) return;
    const toutes = gs.flatMap((g) => g.product_options);
    const options = Object.values(choix).flat().map((id) => toutes.find((o) => o.id === id)).filter(Boolean) as Option[];
    ajouter(enCours, options, quantite);
  }

  function changerQuantite(cle: string, delta: number) {
    setLignes(lignes.flatMap((l) => (l.cle !== cle ? [l] : l.quantite + delta <= 0 ? [] : [{ ...l, quantite: l.quantite + delta }])));
  }

  async function envoyer() {
    if (gestEnCours.current || manque.length > 0 || !resto || !position) return;
    gestEnCours.current = true;
    setEnvoi(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_commande_telephone', {
      p_restaurant_id: resto.id,
      p_client_nom: nom.trim(),
      p_client_telephone: telephone.trim(),
      p_zone: zone.trim(),
      p_repere: repere.trim(),
      p_latitude: position.lat,
      p_longitude: position.lng,
      p_items: articlesPourLaBase(lignes),
    });
    gestEnCours.current = false;
    setEnvoi(false);
    setConfirmer(false);
    if (error) { setErr(messageErreur(error.message)); void chargerRestos(); return; }
    const row = (Array.isArray(data) ? data[0] : data) as { order_number: string; total: number } | undefined;
    if (!row?.order_number) {
      setErr('La base n’a pas renvoyé de numéro. Regarde l’onglet Temps réel avant de recommencer : la commande est peut-être partie.');
      return;
    }
    setEnvoyee({ numero: row.order_number, total: row.total, resto: resto.name, client: nom.trim() });
  }

  function nouvelleCommande() {
    setEnvoyee(null);
    setTelephone(''); setNom(''); setConnu(null);
    setZone(''); setRepere(''); setPositionTexte('');
    setLignes([]); setEnCours(null); setRecherche(''); setRestoId(null);
    setErr(null);
    void chargerRestos();
  }

  if (envoyee) {
    return (
      <div className="card sel-bloc">
        <h2>Commande envoyée</h2>
        <div className="tel-numero">{envoyee.numero}</div>
        <div className="recap">
          <div><strong>{envoyee.client}</strong> — {envoyee.resto}</div>
          <div>Total calculé par la base : <strong>{formatAr(envoyee.total)}</strong>, en espèces à la livraison.</div>
        </div>
        <p className="muted sel-texte-court">
          Relis ce total au client avant de raccrocher. Le restaurant a reçu la commande sur Telegram, comme une
          commande de l’app ; elle apparaît dans l’onglet Temps réel. Les notifications « client » (confirmée, en
          route…) arrivent sur TON téléphone : préviens le client toi-même si besoin.
        </p>
        <div className="sel-gestes">
          <button className="btn sel-btn" onClick={nouvelleCommande}>Nouvelle commande</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {err ? <div className="card sel-erreur">{err}</div> : null}

      <div className="card sel-bloc">
        <h2>Commande par téléphone</h2>

        <div className="sel-etape">
          <div className="sel-etape-titre"><span>1. Le client</span></div>
          <label className="sel-champ-bloc">
            <span className="sel-label">Téléphone</span>
            <input className="sel-champ" type="tel" inputMode="tel" autoComplete="off" value={telephone}
              onChange={(e) => { setTelephone(e.target.value); setConnu(null); }}
              onBlur={() => void chercherClient()} placeholder="034 12 345 67" />
          </label>
          {connu ? <p className="muted sel-texte-court">{connu}</p> : null}
          <label className="sel-champ-bloc">
            <span className="sel-label">Nom</span>
            <input className="sel-champ" autoComplete="off" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" />
          </label>
        </div>

        <div className="sel-etape">
          <div className="sel-etape-titre"><span>2. Où livrer</span></div>
          <label className="sel-champ-bloc">
            <span className="sel-label">Zone</span>
            <input className="sel-champ" list="tel-zones" autoComplete="off" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ambatoloaka" />
            <datalist id="tel-zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
          </label>
          <label className="sel-champ-bloc">
            <span className="sel-label">Repère (hôtel, couleur du portail, à côté de…)</span>
            <input className="sel-champ" autoComplete="off" value={repere} onChange={(e) => setRepere(e.target.value)} placeholder="Hôtel Les Bungalows, portail bleu" />
          </label>
          <label className="sel-champ-bloc">
            <span className="sel-label">Position GPS — lien Google Maps ou localisation WhatsApp collée</span>
            <input className="sel-champ" autoComplete="off" value={positionTexte} onChange={(e) => setPositionTexte(e.target.value)} placeholder="-13.3985, 48.2168" />
            {positionTexte.trim() && !position ? (
              <span className="sel-compteur trop">
                Pas de coordonnées lisibles. Un lien court maps.app.goo.gl n’en contient pas : ouvre-le et copie les chiffres.
              </span>
            ) : null}
            {position && positionHorsZone ? (
              <span className="sel-compteur trop">Cette position est hors de Nosy Be (latitude et longitude inversées ?).</span>
            ) : null}
            {position && !positionHorsZone ? (
              <span className="muted sel-detail">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)} ·{' '}
                <a href={`https://www.google.com/maps?q=${position.lat},${position.lng}`} target="_blank" rel="noopener noreferrer">vérifier sur la carte</a>
              </span>
            ) : null}
          </label>
        </div>

        <div className="sel-etape">
          <div className="sel-etape-titre"><span>3. Le restaurant</span></div>
          <div className="sel-liste">
            {restos.map((r) => {
              const ok = r.listing_status === 'visible' && r.commandable_maintenant === true;
              return (
                <label className={`sel-rangee${restoId === r.id ? ' choisi' : ''}${ok ? '' : ' tel-eteint'}`} key={r.id}>
                  <input className="sel-case" type="radio" name="tel-resto" disabled={!ok} checked={restoId === r.id} onChange={() => choisirResto(r.id)} />
                  <span className="sel-corps">
                    <span className="sel-nom">{r.name}</span>
                    <span className="muted sel-detail">
                      {r.listing_status === 'coming_soon' ? 'En négociation' : ok ? `Ouvert · livraison ${formatAr(r.delivery_fee)}` : 'Fermé en ce moment'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="sel-etape">
          <div className="sel-etape-titre"><span>4. Les plats</span><span className="muted">{lignes.reduce((n, l) => n + l.quantite, 0)} article(s)</span></div>
          {!resto ? <div className="empty">Choisis d’abord un restaurant.</div> : chargementCarte ? <div className="empty">Chargement de la carte…</div> : (
            <>
              <input className="sel-champ tel-recherche" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un plat" />
              {sections.map((s) => (
                <div className="sel-groupe" key={s.titre}>
                  <div className="sel-groupe-titre">{s.titre}</div>
                  <div className="sel-liste">
                    {s.plats.map((p) => {
                      const servi = categorieServie(p.category_id);
                      const dispo = p.is_available && p.stock_quantity !== 0 && servi;
                      return (
                        <button type="button" className={`sel-rangee tel-plat${dispo ? '' : ' tel-eteint'}`} key={`${s.titre}-${p.id}`} disabled={!dispo} onClick={() => ouvrirPlat(p)}>
                          <span className="sel-corps">
                            <span className="sel-nom">{p.name}</span>
                            <span className="muted sel-detail">
                              {formatAr(p.price)}{(groupes[p.id] ?? []).length ? ' · options' : ''}{!p.is_available || p.stock_quantity === 0 ? ' · indisponible' : !servi ? ' · pas servi à cette heure' : ''}
                            </span>
                          </span>
                          <span className="tel-plus" aria-hidden="true">+</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {lignes.length > 0 ? (
          <div className="sel-etape">
            <div className="sel-etape-titre"><span>5. Le panier</span></div>
            {lignes.map((l) => (
              <div className="sel-fiche tel-ligne" key={l.cle}>
                <div className="sel-corps">
                  <span className="sel-nom">{l.plat.name}</span>
                  {l.options.length ? <span className="muted sel-detail">{l.options.map((o) => o.name).join(', ')}</span> : null}
                  <span className="muted sel-detail">{formatAr(prixUnitaire(l) * l.quantite)}</span>
                </div>
                <div className="tel-stepper">
                  <button type="button" className="btn ghost sel-btn" onClick={() => changerQuantite(l.cle, -1)} aria-label="Retirer un">−</button>
                  <span className="tel-qte">{l.quantite}</span>
                  <button type="button" className="btn ghost sel-btn" onClick={() => changerQuantite(l.cle, 1)} aria-label="Ajouter un">+</button>
                </div>
              </div>
            ))}
            <div className="recap">
              <div>Plats : {formatAr(montants.plats)}</div>
              {montants.emballage ? <div>Emballage : {formatAr(montants.emballage)}</div> : null}
              <div>Livraison : {formatAr(montants.livraison)}</div>
              <div><strong>Total estimé : {formatAr(montants.total)}</strong> — espèces à la livraison</div>
              <div className="muted">La base recalcule le total à l’envoi ; c’est lui qui s’affiche ensuite.</div>
            </div>
          </div>
        ) : null}

        {manque.length ? <p className="muted sel-texte-court">Il manque : {manque.join(', ')}.</p> : null}
        <div className="sel-gestes">
          <button className="btn sel-btn" disabled={envoi || manque.length > 0} onClick={() => { setErr(null); setConfirmer(true); }}>
            Envoyer au restaurant
          </button>
        </div>
      </div>

      {enCours ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            <h3>{enCours.name}</h3>
            {(groupes[enCours.id] ?? []).map((g) => (
              <div className="sel-groupe" key={g.id}>
                <div className="sel-groupe-titre">
                  {g.name}{g.required ? ' · obligatoire' : ''}{g.max_select > 1 ? ` · ${g.max_select} max` : ''}
                </div>
                <div className="sel-liste">
                  {g.product_options.map((o) => {
                    const coche = (choix[g.id] ?? []).includes(o.id);
                    return (
                      <label className={`sel-rangee${coche ? ' choisi' : ''}${o.is_available ? '' : ' tel-eteint'}`} key={o.id}>
                        <input className="sel-case" type={g.max_select === 1 ? 'radio' : 'checkbox'} name={`g-${g.id}`}
                          disabled={!o.is_available} checked={coche} onChange={() => basculerOption(g, o)} onClick={() => { if (coche && g.max_select === 1 && !g.required) basculerOption(g, o); }} />
                        <span className="sel-corps">
                          <span className="sel-nom">{o.name}</span>
                          <span className="muted sel-detail">{o.price_delta ? `+ ${formatAr(o.price_delta)}` : 'inclus'}{o.is_available ? '' : ' · indisponible'}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="tel-stepper">
              <button type="button" className="btn ghost sel-btn" onClick={() => setQuantite(Math.max(1, quantite - 1))}>−</button>
              <span className="tel-qte">{quantite}</span>
              <button type="button" className="btn ghost sel-btn" onClick={() => setQuantite(Math.min(50, quantite + 1))}>+</button>
            </div>
            {groupeIncomplet(groupes[enCours.id] ?? [], choix) ? (
              <p className="muted sel-texte-court">À choisir : {groupeIncomplet(groupes[enCours.id] ?? [], choix)!.name}</p>
            ) : null}
            <div className="pied">
              <button className="btn ghost sel-btn" onClick={() => setEnCours(null)}>Annuler</button>
              <button className="btn sel-btn" disabled={!!groupeIncomplet(groupes[enCours.id] ?? [], choix)} onClick={validerPlat}>Ajouter</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmer && resto && position ? (
        <div className="voile" role="dialog" aria-modal="true">
          <div className="boite">
            <h3>Envoyer à {resto.name} ?</h3>
            <div className="recap">
              <div><strong>{nom.trim()}</strong> · {telephone.trim()}</div>
              <div>{zone.trim()}{repere.trim() ? ` — ${repere.trim()}` : ''}</div>
              {lignes.map((l) => (
                <div key={l.cle}>{l.quantite} × {l.plat.name}{l.options.length ? ` (${l.options.map((o) => o.name).join(', ')})` : ''}</div>
              ))}
              <div><strong>Total estimé : {formatAr(montants.total)}</strong> · espèces</div>
            </div>
            <div className="warn">Le restaurant est prévenu tout de suite, comme pour une commande de l’app.</div>
            <div className="pied">
              <button className="btn ghost sel-btn" disabled={envoi} onClick={() => setConfirmer(false)}>Revenir</button>
              <button className="btn sel-btn" disabled={envoi} onClick={() => void envoyer()}>{envoi ? 'Envoi…' : 'Envoyer'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
