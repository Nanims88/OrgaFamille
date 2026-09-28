# 💶 Budget perso

Application de suivi du budget personnel, **100% locale** : aucune donnée ne quitte jamais le navigateur (pas de compte, pas de serveur, pas de synchronisation). Elle est volontairement séparée du site familial et n'y est pas liée — c'est un espace privé.

Accès protégé par un code à 4 chiffres ou plus, créé au premier lancement (stocké uniquement sur cet appareil, dans ce navigateur).

## Les notions de base

Avant les écrans, quelques mots-clés utilisés partout dans l'app :

- **Cycle** : ton "mois" à toi, qui ne commence pas forcément le 1er mais au jour de paie que tu as choisi (réglable dans Paramètres). Un cycle va d'une paie à la suivante.
- **Enveloppe** : le budget des dépenses du quotidien (carburant, courses, tabac, café, restaurant, vêtements, soins, cadeaux, maison, psy, voiture...). C'est LE chiffre à surveiller au jour le jour — tout le reste (charges fixes, dettes) est prévisible et déjà décidé.
- **Charge fixe** vs **dépense variable** : une charge fixe (loyer côté joint, prêt, assurance...) est connue à l'avance et ne pèse jamais sur l'enveloppe. Une dépense variable (café, courses...) sort de l'enveloppe de la semaine.
- **Virement enveloppe** : l'argent que tu transfères chaque semaine de ton compte principal vers la carte/compte dédié aux dépenses courantes (Boursorama). Le montant suggéré s'ajuste tout seul si tu as déjà dépensé avant de faire le virement, **et ne dépasse jamais ce que ton découvert autorisé permet réellement** — s'il est réduit pour cette raison, un message te le signale.
- **Coussin** : une réserve de sécurité (objectif : atteindre un montant cible) qui se remplit avec ce qu'il reste à la fin d'un cycle, avant que le surplus n'aille rembourser le prêt auto en avance.
- **Compte principal** : le compte sur lequel arrive ton salaire et d'où partent les charges fixes et le virement enveloppe. Son solde affiché est calculé (dernier solde connu + mouvements saisis depuis), pas récupéré automatiquement d'une banque.
- **Reste à vivre réel** (Accueil) : ton solde réel, moins tout ce qu'il reste encore à transférer vers l'enveloppe pour financer le reste du cycle (`budget de l'enveloppe du cycle − ce qui a déjà été viré`). C'est la réponse honnête à "combien me reste-t-il vraiment", indépendamment du montant suggéré semaine par semaine — il peut être négatif si tes charges fixes et virements restants dépassent ton solde actuel, et c'est volontairement affiché sans le masquer.

## Navigation : 3 groupes, du plus fréquent au plus rare

Les 10 écrans sont rangés par fréquence d'usage réelle plutôt que tous mis au même niveau. En haut, 3 boutons de groupe ; cliquer sur l'un affiche ses écrans juste en dessous.

### 🏠 Au quotidien

| Écran | À quoi il sert |
|---|---|
| **Accueil** | Vue d'ensemble en un coup d'œil : solde du compte principal, **reste à vivre réel**, reste du cycle (enveloppe), coussin, jauge de la semaine en cours, alertes de trésorerie, prochaines échéances (14 jours), top 3 des objectifs. |
| **Saisie** | Enregistrer une dépense ou un revenu (montant, catégorie, compte, date). Historique complet consultable dans un volet repliable. |
| **Semaine** | Le budget hebdomadaire de l'enveloppe : combien il reste, combien virer (plafonné par ton découvert autorisé). Le bouton "Faire le virement" enregistre automatiquement la sortie sur le compte principal. |

### 📊 Le mois

| Écran | À quoi il sert |
|---|---|
| **Cycle** | Vue globale du cycle en cours : revenu, charges fixes, enveloppe budgétée, écart. Détail "Réel vs budget" par catégorie. Bouton de clôture qui répartit le reste entre coussin et prêt auto. |
| **Échéancier** | Ce qui va tomber dans les 30 prochains jours (paie, charges fixes, échéances de crédit, **et ce qu'il reste à virer vers l'enveloppe**). Simulateur de trésorerie : à partir d'un solde et d'une liste de mouvements prévus, détecte si/quand tu risques de passer sous 0 ou sous le découvert autorisé. |
| **Objectifs** | Suivi de tes objectifs personnels (coussin permanent, plafond tabac, 0 rejet bancaire, dates cibles des crédits, épargne). |

### ⚙️ De temps en temps

| Écran | À quoi il sert |
|---|---|
| **Dettes** | Détail de chaque crédit (Izicarte, prêt auto, PayPal 4X) : tableau d'amortissement, simulateur "et si je verse un extra ce mois-ci". |
| **Bonus** | Calculateur ponctuel : répartir un revenu exceptionnel (13e mois, intéressement) entre Noël, remboursement Izicarte, prêt auto et épargne. Liste des gros événements à venir (anniversaires, Noël...) pour t'y préparer. |
| **Paramètres** | Configuration : jour du cycle, revenu, découvert autorisé, charges fixes, réglages de l'enveloppe carburant/courses/tabac/variable, thème clair/sombre, changement du code d'accès. |
| **Import / Export** | Coller/importer un relevé bancaire CSV (avec règles de catégorisation automatique par mot-clé), exporter toutes tes données en JSON (sauvegarde) ou en CSV. |

## Où vivent les données

Tout est stocké dans IndexedDB (`budget-perso`), dans ce navigateur uniquement :

- **config** : un seul enregistrement avec tous les réglages (cycle, revenu, catégories, charges fixes, enveloppe, objectifs...)
- **transactions** : chaque dépense/revenu saisi ou importé
- **dettes** : les 3 crédits suivis
- **virementsHebdo** : les virements enveloppe déjà validés, semaine par semaine
- **evenements** : les échéances "Bonus" (anniversaires, Noël...)
- **reglesImport** : les règles de catégorisation automatique pour l'import CSV

Rien de tout ça ne part sur un serveur. Changer de navigateur ou d'appareil = repartir à zéro (utiliser Export/Import JSON pour transférer).

## Notes techniques (pour reprendre le code plus tard)

- `assets/budget-perso/calc.js` : tous les calculs (cycle, enveloppe, amortissement, projection de trésorerie...) sous forme de fonctions pures, testées (`tests/calc.test.js`, `npm test`).
- `assets/budget-perso/db.js` : accès IndexedDB + valeurs par défaut + migrations de configuration (ajout de champs sans perte de données pour les comptes déjà créés).
- `assets/budget-perso/app.js` : navigation par onglets (`#hash`) et rendu de chaque écran.
- Aucun lien depuis le site familial : accessible uniquement en ouvrant `budget-perso.html` directement.
