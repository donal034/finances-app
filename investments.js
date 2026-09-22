/**
 * Investments Module
 * Gère le portefeuille d'investissements
 */

const Investments = {
    render() {
        this.renderInvestmentsList();
        this.renderAllocationChart();
    },

    renderInvestmentsList() {
        const investments = Storage.getInvestments();
        const container = document.getElementById('investmentsList');

        if (investments.length === 0) {
            container.innerHTML = '<div class="empty" style="grid-column: 1/-1;">Aucun investissement. Commence à en ajouter.</div>';
            return;
        }

        container.innerHTML = investments.map(inv => {
            const gain = inv.currentValue - inv.amount;
            const gainPercent = ((gain / inv.amount) * 100).toFixed(2);
            const isPositive = gain >= 0;

            return `
                <div class="investment-card">
                    <div class="type">${this.getTypeLabel(inv.type)}</div>
                    <h3>${this.escapeHtml(inv.name)}</h3>
                    
                    <div class="investment-stat">
                        <div class="investment-stat-item">
                            <span class="investment-stat-label">Investi</span>
                            <span class="investment-stat-value">${this.formatCurrency(inv.amount)}</span>
                        </div>
                        <div class="investment-stat-item">
                            <span class="investment-stat-label">Valeur actuelle</span>
                            <span class="investment-stat-value">${this.formatCurrency(inv.currentValue)}</span>
                        </div>
                    </div>

                    <div class="roi ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''} ${this.formatCurrency(gain)} (${isPositive ? '+' : ''}${gainPercent}%)
                    </div>

                    <div style="font-size: 0.8rem; color: var(--muted); margin-top: 12px;">
                        Depuis: ${new Date(inv.date).toLocaleDateString('fr-FR')}
                    </div>

                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <button class="btn" style="flex: 1; padding: 8px; font-size: 0.8rem;" onclick="Investments.editInvestment(${inv.id})">✏️ Éditer</button>
                        <button class="btn" style="flex: 1; padding: 8px; font-size: 0.8rem;" onclick="Investments.deleteInvestment(${inv.id})">🗑️ Supprimer</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderAllocationChart() {
        const investments = Storage.getInvestments();
        const container = document.getElementById('allocationChart');

        if (investments.length === 0) {
            container.innerHTML = '<div class="empty">Aucun investissement à afficher.</div>';
            return;
        }

        const types = {};
        let total = 0;

        investments.forEach(inv => {
            const value = inv.currentValue;
            types[inv.type] = (types[inv.type] || 0) + value;
            total += value;
        });

        const sorted = Object.entries(types)
            .sort((a, b) => b[1] - a[1]);

        container.innerHTML = sorted.map(([type, value]) => {
            const percent = ((value / total) * 100).toFixed(1);
            return `
                <div class="allocation-item">
                    <div class="allocation-label">${this.getTypeLabel(type)}</div>
                    <div class="allocation-percent">${percent}%</div>
                    <div style="font-size: 0.85rem; color: var(--muted); margin-top: 5px;">${this.formatCurrency(value)}</div>
                </div>
            `;
        }).join('');
    },

    handleAddInvestment() {
        const name = document.getElementById('invName').value.trim();
        const type = document.getElementById('invType').value;
        const amount = parseFloat(document.getElementById('invAmount').value);
        const currentValue = parseFloat(document.getElementById('invCurrentValue').value);
        const date = document.getElementById('invDate').value;

        if (!name || isNaN(amount) || amount <= 0 || isNaN(currentValue) || !date) {
            App.showToast('Remplis tous les champs correctement');
            return;
        }

        const investment = {
            name,
            type,
            amount,
            currentValue,
            date
        };

        Storage.addInvestment(investment);
        document.getElementById('addInvestmentDialog').close();
        document.getElementById('investmentForm').reset();
        App.showToast('Investissement enregistré');
        this.render();
        App.renderDashboard();
    },

    editInvestment(id) {
        const inv = Storage.getInvestments().find(i => i.id === id);
        if (!inv) return;

        const newValue = prompt(`Nouvelle valeur pour "${inv.name}" (€):`, inv.currentValue);
        if (newValue !== null && !isNaN(newValue) && parseFloat(newValue) >= 0) {
            Storage.updateInvestment(id, { currentValue: parseFloat(newValue) });
            App.showToast('Investissement mis à jour');
            this.render();
            App.renderDashboard();
        }
    },

    deleteInvestment(id) {
        const inv = Storage.getInvestments().find(i => i.id === id);
        if (inv && confirm(`Supprimer l'investissement "${inv.name}" ?`)) {
            Storage.deleteInvestment(id);
            App.showToast('Investissement supprimé');
            this.render();
            App.renderDashboard();
        }
    },

    getTypeLabel(type) {
        const labels = {
            'stock': 'Actions',
            'crypto': 'Crypto-monnaies',
            'realestate': 'Immobilier',
            'etf': 'ETF/Fonds',
            'insurance': 'Assurance-vie',
            'other': 'Autre'
        };
        return labels[type] || type;
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
