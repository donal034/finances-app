/**
 * Opérations récurrentes, abonnements et échéancier.
 * Chaque occurrence est créée automatiquement le jour venu.
 * Un abonnement est une récurrence marquée comme telle (kind = "subscription").
 */
const Recurring = {
  editingId: null,
  tab: 'upcoming',

  isEnded(r) {
    return !!r.endDate && r.endDate <= U.today();
  },

  render(el) {
    const all = Store.list('recurrings');
    const subs = all.filter(r => r.kind === 'subscription');
    const tabs = [['upcoming', 'Échéancier'], ['all', `Récurrences (${all.length})`], ['subs', `Abonnements (${subs.length})`]];

    el.innerHTML = `
      ${App.header('Automatisation', 'Récurrents',
        `<button class="btn primary" data-act="recurring.openNew">＋ Ajouter</button>`)}
      <div class="tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button role="tab" class="tab ${this.tab === k ? 'active' : ''}" aria-selected="${this.tab === k}" data-act="recurring.setTab" data-id="${k}">${l}</button>`).join('')}
      </div>
      <div id="recContent"></div>`;

    const box = el.querySelector('#recContent');
    if (this.tab === 'upcoming') box.innerHTML = this.renderUpcoming();
    else if (this.tab === 'subs') box.innerHTML = this.renderSubs(subs);
    else box.innerHTML = this.renderAll(all);
  },

  setTab(k) {
    this.tab = k;
    if (App.section === 'recurring') App.render(); else App.go('recurring');
  },

  renderUpcoming() {
    const p = Store.projection(45);
    const pending = Store.pendingVariable();
    if (!Store.list('recurrings').length && !Store.list('debts').length) {
      return `<div class="card onboarding"><h2>Rien de prévu</h2>
        <p class="muted">Ajoute ton salaire, ton loyer et tes abonnements : l'échéancier affichera ce qui arrive et le solde prévu de tes comptes courants.</p>
        <button class="btn primary" data-act="recurring.openNew">Ajouter une récurrence</button></div>`;
    }
    const byDate = {};
    p.events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });

    return `
      <div class="grid">
        <article class="card kpi span-4"><span class="kpi-label">Comptes courants aujourd’hui</span>
          <div class="kpi-value">${U.money(p.start, p.start < 0 ? 'negative' : '')}</div></article>
        <article class="card kpi span-4"><span class="kpi-label">Prévu au ${U.longDate(p.monthEnd)}</span>
          <div class="kpi-value ${p.endOfMonth < 0 ? 'negative' : ''}">${U.money(p.endOfMonth)}</div>
          <span class="muted small">Après les récurrences restantes du mois</span></article>
        <article class="card kpi span-4"><span class="kpi-label">Dans 45 jours</span>
          <div class="kpi-value ${(p.events.length ? p.events[p.events.length - 1].balance : p.start) < 0 ? 'negative' : ''}">${U.money(p.events.length ? p.events[p.events.length - 1].balance : p.start)}</div></article>
      </div>
      ${pending.length ? `<div class="card pending">
        <div class="card-head"><h2>À confirmer</h2><span class="muted small">Montant variable : saisis le montant réel</span></div>
        <div class="list">${pending.map(e => `
          <div class="tx">
            <span class="ico">?</span>
            <div class="tx-main"><strong>${U.esc(e.item.label)}</strong>
              <small>Prévu le ${U.longDate(e.date)} – dernier montant ${U.eur(e.item.amount)}</small></div>
            <div class="row-actions">
              <button class="btn small primary" data-act="transactions.confirmRecurring" data-id="${U.esc(e.item.id + '|' + e.monthKey)}">Saisir</button>
              <button class="btn small" data-act="recurring.skip" data-id="${U.esc(e.item.id + '|' + e.monthKey)}">Ignorer</button>
            </div>
          </div>`).join('')}</div>
      </div>` : ''}
      ${!p.hasCurrent ? '<div class="alert">⚠ Aucun compte de type « Compte courant », « Portefeuille en ligne » ou « Espèces » : le solde prévu ne peut pas être calculé.</div>' : ''}
      <div class="card">
        ${p.events.length ? Object.entries(byDate).map(([date, evs]) => `
          <div class="agenda-day">
            <div class="agenda-date"><strong>${U.weekday(date)}</strong>
              <span class="muted small">Solde prévu : ${U.money(evs[evs.length - 1].balance, evs[evs.length - 1].balance < 0 ? 'negative' : '')}</span></div>
            ${evs.map(e => this.agendaRow(e)).join('')}
          </div>`).join('')
          : '<p class="empty">Aucune échéance dans les 45 prochains jours.</p>'}
      </div>`;
  },

  agendaRow(e) {
    if (e.kind === 'debt') {
      const d = e.item;
      return `<div class="tx"><span class="ico">⚖</span>
        <div class="tx-main"><strong>Échéance : ${U.esc(d.name)}</strong>
          <small>${d.direction === 'owed' ? 'On me doit' : 'Je dois'} ${U.eur(Store.debtRemaining(d))}</small></div>
        <b class="${d.direction === 'owed' ? 'positive' : 'negative'}">${U.money(Store.debtRemaining(d))}</b></div>`;
    }
    const r = e.item;
    const cls = r.type === 'income' ? 'positive' : r.type === 'expense' ? 'negative' : 'transfer';
    const sign = r.type === 'income' ? '+ ' : r.type === 'expense' ? '− ' : '';
    return `<div class="tx"><span class="ico">${r.type === 'transfer' ? '⇆' : U.catIcon(r.category)}</span>
      <div class="tx-main"><strong>${U.esc(r.label)}${r.kind === 'subscription' ? ' <span class="tag">Abonnement</span>' : ''}</strong>
        <small>${U.esc(this.where(r))}${r.variable ? ' – montant variable' : ''}</small></div>
      <b class="${cls}">${sign}${U.money(r.amount)}${r.variable ? ' ?' : ''}</b></div>`;
  },

  renderAll(list) {
    list = list.slice().sort((a, b) => (this.isEnded(a) - this.isEnded(b)) || (Number(a.day) || 0) - (Number(b.day) || 0));
    let monthIn = 0, monthOut = 0;
    list.filter(r => r.active && !this.isEnded(r)).forEach(r => {
      if (r.type === 'income') monthIn += Number(r.amount) || 0;
      if (r.type === 'expense') monthOut += Number(r.amount) || 0;
    });
    return `
      <div class="summary-bar card">
        <span>Chaque mois</span>
        <span>Entrées ${U.money(monthIn, 'positive')} · Charges ${U.money(monthOut, 'negative')} · Reste ${U.money(monthIn - monthOut)}</span>
      </div>
      ${list.length ? `<div class="card"><div class="list">${list.map(r => this.row(r)).join('')}</div></div>`
        : `<div class="card onboarding"><h2>Aucune opération récurrente</h2>
           <p class="muted">Salaire, loyer, Navigo, épargne automatique : elles seront enregistrées toutes seules chaque mois.</p>
           <button class="btn primary" data-act="recurring.openNew">Ajouter une récurrence</button></div>`}`;
  },

  renderSubs(subs) {
    const active = subs.filter(r => r.active && !this.isEnded(r));
    const monthly = U.round2(active.reduce((s, r) => s + (Number(r.amount) || 0), 0));
    const sorted = subs.slice().sort((a, b) => (this.isEnded(a) - this.isEnded(b)) || (Number(b.amount) || 0) - (Number(a.amount) || 0));
    return `
      <div class="grid">
        <article class="card kpi span-4"><span class="kpi-label">Abonnements actifs</span><div class="kpi-value">${active.length}</div></article>
        <article class="card kpi span-4"><span class="kpi-label">Coût mensuel</span><div class="kpi-value negative">${U.money(monthly)}</div></article>
        <article class="card kpi span-4"><span class="kpi-label">Coût annuel</span><div class="kpi-value negative">${U.money(monthly * 12)}</div></article>
      </div>
      ${sorted.length ? `<div class="card"><div class="list">${sorted.map(r => this.row(r)).join('')}</div></div>`
        : `<div class="card onboarding"><h2>Aucun abonnement</h2>
           <p class="muted">Téléphone, box internet, salle de sport, streaming, assurances… Ajoute une récurrence et coche « C’est un abonnement » pour voir leur coût total.</p>
           <button class="btn primary" data-act="recurring.openNewSub">Ajouter un abonnement</button></div>`}`;
  },

  where(r) {
    const acc = Store.get('accounts', r.accountId);
    const to = Store.get('accounts', r.toAccountId);
    return r.type === 'transfer' ? `${acc ? acc.name : '?'} → ${to ? to.name : '?'}`
      : `${r.category || ''}${acc ? ' – ' + acc.name : ''}`;
  },

  statusText(r) {
    if (this.isEnded(r)) return `${r.kind === 'subscription' ? 'Résilié' : 'Terminé'} le ${U.longDate(r.endDate)}`;
    if (!r.active) return 'En pause';
    const next = Store.nextOccurrence(r);
    return next ? `Prochaine : ${U.longDate(next)}` : 'Terminée';
  },

  row(r) {
    const ended = this.isEnded(r);
    const cls = r.type === 'income' ? 'positive' : r.type === 'expense' ? 'negative' : 'transfer';
    const sign = r.type === 'income' ? '+ ' : r.type === 'expense' ? '− ' : '';
    const id = U.esc(r.id);
    return `
      <div class="tx ${r.active && !ended ? '' : 'inactive'}">
        <span class="ico">${r.type === 'transfer' ? '⇆' : U.catIcon(r.category)}</span>
        <div class="tx-main">
          <strong>${U.esc(r.label)}${r.kind === 'subscription' ? ' <span class="tag">Abonnement</span>' : ''}</strong>
          <small>${U.esc(this.where(r))} – le ${Number(r.day)} de chaque mois${r.variable ? ' – montant variable' : ''}</small>
          <small class="note">${this.statusText(r)}</small>
        </div>
        <b class="${cls}">${sign}${U.money(r.amount)}</b>
        <div class="row-actions">
          ${ended ? '' : `<button class="icon-btn" data-act="recurring.toggle" data-id="${id}" aria-label="${r.active ? 'Mettre en pause' : 'Réactiver'}" title="${r.active ? 'Mettre en pause' : 'Réactiver'}">${r.active ? '⏸' : '▶'}</button>`}
          ${r.kind === 'subscription' && !ended ? `<button class="icon-btn" data-act="recurring.cancel" data-id="${id}" aria-label="Résilier" title="Résilier">⛔</button>` : ''}
          <button class="icon-btn" data-act="recurring.edit" data-id="${id}" aria-label="Modifier" title="Modifier">✏️</button>
          <button class="icon-btn" data-act="recurring.del" data-id="${id}" aria-label="Supprimer" title="Supprimer">🗑️</button>
        </div>
      </div>`;
  },

  /* ---------- Formulaire ---------- */

  bindForm() {
    document.getElementById('recType').addEventListener('change', () => this.updateTypeUI());
    document.getElementById('recForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
  },

  openNew(presetSub) {
    this.editingId = null;
    this.fill({ type: 'expense', label: '', amount: '', day: new Date().getDate(), startDate: U.today(), active: true, variable: false,
      kind: presetSub === true ? 'subscription' : 'standard', category: presetSub === true ? 'Abonnements' : undefined });
    document.getElementById('recTitle').textContent = presetSub === true ? 'Nouvel abonnement' : 'Nouvelle récurrence';
    App.openDialog('dlgRecurring');
  },

  openNewSub() {
    this.openNew(true);
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
    document.getElementById('recSub').checked = r.kind === 'subscription';
    document.getElementById('recVariable').checked = !!r.variable;
    document.getElementById('recAccount').innerHTML = App.accountOptions(r.accountId || '', { none: 'Aucun compte' });
    document.getElementById('recToAccount').innerHTML = App.accountOptions(r.toAccountId || '', { none: 'Choisir…' });
    this.updateTypeUI(r.category);
  },

  updateTypeUI(selectedCat) {
    const type = document.getElementById('recType').value;
    const isTransfer = type === 'transfer';
    document.getElementById('fieldRecTo').hidden = !isTransfer;
    document.getElementById('fieldRecCat').hidden = isTransfer;
    document.getElementById('fieldRecSub').hidden = type !== 'expense';
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
    const kind = type === 'expense' && document.getElementById('recSub').checked ? 'subscription' : 'standard';
    const variable = document.getElementById('recVariable').checked;
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
      ...base, type, label, amount: U.round2(amount), day, startDate, endDate, accountId, kind,
      variable: variable || null,
      toAccountId: type === 'transfer' ? toAccountId : null,
      category: type === 'transfer' ? null : document.getElementById('recCategory').value
    };
    App.closeDialog('dlgRecurring');
    Store.save('recurrings', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Récurrence modifiée' : kind === 'subscription' ? 'Abonnement ajouté' : 'Récurrence ajoutée');
  },

  skip(key) {
    const [recId, monthKey] = String(key).split('|');
    Store.skipOccurrence(recId, monthKey).catch(e => App.fail(e));
    App.toast('Occurrence ignorée pour ce mois');
  },

  toggle(id) {
    const r = Store.get('recurrings', id);
    if (!r) return;
    Store.save('recurrings', { ...r, active: !r.active }).catch(e => App.fail(e));
    App.toast(r.active ? 'Récurrence en pause' : 'Récurrence réactivée');
  },

  // Résilier = fixer la date de fin à aujourd'hui (l'historique est conservé)
  cancel(id) {
    const r = Store.get('recurrings', id);
    if (!r || !confirm(`Résilier « ${r.label} » ?\nPlus aucune opération ne sera créée après aujourd’hui.`)) return;
    const today = U.today();
    Store.save('recurrings', { ...r, endDate: today < r.startDate ? r.startDate : today }).catch(e => App.fail(e));
    App.toast('Abonnement résilié');
  },

  del(id) {
    const r = Store.get('recurrings', id);
    if (!r || !confirm(`Supprimer « ${r.label} » ?\nLes opérations déjà créées sont conservées.`)) return;
    Store.remove('recurrings', id).catch(e => App.fail(e));
    App.toast('Récurrence supprimée');
  }
};
