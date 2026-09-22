/**
 * Couche de données.
 *
 * Principe : à la connexion, toutes les données de l'utilisateur
 * (users/{uid}) sont chargées en mémoire et tenues à jour en temps réel
 * par un écouteur Firebase. Les lectures sont donc synchrones et
 * instantanées ; seules les écritures passent par le réseau.
 *
 * Structure dans Firebase :
 *   users/{uid}/accounts/{id}
 *   users/{uid}/transactions/{id}
 *   users/{uid}/recurrings/{id}
 *   users/{uid}/goals/{id}
 *   users/{uid}/investments/{id}
 *   users/{uid}/settings
 */
const DEFAULT_CATEGORIES = {
  expense: ['Logement', 'Alimentation', 'Restaurants', 'Transport', 'Santé', 'Loisirs', 'Abonnements',
    'Shopping', 'Famille', 'Éducation', 'Voyage', 'Cadeaux', 'Impôts', 'Frais bancaires', 'Autre'],
  income: ['Salaire', 'Prime', 'Remboursement', 'Aide / Allocation', 'Vente', 'Intérêts', 'Autre revenu']
};

const Store = {
  COLLECTIONS: ['accounts', 'transactions', 'recurrings', 'goals', 'investments'],
  user: null,
  ref: null,
  loaded: false,
  data: null,

  /* ---------- Connexion et synchronisation ---------- */

  init() {
    this.data = this.empty();
    auth.onAuthStateChanged(user => {
      if (user) {
        this.user = user;
        App.showLoading();
        this.attach();
      } else {
        this.detach();
        this.user = null;
        App.showLogin();
      }
    });
  },

  empty() {
    const d = { settings: this.defaultSettings() };
    this.COLLECTIONS.forEach(c => { d[c] = {}; });
    return d;
  },

  defaultSettings() {
    return { monthlyBudget: 1500, categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)) };
  },

  attach() {
    if (this.ref) this.ref.off();
    this.loaded = false;
    this.ref = db.ref('users/' + this.user.uid);
    this.ref.on('value', snap => {
      const v = snap.val() || {};
      const d = this.empty();
      this.COLLECTIONS.forEach(c => {
        d[c] = (v[c] && typeof v[c] === 'object') ? v[c] : {};
      });
      const s = v.settings || {};
      const cats = s.categories || {};
      const budget = Number(s.monthlyBudget);
      d.settings = {
        monthlyBudget: s.monthlyBudget !== undefined && Number.isFinite(budget) ? budget : 1500,
        categories: {
          expense: this.toArray(cats.expense, DEFAULT_CATEGORIES.expense),
          income: this.toArray(cats.income, DEFAULT_CATEGORIES.income)
        }
      };
      this.data = d;

      const first = !this.loaded;
      this.loaded = true;
      App.onData(first);

      // Idempotent : ne crée que les occurrences manquantes
      this.generateRecurring();
      if (first) this.checkMigration();
    }, err => App.onDataError(err));
  },

  detach() {
    if (this.ref) this.ref.off();
    this.ref = null;
    this.loaded = false;
    this.data = this.empty();
  },

  toArray(x, def) {
    const arr = Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : null);
    return arr && arr.length ? arr.filter(Boolean).map(String) : [...def];
  },

  /* ---------- Lecture ---------- */

  list(c) {
    return Object.values(this.data[c] || {});
  },

  get(c, id) {
    return (this.data[c] || {})[id] || null;
  },

  activeAccounts() {
    return this.list('accounts').filter(a => !a.archived).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  },

  sortTx(a, b) {
    return (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
  },

  transactions() {
    return this.list('transactions').sort(this.sortTx);
  },

  monthTransactions(key) {
    return this.transactions().filter(t => (t.date || '').slice(0, 7) === key);
  },

  /**
   * Solde d'un compte = solde de départ + opérations datées
   * entre la date de départ et aujourd'hui (incluses).
   */
  balance(accountId, upTo = U.today()) {
    const a = this.get('accounts', accountId);
    if (!a) return 0;
    let b = Number(a.initialBalance) || 0;
    const from = a.openingDate || '';
    this.list('transactions').forEach(t => {
      if (!t.date || t.date < from || t.date > upTo) return;
      const amt = Number(t.amount) || 0;
      if (t.type === 'income' && t.accountId === accountId) b += amt;
      else if (t.type === 'expense' && t.accountId === accountId) b -= amt;
      else if (t.type === 'transfer') {
        if (t.accountId === accountId) b -= amt;
        if (t.toAccountId === accountId) b += amt;
      }
    });
    return U.round2(b);
  },

  netWorth() {
    const accounts = this.activeAccounts().reduce((s, a) => s + this.balance(a.id), 0);
    const inv = this.list('investments').reduce((s, i) => s + (Number(i.currentValue) || 0), 0);
    return U.round2(accounts + inv);
  },

  // Les virements internes ne sont ni des revenus ni des dépenses
  monthTotals(key) {
    let income = 0, expense = 0;
    this.list('transactions').forEach(t => {
      if ((t.date || '').slice(0, 7) !== key) return;
      if (t.type === 'income') income += Number(t.amount) || 0;
      else if (t.type === 'expense') expense += Number(t.amount) || 0;
    });
    income = U.round2(income);
    expense = U.round2(expense);
    const savings = U.round2(income - expense);
    return { income, expense, savings, rate: income > 0 ? Math.round(savings / income * 100) : null };
  },

  // prefix : "2026-09" pour un mois, "2026" pour une année
  categoryTotals(prefix, type = 'expense') {
    const totals = {};
    this.list('transactions').forEach(t => {
      if (t.type !== type || !(t.date || '').startsWith(prefix)) return;
      const c = t.category || 'Autre';
      totals[c] = (totals[c] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(totals).map(([k, v]) => [k, U.round2(v)]).sort((a, b) => b[1] - a[1]);
  },

  txCountForAccount(id) {
    return this.list('transactions').filter(t => t.accountId === id || t.toAccountId === id).length;
  },

  /* ---------- Écriture ---------- */

  // Supprime null / undefined / NaN (Firebase refuse undefined)
  clean(o) {
    return JSON.parse(JSON.stringify(o, (k, v) =>
      (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) ? undefined : v));
  },

  requireRef() {
    if (!this.ref) throw new Error('Non connecté');
    return this.ref;
  },

  newId(c) {
    return this.requireRef().child(c).push().key;
  },

  save(c, obj) {
    const ref = this.requireRef();
    const o = { ...obj };
    if (!o.id) {
      o.id = this.newId(c);
      o.createdAt = Date.now();
    }
    o.updatedAt = Date.now();
    return ref.child(c + '/' + o.id).set(this.clean(o)).then(() => o);
  },

  remove(c, id) {
    return this.requireRef().child(c + '/' + id).remove();
  },

  saveSettings(s) {
    return this.requireRef().child('settings').set(this.clean(s));
  },

  // Supprimer une occurrence récurrente la marque comme "sautée"
  // pour qu'elle ne soit pas recréée automatiquement.
  deleteTransaction(id) {
    const t = this.get('transactions', id);
    if (!t) return Promise.resolve();
    const u = { ['transactions/' + id]: null };
    if (t.recurringId && this.get('recurrings', t.recurringId)) {
      u[`recurrings/${t.recurringId}/skipped/${t.date.slice(0, 7)}`] = true;
    }
    return this.requireRef().update(u);
  },

  /* ---------- Opérations récurrentes ---------- */

  // Identifiant déterministe : deux appareils ne créent jamais de doublon
  recurringTxId(recId, monthKey) {
    return `rec_${recId}_${monthKey}`;
  },

  occurrenceDate(r, monthKey) {
    const day = Math.min(Number(r.day) || 1, U.daysInMonth(monthKey));
    return `${monthKey}-${String(day).padStart(2, '0')}`;
  },

  generateRecurring() {
    if (!this.ref) return 0;
    const today = U.today();
    const cur = today.slice(0, 7);
    const updates = {};
    let count = 0;

    this.list('recurrings').forEach(r => {
      if (!r.active || !r.startDate || !(Number(r.amount) > 0)) return;
      const skipped = r.skipped || {};
      let key = r.startDate.slice(0, 7);
      let guard = 0;
      while (key <= cur && guard++ < 600) {
        const date = this.occurrenceDate(r, key);
        const id = this.recurringTxId(r.id, key);
        if (date >= r.startDate && date <= today && (!r.endDate || date <= r.endDate)
            && !skipped[key] && !this.data.transactions[id]) {
          updates['transactions/' + id] = this.clean({
            id,
            type: r.type,
            label: r.label,
            amount: Number(r.amount),
            category: r.type === 'transfer' ? null : r.category,
            accountId: r.accountId || null,
            toAccountId: r.type === 'transfer' ? r.toAccountId : null,
            date,
            recurringId: r.id,
            createdAt: Date.now()
          });
          count++;
        }
        key = U.addMonths(key, 1);
      }
    });

    if (count) this.ref.update(updates).catch(e => App.fail(e));
    return count;
  },

  nextOccurrence(r) {
    const today = U.today();
    let key = today.slice(0, 7);
    if (r.startDate && r.startDate.slice(0, 7) > key) key = r.startDate.slice(0, 7);
    for (let i = 0; i < 24; i++) {
      const date = this.occurrenceDate(r, key);
      if (date >= today && date >= (r.startDate || '')) {
        return (!r.endDate || date <= r.endDate) ? date : null;
      }
      key = U.addMonths(key, 1);
    }
    return null;
  },

  /* ---------- Import / export ---------- */

  exportAll() {
    return {
      app: 'mon-pilotage',
      version: 2,
      exportedAt: new Date().toISOString(),
      ...JSON.parse(JSON.stringify(this.data))
    };
  },

  safeKey(k) {
    return String(k).replace(/[.#$\[\]\/]/g, '_');
  },

  // Accepte l'export V2 (objets indexés par id) ou d'anciens formats en tableaux
  importAll(obj) {
    const out = {};
    this.COLLECTIONS.forEach(c => {
      const src = obj[c];
      if (!src || typeof src !== 'object') return;
      const items = Array.isArray(src) ? src : Object.values(src);
      out[c] = {};
      items.forEach(x => {
        if (!x || typeof x !== 'object') return;
        const id = x.id !== undefined ? this.safeKey(x.id) : this.newId(c);
        const item = { ...x, id };
        if (item.accountId !== undefined && item.accountId !== null) item.accountId = this.safeKey(item.accountId);
        if (item.toAccountId !== undefined && item.toAccountId !== null) item.toAccountId = this.safeKey(item.toAccountId);
        if (item.recurringId !== undefined && item.recurringId !== null) item.recurringId = this.safeKey(item.recurringId);
        out[c][id] = item;
      });
    });
    if (obj.settings && typeof obj.settings === 'object') out.settings = obj.settings;
    return this.requireRef().set(this.clean(out));
  },

  wipeAll() {
    return this.requireRef().remove();
  },

  /* ---------- Migration depuis l'ancienne version (localStorage) ---------- */

  checkMigration() {
    try {
      const flag = 'pilotage-migrated-' + this.user.uid;
      if (localStorage.getItem(flag)) return;

      const read = k => {
        try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
      };
      const accs = read('pilotage-accounts') || [];
      const txs = read('pilotage-transactions') || [];
      const invs = read('pilotage-investments') || [];
      const st = read('pilotage-settings');

      if (!accs.length && !txs.length && !invs.length) return;

      const cloudEmpty = !this.list('accounts').length && !this.list('transactions').length;
      localStorage.setItem(flag, '1');
      if (!cloudEmpty) return;

      const ok = confirm(
        `Des données de l'ancienne version ont été trouvées sur cet appareil :\n` +
        `${accs.length} compte(s), ${txs.length} opération(s), ${invs.length} investissement(s).\n\n` +
        `Les importer dans ton espace synchronisé ?`
      );
      if (!ok) return;

      const today = U.today();
      const u = {};
      accs.forEach(a => {
        const id = this.newId('accounts');
        u['accounts/' + id] = this.clean({
          id, name: a.name || 'Compte', bank: a.bank || '', type: a.type || 'checking',
          initialBalance: U.round2(a.balance), openingDate: today, createdAt: Date.now()
        });
      });
      txs.forEach(t => {
        if (!(Number(t.amount) > 0) || !t.date) return;
        const id = this.newId('transactions');
        u['transactions/' + id] = this.clean({
          id, type: t.type === 'income' ? 'income' : 'expense', label: t.label || 'Opération',
          amount: U.round2(t.amount), category: t.category || 'Autre', date: String(t.date).slice(0, 10),
          createdAt: Date.now()
        });
      });
      invs.forEach(i => {
        const id = this.newId('investments');
        u['investments/' + id] = this.clean({
          id, name: i.name || 'Investissement', type: i.type || 'other', amount: U.round2(i.amount),
          currentValue: U.round2(i.currentValue), date: i.date || today, createdAt: Date.now()
        });
      });
      if (st && Number(st.goalAmount) > 0) {
        const id = this.newId('goals');
        u['goals/' + id] = this.clean({
          id, name: st.goalName || 'Objectif', icon: st.goalIcon || '🎯', target: Number(st.goalAmount),
          saved: 0, createdAt: Date.now()
        });
      }
      if (st && Number(st.monthlyBudget) > 0) u['settings/monthlyBudget'] = Number(st.monthlyBudget);

      this.ref.update(u)
        .then(() => App.toast('Anciennes données importées'))
        .catch(e => App.fail(e));
    } catch (e) {
      console.warn('Migration ignorée :', e);
    }
  }
};
