/**
 * Reports Module
 * Génère des rapports mensuel et annuel
 */

const Reports = {
    render() {
        this.renderMonthlySummary();
        this.renderYearlySummary();
    },

    renderMonthlySummary() {
        const transactions = Storage.getTransactions();
        const today = new Date();
        const thisMonth = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        });

        const income = thisMonth
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = thisMonth
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = income - expenses;
        const settings = Storage.getSettings();
        const budgetStatus = expenses <= settings.monthlyBudget ? 'Sous budget' : 'Dépassement';

        const container = document.getElementById('monthlySummary');
        container.innerHTML = `
            <div class="summary-row">
                <div class="label">Revenus totaux</div>
                <div class="value positive">${this.formatCurrency(income)}</div>
            </div>
            <div class="summary-row">
                <div class="label">Dépenses totales</div>
                <div class="value negative">${this.formatCurrency(expenses)}</div>
            </div>
            <div class="summary-row">
                <div class="label">Budget mensuel</div>
                <div class="value">${this.formatCurrency(settings.monthlyBudget)}</div>
            </div>
            <div class="summary-row">
                <div class="label">État du budget</div>
                <div class="value" style="color: ${expenses <= settings.monthlyBudget ? 'var(--mint)' : 'var(--red)'}">${budgetStatus}</div>
            </div>
            <div class="summary-row" style="border-bottom: 2px solid var(--mint); padding-bottom: 15px;">
                <div class="label"><strong>Solde net</strong></div>
                <div class="value" style="color: ${balance >= 0 ? 'var(--mint)' : 'var(--red)'}"><strong>${this.formatCurrency(balance)}</strong></div>
            </div>
            <div class="summary-row">
                <div class="label">Opérations</div>
                <div class="value">${thisMonth.length}</div>
            </div>
        `;
    },

    renderYearlySummary() {
        const transactions = Storage.getTransactions();
        const today = new Date();
        const currentYear = today.getFullYear();

        // Monthly breakdown
        const months = {};
        for (let i = 0; i < 12; i++) {
            const monthKey = `${i}`;
            months[monthKey] = { income: 0, expenses: 0 };
        }

        transactions
            .filter(t => new Date(t.date).getFullYear() === currentYear)
            .forEach(t => {
                const month = new Date(t.date).getMonth();
                if (t.type === 'income') {
                    months[month].income += t.amount;
                } else {
                    months[month].expenses += t.amount;
                }
            });

        // Totals
        const yearIncome = Object.values(months).reduce((sum, m) => sum + m.income, 0);
        const yearExpenses = Object.values(months).reduce((sum, m) => sum + m.expenses, 0);
        const yearBalance = yearIncome - yearExpenses;

        // Get investments
        const investments = Storage.getInvestments();
        const investmentsValue = investments.reduce((sum, inv) => sum + inv.currentValue, 0);
        const investmentsGain = investments.reduce((sum, inv) => sum + (inv.currentValue - inv.amount), 0);

        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

        const container = document.getElementById('yearlySummary');
        container.innerHTML = `
            <div class="summary-row">
                <div class="label">Revenus annuels</div>
                <div class="value positive">${this.formatCurrency(yearIncome)}</div>
            </div>
            <div class="summary-row">
                <div class="label">Dépenses annuelles</div>
                <div class="value negative">${this.formatCurrency(yearExpenses)}</div>
            </div>
            <div class="summary-row" style="border-bottom: 2px solid var(--mint); padding-bottom: 15px;">
                <div class="label"><strong>Solde annuel</strong></div>
                <div class="value" style="color: ${yearBalance >= 0 ? 'var(--mint)' : 'var(--red)'}"><strong>${this.formatCurrency(yearBalance)}</strong></div>
            </div>
            <div class="summary-row">
                <div class="label">Moyennes mensuelles</div>
                <div class="value">${this.formatCurrency(yearIncome / 12)} / ${this.formatCurrency(yearExpenses / 12)}</div>
            </div>
            <div class="summary-row">
                <div class="label">Portefeuille investi</div>
                <div class="value">${this.formatCurrency(investmentsValue)}</div>
            </div>
            <div class="summary-row">
                <div class="label">Gain/Perte investissements</div>
                <div class="value" style="color: ${investmentsGain >= 0 ? 'var(--mint)' : 'var(--red)'}">${investmentsGain >= 0 ? '+' : ''}${this.formatCurrency(investmentsGain)}</div>
            </div>

            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--line);">
                <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 0.95rem;">Détail mensuel ${currentYear}</h3>
                ${monthNames.map((name, i) => {
                    const m = months[i];
                    const balance = m.income - m.expenses;
                    return `
                        <div class="summary-row" style="font-size: 0.9rem;">
                            <div class="label">${name}</div>
                            <div style="display: flex; gap: 15px; text-align: right;">
                                <span style="color: var(--mint); min-width: 70px;">${this.formatCurrency(m.income)}</span>
                                <span style="color: var(--red); min-width: 70px;">${this.formatCurrency(m.expenses)}</span>
                                <span style="color: ${balance >= 0 ? 'var(--mint)' : 'var(--red)'}; min-width: 70px; font-weight: 500;">${this.formatCurrency(balance)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 2
        }).format(amount);
    }
};
