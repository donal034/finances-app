/**
 * Transactions Module
 * Gère les opérations (revenus et dépenses)
 */

const Transactions = {
    render() {
        const transactions = Storage.getTransactions();
        const container = document.getElementById('transactionsList');

        // Populate filters
        this.populateMonthFilter(transactions);

        // Apply filters
        const filterMonth = document.getElementById('filterMonth').value;
        const filterType = document.getElementById('filterType').value;
        const filterSearch = document.getElementById('filterSearch').value.toLowerCase();

        let filtered = transactions.filter(t => {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const matchMonth = !filterMonth || monthKey === filterMonth;
            const matchType = !filterType || t.type === filterType;
            const matchSearch = !filterSearch || 
                t.label.toLowerCase().includes(filterSearch) || 
                t.category.toLowerCase().includes(filterSearch);

            return matchMonth && matchType && matchSearch;
        });

        // Sort by date descending
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty">Aucune opération correspondante.</div>';
            return;
        }

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

        container.innerHTML = filtered.map(t => `
            <div class="transaction-row">
                <div class="icon">${icons[t.category] || '•'}</div>
                <div class="info">
                    <h4>${this.escapeHtml(t.label)}</h4>
                    <p>${t.category} · ${new Date(t.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}</p>
                </div>
                <div class="amount ${t.type === 'income' ? 'positive' : 'negative'}">
                    ${t.type === 'income' ? '+' : '−'} ${this.formatCurrency(t.amount)}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn" style="padding: 6px 8px; font-size: 0.8rem;" onclick="Transactions.editTransaction(${t.id})">✏️</button>
                    <button class="btn" style="padding: 6px 8px; font-size: 0.8rem;" onclick="Transactions.deleteTransaction(${t.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    populateMonthFilter(transactions) {
        const filterMonth = document.getElementById('filterMonth');
        const months = new Set();

        transactions.forEach(t => {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
        });

        const currentOptions = Array.from(filterMonth.querySelectorAll('option')).slice(1);
        const currentKeys = new Set(currentOptions.map(o => o.value));

        months.forEach(monthKey => {
            if (!currentKeys.has(monthKey)) {
                const [year, month] = monthKey.split('-');
                const date = new Date(year, parseInt(month) - 1);
                const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                const option = document.createElement('option');
                option.value = monthKey;
                option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
                filterMonth.appendChild(option);
            }
        });
    },

    handleAddTransaction() {
        const type = document.getElementById('txType').value;
        const label = document.getElementById('txLabel').value.trim();
        const amount = parseFloat(document.getElementById('txAmount').value);
        const category = document.getElementById('txCategory').value;
        const date = document.getElementById('txDate').value;

        if (!label || isNaN(amount) || amount <= 0 || !date) {
            App.showToast('Remplis tous les champs correctement');
            return;
        }

        const transaction = {
            type,
            label,
            amount,
            category,
            date
        };

        Storage.addTransaction(transaction);
        document.getElementById('addTransactionDialog').close();
        document.getElementById('transactionForm').reset();
        App.showToast('Opération enregistrée');
        this.render();
        App.renderDashboard();

        // Setup filters on first add
        this.setupFilters();
    },

    editTransaction(id) {
        const tx = Storage.getTransactions().find(t => t.id === id);
        if (!tx) return;

        const newAmount = prompt(`Nouveau montant pour "${tx.label}" (€):`, tx.amount);
        if (newAmount !== null && !isNaN(newAmount) && parseFloat(newAmount) > 0) {
            Storage.updateTransaction(id, { amount: parseFloat(newAmount) });
            App.showToast('Opération mise à jour');
            this.render();
            App.renderDashboard();
        }
    },

    deleteTransaction(id) {
        const tx = Storage.getTransactions().find(t => t.id === id);
        if (tx && confirm(`Supprimer "${tx.label}" ?`)) {
            Storage.deleteTransaction(id);
            App.showToast('Opération supprimée');
            this.render();
            App.renderDashboard();
        }
    },

    setupFilters() {
        const filterMonth = document.getElementById('filterMonth');
        const filterType = document.getElementById('filterType');
        const filterSearch = document.getElementById('filterSearch');

        filterMonth.addEventListener('change', () => this.render());
        filterType.addEventListener('change', () => this.render());
        filterSearch.addEventListener('input', () => this.render());
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
    }
};

// Setup filters on init
document.addEventListener('DOMContentLoaded', () => {
    Transactions.setupFilters();
});
