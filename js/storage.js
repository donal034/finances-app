/**
 * Storage Module (Firebase)
 * Gère la sauvegarde et la récupération des données dans Firebase Realtime Database
 */

const Storage = {
    // KEYS
    ACCOUNTS_KEY: 'accounts',
    TRANSACTIONS_KEY: 'transactions',
    INVESTMENTS_KEY: 'investments',
    SETTINGS_KEY: 'settings',

    // DEFAULT SETTINGS
    DEFAULT_SETTINGS: {
        monthlyBudget: 1500,
        goalName: 'Objectif principal',
        goalAmount: 3500,
        goalIcon: '🎯',
        currency: 'EUR'
    },

    // DATABASE REFERENCE
    db: null,
    userId: 'donal034', // Utilise ton GitHub username comme ID utilisateur

    // INIT
    async init() {
        this.db = firebase.database();
        
        // Attendre que Firebase soit connecté
        const connectedRef = this.db.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log('✅ Firebase connecté');
                this.initializeDefaults();
            }
        });
    },

    async initializeDefaults() {
        try {
            // Vérifier et créer les données par défaut si elles n'existent pas
            const settingsRef = this.db.ref(`users/${this.userId}/${this.SETTINGS_KEY}`);
            const settingsSnapshot = await settingsRef.once('value');
            
            if (!settingsSnapshot.exists()) {
                await this.saveSettings(this.DEFAULT_SETTINGS);
            }
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
        }
    },

    // SETTINGS
    async getSettings() {
        try {
            const ref = this.db.ref(`users/${this.userId}/${this.SETTINGS_KEY}`);
            const snapshot = await ref.once('value');
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            console.error('Erreur getSettings:', error);
            return null;
        }
    },

    async saveSettings(settings) {
        try {
            await this.db.ref(`users/${this.userId}/${this.SETTINGS_KEY}`).set(settings);
            console.log('Paramètres sauvegardés');
        } catch (error) {
            console.error('Erreur saveSettings:', error);
        }
    },

    // ACCOUNTS
    async getAccounts() {
        try {
            const ref = this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}`);
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Erreur getAccounts:', error);
            return [];
        }
    },

    async saveAccounts(accounts) {
        try {
            const accountsObj = {};
            accounts.forEach(acc => {
                accountsObj[acc.id] = acc;
            });
            await this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}`).set(accountsObj);
        } catch (error) {
            console.error('Erreur saveAccounts:', error);
        }
    },

    async addAccount(account) {
        try {
            account.id = Date.now();
            account.createdAt = new Date().toISOString();
            await this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}/${account.id}`).set(account);
            return account;
        } catch (error) {
            console.error('Erreur addAccount:', error);
            return null;
        }
    },

    async updateAccount(id, updates) {
        try {
            await this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}/${id}`).update(updates);
            const snapshot = await this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}/${id}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Erreur updateAccount:', error);
            return null;
        }
    },

    async deleteAccount(id) {
        try {
            await this.db.ref(`users/${this.userId}/${this.ACCOUNTS_KEY}/${id}`).remove();
        } catch (error) {
            console.error('Erreur deleteAccount:', error);
        }
    },

    // TRANSACTIONS
    async getTransactions() {
        try {
            const ref = this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}`);
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Erreur getTransactions:', error);
            return [];
        }
    },

    async saveTransactions(transactions) {
        try {
            const transObj = {};
            transactions.forEach(tx => {
                transObj[tx.id] = tx;
            });
            await this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}`).set(transObj);
        } catch (error) {
            console.error('Erreur saveTransactions:', error);
        }
    },

    async addTransaction(transaction) {
        try {
            transaction.id = Date.now();
            transaction.createdAt = new Date().toISOString();
            await this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}/${transaction.id}`).set(transaction);
            return transaction;
        } catch (error) {
            console.error('Erreur addTransaction:', error);
            return null;
        }
    },

    async updateTransaction(id, updates) {
        try {
            await this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}/${id}`).update(updates);
            const snapshot = await this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}/${id}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Erreur updateTransaction:', error);
            return null;
        }
    },

    async deleteTransaction(id) {
        try {
            await this.db.ref(`users/${this.userId}/${this.TRANSACTIONS_KEY}/${id}`).remove();
        } catch (error) {
            console.error('Erreur deleteTransaction:', error);
        }
    },

    // INVESTMENTS
    async getInvestments() {
        try {
            const ref = this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}`);
            const snapshot = await ref.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Erreur getInvestments:', error);
            return [];
        }
    },

    async saveInvestments(investments) {
        try {
            const invObj = {};
            investments.forEach(inv => {
                invObj[inv.id] = inv;
            });
            await this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}`).set(invObj);
        } catch (error) {
            console.error('Erreur saveInvestments:', error);
        }
    },

    async addInvestment(investment) {
        try {
            investment.id = Date.now();
            investment.createdAt = new Date().toISOString();
            await this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}/${investment.id}`).set(investment);
            return investment;
        } catch (error) {
            console.error('Erreur addInvestment:', error);
            return null;
        }
    },

    async updateInvestment(id, updates) {
        try {
            await this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}/${id}`).update(updates);
            const snapshot = await this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}/${id}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Erreur updateInvestment:', error);
            return null;
        }
    },

    async deleteInvestment(id) {
        try {
            await this.db.ref(`users/${this.userId}/${this.INVESTMENTS_KEY}/${id}`).remove();
        } catch (error) {
            console.error('Erreur deleteInvestment:', error);
        }
    },

    // EXPORT
    async exportData() {
        try {
            const [accounts, transactions, investments, settings] = await Promise.all([
                this.getAccounts(),
                this.getTransactions(),
                this.getInvestments(),
                this.getSettings()
            ]);

            return {
                accounts,
                transactions,
                investments,
                settings,
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Erreur exportData:', error);
            return null;
        }
    },

    // RESET (Delete all user data)
    async resetAll() {
        try {
            if (confirm('⚠️ Cela supprimera TOUTES vos données de Firebase. Êtes-vous sûr ?')) {
                await this.db.ref(`users/${this.userId}`).remove();
                console.log('Données supprimées de Firebase');
                location.reload();
            }
        } catch (error) {
            console.error('Erreur resetAll:', error);
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Storage.init());
