# E-mails de contact — Taxi Food

Deux e-mails partent dès qu'une personne laisse ses coordonnées sur le site :
un **avis interne** à Christopher, et un **accusé de réception** à la personne
— quand on a son adresse.

---

## La chaîne, de bout en bout

```
formulaire du site
   ↓ RPC (submit_waitlist · submit_restaurant_lead · submit_courier_lead)
table Postgres (waitlist_signups · restaurant_leads · courier_leads)
   ↓ trigger AFTER INSERT → notifier_nouveau_contact() → pg_net
webhook n8n  « Taxi Food — Nouveau contact »   (id WmGRW5mqcYeTZrCo)
   ↓ Prep (normalise les 3 formes, rend les 2 HTML)
   ├─ Gmail → techerchristopher@gmail.com          toujours
   └─ Gmail → l'adresse du client                  si elle existe
```

**L'envoi est asynchrone** (`pg_net`). Une inscription n'attend jamais un
e-mail, et un n8n injoignable ne fait pas échouer le formulaire. Sur la
liaison de Nosy Be, c'est la propriété qui compte.

---

## ⚠️ Seul le client peut être accusé réception

| Formulaire | Table | Adresse e-mail collectée ? |
|---|---|---|
| Client (liste d'attente) | `waitlist_signups` | **oui, mais facultative** |
| Restaurateur | `restaurant_leads` | **non — pas de colonne** |
| Livreur | `courier_leads` | **non — pas de colonne** |

Restaurateurs et livreurs laissent un **numéro WhatsApp**, pas une adresse.
Ils ne peuvent donc pas recevoir d'accusé de réception par e-mail : l'avis
interne part, l'accusé non. Le nœud `A-t-il un e-mail ?` coupe la branche.

**Pour étendre l'accusé de réception aux deux autres**, il faut d'abord
ajouter une colonne `email` à leur table et un champ au formulaire. Le
workflow n8n, lui, n'a rien à changer : il lit déjà `record.email`.

---

## Les gabarits

| Fichier | Destinataire | Registre |
|---|---|---|
| `nouveau-contact-admin.html` | Christopher | — |
| `accuse-reception-client.html` | le client | **tutoiement** |

Le tutoiement de l'accusé de réception n'est pas un détail de style : c'est la
règle posée le 2026-08-24 sur toute l'application et tout le site — **on tutoie
les personnes, on vouvoie les entreprises**. Repasser cet e-mail au
vouvoiement le mettrait en contradiction avec le site qui l'a produit.

### ⚠️ Le HTML est dupliqué

Ces deux fichiers sont la **source de vérité**, mais leur contenu est **recopié
dans le nœud `Prep`** du workflow n8n. Toute modification ici doit y être
repoussée, sinon les deux divergent en silence — et c'est la version n8n qui
part.

Pour repousser : `GET` le workflow, remplacer `jsCode` du nœud `Prep`, `PUT`.

### ⚠️ Piège n8n connu

Sur cette instance, **un `PUT` par API sur un workflow ACTIF ne réenregistre
pas le webhook de production**. Après tout `PUT`, rebasculer le workflow
Actif OFF → ON **dans l'éditeur n8n**.

Créer un workflow inactif puis l'activer par API fonctionne, en revanche —
vérifié le 2026-08-24 : le webhook a répondu 200 dès l'activation.

---

## Les jetons

`Prep` remplace ces marqueurs dans le HTML. Ce ne sont pas des expressions
n8n : de simples `split().join()`, pour que les gabarits restent lisibles et
ouvrables dans un navigateur.

**Avis interne :** `{{TYPE}}` `{{TITRE}}` `{{NOM}}` `{{LIGNES}}` `{{QUAND}}`
`{{TEL}}` `{{TEL_BRUT}}`

**Accusé de réception :** `{{PRENOM}}` `{{TEL}}`

`{{LIGNES}}` est un bloc de `<tr>` construit à la volée : une ligne par champ
réellement rempli, donc pas de « — » inutile dans l'e-mail.

Un contact dont la `source` finit par `_rapide` — envoi trop rapide pour un
humain, marqué par la RPC — ajoute une ligne « ⚠️ Signal ». C'est ce qui
permet de trier un robot d'un vrai contact sans ouvrir la base.

---

## Les visuels

Servis depuis le site lui-même, donc toujours à jour et déjà en cache :

- logo : `https://taxifood.rentanoo.com/assets/icon-512.png`
- bandeau : `https://taxifood.rentanoo.com/og/taxi-food-nosy-be.jpg`

Le bandeau est un **JPEG** et non un WebP : Outlook ne lit pas le WebP.

---

## Secrets

L'URL du webhook vit dans le **Vault Supabase**, secret
`n8n_contact_webhook_url`, lue par `public.n8n_contact_webhook_url()` —
révoquée pour `anon` et `authenticated`. Elle n'est **pas** dans le dépôt :
qui la détient peut poster n'importe quoi et déclencher des e-mails.

Pour la remplacer (rotation) :

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'n8n_contact_webhook_url'),
  '<nouvelle url>'
);
```

Côté n8n, changer le `path` du nœud Webhook, puis rebasculer Actif OFF → ON
dans l'éditeur.
