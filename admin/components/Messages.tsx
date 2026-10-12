'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 💬 Messagerie de commande (2026-10-13).
 *
 * Chaque commande a une conversation partagée entre le client, le livreur assigné et le
 * restaurant. Ici, Taxi Food voit toutes les conversations récentes, lit un fil (ce qui le
 * marque comme lu pour l'admin) et peut répondre en tant que « Taxi Food ».
 *
 * Tout passe par des RPC : `admin_messagerie_conversations` (liste, `is_admin()`),
 * `messagerie_lire` / `messagerie_envoyer` avec le rôle `admin` (la base vérifie
 * `is_admin()`). Les photos sont dans le bucket PRIVÉ `messages`, lues par liens signés.
 */

type Conversation = {
  order_id: string;
  order_number: string;
  restaurant: string;
  client: string | null;
  statut: string;
  nb_messages: number;
  dernier_role: string;
  dernier_texte: string | null;
  dernier_photo: boolean;
  dernier_le: string;
  non_lus: number;
};

type Message = {
  id: string;
  auteur_role: 'client' | 'livreur' | 'restaurant' | 'admin';
  est_moi: boolean;
  auteur_nom: string | null;
  texte: string | null;
  photo_path: string | null;
  created_at: string;
  langue_source?: string | null;
  traductions?: { fr?: string; en?: string; it?: string } | null;
};

type Fil = {
  order_number: string;
  peut_ecrire: boolean;
  participants: { client: string | null; livreur: string | null; restaurant: string | null };
  messages: Message[];
};

const ROLES: Record<string, string> = { client: 'client', livreur: 'livreur', restaurant: 'restaurant', admin: 'Taxi Food' };

function quand(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Indian/Antananarivo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function erreurLisible(e: unknown): string {
  const brut = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? '');
  if (brut.includes('messagerie:fermee')) return 'Conversation terminée (plus de 2 h après la livraison).';
  if (brut.includes('messagerie:acces_refuse')) return 'Accès refusé (commande par téléphone ?).';
  if (brut.includes('messagerie:trop_rapide')) return 'Trop de messages d’un coup : attends un instant.';
  return brut || 'Erreur inconnue';
}

export function Messages() {
  const [vue, setVue] = useState<'commandes' | 'clients'>('commandes');
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={`btn ${vue === 'commandes' ? '' : 'ghost'}`} onClick={() => setVue('commandes')}>
          Commandes
        </button>
        <button className={`btn ${vue === 'clients' ? '' : 'ghost'}`} onClick={() => setVue('clients')}>
          Clients (hors commande)
        </button>
      </div>
      {vue === 'commandes' ? <MessagesCommandes /> : <MessagesClients />}
    </>
  );
}

