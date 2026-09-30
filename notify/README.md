# Brief quotidien par e-mail et SMS

Chaque matin à 7 h, une tâche GitHub Actions lit ta base Firebase, calcule ton brief et te l'envoie. Gratuit, sans serveur à gérer.

## Ce que tu reçois

```
Pilotage — lundi 12 octobre

Comptes courants : 188,61 €
Prévu au 31 octobre : 1 111,56 €
Ce mois : 182,00 € reçus, 0,00 € dépensés

! Hello – Compte de chèques passerait en négatif le 13 octobre : -1,75 €
! 2 opération(s) à montant variable à confirmer

Cette semaine :
  13 octobre — Free Mobile −9,99 €
  18 octobre — Lycamobile (Audrey) −9,99 €
```

Le SMS ne reprend que le solde et les quatre premières alertes, pour tenir en 480 caractères.

**Aucun message n'est envoyé** les jours sans alerte ni échéance, sauf le lundi. Un brief qu'on reçoit pour rien est un brief qu'on cesse de lire.

## Mise en place

### 1. Compte de service Firebase

1. Console Firebase → ⚙ **Paramètres du projet** → onglet **Comptes de service**
2. **Générer une nouvelle clé privée** → un fichier JSON se télécharge
3. Garde-le : son contenu entier ira dans un secret GitHub

Ce compte contourne les règles de sécurité, c'est voulu : le script doit lire tes données sans être connecté avec ton compte Google. **Ne le mets jamais dans le dépôt.**

### 2. Ton identifiant utilisateur

Dans l'app : **Paramètres → Compte**. L'identifiant est affiché sous ton adresse e-mail.

### 3. SMS gratuit, si tu es chez Free Mobile

1. [Espace abonné Free Mobile](https://mobile.free.fr) → **Gérer mon compte**
2. Section **Notifications par SMS** → **Activer**
3. Note l'identifiant et la clé générée

Gratuit et illimité, vers ton propre numéro uniquement.

### 4. E-mail

Avec Gmail : crée un **mot de passe d'application** dans ton compte Google (la validation en deux étapes doit être active). Hôte `smtp.gmail.com`, port `587`.

### 5. Secrets GitHub

Dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Valeur | Obligatoire |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Tout le contenu du fichier JSON | Oui |
| `FIREBASE_DATABASE_URL` | `https://finances-app-d11be-default-rtdb.europe-west1.firebasedatabase.app` | Oui |
| `PILOTAGE_UID` | Ton identifiant | Oui |
| `MAIL_TO` | Ton adresse e-mail | Pour l'e-mail |
| `SMTP_HOST` | `smtp.gmail.com` | Pour l'e-mail |
| `SMTP_PORT` | `587` | Pour l'e-mail |
| `SMTP_USER` | Ton adresse Gmail | Pour l'e-mail |
| `SMTP_PASS` | Le mot de passe d'application | Pour l'e-mail |
| `MAIL_FROM` | Identique à `SMTP_USER` | Facultatif |
| `FREE_SMS_USER` | Identifiant Free | Pour le SMS |
| `FREE_SMS_PASS` | Clé Free | Pour le SMS |

E-mail et SMS sont indépendants : tu peux n'en configurer qu'un.

### 6. Premier essai

Dépôt → onglet **Actions** → **Brief quotidien Mon Pilotage** → **Run workflow**.

Le journal affiche le brief, puis le résultat de chaque envoi.

## Essai en local

```bash
cd notify
npm install
npm test          # 23 vérifications, sans réseau
```

## Régler l'heure

Dans `.github/workflows/notify.yml`, la ligne `cron: '0 5 * * *'` est en heure UTC : 7 h à Paris en été, 6 h en hiver. Pour 8 h en hiver, mets `0 7 * * *`.

GitHub peut décaler l'exécution de quelques minutes à une heure en cas de charge : c'est normal pour une tâche planifiée gratuite.

## Ce qui circule, et où

| Donnée | Où elle passe |
|---|---|
| Soldes, opérations, budgets | Lus par le script, en mémoire, le temps du calcul sur un serveur GitHub |
| Brief | Envoyé à ton adresse e-mail et à ton numéro |
| Secrets | Chiffrés par GitHub, jamais affichés dans les journaux |
| Rien n'est stocké | Aucun fichier n'est écrit, aucune donnée n'est conservée après l'exécution |

C'est le compromis à accepter : ton modèle reste local côté app, mais le brief quotidien fait transiter tes chiffres par un serveur tiers pendant quelques secondes.

## Codes d'erreur du SMS Free

| Code | Cause |
|---|---|
| 400 | Paramètre manquant |
| 402 | Trop de SMS envoyés, attends quelques minutes |
| 403 | Service non activé, ou identifiants faux |
| 500 | Panne côté Free |
