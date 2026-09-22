/**
 * Investissements : montant investi, valeur actuelle, plus-value et répartition.
 * La valeur actuelle se met à jour à la main (V1).
 */
const INVESTMENT_TYPES = {
  etf: 'ETF / Fonds', stock: 'Actions', crypto: 'Crypto', av: 'Assurance-vie',
  per: 'PER', scpi: 'SCPI / Immobilier', bond: 'Obligations', other: 'Autre'
};

const Investments = {
  editingId: null,

  render(el) {
    const list = Store.list('investments').sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0));
    const invested = list.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const value = list.reduce((s, i) => s + (Number(i.currentValue) || 0), 0);
    const gain = U.round2(value - invested);
    const gainPct = invested > 0 ? (gain / invested * 100).toFixed(1) : '0.0';

    const byType = {};
    list.forEach(i => { byType[i.type] = (byType[i.type] || 0) + (Number(i.currentValue) || 0); });
    const alloc = Object.entries(byType).sort((a, b) => b[1] - a[1]);

    el.innerHTML = `
      ${App.header('Portefeuille', 'Investissements',
        `<button class="btn primary" data-act="investments.openNew">＋ Ajouter</button>`)}
      ${list.length ? `
        <div class="grid">
          <article class="card kpi span-4"><span class="kpi-label">Valeur actuelle</span><div class="kpi-value">${U.money(value)}</div></article>
          <article class="card kpi span-4"><span class="kpi-label">Montant investi</span><div class="kpi-value">${U.money(invested)}</div></article>
          <article class="card kpi span-4"><span class="kpi-label">Plus / moins-value</span>
            <div class="kpi-value ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${U.money(gain)}</div>
            <span class="muted small">${gain >= 0 ? '+' : ''}${gainPct.replace('.', ',')} %</span></article>
        </div>
        <div class="card">
          <div class="card-head"><h2>Répartition</h2></div>
          <div class="bars">${alloc.map(([k, v]) => `
            <div class="bar-row"><span>${U.esc(INVESTMENT_TYPES[k] || k)}</span>
              <div class="bar"><i style="width:${value > 0 ? v / value * 100 : 0}%"></i></div>
              <span>${value > 0 ? Math.round(v / value * 100) : 0} %</span></div>`).join('')}</div>
        </div>
        <div class="cards-grid">${list.map(i => this.card(i)).join('')}</div>`
      : `<div class="card onboarding"><h2>Aucun investissement</h2>
          <p class="muted">Ajoute tes ETF, actions, crypto ou ton assurance-vie pour suivre leur performance.</p>
          <button class="btn primary" data-act="investments.openNew">Ajouter un investissement</button></div>`}`;
  },

  card(i) {
    const amount = Number(i.amount) || 0;
    const value = Number(i.currentValue) || 0;
    const gain = U.round2(value - amount);
    const pct = amount > 0 ? (gain / amount * 100).toFixed(1).replace('.', ',') : '0';
    return `
      <div class="card investment">
        <span class="muted small">${U.esc(INVESTMENT_TYPES[i.type] || i.type)}</span>
        <h3>${U.esc(i.name)}</h3>
        <div class="inv-stats">
          <div><span class="muted small">Investi</span>${U.money(amount)}</div>
          <div><span class="muted small">Valeur</span>${U.money(value)}</div>
        </div>
        <div class="inv-gain ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${U.money(gain)} (${gain >= 0 ? '+' : ''}${pct} %)</div>
        <small class="muted">Depuis le ${U.longDate(i.date)}</small>
        <div class="card-actions">
          <button class="btn small" data-act="investments.edit" data-id="${U.esc(i.id)}">Mettre à jour</button>
          <button class="btn small danger" data-act="investments.del" data-id="${U.esc(i.id)}">Supprimer</button>
        </div>
      </div>`;
  },

  bindForm() {
    document.getElementById('invType').innerHTML =
      Object.entries(INVESTMENT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    document.getElementById('invForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
  },

  openNew() {
    this.editingId = null;
    this.fill({ name: '', type: 'etf', amount: '', currentValue: '', date: U.today() });
    document.getElementById('invTitle').textContent = 'Nouvel investissement';
    App.openDialog('dlgInvestment');
  },

  edit(id) {
    const i = Store.get('investments', id);
    if (!i) return;
    this.editingId = id;
    this.fill(i);
    document.getElementById('invTitle').textContent = 'Mettre à jour l’investissement';
    App.openDialog('dlgInvestment');
  },

  fill(i) {
    const f = v => (v === '' || v === undefined ? '' : String(v).replace('.', ','));
    document.getElementById('invName').value = i.name || '';
    document.getElementById('invType').value = i.type || 'etf';
    document.getElementById('invAmount').value = f(i.amount);
    document.getElementById('invValue').value = f(i.currentValue);
    document.getElementById('invDate').value = i.date || U.today();
  },

  submit() {
    const name = document.getElementById('invName').value.trim();
    const type = document.getElementById('invType').value;
    const amount = U.num(document.getElementById('invAmount').value);
    const currentValue = U.num(document.getElementById('invValue').value);
    const date = document.getElementById('invDate').value;

    if (!name) return App.toast('Donne un nom', 'error');
    if (!(amount > 0)) return App.toast('Montant investi invalide', 'error');
    if (Number.isNaN(currentValue) || currentValue < 0) return App.toast('Valeur actuelle invalide', 'error');
    if (!date) return App.toast('Choisis une date', 'error');

    const base = this.editingId ? { ...Store.get('investments', this.editingId) } : {};
    const obj = { ...base, name, type, amount: U.round2(amount), currentValue: U.round2(currentValue), date };
    App.closeDialog('dlgInvestment');
    Store.save('investments', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Investissement mis à jour' : 'Investissement ajouté');
  },

  del(id) {
    const i = Store.get('investments', id);
    if (!i || !confirm(`Supprimer « ${i.name} » ?`)) return;
    Store.remove('investments', id).catch(e => App.fail(e));
    App.toast('Investissement supprimé');
  }
};
