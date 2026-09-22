/**
 * App Main Controller
 * Gère la navigation, les mises à jour globales et le dashboard
 */

const App = {
    // INIT
    init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.renderDashboard();
        this.setDateInputToday();
    },

    // SETUP
    setupEventListeners() {
        // Dialog triggers
        document.getElementById('openAddTransaction').addEventListener('click', () => {
            document.getElementById('addTransactionDialog').showModal();
            document.getElementById('txDate').valueAsDate = new Date();
        });
        document.getElementById('openAddTransaction2').addEventListener('click', () => {
            document.getElementById('addTransactionDialog').showModal();
            document.getElementById('txDate').valueAsDate = new Date();
        });
        document.getElementById('openAddAccount').addEventListener('click', () => {
            document.getElementById('addAccountDialog').showModal();
        });
        document.getElementById('openAddInvestment').addEventListener('click', () => {
            document.getElementById('addInvestmentDialog').showModal();
            document.getElementById('invDate').valueAsDate = new Date();
        });

        // Dialog cancels
        document.getElementById('cancelTransaction').addEventListener('click', () => {
            document.getElementById('addTransactionDialog').close();
        });
        document.getElementById('cancelAccount').addEventListener('click', () => {
            document.getElementById('addAccountDialog').close();
        });
        document.getElementById('cancelInvestment').addEventListener('click', () => {
            document.getElementById('addInvestmentDialog').close();
        });

        // Form submissions
        document.getElementById('accountForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Accounts.handleAddAccount();
        });
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Transactions.handleAddTransaction();
        });
        document.getElementById('investmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            Investments.handleAddInvestment();
        });

        // Settings
        document.getElementById('settingsBudget').addEventListener('change', () => {
            this.handleSettingChange();
        });
        document.getElementById('settingsGoalName').addEventListener('change', () => {
            this.handleSettingChange();
        });
        document.getElementById('settingsGoalAmount').addEventListener('change', () => {
            this.handleSettingChange();
        });
        document.getElementById('settingsGoalIcon').addEventListener('change', () => {
            this.handleSettingChange();
        });

        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
        document.getElementById('resetData').addEventListener('click', () => {
            if (confirm('Êtes-vous sûr ? Cette action est irréversible.')) {
                Storage.resetAll();
                location.reload();
            }
        });
    },

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn, .mobile-nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = btn.dataset.section;
                this.switchSection(section);
            });
        });
    },

    // NAVIGATION
    switchSection(section) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        // Show selected section
        document.getElementById(section).classList.add('active');

        // Update nav buttons
        document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === section) {
                btn.classList.add('active');
            }
        });

        // Render section content
        if (section === 'dashboard') {
            this.renderDashboard();
        } else if (section === 'accounts') {
            Accounts.render();
        } else if (section === 'transactions') {
            Transactions.render();
        } else if (section === 'investments') {
            Investments.render();
        } else if (section === 'reports') {
            Reports.render();
        } else if (section === 'settings') {
            this.renderSettings();
        }
    },

    // DASHBOARD RENDERING
    renderDashboard() {
        this.renderDashboardCards();
        this.renderBudgetChart();
        this.renderGoalProgress();
        this.renderRecentTransactions();
        this.renderCategoryBreakdown();
    },

    renderDashboardCards() {
        const accounts = Storage.getAccounts();
        const transactions = Storage.getTransactions();
        const thisMonth = this.getThisMonthTransactions();

        // Total assets
        const totalAssets = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        document.getElementById('totalAssets').textContent = this.formatCurrency(totalAssets);

        // Monthly income
        const income = thisMonth
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('monthlyIncome').textContent = this.formatCurrency(income);

        // Monthly expenses
        const expenses = thisMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        document.getElementById('monthlyExpenses').textContent = this.formatCurrency(expenses);
    },

    renderBudgetChart() {
        const settings = Storage.getSettings();
        const thisMonth = this.getThisMonthTransactions();
        const expenses = thisMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const budget = settings.monthlyBudget || 1500;
        const pct = Math.min(100, Math.round((expenses / budget) * 100));

        document.getElementById('donut').style.setProperty('--pct', pct + '%');
        document.getElementById('budgetPct').textContent = pct + '%';
        document.getElementById('budgetText').textContent = `${this.formatCurrency(expenses)} / ${this.formatCurrency(budget)}`;
    },

    renderGoalProgress() {
        const settings = Storage.getSettings();
        const investments = Storage.getInvestments();
        const savings = investments
            .filter(inv => inv.type === 'savings' || inv.category === 'Épargne')
            .reduce((sum, inv) => sum + inv.currentValue, 0);

        const goalAmount = settings.goalAmount || 3500;
        const pct = Math.round((savings / goalAmount) * 100);

        document.getElementById('goalIcon').textContent = settings.goalIcon || '🎯';
        document.getElementById('goalName').textContent = settings.goalName || 'Objectif principal';
        document.getElementById('goalBar').style.width = Math.min(100, pct) + '%';
        document.getElementById('goalSaved').textContent = this.formatCurrency(savings);
        document.getElementById('goalTarget').textContent = this.formatCurrency(goalAmount);
    },

    renderRecentTransactions() {
        const thisMonth = this.getThisMonthTransactions();
        const recent = thisMonth
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6);

        const icons = {
            'Salaire': '↓',
            'Bonus': '💰',
            'Logement': '⌂',
            'Alimentation': '◉',
            'Transport': '➜',
            'Loisirs': '♪',
            'Santé': '⚕️',
            'Épargne': '◇',
            'Autre': '•'
        };

        const txList = document.getElementById('txList');
        if (recent.length === 0) {
            txList.innerHTML = '<div class="empty">Aucune opération ce mois-ci.</div>';
            document.getElementById('txCount').textContent = '0';
        } else {
            txList.innerHTML = recent.map(t => `
                <div class="tx">
                    <span class="ico">${icons[t.category] || '•'}</span>
                    <div>
                        <strong>${this.escapeHtml(t.label)}</strong>
                        <br>
                        <small>${t.category} · ${new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small>
                    </div>
                    <b class="${t.type === 'income' ? 'positive' : 'negative'}">
                        ${t.type === 'income' ? '+' : '−'} ${this.formatCurrency(t.amount)}
                    </b>
                </div>
            `).join('');
            document.getElementById('txCount').textContent = recent.length + ' opérations';
        }
    },

    renderCategoryBreakdown() {
        const thisMonth = this.getThisMonthTransactions();
        const categories = {};

        thisMonth
            .filter(t => t.type === 'expense')
            .forEach(t => {
                categories[t.category] = (categories[t.category] || 0) + t.amount;
            });

        const colors = {
            'Logement': '#60a5fa',
            'Alimentation': '#fb923c',
            'Transport': '#f472b6',
            'Loisirs': '#a78bfa',
            'Santé': '#fb7185',
            'Épargne': '#6ee7b7',
            'Autre': '#94a3b8'
        };

        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        const max = Math.max(...Object.values(categories), 1);

        const bars = document.getElementById('categoryBars');
        if (sorted.length === 0) {
            bars.innerHTML = '<div class="empty">Pas de dépenses ce mois-ci.</div>';
        } else {
            bars.innerHTML = sorted.map(([cat, amount]) => `
                <div class="bar-row">
                    <span>${cat}</span>
                    <div class="bar"><i style="width: ${(amount/max)*100}%; background: ${colors[cat] || colors.Autre}"></i></div>
                    <b>${this.formatCurrency(amount)}</b>
                </div>
            `).join('');
        }
    },

    // SETTINGS RENDERING
    renderSettings() {
        const settings = Storage.getSettings();
        document.getElementById('settingsBudget').value = settings.monthlyBudget;
        document.getElementById('settingsGoalName').value = settings.goalName;
        document.getElementById('settingsGoalAmount').value = settings.goalAmount;
        document.getElementById('settingsGoalIcon').value = settings.goalIcon;
    },

    handleSettingChange() {
        const settings = {
            monthlyBudget: parseFloat(document.getElementById('settingsBudget').value) || 1500,
            goalName: document.getElementById('settingsGoalName').value || 'Objectif principal',
            goalAmount: parseFloat(document.getElementById('settingsGoalAmount').value) || 3500,
            goalIcon: document.getElementById('settingsGoalIcon').value || '🎯'
        };
        Storage.saveSettings(settings);
        this.showToast('Paramètres enregistrés');
        this.renderDashboard();
    },

    // UTILITIES
    getThisMonthTransactions() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        return Storage.getTransactions().filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 2
        }).format(amount);
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    setDateInputToday() {
        const today = new Date().toISOString().split('T')[0];
        const dateInputs = document.querySelectorAll('input[type="date"]');
        dateInputs.forEach(input => {
            if (!input.value) {
                input.value = today;
            }
        });
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
    },

    exportData() {
        const data = Storage.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pilotage-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Données exportées');
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
