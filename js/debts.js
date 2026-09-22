/**
 * Dettes et prêts.
 * direction "owe" : je dois de l'argent (crédit, proche…)
 * direction "owed" : on me doit de l'argent
 * Le reste dû est déduit (ou ajouté) au patrimoine net.
 */
const DEBT_KINDS = { person: 'Proche', loan: 'Crédit bancaire', other: 'Autre' };

const Debts = {
  editingId: null,
  paymentDebtId: null,

  render(el) {
    const list = Store.list('debts').sort((a, b) => {
      const ra = Store.debtRemaining(a), rb = Store.debtRemaining(b);
      if ((ra > 0) !== (rb > 0)) return ra > 0 ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    const t = Store.debtTotals();

    el.innerHTML = `
      ${App.header('Engagements', 'Dettes et prêts',
        `<button class="btn primary" data-act="debts.openNew">＋ Ajouter</button>`)}
      <div class="grid">
        <article class="card kpi span-4"><span class="kpi-label">Je dois</span>
          <div class="kpi-value negative">${U.money(t.owe)}</div></article>
        <article class="card kpi span-4"><span class="kpi-label">On me doit</span>
          <div class="kpi-value positive">${U.money(t.owed)}</div></article>
        <article class="card kpi span-4"><span class="kpi-label">Solde</span>
          <div class="kpi-value">${U.money(t.owed - t.owe)}</div>
          <span class="muted small">Pris en compte dans le patrimoine net</span></article>
      </div>
      ${list.length ? `<div class="cards-grid">${list.map(d => this.card(d)).join('')}</div>`
        : `<div class="card onboarding"><h2>Aucune dette ni prêt</h2>
           <p class="muted">Note l'argent prêté à un proche, un crédit en cours ou une somme que tu dois rembourser. Chaque remboursement met à jour le reste dû.</p>
           <button class="btn primary" data-act="debts.openNew">Ajouter</button></div>`}`;
  },

  card(d) {
    const initial = Number(d.initialAmount) || 0;
    const remaining = Store.debtRemaining(d);
    const paid = Store.debtPaid(d);
    const pct = initial > 0 ? Math.min(100, paid / initial * 100) : 0;
    const owe = d.direction !== 'owed';
    const payments = Object.values(d.payments || {}).sort((a, b) => b.date.localeCompare(a.date));
    const settled = remaining <= 0;
    const late = !settled && d.dueDate && d.dueDate < U.today();
    return `
      <div class="card debt ${settled ? 'settled' : ''}">
        <div class="account-top">
          <div>
            <h3>${U.esc(d.name)}</h3>
            <span class="muted small">${owe ? 'Je dois' : 'On me doit'} – ${U.esc(DEBT_KINDS[d.kind] || 'Autre')}</span>
          </div>
          ${settled ? '<span class="tag">Soldé</span>' : late ? '<span class="tag tag-alert">En retard</span>' : ''}
        </div>
        <div class="account-balance ${settled ? '' : owe ? 'negative' : 'positive'}">${U.money(remaining)}</div>
        <small class="muted">Reste sur ${U.money(initial)}${d.dueDate ? ` – échéance ${U.longDate(d.dueDate)}` : ''}</small>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <small class="muted">${Math.round(pct)} % remboursé</small>
        ${d.note ? `<p class="small note">${U.esc(d.note)}</p>` : ''}
        ${payments.length ? `<div class="payments">${payments.slice(0, 4).map(p => `
          <div class="mini-row"><span>${U.shortDate(p.date)}</span><span>${U.money(p.amount)}
            <button class="icon-btn" data-act="debts.delPayment" data-id="${U.esc(d.id + '|' + p.id)}" aria-label="Supprimer ce remboursement">✕</button></span></div>`).join('')}
          ${payments.length > 4 ? `<small class="muted">et ${payments.length - 4} autre(s)</small>` : ''}</div>` : ''}
        <div class="card-actions">
          ${settled ? '' : `<button class="btn small primary" data-act="debts.pay" data-id="${U.esc(d.id)}">Remboursement</button>`}
          <button class="btn small" data-act="debts.edit" data-id="${U.esc(d.id)}">Modifier</button>
          <button class="btn small danger" data-act="debts.del" data-id="${U.esc(d.id)}">Supprimer</button>
        </div>
      </div>`;
  },

  bindForm() {
    document.getElementById('debtKind').innerHTML =
      Object.entries(DEBT_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    document.getElementById('debtForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    document.getElementById('payForm').addEventListener('submit', e => { e.preventDefault(); this.submitPayment(); });
  },

  openNew() {
    this.editingId = null;
    this.fill({ direction: 'owe', name: '', kind: 'person', initialAmount: '', startDate: U.today(), dueDate: '', note: '' });
    document.getElementById('debtTitle').textContent = 'Nouvelle dette ou prêt';
    App.openDialog('dlgDebt');
  },

  edit(id) {
    const d = Store.get('debts', id);
    if (!d) return;
    this.editingId = id;
    this.fill(d);
    document.getElementById('debtTitle').textContent = 'Modifier';
    App.openDialog('dlgDebt');
  },

  fill(d) {
    document.getElementById('debtDirection').value = d.direction || 'owe';
    document.getElementById('debtName').value = d.name || '';
    document.getElementById('debtKind').value = d.kind || 'person';
    document.getElementById('debtAmount').value = d.initialAmount ? String(d.initialAmount).replace('.', ',') : '';
    document.getElementById('debtStart').value = d.startDate || U.today();
    document.getElementById('debtDue').value = d.dueDate || '';
    document.getElementById('debtNote').value = d.note || '';
  },

  submit() {
    const direction = document.getElementById('debtDirection').value;
    const name = document.getElementById('debtName').value.trim();
    const kind = document.getElementById('debtKind').value;
    const initialAmount = U.num(document.getElementById('debtAmount').value);
    const startDate = document.getElementById('debtStart').value;
    const dueDate = document.getElementById('debtDue').value || null;
    const note = document.getElementById('debtNote').value.trim() || null;

    if (!name) return App.toast('Indique la personne ou l’organisme', 'error');
    if (!(initialAmount > 0)) return App.toast('Indique un montant supérieur à 0', 'error');
    if (!startDate) return App.toast('Choisis une date', 'error');
    if (dueDate && dueDate < startDate) return App.toast('L’échéance doit être après la date de début', 'error');

    const base = this.editingId ? { ...Store.get('debts', this.editingId) } : {};
    const obj = { ...base, direction, name, kind, initialAmount: U.round2(initialAmount), startDate, dueDate, note };
    App.closeDialog('dlgDebt');
    Store.save('debts', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Modifié' : 'Ajouté');
  },

  pay(id) {
    const d = Store.get('debts', id);
    if (!d) return;
    this.paymentDebtId = id;
    const owe = d.direction !== 'owed';
    document.getElementById('payInfo').innerHTML =
      `${U.esc(d.name)} – reste ${U.money(Store.debtRemaining(d))}`;
    document.getElementById('payAmount').value = '';
    document.getElementById('payDate').value = U.today();
    document.getElementById('lblPayAccount').textContent = owe ? 'Payé depuis le compte (facultatif)' : 'Reçu sur le compte (facultatif)';
    document.getElementById('payAccount').innerHTML = App.accountOptions('', { none: 'Ne pas créer d’opération' });
    App.openDialog('dlgPayment');
  },

  submitPayment() {
    const d = Store.get('debts', this.paymentDebtId);
    if (!d) return;
    const amount = U.num(document.getElementById('payAmount').value);
    const date = document.getElementById('payDate').value;
    const accountId = document.getElementById('payAccount').value || null;
    const remaining = Store.debtRemaining(d);

    if (!(amount > 0)) return App.toast('Indique un montant supérieur à 0', 'error');
    if (!date) return App.toast('Choisis une date', 'error');
    if (amount > remaining + 0.001) return App.toast(`Le montant dépasse le reste dû (${U.eur(remaining)})`, 'error');

    const pid = Store.newId('debts');
    const u = { [`debts/${d.id}/payments/${pid}`]: { id: pid, date, amount: U.round2(amount) } };

    // Opération correspondante sur le compte, pour que le solde reste juste
    if (accountId) {
      const tid = Store.newId('transactions');
      const owe = d.direction !== 'owed';
      u['transactions/' + tid] = Store.clean({
        id: tid, type: owe ? 'expense' : 'income',
        label: `${owe ? 'Remboursement à' : 'Remboursement de'} ${d.name}`.slice(0, 200),
        amount: U.round2(amount), date, accountId,
        category: owe ? 'Remboursements de dettes' : 'Remboursement',
        debtId: d.id, createdAt: Date.now()
      });
    }
    App.closeDialog('dlgPayment');
    Store.applyUpdates(u).catch(e => App.fail(e));
    App.toast(U.round2(remaining - amount) <= 0 ? 'Remboursement enregistré : c’est soldé 🎉' : 'Remboursement enregistré');
  },

  delPayment(key) {
    const [id, pid] = String(key).split('|');
    if (!confirm('Supprimer ce remboursement ?\nL’opération éventuellement créée sur le compte n’est pas supprimée.')) return;
    Store.applyUpdates({ [`debts/${id}/payments/${pid}`]: null }).catch(e => App.fail(e));
    App.toast('Remboursement supprimé');
  },

  del(id) {
    const d = Store.get('debts', id);
    if (!d || !confirm(`Supprimer « ${d.name} » et son historique de remboursements ?`)) return;
    Store.remove('debts', id).catch(e => App.fail(e));
    App.toast('Supprimé');
  }
};