function MessagesCommandes() {
  const [jours, setJours] = useState(14);
  const [liste, setListe] = useState<Conversation[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_messagerie_conversations', { p_jours: jours });
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setErreur(null);
    setListe((data ?? []) as Conversation[]);
  }, [jours]);

  useEffect(() => {
    void charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  return (
    <div className="card">
      <h2>💬 Messages des commandes</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Conversations client · livreur · restaurant. Tu peux répondre en tant que « Taxi Food ». On écrit
        jusqu’à 2 h après la livraison ; les photos sont effacées au bout de 90 jours.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 14px' }}>
        <span className="muted">Période :</span>
        {[2, 14, 60].map((j) => (
          <button key={j} className={`btn petit ${jours === j ? '' : 'ghost'}`} onClick={() => setJours(j)}>
            {j} jours
          </button>
        ))}
      </div>
      {erreur ? <p style={{ color: 'var(--red)' }}>{erreur}</p> : null}
      {liste === null ? (
        <p className="muted">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="empty">Aucune conversation sur la période.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map((c) => (
            <div key={c.order_id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel-2)' }}>
              <button
                onClick={() => setOuverte(ouverte === c.order_id ? null : c.order_id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                  padding: 12,
                  boxSizing: 'border-box',
                  minHeight: 44,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{c.order_number}</strong>
                  <span className="muted">{c.restaurant}</span>
                  {c.client ? <span className="muted">· {c.client}</span> : null}
                  <span className={`pill ${c.statut}`}>{c.statut}</span>
                  {c.non_lus > 0 ? (
                    <span className="pill" style={{ background: 'var(--primary)', color: '#fff' }}>
                      {c.non_lus} non lu{c.non_lus > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                    {quand(c.dernier_le)} · {c.nb_messages} msg
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{ROLES[c.dernier_role] ?? c.dernier_role} :</b> {c.dernier_photo ? '📷 ' : ''}
                  {c.dernier_texte ?? (c.dernier_photo ? 'Photo' : '')}
                </div>
              </button>
              {ouverte === c.order_id ? <FilAdmin orderId={c.order_id} onLu={charger} /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilAdmin({ orderId, onLu }: { orderId: string; onLu: () => void }) {
  const [fil, setFil] = useState<Fil | null>(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const premier = useRef(true);

  const lire = useCallback(async () => {
    const { data, error } = await supabase.rpc('messagerie_lire', { p_order_id: orderId, p_en_tant_que: 'admin', p_depuis: null });
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setFil(data as Fil);
    if (premier.current) {
      premier.current = false;
      onLu();
    }
  }, [orderId, onLu]);

  useEffect(() => {
    void lire();
    const t = setInterval(lire, 5000);
    return () => clearInterval(t);
  }, [lire]);

  async function envoyer() {
    const propre = texte.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.rpc('messagerie_envoyer', {
      p_order_id: orderId,
      p_en_tant_que: 'admin',
      p_texte: propre,
      p_photo_path: null,
    });
    setEnvoi(false);
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setTexte('');
    void lire();
  }

  if (!fil) return <p className="muted" style={{ padding: 12 }}>{erreur ?? 'Chargement…'}</p>;

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
        {[fil.participants.client && `${fil.participants.client} (client)`, fil.participants.livreur && `${fil.participants.livreur} (livreur)`, fil.participants.restaurant]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fil.messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.auteur_role === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>
              {m.auteur_role === 'restaurant' || m.auteur_role === 'admin'
                ? m.auteur_nom ?? ROLES[m.auteur_role]
                : `${m.auteur_nom ?? ''} · ${ROLES[m.auteur_role]}`}{' '}
              · {quand(m.created_at)}
            </div>
            <div
              style={{
                background: m.auteur_role === 'admin' ? 'var(--primary)' : 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '8px 10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.photo_path ? <PhotoSignee path={m.photo_path} /> : null}
              {m.texte}
              <Traduction m={m} />
            </div>
          </div>
        ))}
      </div>
      {fil.peut_ecrire ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void envoyer();
            }}
            maxLength={500}
            placeholder="Répondre en tant que Taxi Food…"
            style={{ flex: 1, minHeight: 44, fontSize: 16 }}
          />
          <button className="btn" onClick={envoyer} disabled={envoi || !texte.trim()}>
            {envoi ? '…' : 'Envoyer'}
          </button>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>Conversation terminée : lecture seule.</p>
      )}
      {erreur ? <p style={{ color: 'var(--red)' }}>{erreur}</p> : null}
    </div>
  );
}

function PhotoSignee({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void supabase.storage
      .from('messages')
      .createSignedUrl(path, 3600, { transform: { width: 900, quality: 70, resize: 'contain' } })
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <div className="muted">📷 …</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Photo du message" style={{ display: 'block', maxWidth: 260, width: '100%', borderRadius: 8, marginBottom: 6 }} />
    </a>
  );
}

/** Traduction française d'un message écrit dans une autre langue (posée par la base). */
function Traduction({ m }: { m: Message }) {
  if (!m.texte || !m.langue_source || m.langue_source === 'fr' || !m.traductions?.fr) return null;
  return (
    <div className="muted" style={{ fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>
      🌐 ({m.langue_source}) {m.traductions.fr}
    </div>
  );
}

// ───────────── Conversations « Écrire à Taxi Food » (hors commande) ─────────────

type ConversationClient = {
  client_id: string;
  client: string | null;
  email: string | null;
  telephone: string | null;
  nb_messages: number;
  dernier_role: string;
  dernier_texte: string | null;
  dernier_photo: boolean;
  dernier_le: string;
  non_lus: number;
};

function MessagesClients() {
  const [liste, setListe] = useState<ConversationClient[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_support_conversations', { p_jours: 120 });
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setErreur(null);
    setListe((data ?? []) as ConversationClient[]);
  }, []);

  useEffect(() => {
    void charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  return (
    <div className="card">
      <h2>🆘 Écrire à Taxi Food</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Les clients écrivent depuis Profil → « Écrire à Taxi Food ». Ta réponse leur arrive en notification.
      </p>
      {erreur ? <p style={{ color: 'var(--red)' }}>{erreur}</p> : null}
      {liste === null ? (
        <p className="muted">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="empty">Aucun message de client pour l’instant.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map((c) => (
            <div key={c.client_id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--panel-2)' }}>
              <button
                onClick={() => setOuverte(ouverte === c.client_id ? null : c.client_id)}
                style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', padding: 12, boxSizing: 'border-box', minHeight: 44 }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{c.client ?? 'Client'}</strong>
                  {c.telephone ? <span className="muted">{c.telephone}</span> : null}
                  {c.email ? <span className="muted">· {c.email}</span> : null}
                  {c.non_lus > 0 ? (
                    <span className="pill" style={{ background: 'var(--primary)', color: '#fff' }}>
                      {c.non_lus} non lu{c.non_lus > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                    {quand(c.dernier_le)} · {c.nb_messages} msg
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{c.dernier_role === 'admin' ? 'Taxi Food' : 'client'} :</b> {c.dernier_photo ? '📷 ' : ''}
                  {c.dernier_texte ?? (c.dernier_photo ? 'Photo' : '')}
                </div>
              </button>
              {ouverte === c.client_id ? <FilClient clientId={c.client_id} onLu={charger} /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilClient({ clientId, onLu }: { clientId: string; onLu: () => void }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const premier = useRef(true);

  const lire = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_support_lire', { p_client: clientId, p_depuis: null });
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setMessages(((data as { messages: Message[] }).messages ?? []) as Message[]);
    if (premier.current) {
      premier.current = false;
      onLu();
    }
  }, [clientId, onLu]);

  useEffect(() => {
    void lire();
    const t = setInterval(lire, 5000);
    return () => clearInterval(t);
  }, [lire]);

  async function envoyer() {
    const propre = texte.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.rpc('admin_support_envoyer', { p_client: clientId, p_texte: propre, p_photo_path: null });
    setEnvoi(false);
    if (error) {
      setErreur(erreurLisible(error));
      return;
    }
    setTexte('');
    void lire();
  }

  if (!messages) return <p className="muted" style={{ padding: 12 }}>{erreur ?? 'Chargement…'}</p>;

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.auteur_role === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>
              {m.auteur_role === 'admin' ? 'Taxi Food' : m.auteur_nom ?? 'client'} · {quand(m.created_at)}
            </div>
            <div
              style={{
                background: m.auteur_role === 'admin' ? 'var(--primary)' : 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '8px 10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.photo_path ? <PhotoSignee path={m.photo_path} /> : null}
              {m.texte}
              <Traduction m={m} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void envoyer();
          }}
          maxLength={1000}
          placeholder="Répondre en tant que Taxi Food…"
          style={{ flex: 1, minHeight: 44, fontSize: 16 }}
        />
        <button className="btn" onClick={envoyer} disabled={envoi || !texte.trim()}>
          {envoi ? '…' : 'Envoyer'}
        </button>
      </div>
      {erreur ? <p style={{ color: 'var(--red)' }}>{erreur}</p> : null}
    </div>
  );
}
