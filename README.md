# Mon Pilotage Financier

Une application web moderne et intuitive pour gérer vos finances personnelles, vos dépenses et vos investissements en toute sécurité.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-active-success)

## ✨ Fonctionnalités

### 📊 Tableau de bord
- **Vue d'ensemble** : Patrimoine total, revenus et dépenses du mois
- **Budget mensuel** : Suivi visuel avec donut chart
- **Objectif d'épargne** : Progression vers votre objectif
- **Opérations récentes** : Historique des 6 dernières transactions
- **Analyse par catégorie** : Ventilation des dépenses

### 🏦 Gestion des comptes
- Ajouter plusieurs comptes bancaires (courant, Livret A, LEP, etc.)
- Mettre à jour les soldes en temps réel
- Support de 4 banques et plus (BNP, Revolut, Hello Banque, Bourso, etc.)

### 💰 Suivi des opérations
- Enregistrer revenus et dépenses
- Catégoriser les transactions
- Filtrer par mois, type, ou mot-clé
- Modifier ou supprimer les opérations
- Historique complet par mois

### 📈 Portefeuille d'investissements
- Tracker actions, crypto-monnaies, immobilier, ETF, assurance-vie
- Calcul automatique du ROI (gain/perte)
- Visualisation de l'allocation du portefeuille
- Mise à jour facile des valeurs actuelles

### 📊 Rapports et synthèses
- **Résumé mensuel** : Revenus, dépenses, solde, état du budget
- **Résumé annuel** : Totaux année, moyennes mensuelles, détail mois par mois
- **Allocation d'actifs** : Distribution des investissements par type
- **Analyse de performance** : ROI par investissement

### ⚙️ Paramètres
- Configurer le budget mensuel
- Définir votre objectif principal (montant, nom, emoji)
- Exporter vos données en JSON
- Réinitialiser les données

## 🔒 Sécurité et Confidentialité

**Les données restent 100% locales sur votre appareil.**
- Aucun serveur : pas d'envoi de données à l'extérieur
- Stockage dans `localStorage` du navigateur
- Vous avez le contrôle complet de vos données
- Export/Import en JSON pour sauvegarde personnelle

## 🚀 Installation et déploiement

### Option 1 : Local (développement)
```bash
# Cloner le repo
git clone https://github.com/donal034/finances-app.git
cd finances-app

# Ouvrir dans un navigateur
open index.html
# ou
start index.html  # Windows
```

### Option 2 : GitHub Pages (production)

#### Prérequis
- Un compte GitHub (vous en avez un ✓)
- Git installé localement

#### Déploiement
1. **Pousser le code sur GitHub** :
```bash
git add .
git commit -m "Initial commit: finances app"
git push -u origin main
```

2. **Activer GitHub Pages** :
   - Aller dans `Settings` → `Pages`
   - Choisir `Deploy from a branch`
   - Sélectionner `main` comme branche source
   - Cliquer sur `Save`

3. **Accéder à l'app** :
   ```
   https://donal034.github.io/finances-app
   ```

L'app sera automatiquement mise à jour à chaque push sur `main`.

## 📱 Utilisation

### Ajouter vos premiers comptes
1. Allez dans **Comptes**
2. Cliquez sur **+ Ajouter un compte**
3. Remplissez : nom, banque, type, solde initial
4. Cliquez sur **Enregistrer**

### Enregistrer une opération
1. Allez dans **Opérations** ou cliquez **+ Ajouter une opération**
2. Remplissez : type, libellé, montant, catégorie, date
3. Cliquez sur **Enregistrer**

### Tracker un investissement
1. Allez dans **Investissements**
2. Cliquez sur **+ Ajouter un investissement**
3. Remplissez : nom, type, montant investi, valeur actuelle, date
4. Le ROI se calcule automatiquement

### Consulter vos rapports
1. Allez dans **Rapports**
2. Consultez le résumé mensuel et annuel
3. Analysez votre allocation d'actifs

## 🛠️ Architecture

```
finances-app/
├── index.html              # Structure HTML
├── css/
│   └── styles.css          # Styles et responsive
├── js/
│   ├── storage.js          # Gestion localStorage
│   ├── app.js              # Logique principale
│   ├── accounts.js         # Module comptes
│   ├── transactions.js     # Module opérations
│   ├── investments.js      # Module investissements
│   └── reports.js          # Module rapports
├── README.md               # Ce fichier
└── .gitignore
```

## 💻 Technologies

- **HTML5** : Structure sémantique
- **CSS3** : Design moderne, responsive, variables CSS
- **Vanilla JavaScript** : Pas de dépendances externes
- **localStorage** : Persistance de données côté client

## 🎨 Design

- **Thème sombre** : Design élégant et reposant pour les yeux
- **Responsive** : Desktop, tablette, mobile
- **Navigation** : Sidebar (desktop) + bottom nav (mobile)
- **Accessibilité** : Contraste optimisé, navigation au clavier

## 📊 Exemple de données

Lors du premier démarrage, l'app est vide. Vous pouvez :
1. Ajouter vos comptes actuels
2. Importer votre historique (si vous avez un export JSON)
3. Commencer à enregistrer les opérations futures

## 🔄 Sauvegarde et récupération

### Exporter vos données
1. Allez dans **Paramètres**
2. Cliquez sur **📥 Exporter (JSON)**
3. Un fichier JSON est téléchargé

### Importer vos données
Ouvrez l'explorateur de stockage du navigateur (DevTools) et importez le JSON sauvegardé (fonctionnalité via paramètres).

## 📝 Catégories disponibles

- **Revenus** : Salaire, Bonus
- **Dépenses** : Logement, Alimentation, Transport, Loisirs, Santé, Épargne, Autre

## 🐛 Bugs / Améliorations

Avez-vous trouvé un bug ou une idée d'amélioration ?
- Ouvrez une **Issue** sur GitHub
- Soumettez une **Pull Request**

## 📄 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer ce projet.

## 🙋 Support

Des questions ? Besoin d'aide ?
- Consultez le code (il est commenté)
- Vérifiez la console du navigateur pour les erreurs
- Ouvrez une Issue sur GitHub

---

**Créé avec ❤️ pour une meilleure gestion financière personnelle.**

*Mise à jour : Septembre 2026*
