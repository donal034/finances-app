/**
 * Opérations récurrentes (salaire, loyer, abonnements, épargne automatique).
 * Chaque mois, l'occurrence est créée automatiquement à l'ouverture de l'app
 * une fois sa date atteinte.
 */
const Recurring = {
  editingId: null,

  render(el) {
    const list = Store.list('recurrings').sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));
    let monthIn = 0, monthOut = 0;
    list.filter(r => r.active).forEach(r => {
      if (r.type === 'income') monthIn += Number(r.amount) || 0;
      if (r.type === 'expense') monthOut += Number(r.amount) || 0;
    });

    el.innerHTML = `
      ${App.header('Automatisation', 'Opérations récurrentes',
        `<button class="btn primary" data-act="recurring.openNew">＋ Ajouter</button>`)}
      <div class="summary-bar card">
        <span>Chaque mois</span>
        <span>Entrées ${U.money(monthIn, 'positive')} · Charges ${U.money(monthOut, 'negative')} · Reste ${U.money(monthIn - monthOut)}</span>
      </div>
      ${list.length ? `<div class="card"><div class="list">${list.map(r => this.row(r)).join('')}</div></div>`
        : `<div class="card onboarding"><h2>Aucune opération récurrente</h2>
           <p class="muted">Ajoute ton salaire, ton loyer, ton Navigo ou tes abonnements : ils seront enregistrés automatiquement chaque mois.</p>
           <button class="btn primary" data-act="recurring.openNew">Ajouter une récurrence</button></div>`}`;
  },

  row(r) {
    const acc = Store.get('accounts', r.accountId);
    const to = Store.get('accounts', r.toAccountId);
    const next = r.active ? Store.nextOccurrence(r) : null;
    const cls = r.type === 'income' ? 'positive' : r.type === 'expense' ? 'negative' : 'transfer';
    const sign = r.type === 'income' ? '+ ' : r.type === 'expense' ? '− ' : '';
    const where = r.type === 'transfer' ? `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`
      : `${r.category || ''}${acc ? ' – ' + acc.name : ''}`;
    return `
      <div class="tx ${r.active ? '' : 'inactive'}">
        <span class="ico">${r.type === 'transfer' ? '⇆' : U.catIcon(r.category)}</span>
        <div class="tx-main">
          <strong>${U.esc(r.label)}</strong>
          <small>${U.esc(where)} – le ${Number(r.day)} de chaque mois</small>
          <small class="note">${r.active ? (next ? `Prochaine : ${U.longDate(next)}` : 'Terminée') : 'En pause'}</small>
        </div>
        <b class="${cls}">${sign}${U.money(r.amount)}</b>
        <div class="row-actions">
          <button class="icon-btn" data-act="recurring.toggle" data-id="${U.esc(r.id)}" aria-label="${r.active ? 'Mettre en pause' : 'Réactiver'}">${r.active ? '⏸' : '▶'}</button>
          <button class="icon-btn" data-act="recurring.edit" data-id="${U.esc(r.id)}" aria-label="Modifier">✏️</button>
          <button class="icon-btn" data-act="recurring.del" data-id="${U.esc(r.id)}" aria-label="Supprimer">🗑️</button>
        </div>
      </div>`;
  },

  bindForm() {
    document.getElementById('recType').addEventListener('change', () => this.updateTypeUI());
    document.getElementById('recForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
  },

  openNew() {
    this.editingId = null;
    this.fill({ type: 'expense', label: '', amount: '', day: new Date().getDate(), startDate: U.today(), active: true });
    document.getElementById('recTitle').textContent = 'Nouvelle récurrence';
    App.openDialog('dlgRecurring');
  },

  edit(id) {
    const r = Store.get('recurrings', id);
    if (!r) return;
    this.editingId = id;
    this.fill(r);
    document.getElementById('recTitle').textContent = 'Modifier la récurrence';
    App.openDialog('dlgRecurring');
  },

  fill(r) {
    document.getElementById('recType').value = r.type || 'expense';
    document.getElementById('recLabel').value = r.label || '';
    document.getElementById('recAmount').value = r.amount !== '' && r.amount !== undefined ? String(r.amount).replace('.', ',') : '';
    document.getElementById('recDay').value = r.day || 1;
    document.getElementById('recStart').value = r.startDate || U.today();
    document.getElementById('recEnd').value = r.endDate || '';
    document.getElementById('recAccount').innerHTML = App.accountOptions(r.accountId || '', { none: 'Aucun compte' });
    document.getElementById('recToAccount').innerHTML = App.accountOptions(r.toAccountId || '', { none: 'Choisir…' });
    this.updateTypeUI(r.category);
  },

  updateTypeUI(selectedCat) {
    const type = document.getElementById('recType').value;
    const isTransfer = type === 'transfer';
    document.getElementById('fieldRecTo').hidden = !isTransfer;
    document.getElementById('fieldRecCat').hidden = isTransfer;
    if (!isTransfer) {
      const cur = selectedCat !== undefined ? selectedCat : document.getElementById('recCategory').value;
      document.getElementById('recCategory').innerHTML = App.categoryOptions(type, cur);
    }
  },

  submit() {
    const type = document.getElementById('recType').value;
    const amount = U.num(document.getElementById('recAmount').value);
    const day = parseInt(document.getElementById('recDay').value, 10);
    const startDate = document.getElementById('recStart').value;
    const endDate = document.getElementById('recEnd').value || null;
    const accountId = document.getElementById('recAccount').value || null;
    const toAccountId = document.getElementById('recToAccount').value || null;
    let label = document.getElementById('recLabel').value.trim();

    if (!(amount > 0)) return App.toast('Indique un montant supérieur à 0', 'error');
    if (!(day >= 1 && day <= 31)) return App.toast('Le jour doit être entre 1 et 31', 'error');
    if (!startDate) return App.toast('Choisis une date de début', 'error');
    if (endDate && endDate < startDate) return App.toast('La date de fin doit être après la date de début', 'error');
    if (type === 'transfer') {
      if (!accountId || !toAccountId || accountId === toAccountId) return App.toast('Choisis deux comptes différents', 'error');
      if (!label) label = 'Virement';
    } else if (!label) {
      return App.toast('Ajoute un libellé', 'error');
    }

    const base = this.editingId ? { ...Store.get('recurrings', this.editingId) } : { active: true };
    const obj = {
      ...base, type, label, amount: U.round2(amount), day, startDate, endDate, accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      category: type === 'transfer' ? null : document.getElementById('recCategory').value
    };
    App.closeDialog('dlgRecurring');
    Store.save('recurrings', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Récurrence modifiée' : 'Récurrence ajoutée');
  },

  toggle(id) {
    const r = Store.get('recurrings', id);
    if (!r) return;
    Store.save('recurrings', { ...r, active: !r.active }).catch(e => App.fail(e));
    App.toast(r.active ? 'Récurrence en pause' : 'Récurrence réactivée');
  },

  del(id) {
    const r = Store.get('recurrings', id);
    if (!r || !confirm(`Supprimer la récurrence « ${r.label} » ?\nLes opérations déjà créées sont conservées.`)) return;
    Store.remove('recurrings', id).catch(e => App.fail(e));
    App.toast('Récurrence supprimée');
  }
};
