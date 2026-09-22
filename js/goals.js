/**
 * Objectifs d'épargne.
 * Un objectif peut suivre le solde d'un compte (ex. Livret A = fonds d'urgence)
 * ou un montant mis de côté saisi à la main.
 */
const Goals = {
  editingId: null,

  progress(g) {
    const linked = g.accountId && Store.get('accounts', g.accountId);
    const saved = linked ? Math.max(0, Store.balance(g.accountId)) : (Number(g.saved) || 0);
    const target = Number(g.target) || 0;
    const pct = target > 0 ? Math.min(100, saved / target * 100) : 0;
    const remaining = Math.max(0, U.round2(target - saved));
    let monthly = null, monthsLeft = null;
    if (g.deadline && remaining > 0) {
      monthsLeft = Math.max(1, U.monthsBetween(U.today().slice(0, 7), g.deadline.slice(0, 7)));
      monthly = U.round2(remaining / monthsLeft);
    }
    return { saved: U.round2(saved), target, pct, remaining, monthly, monthsLeft, linked: !!linked };
  },

  render(el) {
    const list = Store.list('goals').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    el.innerHTML = `
      ${App.header('Épargne', 'Mes objectifs',
        `<button class="btn primary" data-act="goals.openNew">＋ Nouvel objectif</button>`)}
      ${list.length ? `<div class="cards-grid">${list.map(g => this.card(g)).join('')}</div>`
        : `<div class="card onboarding"><h2>Aucun objectif</h2>
           <p class="muted">Fonds d'urgence, voyage, apport immobilier : fixe un montant et une échéance, l'app calcule l'effort mensuel.</p>
           <button class="btn primary" data-act="goals.openNew">Créer un objectif</button></div>`}`;
  },

  card(g) {
    const p = this.progress(g);
    const acc = Store.get('accounts', g.accountId);
    let hint;
    if (p.remaining <= 0) hint = 'Objectif atteint 🎉';
    else if (p.monthly !== null) hint = `${U.money(p.monthly)} par mois pendant ${p.monthsLeft} mois pour tenir l’échéance`;
    else hint = `Reste ${U.money(p.remaining)}`;
    return `
      <div class="card goal">
        <div class="goal-head">
          <span class="goal-icon">${U.esc(g.icon || '🎯')}</span>
          <div>
            <h3>${U.esc(g.name)}</h3>
            <span class="muted small">${acc ? 'Suit le compte ' + U.esc(acc.name) : 'Montant saisi manuellement'}${g.deadline ? ' – échéance ' + U.longDate(g.deadline) : ''}</span>
          </div>
        </div>
        <div class="goal-amounts">${U.money(p.saved)} <span class="muted">/ ${U.money(p.target)}</span></div>
        <div class="progress big"><i style="width:${p.pct}%"></i></div>
        <p class="small">${hint}</p>
        <div class="card-actions">
          <button class="btn small" data-act="goals.edit" data-id="${U.esc(g.id)}">Modifier</button>
          <button class="btn small danger" data-act="goals.del" data-id="${U.esc(g.id)}">Supprimer</button>
        </div>
      </div>`;
  },

  bindForm() {
    document.getElementById('goalAccount').addEventListener('change', () => this.updateUI());
    document.getElementById('goalForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
  },

  openNew() {
    this.editingId = null;
    this.fill({ name: '', icon: '🎯', target: '', deadline: '', accountId: '', saved: '' });
    document.getElementById('goalTitle').textContent = 'Nouvel objectif';
    App.openDialog('dlgGoal');
  },

  edit(id) {
    const g = Store.get('goals', id);
    if (!g) return;
    this.editingId = id;
    this.fill(g);
    document.getElementById('goalTitle').textContent = 'Modifier l’objectif';
    App.openDialog('dlgGoal');
  },

  fill(g) {
    document.getElementById('goalName').value = g.name || '';
    document.getElementById('goalIcon').value = g.icon || '🎯';
    document.getElementById('goalTarget').value = g.target ? String(g.target).replace('.', ',') : '';
    document.getElementById('goalDeadline').value = g.deadline || '';
    document.getElementById('goalAccount').innerHTML = App.accountOptions(g.accountId || '', { none: 'Aucun (je saisis le montant)' });
    document.getElementById('goalSaved').value = g.saved ? String(g.saved).replace('.', ',') : '';
    this.updateUI();
  },

  updateUI() {
    document.getElementById('fieldGoalSaved').hidden = !!document.getElementById('goalAccount').value;
  },

  submit() {
    const name = document.getElementById('goalName').value.trim();
    const icon = document.getElementById('goalIcon').value.trim() || '🎯';
    const target = U.num(document.getElementById('goalTarget').value);
    const deadline = document.getElementById('goalDeadline').value || null;
    const accountId = document.getElementById('goalAccount').value || null;
    const saved = accountId ? 0 : U.num(document.getElementById('goalSaved').value || '0');

    if (!name) return App.toast('Donne un nom à l’objectif', 'error');
    if (!(target > 0)) return App.toast('Indique un montant cible', 'error');
    if (Number.isNaN(saved) || saved < 0) return App.toast('Montant épargné invalide', 'error');

    const base = this.editingId ? { ...Store.get('goals', this.editingId) } : {};
    const obj = { ...base, name, icon, target: U.round2(target), deadline, accountId, saved: U.round2(saved) };
    App.closeDialog('dlgGoal');
    Store.save('goals', obj).catch(e => App.fail(e));
    App.toast(this.editingId ? 'Objectif modifié' : 'Objectif créé');
  },

  del(id) {
    const g = Store.get('goals', id);
    if (!g || !confirm(`Supprimer l’objectif « ${g.name} » ?`)) return;
    Store.remove('goals', id).catch(e => App.fail(e));
    App.toast('Objectif supprimé');
  }
};
