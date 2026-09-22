/**
 * Accounts Module
 * Gère les comptes bancaires
 */

const Accounts = {
    render() {
        const accounts = Storage.getAccounts();
        const container = document.getElementById('accountsList');

        if (accounts.length === 0) {
            container.innerHTML = '<div class="empty" style="grid-column: 1/-1;">Aucun compte. Ajoute-en un pour commencer.</div>';
            return;
        }

        container.innerHTML = accounts.map(account => `
            <div class="account-card">
                <h3>${this.escapeHtml(account.name)}</h3>
                <div class="bank">${this.escapeHtml(account.bank)}</div>
                <div style="color: var(--muted); font-size: 0.85rem; margin-bottom: 10px;">
                    ${this.getTypeLabel(account.type)}
                </div>
                <div class="balance">${this.formatCurrency(account.balance)}</div>
                <div style="font-size: 0.8rem; color: var(--muted); margin-bottom: 15px;">
                    Créé: ${new Date(account.createdAt).toLocaleDateString('fr-FR')}
                </div>
                <div class="actions">
                    <button class="btn" onclick="Accounts.editAccount(${account.id})">✏️ Éditer</button>
                    <button class="btn" onclick="Accounts.deleteAccount(${account.id})">🗑️ Supprimer</button>
                </div>
            </div>
        `).join('');
    },

    handleAddAccount() {
        const name = document.getElementById('accountName').value.trim();
        const bank = document.getElementById('accountBank').value.trim();
        const type = document.getElementById('accountType').value;
        const balance = parseFloat(document.getElementById('accountBalance').value);

        if (!name || !bank || isNaN(balance)) {
            App.showToast('Remplis tous les champs');
            return;
        }

        const account = {
            name,
            bank,
            type,
            balance
        };

        Storage.addAccount(account);
        document.getElementById('addAccountDialog').close();
        document.getElementById('accountForm').reset();
        App.showToast('Compte ajouté');
        this.render();
        App.renderDashboard();
    },

    editAccount(id) {
        const account = Storage.getAccounts().find(a => a.id === id);
        if (!account) return;

        const newBalance = prompt(`Nouveau solde pour "${account.name}" (€):`, account.balance);
        if (newBalance !== null && !isNaN(newBalance)) {
            Storage.updateAccount(id, { balance: parseFloat(newBalance) });
            App.showToast('Solde mis à jour');
            this.render();
            App.renderDashboard();
        }
    },

    deleteAccount(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce compte ?')) {
            Storage.deleteAccount(id);
            App.showToast('Compte supprimé');
            this.render();
            App.renderDashboard();
        }
    },

    getTypeLabel(type) {
        const labels = {
            'checking': 'Compte courant',
            'savings': 'Livret d\'épargne',
            'lep': 'LEP',
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
