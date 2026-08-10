# Cahier des charges — MVP application client

**Projet :** Taxi Food — livraison de repas à Nosy Be
**Périmètre de ce document :** application **client** (le mangeur qui commande)
**Objectif :** sortir la première version le plus vite possible, avec les fonctionnalités indispensables et rien de superflu.
**Date :** 10 août 2026

---

## 1. Le produit en une phrase

Le client ouvre l'application, choisit un restaurant de Nosy Be, compose sa commande (pizza, tacos, burger…), indique où se faire livrer, choisit son mode de paiement, valide, puis suit l'avancement de sa commande jusqu'à la livraison — le paiement réel se faisant au moment de la remise du repas.

---

## 2. Décisions structurantes (validées)

| Sujet | Choix retenu pour le MVP |
|---|---|
| **Identification** | Connexion **Google uniquement** (un seul bouton, aucun mot de passe à gérer) |
| **Modèle** | **Marketplace multi-restaurants** : plusieurs enseignes listées, chacune avec son propre menu |
| **Paiement** | Le client **déclare** son mode de paiement (CB / espèces / Orange Money) dans l'appli ; l'**encaissement réel se fait à la livraison**. Aucune passerelle de paiement en ligne dans le MVP |
| **Suivi** | **Statuts simples** (reçue → confirmée → en préparation → en livraison → livrée). Pas de carte GPS temps réel |
| **Langue** | Français |
| **Zone** | Nosy Be (Hell-Ville et environs) |

---

## 3. Ce qui est DANS le MVP / ce qui est REPORTÉ

### Inclus (indispensable pour commander)
- Connexion Google
- Liste des restaurants avec statut ouvert/fermé
- Menu d'un restaurant (catégories + produits)
- Panier (un seul restaurant par commande)
- Saisie de l'adresse de livraison
- Choix du mode de paiement (déclaratif)
- Validation de commande
- Suivi de commande par statuts
- Historique des commandes + « recommander »
- Profil minimal (nom, téléphone, adresses enregistrées)
- Notification au client à chaque changement de statut

### Reporté (version 2 et au-delà — **hors périmètre MVP**)
- Paiement en ligne réel (intégration CB / API Orange Money)
- Géolocalisation du livreur en temps réel sur une carte
- Notes et avis sur les restaurants
- Codes promo, réductions, programme de fidélité
- Chat / support intégré dans l'appli
- Recherche avancée et filtres (cuisine, prix, note…)
- Plusieurs langues
- Programmation d'une commande à une heure future

---

## 4. Acteurs

