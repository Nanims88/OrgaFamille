# 🏡 Chez nous — OrgaFamille

Application web familiale (front-end statique + [Supabase](https://supabase.com)) pour organiser au même endroit le quotidien d'une famille : tâches ménagères, agenda, activités, checklists, un espace dédié à l'enfant, et le suivi du budget.

Aucune installation ni build n'est nécessaire : l'app est un ensemble de pages HTML/JS/CSS statiques qui se connectent directement à une base Supabase.

## Sommaire des pages

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil « Aujourd'hui ». Vue **Jour** (une colonne par membre : tâches, planning, événements), vue **Semaine** et vue **Mois** (grille avec pastilles d'événements/activités/travaux). |
| `menage.html` | Gestion des **tâches ménagères** : création, fréquence (quotidien, hebdo, mensuel, ponctuel), attribution à un membre, historique des tâches faites/à faire, exceptions ponctuelles. |
| `agenda.html` | **Semaine type** (planning récurrent par jour/membre) et **événements** ponctuels (sorties, rendez-vous, vacances qui remplacent le planning habituel). |
| `activites.html` | **Idées de sorties/activités** à programmer, avec statut (idée → planifiée) et date prévue. |
| `checklists.html` | **Modèles de checklists** réutilisables (ex. valise, courses) et leurs **instances en cours**, avec suivi des items cochés. |
| `baptiste.html` | Espace enfant dédié (Baptiste) : liste de ses tâches du jour à cocher, scores (⭐ jour/semaine/mois) et animation de confettis en récompense. |
| `budget.html` | Suivi du **budget familial** : charges fixes, charges enfants (cantine, garderie…), carburant, salaires/répartition, dépenses variables du mois. |
| `parametres.html` | Gestion des **membres de la famille** (nom, icône, couleur, ordre d'affichage). |

Toutes les pages partagent la même en-tête, la même navigation (`nav.modules`) et le même portail d'authentification par mot de passe.

## Architecture technique

- **Front-end** : HTML + JavaScript vanilla (pas de framework), un seul fichier CSS partagé (`assets/style.css`).
- **Backend** : [Supabase](https://supabase.com) (PostgreSQL + API auto-générée), consommé via le SDK JS `@supabase/supabase-js` chargé en CDN.
- **`assets/config.js`** : configuration du client Supabase (URL du projet, clé publique `anon`) et hash SHA-256 du mot de passe famille.
- **`assets/app.js`** : fonctions communes à toutes les pages (client Supabase, gestion du portail mot de passe, cache des membres, formatage des dates, navigation active).
- Chaque page HTML contient son propre script embarqué avec la logique spécifique au module (requêtes Supabase, rendu du DOM).

### Authentification

L'accès est protégé par un **vrai compte Supabase Auth par personne** (email + mot de passe, via `sb.auth.signInWithPassword()`) — pas de hash local ni de mot de passe en clair dans le code. C'est cette session authentifiée qui satisfait les règles **Row Level Security (RLS)** activées sur toutes les tables : sans elle, l'API Supabase refuse toute lecture/écriture, même avec la clé `anon` (publique dans le code source).

Pour ajouter quelqu'un ou changer un mot de passe : Supabase > Authentication > Users.

## Modèle de données (tables Supabase)

| Table | Utilisée par | Contenu |
|---|---|---|
| `membres` | toutes les pages | Membres de la famille (nom, icône, couleur, ordre) |
| `taches_menage` | `index.html`, `menage.html`, `baptiste.html` | Tâches ménagères (libellé, icône, fréquence, membre assigné) |
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
3. Entrer le mot de passe famille configuré dans `assets/config.js`.

Aucune dépendance à installer : Supabase JS et `canvas-confetti` sont chargés depuis un CDN.
