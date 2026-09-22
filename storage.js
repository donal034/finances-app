/**
 * Storage Module
 * Gère la sauvegarde et la récupération des données dans localStorage
 */

const Storage = {
    // KEYS
    ACCOUNTS_KEY: 'pilotage-accounts',
    TRANSACTIONS_KEY: 'pilotage-transactions',
    INVESTMENTS_KEY: 'pilotage-investments',
    SETTINGS_KEY: 'pilotage-settings',

    // DEFAULT SETTINGS
    DEFAULT_SETTINGS: {
        monthlyBudget: 1500,
        goalName: 'Objectif principal',
        goalAmount: 3500,
        goalIcon: '🎯',
        currency: 'EUR'
    },

    // INIT
    init() {
        if (!this.getSettings()) {
            this.saveSettings(this.DEFAULT_SETTINGS);
        }
        if (!this.getAccounts()) {
            this.saveAccounts([]);
        }
        if (!this.getTransactions()) {
            this.saveTransactions([]);
        }
        if (!this.getInvestments()) {
            this.saveInvestments([]);
        }
    },

    // SETTINGS
    getSettings() {
        const data = localStorage.getItem(this.SETTINGS_KEY);
        return data ? JSON.parse(data) : null;
    },

    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    },

    // ACCOUNTS
    getAccounts() {
        const data = localStorage.getItem(this.ACCOUNTS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveAccounts(accounts) {
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
    },

    addAccount(account) {
        const accounts = this.getAccounts();
        account.id = Date.now();
        account.createdAt = new Date().toISOString();
        accounts.push(account);
        this.saveAccounts(accounts);
        return account;
    },

    updateAccount(id, updates) {
        const accounts = this.getAccounts();
        const index = accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            accounts[index] = { ...accounts[index], ...updates };
            this.saveAccounts(accounts);
            return accounts[index];
        }
        return null;
    },

    deleteAccount(id) {
        const accounts = this.getAccounts().filter(a => a.id !== id);
        this.saveAccounts(accounts);
    },

    // TRANSACTIONS
    getTransactions() {
        const data = localStorage.getItem(this.TRANSACTIONS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveTransactions(transactions) {
        localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(transactions));
    },

    addTransaction(transaction) {
        const transactions = this.getTransactions();
        transaction.id = Date.now();
        transaction.createdAt = new Date().toISOString();
        transactions.push(transaction);
        this.saveTransactions(transactions);
        return transaction;
    },

    updateTransaction(id, updates) {
        const transactions = this.getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...updates };
            this.saveTransactions(transactions);
            return transactions[index];
        }
        return null;
    },

    deleteTransaction(id) {
        const transactions = this.getTransactions().filter(t => t.id !== id);
        this.saveTransactions(transactions);
    },

    // INVESTMENTS
    getInvestments() {
        const data = localStorage.getItem(this.INVESTMENTS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveInvestments(investments) {
        localStorage.setItem(this.INVESTMENTS_KEY, JSON.stringify(investments));
    },

    addInvestment(investment) {
        const investments = this.getInvestments();
        investment.id = Date.now();
        investment.createdAt = new Date().toISOString();
        investments.push(investment);
        this.saveInvestments(investments);
        return investment;
    },

    updateInvestment(id, updates) {
        const investments = this.getInvestments();
        const index = investments.findIndex(i => i.id === id);
        if (index !== -1) {
            investments[index] = { ...investments[index], ...updates };
            this.saveInvestments(investments);
            return investments[index];
        }
        return null;
    },

    deleteInvestment(id) {
        const investments = this.getInvestments().filter(i => i.id !== id);
        this.saveInvestments(investments);
    },

    // EXPORT
    exportData() {
        return {
            accounts: this.getAccounts(),
            transactions: this.getTransactions(),
            investments: this.getInvestments(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString()
        };
    },

    // IMPORT
    importData(data) {
        try {
            if (data.accounts) this.saveAccounts(data.accounts);
            if (data.transactions) this.saveTransactions(data.transactions);
            if (data.investments) this.saveInvestments(data.investments);
            if (data.settings) this.saveSettings(data.settings);
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    },

    // RESET
    resetAll() {
        localStorage.removeItem(this.ACCOUNTS_KEY);
        localStorage.removeItem(this.TRANSACTIONS_KEY);
        localStorage.removeItem(this.INVESTMENTS_KEY);
        localStorage.removeItem(this.SETTINGS_KEY);
        this.init();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => Storage.init());
