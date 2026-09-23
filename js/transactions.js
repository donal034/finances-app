/**
 * Opérations : revenus, dépenses et virements entre comptes.
 */
const Transactions = {
  editingId: null,
  forcedId: null,        // confirmation d'une récurrence à montant variable
  forcedRecurringId: null,
  filters: { all: false, type: '', account: '', category: '', q: '', scope: '' },

  render(el) {
    const f = this.filters;
    const cats = [...new Set([...Store.data.settings.categories.expense, ...Store.data.settings.categories.income])];

    el.innerHTML = `
      ${App.header('Suivi', 'Opérations',
        `<button class="btn primary" data-act="transactions.openNew">＋ Opération</button>`)}
      ${f.all ? '' : App.monthNav()}
      <div class="filters">
        <input type="search" id="fQ" placeholder="Rechercher un libellé, une note…" value="${U.esc(f.q)}">
        <select id="fType">
          <option value="">Tous les types</option>
          <option value="expense" ${f.type === 'expense' ? 'selected' : ''}>Dépenses</option>
          <option value="income" ${f.type === 'income' ? 'selected' : ''}>Revenus</option>
          <option value="transfer" ${f.type === 'transfer' ? 'selected' : ''}>Virements</option>
        </select>
        <select id="fAccount"><option value="">Tous les comptes</option>${App.accountOptions(f.account, { all: true })}</select>
        <select id="fCategory"><option value="">Toutes les catégories</option>${cats.map(c => `<option ${c === f.category ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select>
        <select id="fScope">
          <option value="">Tout</option>
          <option value="mine" ${f.scope === 'mine' ? 'selected' : ''}>Mes opérations</option>
          <option value="third" ${f.scope === 'third' ? 'selected' : ''}>Pour un tiers</option>
        </select>
        <label class="check"><input type="checkbox" id="fAll" ${f.all ? 'checked' : ''}> Toutes les périodes</label>
      </div>
      <div class="summary-bar card" id="txSummary"></div>
      <div class="card"><div class="list" id="txList"></div></div>`;

    const on = (id, ev, fn) => el.querySelector(id).addEventListener(ev, fn);
    on('#fQ', 'input', e => { f.q = e.target.value; this.renderList(); });
    on('#fType', 'change', e => { f.type = e.target.value; this.renderList(); });
    on('#fAccount', 'change', e => { f.account = e.target.value; this.renderList(); });
    on('#fCategory', 'change', e => { f.category = e.target.value; this.renderList(); });
    on('#fScope', 'change', e => { f.scope = e.target.value; this.renderList(); });
    on('#fAll', 'change', e => { f.all = e.target.checked; this.render(el); });
    this.renderList();
  },

  filtered() {
    const f = this.filters;
    const q = f.q.trim().toLowerCase();
    return Store.transactions().filter(t => {
      if (!f.all && (t.date || '').slice(0, 7) !== App.month) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.account && t.accountId !== f.account && t.toAccountId !== f.account) return false;
      if (f.category && t.category !== f.category) return false;
      if (f.scope === 'mine' && t.thirdParty) return false;
      if (f.scope === 'third' && !t.thirdParty) return false;
      if (q && !U.norm(`${t.label} ${t.note || ''} ${t.category || ''} ${t.person || ''}`).includes(U.norm(q))) return false;
      return true;
    });
  },

  renderList() {
    const list = this.filtered();
    let inc = 0, exp = 0, third = 0;
    list.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.thirdParty) { third += amt; return; }
      if (t.type === 'income') inc += amt;
      if (t.type === 'expense') exp += amt;
    });
    const sum = document.getElementById('txSummary');
    const box = document.getElementById('txList');
    if (!sum || !box) return;
    sum.innerHTML = `<span>${list.length} opération${list.length > 1 ? 's' : ''}</span>
      <span>Entrées ${U.money(inc, 'positive')} · Sorties ${U.money(exp, 'negative')}${third ? ` · Pour autrui ${U.money(third, 'third')}` : ''}</span>`;
    box.innerHTML = list.length ? list.map(t => this.row(t, true)).join('')
      : '<p class="empty">Aucune opération ne correspond. Ajoute-en une avec le bouton ＋.</p>';
  },

  row(t, actions) {
    const acc = Store.get('accounts', t.accountId);
    const to = Store.get('accounts', t.toAccountId);
    let icon, cls, sign, sub;
    if (t.type === 'transfer') {
      icon = '⇆'; cls = 'transfer'; sign = '';
      sub = `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`;
    } else if (t.thirdParty) {
      icon = '👥';
      cls = 'third';
      sign = t.type === 'income' ? '+ ' : '− ';
      sub = `Pour ${t.person || 'un tiers'}${acc ? ' – ' + acc.name : ''}`;
    } else {
      icon = U.catIcon(t.category);
      cls = t.type === 'income' ? 'positive' : 'negative';
      sign = t.type === 'income' ? '+ ' : '− ';
      sub = `${t.category || 'Sans catégorie'}${acc ? ' – ' + acc.name : ''}`;
    }
    return `
      <div class="tx">
        <span class="ico">${icon}</span>
        <div class="tx-main">
          <strong>${U.esc(t.label)}${t.recurringId ? ' <span class="tag" title="Opération récurrente">↻</span>' : ''}${t.thirdParty ? ' <span class="tag">Tiers</span>' : ''}</strong>
          <small>${U.esc(sub)} – ${U.shortDate(t.date)}</small>
          ${t.note ? `<small class="note">${U.esc(t.note)}</small>` : ''}
        </div>
        <b class="${cls}">${sign}${U.money(t.amount)}</b>
        ${actions ? `<div class="row-actions">
          <button class="icon-btn" data-act="transactions.edit" data-id="${U.esc(t.id)}" aria-label="Modifier">✏️</button>
          <button class="icon-btn" data-act="transactions.del" data-id="${U.esc(t.id)}" aria-label="Supprimer">🗑️</button>
        </div>` : ''}
      </div>`;
  },

  /* ---------- Formulaire ---------- */

  bindForm() {
    document.getElementById('txType').addEventListener('change', () => this.updateTypeUI());
    document.getElementById('txThird').addEventListener('change', () => this.updateTypeUI());
    document.getElementById('txForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    // Règles de catégorisation : proposer une catégorie d'après le libellé
    document.getElementById('txLabel').addEventListener('input', e => {
      if (document.getElementById('txType').value === 'transfer' || document.getElementById('txThird').checked) return;
      const c = Store.categoryForLabel(e.target.value);
      const sel = document.getElementById('txCategory');
      if (c && [...sel.options].some(o => o.value === c)) sel.value = c;
    });
  },

  lastAccount() {
    try { return localStorage.getItem('pilotage-last-account') || ''; } catch (e) { return ''; }
  },

  openNew() {
    if (!Store.activeAccounts().length && !confirm("Tu n'as pas encore de compte. Enregistrer l'opération sans compte ?")) {
      return Accounts.openNew();
    }
    this.editingId = null;
    this.forcedId = null;
    this.forcedRecurringId = null;
    const last = this.lastAccount();
    this.fill({
      type: 'expense', label: '', amount: '', date: U.today(),
      accountId: Store.get('accounts', last) ? last : '', toAccountId: '', category: '', note: ''
    });
    document.getElementById('txTitle').textContent = 'Nouvelle opération';
    App.openDialog('dlgTx');
    setTimeout(() => document.getElementById('txAmount').focus(), 60);
  },

  // Confirmation d'une occurrence à montant variable (salaire d'intérim, CAF…)
  confirmRecurring(key) {
    const [recId, monthKey] = String(key).split('|');
    const r = Store.get('recurrings', recId);
    if (!r) return;
    this.editingId = null;
    this.forcedId = Store.recurringTxId(recId, monthKey);
    this.forcedRecurringId = recId;
    this.fill({
      type: r.type, label: r.label, amount: r.amount, date: Store.occurrenceDate(r, monthKey),
      accountId: r.accountId || '', toAccountId: r.toAccountId || '', category: r.category, note: ''
    });
    document.getElementById('txTitle').textContent = `Confirmer : ${r.label}`;
    App.openDialog('dlgTx');
    setTimeout(() => document.getElementById('txAmount').select(), 60);
  },

  edit(id) {
    const t = Store.get('transactions', id);
    if (!t) return;
    this.editingId = id;
    this.forcedId = null;
    this.forcedRecurringId = null;
    this.fill(t);
    document.getElementById('txTitle').textContent = 'Modifier l’opération';
    App.openDialog('dlgTx');
  },

  fill(t) {
    document.getElementById('txType').value = t.type || 'expense';
    document.getElementById('txLabel').value = t.label || '';
    document.getElementById('txAmount').value = t.amount !== '' && t.amount !== undefined ? String(t.amount).replace('.', ',') : '';
    document.getElementById('txDate').value = t.date || U.today();
    document.getElementById('txAccount').innerHTML = App.accountOptions(t.accountId || '', { none: 'Aucun compte' });
    document.getElementById('txToAccount').innerHTML = App.accountOptions(t.toAccountId || '', { none: 'Choisir…' });
    document.getElementById('txNote').value = t.note || '';
    document.getElementById('txThird').checked = !!t.thirdParty;
    document.getElementById('txPerson').value = t.person || '';
    document.getElementById('personsList').innerHTML =
      Store.knownPersons().map(p => `<option value="${U.esc(p)}"></option>`).join('');
    this.updateTypeUI(t.category);
  },

  updateTypeUI(selectedCat) {
    const type = document.getElementById('txType').value;
    const isTransfer = type === 'transfer';
    const isThird = document.getElementById('txThird').checked && !isTransfer;
    document.getElementById('fieldToAccount').hidden = !isTransfer;
    document.getElementById('fieldThird').hidden = isTransfer;
    document.getElementById('fieldPerson').hidden = !isThird;
    document.getElementById('fieldCategory').hidden = isTransfer || isThird;
    document.getElementById('lblTxAccount').textContent = isTransfer ? 'Depuis le compte' : 'Compte';
    document.getElementById('txLabel').placeholder = isTransfer ? 'Ex. Épargne mensuelle' : 'Ex. Courses Carrefour';
    if (!isTransfer) {
      const cur = selectedCat !== undefined ? selectedCat : document.getElementById('txCategory').value;
      document.getElementById('txCategory').innerHTML = App.categoryOptions(type, cur);
    }
  },

  submit() {
    const type = document.getElementById('txType').value;
    const amount = U.num(document.getElementById('txAmount').value);
    const date = document.getElementById('txDate').value;
    const accountId = document.getElementById('txAccount').value || null;
    const toAccountId = document.getElementById('txToAccount').value || null;
    const category = document.getElementById('txCategory').value;
    const note = document.getElementById('txNote').value.trim();
    const thirdParty = type !== 'transfer' && document.getElementById('txThird').checked;
    const person = document.getElementById('txPerson').value.trim();
    let label = document.getElementById('txLabel').value.trim();

    if (!(amount > 0)) return App.toast('Indique un montant supérieur à 0', 'error');
    if (!date) return App.toast('Choisis une date', 'error');
    if (type === 'transfer') {
      if (!accountId || !toAccountId) return App.toast('Choisis le compte de départ et le compte d’arrivée', 'error');
      if (accountId === toAccountId) return App.toast('Les deux comptes doivent être différents', 'error');
      if (!label) label = 'Virement';
    } else if (!label) {
      return App.toast('Ajoute un libellé', 'error');
    }
    if (thirdParty && !person) return App.toast('Indique pour qui tu encaisses ou avances cet argent', 'error');

    const base = this.editingId ? { ...Store.get('transactions', this.editingId) } : {};
    const obj = {
      ...base, type, label, amount: U.round2(amount), date, accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      category: (type === 'transfer' || thirdParty) ? null : category,
      note: note || null,
      thirdParty: thirdParty || null,
      person: thirdParty ? person : null
    };
    if (this.forcedId) {
      obj.id = this.forcedId;
      obj.recurringId = this.forcedRecurringId;
      obj.createdAt = obj.createdAt || Date.now();
      // la prochaine proposition partira du dernier montant confirmé
      const r = Store.get('recurrings', this.forcedRecurringId);
      if (r && Number(r.amount) !== U.round2(amount)) {
        Store.save('recurrings', { ...r, amount: U.round2(amount) }).catch(e => App.fail(e));
      }
    }

    try { if (accountId) localStorage.setItem('pilotage-last-account', accountId); } catch (e) { /* ignoré */ }
    const wasForced = !!this.forcedId;
    this.forcedId = null;
    this.forcedRecurringId = null;
    App.closeDialog('dlgTx');
    Store.save('transactions', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Opération modifiée' : wasForced ? 'Occurrence confirmée' : 'Opération enregistrée');
  },

  del(id) {
    const t = Store.get('transactions', id);
    if (!t || !confirm(`Supprimer « ${t.label} » (${U.eur(t.amount)}) ?`)) return;
    Store.deleteTransaction(id).catch(e => App.fail(e));
    App.toast('Opération supprimée');
  }
};