- **Le client** — utilise l'application décrite ici pour commander et suivre sa livraison.
- **Le restaurant** — reçoit et prépare les commandes. *(Réception des commandes gérée par une interface back-office simple, hors périmètre de ce document — à cadrer séparément. Pour le tout premier lancement, la réception peut même être manuelle/tablette, comme sur le projet Addition Appli.)*
- **Le livreur** — récupère et livre la commande, encaisse le paiement. *(Pas d'application dédiée dans le MVP ; le suivi côté client repose sur les statuts mis à jour par le restaurant/back-office.)*

---

## 5. Parcours principal du client (happy path)

1. J'ouvre l'appli → écran d'accueil ou invitation à me connecter.
2. Je me connecte avec **Google** (une seule fois ; je reste connecté ensuite).
3. Je vois la **liste des restaurants** de Nosy Be, avec ceux qui sont ouverts en avant.
4. Je choisis un restaurant → je vois son **menu** classé par catégories.
5. J'ajoute des produits au **panier** (je peux ajuster les quantités).
6. J'ouvre le panier, je vérifie le récapitulatif et le total.
7. Je renseigne ou confirme mon **adresse de livraison**.
8. Je choisis mon **mode de paiement** (CB / espèces / Orange Money).
9. Je **valide** la commande.
10. J'arrive sur l'**écran de suivi** : ma commande passe par les statuts jusqu'à « livrée ».
11. Je paie **à la livraison** selon le mode choisi.
12. Je retrouve la commande dans mon **historique** et peux la recommander plus tard.

---

## 6. Fonctionnalités détaillées, écran par écran

*(Cette section sert de base au design et au développement.)*

### 6.1 Connexion
- Un écran unique avec le logo Taxi Food et un bouton **« Continuer avec Google »**.
- À la première connexion, on récupère automatiquement le nom et l'e-mail depuis Google.
- On demande le **numéro de téléphone** une seule fois (indispensable pour la livraison), juste après la première connexion.
- Ensuite, l'utilisateur reste connecté (pas de reconnexion à chaque ouverture).

### 6.2 Accueil — liste des restaurants
- Liste (ou grille) des restaurants disponibles à Nosy Be.
- Pour chaque restaurant : **nom, photo/logo, type de cuisine, statut ouvert/fermé**, éventuellement frais de livraison et délai estimé.
- Les restaurants **fermés** sont visibles mais grisés / non commandables.
- En-tête affichant l'adresse de livraison active (modifiable).

### 6.3 Menu d'un restaurant
- En-tête du restaurant (nom, photo, horaires, statut).
- Produits regroupés par **catégories** (ex. Pizzas, Tacos, Burgers, Boissons).
- Pour chaque produit : **nom, photo, description courte, prix**, bouton d'ajout.
- Un produit **indisponible** est affiché comme tel et non ajoutable.
- Un panier flottant/badge indique le nombre d'articles et le total, avec accès rapide.

### 6.4 Détail d'un produit *(peut être une fiche ou un panneau qui remonte)*
- Photo, description complète, prix.
- Sélecteur de **quantité**.
- Champ **commentaire** optionnel (ex. « sans oignons »).
- Bouton **« Ajouter au panier »**.
- *(Options/suppléments : simples si nécessaires ; sinon reportés en v2 pour aller plus vite.)*

### 6.5 Panier
- Liste des articles : nom, quantité (modifiable), prix ligne.
- Possibilité de **retirer** un article.
- **Règle : un panier = un seul restaurant.** Ajouter un produit d'un autre restaurant propose de vider le panier en cours.
- Récapitulatif : **sous-total, frais de livraison, total**.
- Bouton **« Commander »**.

### 6.6 Adresse de livraison
- Sélection d'une adresse **enregistrée** ou saisie d'une **nouvelle adresse**.
- Champs : **quartier/zone de Nosy Be, description du point de repère, téléphone, instructions** (« maison bleue à côté de… »).
- *(Pas de sélection sur carte obligatoire dans le MVP ; adresse textuelle suffisante. Un point sur carte est un plus possible mais non bloquant.)*
- Possibilité d'**enregistrer** l'adresse pour la prochaine fois.

### 6.7 Validation de la commande
- Récapitulatif final : restaurant, articles, adresse, **mode de paiement**, total.
- Choix du **mode de paiement** : CB, espèces, Orange Money (boutons/segments).
- Rappel clair : **« Paiement à la livraison »**.
- Bouton **« Valider la commande »**.

### 6.8 Confirmation
- Écran de confirmation (numéro de commande, restaurant, montant, mode de paiement).
- Accès direct au **suivi**.

### 6.9 Suivi de commande
- Affichage de l'état d'avancement par **statuts** :
  `Reçue → Confirmée → En préparation → En livraison → Livrée`
- État visuel type barre de progression / étapes cochées.
- Rappel du récapitulatif (articles, adresse, mode de paiement, total).
- Le client est **notifié** à chaque changement de statut.

### 6.10 Historique des commandes
- Liste des commandes passées (restaurant, date, montant, statut final).
- Ouvrir une commande → détail.
- Bouton **« Recommander »** qui recrée le panier à l'identique.

### 6.11 Profil
- Nom, e-mail (via Google), **téléphone**.
- Gestion des **adresses enregistrées**.
- Bouton **« Se déconnecter »**.

---

## 7. Règles métier clés

- Un **panier ne contient qu'un seul restaurant** à la fois.
- On ne peut commander que dans un restaurant **ouvert**.
- Le **téléphone du client est obligatoire** avant de pouvoir valider une commande.
- Le **paiement est déclaratif** : le mode choisi est une information transmise au restaurant/livreur ; aucun débit dans l'appli.
- Les **frais de livraison** et un éventuel **minimum de commande** sont définis par restaurant (valeurs par défaut simples pour démarrer).
- Une fois **validée**, la commande n'est plus modifiable par le client dans le MVP (annulation possible par contact direct — hors appli au départ).
- Les statuts sont **avancés par le restaurant/back-office**, pas par le client.

---

## 8. Modèle de données (vue haut niveau)

*(Pour cadrer le back-end ; détaillé au moment du développement.)*

- **Utilisateur** : id, nom, e-mail (Google), téléphone, date d'inscription.
- **Adresse** : id, utilisateur, quartier/zone, description, instructions, téléphone de contact.
- **Restaurant** : id, nom, logo/photo, type de cuisine, statut (ouvert/fermé), horaires, frais de livraison, minimum de commande, zone desservie.
- **Catégorie** : id, restaurant, nom, ordre d'affichage.
- **Produit** : id, catégorie/restaurant, nom, description, prix, photo, disponibilité.
- **Commande** : id, numéro, utilisateur, restaurant, adresse, mode de paiement, sous-total, frais de livraison, total, statut, date, horodatage des changements de statut.
- **Ligne de commande** : id, commande, produit, quantité, prix unitaire, commentaire.

---

## 9. Contraintes techniques & hypothèses

- **Type d'application :** application mobile client (web app / PWA envisageable pour cohérence avec l'écosystème existant — à confirmer au moment du choix technique).
- **Identification :** Google Sign-In (OAuth Google).
- **Hébergement :** cloud (à aligner avec l'existant — Supabase + hébergement front, comme le projet Addition Appli).
- **Connexion internet :** supposée correcte à Nosy Be pour l'usage visé.
- **Hypothèses par défaut à confirmer** *(choix pris pour ne pas bloquer le cadrage)* :
  - Frais de livraison : **forfait simple par restaurant** (pas de calcul par distance dans le MVP).
  - Pas de sélection cartographique obligatoire de l'adresse.
  - Français uniquement.
  - Options/suppléments produits gardés minimaux.

---

## 10. Après le MVP (rappel des évolutions prévues)

Paiement en ligne réel (CB, Orange Money), suivi GPS du livreur en temps réel, avis et notes, codes promo et fidélité, recherche et filtres, application dédiée pour le livreur, multi-langue, commande programmée.

---

## 11. Prochaine étape

Ce cahier des charges sert de base à un **prompt pour Claude (Design)**, qui définira toute la charte graphique (couleurs rouge/orange/jaune, typographie, composants) et construira le design des écrans listés en section 6. Le code du design sera ensuite exporté, et Claude Code se chargera de relier le back-end au front-end.
