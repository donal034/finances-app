/**
 * Comptes bancaires.
 * Le solde n'est pas saisi à la main : il est calculé à partir du solde
 * de départ et des opérations. "Corriger le solde" aligne le calcul
 * sur le solde réel affiché par la banque.
 */
const ACCOUNT_TYPES = {
  checking: 'Compte courant', livretA: 'Livret A', lep: 'LEP', ldds: 'LDDS',
  savings: 'Autre livret / épargne', pea: 'PEA', cto: 'Compte-titres', av: 'Assurance-vie',
  per: 'PER', crypto: 'Crypto', wallet: 'Portefeuille en ligne', cash: 'Espèces', other: 'Autre'
};

const Accounts = {
  showArchived: false,
  editingId: null,
  reconcileId: null,

  render(el) {
    const all = Store.list('accounts').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const visible = all.filter(a => this.showArchived || !a.archived);
    const archivedCount = all.filter(a => a.archived).length;
    const total = Store.activeAccounts().reduce((s, a) => s + Store.balance(a.id), 0);

    el.innerHTML = `
      ${App.header('Comptes', 'Mes comptes',
        `<button class="btn primary" data-act="accounts.openNew">＋ Ajouter un compte</button>`)}
      <div class="summary-bar card">
        <span>Total des comptes actifs</span>
        <strong>${U.money(total, total < 0 ? 'negative' : '')}</strong>
      </div>
      ${archivedCount ? `<label class="check"><input type="checkbox" id="accShowArchived" ${this.showArchived ? 'checked' : ''}> Afficher les comptes archivés (${archivedCount})</label>` : ''}
      ${visible.length ? `<div class="cards-grid">${visible.map(a => this.card(a)).join('')}</div>`
        : `<div class="card onboarding"><h2>Aucun compte</h2><p class="muted">Ajoute ton premier compte avec son solde actuel.</p>
           <button class="btn primary" data-act="accounts.openNew">Ajouter un compte</button></div>`}`;

    const cb = el.querySelector('#accShowArchived');
    if (cb) cb.addEventListener('change', () => { this.showArchived = cb.checked; this.render(el); });
  },

  card(a) {
    const b = Store.balance(a.id);
    const n = Store.txCountForAccount(a.id);
    return `
      <div class="card account ${a.archived ? 'archived' : ''}">
        <div class="account-top">
          <div>
            <h3>${U.esc(a.name)}</h3>
            <span class="muted small">${U.esc(a.bank || '')}${a.bank ? ' – ' : ''}${U.esc(ACCOUNT_TYPES[a.type] || a.type || '')}</span>
          </div>
          ${a.archived ? '<span class="tag">Archivé</span>' : ''}
        </div>
        <div class="account-balance ${b < 0 ? 'negative' : ''}">${U.money(b)}</div>
        <small class="muted">Suivi depuis le ${U.longDate(a.openingDate)} – ${n} opération${n > 1 ? 's' : ''}</small>
        <div class="card-actions">
          <button class="btn small" data-act="accounts.reconcile" data-id="${U.esc(a.id)}">Corriger le solde</button>
          <button class="btn small" data-act="accounts.edit" data-id="${U.esc(a.id)}">Modifier</button>
          <button class="btn small" data-act="accounts.toggleArchive" data-id="${U.esc(a.id)}">${a.archived ? 'Réactiver' : 'Archiver'}</button>
          <button class="btn small danger" data-act="accounts.del" data-id="${U.esc(a.id)}">Supprimer</button>
        </div>
      </div>`;
  },

  bindForm() {
    const f = document.getElementById('accountForm');
    document.getElementById('accType').innerHTML =
      Object.entries(ACCOUNT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    f.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    document.getElementById('reconcileForm').addEventListener('submit', e => { e.preventDefault(); this.submitReconcile(); });
  },

  openNew() {
    this.editingId = null;
    document.getElementById('accountTitle').textContent = 'Nouveau compte';
    document.getElementById('accountForm').reset();
    document.getElementById('accOpening').value = U.today();
    document.getElementById('accInitial').value = '';
    App.openDialog('dlgAccount');
  },

  edit(id) {
    const a = Store.get('accounts', id);
    if (!a) return;
    this.editingId = id;
    document.getElementById('accountTitle').textContent = 'Modifier le compte';
    document.getElementById('accName').value = a.name || '';
    document.getElementById('accBank').value = a.bank || '';
    document.getElementById('accType').value = a.type || 'checking';
    document.getElementById('accInitial').value = String(a.initialBalance ?? 0).replace('.', ',');
    document.getElementById('accOpening').value = a.openingDate || U.today();
    App.openDialog('dlgAccount');
  },

  submit() {
    const name = document.getElementById('accName').value.trim();
    const bank = document.getElementById('accBank').value.trim();
    const type = document.getElementById('accType').value;
    const initial = U.num(document.getElementById('accInitial').value || '0');
    const openingDate = document.getElementById('accOpening').value;

    if (!name) return App.toast('Donne un nom au compte', 'error');
    if (Number.isNaN(initial)) return App.toast('Solde invalide', 'error');
    if (!openingDate) return App.toast('Choisis une date', 'error');

    const base = this.editingId ? { ...Store.get('accounts', this.editingId) } : { archived: false };
    const obj = { ...base, name, bank, type, initialBalance: U.round2(initial), openingDate };
    App.closeDialog('dlgAccount');
    Store.save('accounts', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Compte modifié' : 'Compte ajouté');
  },

  reconcile(id) {
    const a = Store.get('accounts', id);
    if (!a) return;
    this.reconcileId = id;
    document.getElementById('recoInfo').innerHTML =
      `Solde calculé de <strong>${U.esc(a.name)}</strong> : ${U.money(Store.balance(id))}`;
    document.getElementById('recoReal').value = '';
    App.openDialog('dlgReconcile');
  },

  submitReconcile() {
    const a = Store.get('accounts', this.reconcileId);
    const real = U.num(document.getElementById('recoReal').value);
    if (!a) return;
    if (Number.isNaN(real)) return App.toast('Montant invalide', 'error');
    const diff = U.round2(real - Store.balance(a.id));
    App.closeDialog('dlgReconcile');
    if (diff === 0) return App.toast('Le solde est déjà juste');
    Store.save('accounts', { ...a, initialBalance: U.round2((Number(a.initialBalance) || 0) + diff) })
      .catch(e => App.fail(e));
    App.toast(`Solde corrigé (écart de ${U.eur(diff)})`);
  },

  toggleArchive(id) {
    const a = Store.get('accounts', id);
    if (!a) return;
    Store.save('accounts', { ...a, archived: !a.archived }).catch(e => App.fail(e));
    App.toast(a.archived ? 'Compte réactivé' : 'Compte archivé');
  },

  del(id) {
    const a = Store.get('accounts', id);
    if (!a) return;
    const n = Store.txCountForAccount(id);
    if (n > 0) {
      return alert(`Ce compte a ${n} opération(s). Supprime-les d'abord, ou archive le compte pour le masquer en gardant l'historique.`);
    }
    if (!confirm(`Supprimer le compte « ${a.name} » ?`)) return;
    Store.remove('accounts', id).catch(e => App.fail(e));
    App.toast('Compte supprimé');
  }
};
