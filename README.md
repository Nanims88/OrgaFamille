# 🏡 Chez nous — OrgaFamille

Application web familiale (front-end statique + [Supabase](https://supabase.com)) pour organiser au même endroit le quotidien d'une famille : tâches ménagères, agenda, activités, checklists, un espace dédié à l'enfant, et le suivi du budget.

Aucune installation ni build n'est nécessaire : l'app est un ensemble de pages HTML/JS/CSS statiques qui se connectent directement à une base Supabase.

## Sommaire des pages

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil « Aujourd'hui ». Vue **Jour** (une colonne par membre : tâches à cocher, planning, événements), vue **Semaine** et vue **Mois** (grille avec pastilles d'événements/activités/travaux). Alerte automatique si une checklist en cours n'est pas terminée. |
| `menage.html` | Gestion des **tâches ménagères** : création, fréquence (quotidien, hebdo, mensuel, ponctuel), attribution à un membre, historique des tâches faites/à faire, exceptions ponctuelles, archives (terminées/supprimées, restaurables). |
| `agenda.html` | **Événements** ponctuels (sorties, rendez-vous, vacances qui remplacent ou complètent le planning habituel, avec couleur personnalisable) et **semaine type** (planning récurrent par jour/membre). Numéro de semaine ISO affiché sur les vues Semaine et Mois. |
| `activites.html` | **Idées de sorties/activités** à programmer, avec statut (idée → planifiée) et date prévue. |
| `checklists.html` | **Modèles de checklists** réutilisables (ex. valise, courses) et leurs **instances en cours**, avec ajout, modification et suivi des items cochés. |
| `baptiste.html` | Espace enfant dédié (Baptiste) : liste de ses tâches du jour à cocher, défi/énigme du jour (avec révélation de la réponse pour les parents), scores (⭐ jour/semaine/mois) et animation de confettis en récompense. |
| `budget.html` | Suivi du **budget familial** : résumé du mois (figé en haut de page au défilement) avec solde du compte commun (modifiable, suggéré automatiquement d'un mois sur l'autre), charges fixes, charges enfants (cantine, garderie…, détail repliable avec solde par enfant), carburant, salaires/répartition, dépenses variables du mois, et une **vue annuelle** (graphique d'évolution des dépenses par poste, mois par mois). |
| `parametres.html` | Gestion des **membres de la famille** (nom, icône, couleur, ordre d'affichage). |

Toutes les pages partagent la même en-tête, la même navigation (`nav.modules`) et le même portail de connexion.

## Architecture technique

- **Front-end** : HTML + JavaScript vanilla (pas de framework), un seul fichier CSS partagé (`assets/style.css`).
- **Backend** : [Supabase](https://supabase.com) (PostgreSQL + API auto-générée), consommé via le SDK JS `@supabase/supabase-js` chargé en CDN.
- **`assets/config.js`** : configuration du client Supabase (URL du projet, clé publique `anon`).
- **`assets/app.js`** : fonctions communes à toutes les pages (client Supabase, portail de connexion, cache des membres, formatage des dates, navigation active).
- Chaque page HTML contient son propre script embarqué avec la logique spécifique au module (requêtes Supabase, rendu du DOM).
- **PWA installable** : `assets/manifest.json` + `sw.js` (service worker, enregistré dans `app.js`) permettent d'installer le site sur l'écran d'accueil.

### Authentification

L'accès est protégé par un **vrai compte Supabase Auth par personne** (email + mot de passe, via `sb.auth.signInWithPassword()`) — pas de hash local ni de mot de passe en clair dans le code. C'est cette session authentifiée qui satisfait les règles **Row Level Security (RLS)** activées sur toutes les tables : sans elle, l'API Supabase refuse toute lecture/écriture, même avec la clé `anon` (publique dans le code source).

Pour ajouter quelqu'un ou changer un mot de passe : Supabase > Authentication > Users.

## Modèle de données (tables Supabase)

| Table | Utilisée par | Contenu |
|---|---|---|
| `membres` | toutes les pages | Membres de la famille (nom, icône, couleur, ordre) |
| `taches_menage` | `index.html`, `menage.html`, `baptiste.html` | Tâches ménagères (libellé, icône, fréquence, membre assigné). Les tâches **ponctuelles** (travaux / à penser) sont clôturées définitivement (`actif=false`) dès qu'on les coche, où que ce soit dans l'app — elles ne reviennent pas le lendemain, contrairement aux tâches récurrentes (quotidien/hebdo/mensuel) qui se recochent chaque période. |
| `taches_menage_log` | `index.html`, `baptiste.html` | Historique quotidien des tâches faites/non faites |
| `taches_menage_exceptions` | `index.html`, `baptiste.html` | Exceptions ponctuelles (tâche non due un jour donné) |
| `planning_recurrent` | `index.html`, `agenda.html` | Semaine type récurrente par membre |
| `evenements` | `index.html`, `agenda.html` | Événements ponctuels (sorties, vacances, rendez-vous) |
| `idees_activites` | `index.html`, `activites.html` | Idées de sorties/activités et leur statut |
| `checklists_modeles` / `checklists_modele_items` | `checklists.html` | Modèles de checklists et leurs items |
| `checklists_instances` / `checklists_instance_items` | `checklists.html` | Instances en cours d'une checklist et suivi des items |
| `budget_charges_fixes` / `budget_charges_fixes_montant` / `budget_charges_fixes_statut` | `budget.html` | Charges fixes mensuelles, leurs montants et statut de paiement |
| `budget_charges_enfants` / `budget_charges_enfants_ajustement` | `budget.html` | Charges liées aux enfants (cantine, garderie…) et ajustements |
| `budget_transport` | `budget.html` | Suivi du carburant/transport |
| `budget_depenses_variables` | `budget.html` | Historique des dépenses variables du mois |
| `budget_profils` | `budget.html` | Profils/répartition liés au budget (salaires, parts) |
| `budget_solde_compte` | `budget.html` | Solde du compte commun en début de mois (figé par mois, ajustable ; suggéré automatiquement à partir du mois précédent) |

## Démarrer

1. Cloner le dépôt.
2. Ouvrir `index.html` dans un navigateur (ou servir le dossier avec un serveur statique, ex. `python3 -m http.server`).
3. Se connecter avec un compte Supabase Auth existant (créé dans Supabase > Authentication > Users).

Aucune dépendance à installer : Supabase JS et `canvas-confetti` sont chargés depuis un CDN.

## Module séparé : Budget perso

`budget-perso.html` est une application de suivi du budget **personnel**, 100 % locale (IndexedDB, aucune donnée envoyée à Supabase ni ailleurs) et volontairement non reliée au reste du site. Voir [README-budget-perso.md](README-budget-perso.md) pour le détail.
