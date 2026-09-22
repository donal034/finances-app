# Mon Pilotage Financier

Application web de gestion de finances personnelles : comptes, opérations, virements, récurrences, objectifs d'épargne, investissements et rapports. Les données sont synchronisées en temps réel entre ordinateur et téléphone, et accessibles uniquement par leur propriétaire.

**Démo :** https://donal034.github.io/finances-app

## Fonctionnalités (V1)

- **Comptes** : courant, Livret A, LEP, PEA, assurance-vie, etc. Le solde est calculé à partir du solde de départ et des opérations ; « Corriger le solde » l'aligne sur le relevé bancaire. Archivage des comptes clôturés.
- **Opérations** : revenus, dépenses et virements entre comptes (les virements ne faussent ni les revenus ni les dépenses). Modification complète, notes, filtres par mois, type, compte, catégorie et recherche.
- **Récurrences** : salaire, loyer, abonnements ou épargne automatique, créés chaque mois sans doublon, même utilisés depuis plusieurs appareils.
- **Objectifs** : montant cible, échéance, effort mensuel calculé ; un objectif peut suivre le solde d'un compte.
- **Investissements** : montant investi, valeur actuelle, plus-value, répartition.
- **Rapports** : synthèse du mois, graphique annuel revenus / dépenses, principales catégories.
- **Tableau de bord** : patrimoine net, budget, alertes de découvert et de dépassement.
- **Données** : sauvegarde et restauration JSON, export CSV pour Excel, migration automatique depuis l'ancienne version locale.
- **Confidentialité** : mode discret qui floute les montants.

## Architecture

```
index.html
css/styles.css
js/
  firebase-config.js   Configuration et initialisation Firebase
  utils.js             Formatage, dates, échappement HTML
  store.js             Authentification, cache temps réel, écritures, calculs
  dashboard.js         Tableau de bord
  accounts.js          Comptes
  transactions.js      Opérations
  recurring.js         Récurrences
  goals.js             Objectifs
  investments.js       Investissements
  reports.js           Rapports
  settings.js          Paramètres, import / export
  app.js               Navigation, connexion, dialogues (chargé en dernier)
database.rules.json    Règles de sécurité de la base
```

**Flux de données :** à la connexion, l'arbre `users/{uid}` est chargé en mémoire et tenu à jour par un écouteur temps réel. Les vues lisent ce cache de façon synchrone ; les écritures partent vers Firebase et reviennent automatiquement dans le cache, sur tous les appareils connectés.

## Sécurité

| Contrôle | Mise en œuvre |
|---|---|
| Authentification | Firebase Authentication, fournisseur Google (OpenID Connect) |
| Autorisation | Règles Realtime Database : chaque utilisateur n'accède qu'à `users/{son uid}` ; tout le reste est refusé par défaut |
| Injection HTML | Toutes les données affichées sont échappées (`U.esc`) |
| Configuration | La configuration Firebase du front n'est pas un secret ; la protection repose sur l'authentification et les règles |

## Mise en place

1. **Firebase → Authentication** : cliquer sur *Commencer*, puis *Méthode de connexion → Google → Activer*.
2. **Authentication → Paramètres → Domaines autorisés** : ajouter `donal034.github.io`.
3. **Realtime Database → Règles** : coller le contenu de `database.rules.json`, puis *Publier*.
4. **GitHub → Settings → Pages** : déployer depuis la branche `main`, dossier racine.

## Stack

HTML, CSS et JavaScript sans framework ni étape de build. Firebase Authentication et Realtime Database (SDK compat 10.x). Hébergement GitHub Pages.

## Licence

MIT
