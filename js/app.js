/**
 * Contrôleur principal : écrans (connexion / chargement / app),
 * navigation, connexion Google, dialogues et notifications.
 * Chargé en dernier : tous les modules de vue existent déjà.
 */
const NAV = [
  ['dashboard', '⌂', 'Tableau de bord', 'Accueil'],
  ['transactions', '⇄', 'Opérations', 'Opérations'],
  ['accounts', '🏦', 'Comptes', 'Comptes'],
  ['recurring', '↻', 'Récurrents', 'Récurrents'],
  ['goals', '🎯', 'Objectifs', 'Objectifs'],
  ['investments', '📈', 'Investissements', 'Invest.'],
  ['reports', '📊', 'Rapports', 'Rapports'],
  ['settings', '⚙', 'Paramètres', 'Réglages']
];

const App = {
  section: 'dashboard',
  month: U.today().slice(0, 7),
  views: null,
  toastTimer: null,

  init() {
    this.views = {
      dashboard: Dashboard, transactions: Transactions, accounts: Accounts, recurring: Recurring,
      goals: Goals, investments: Investments, reports: Reports, settings: Settings
    };

    document.getElementById('sideNav').innerHTML = NAV.map(([k, i, label]) =>
      `<button class="nav-btn" data-nav="${k}"><span class="icon" aria-hidden="true">${i}</span><span>${label}</span></button>`).join('');
    document.getElementById('mobileNav').innerHTML = NAV.map(([k, i, , short]) =>
      `<button class="mnav-btn" data-nav="${k}"><b aria-hidden="true">${i}</b><span>${short}</span></button>`).join('');

    document.addEventListener('click', e => this.onClick(e));
    document.getElementById('btnLogin').addEventListener('click', () => this.signIn());

    document.querySelectorAll('dialog').forEach(d => {
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
    });

    [Transactions, Accounts, Recurring, Goals, Investments].forEach(m => m.bindForm());

    try { if (localStorage.getItem('pilotage-privacy') === '1') document.body.classList.add('privacy'); } catch (e) { /* ignoré */ }

    // Retour d'une connexion par redirection (téléphones qui bloquent les pop-ups)
    auth.getRedirectResult().catch(e => this.showLoginError(e));

    Store.init();
  },

  /* ---------- Écrans ---------- */

  show(id) {
    ['loginScreen', 'loadingScreen', 'app'].forEach(x => { document.getElementById(x).hidden = x !== id; });
    const inApp = id === 'app';
    document.getElementById('mobileNav').hidden = !inApp;
    document.getElementById('fab').hidden = !inApp;
  },

  showLogin() {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    this.show('loginScreen');
  },

  showLoading() {
    document.getElementById('loadingMsg').textContent = 'Chargement de tes données…';
    document.getElementById('loadingActions').hidden = true;
    this.show('loadingScreen');
  },

  onData(first) {
    if (first) this.show('app');
    this.renderUser();
    this.render();
  },

  onDataError(err) {
    console.error(err);
    const denied = String(err && (err.code || err.message)).toLowerCase().includes('permission');
    document.getElementById('loadingMsg').textContent = denied
      ? 'Accès refusé par la base de données. Vérifie que les règles de sécurité sont publiées (voir README, étape 3).'
      : `Impossible de charger les données : ${err.message || err}`;
    document.getElementById('loadingActions').hidden = false;
    this.show('loadingScreen');
  },

  renderUser() {
    const u = Store.user;
    document.getElementById('userInfo').textContent = u ? (u.displayName || u.email || '') : '';
  },

  firstName() {
    const u = Store.user;
    return u && u.displayName ? u.displayName.split(' ')[0] : '';
  },

  /* ---------- Navigation et rendu ---------- */

  render() {
    const el = document.getElementById('sec-' + this.section);
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s === el));
    document.querySelectorAll('[data-nav]').forEach(b => {
      if (b.classList.contains('nav-btn') || b.classList.contains('mnav-btn')) {
        b.classList.toggle('active', b.dataset.nav === this.section);
      }
    });
    const view = this.views[this.section];
    if (view && el) view.render(el);
  },

  go(section) {
    if (!this.views[section]) return;
    this.section = section;
    this.render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignoré */ }
  },

  onClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav) return this.go(nav.dataset.nav);

    const cmd = e.target.closest('[data-cmd]');
    if (cmd) return this.cmd(cmd.dataset.cmd);

    const act = e.target.closest('[data-act]');
    if (act) {
      const [view, fn] = act.dataset.act.split('.');
      const mod = this.views[view];
      if (mod && typeof mod[fn] === 'function') mod[fn](act.dataset.id, act);
    }
  },

  cmd(name) {
    switch (name) {
      case 'prevMonth': this.month = U.addMonths(this.month, -1); this.render(); break;
      case 'nextMonth': this.month = U.addMonths(this.month, 1); this.render(); break;
      case 'thisMonth': this.month = U.today().slice(0, 7); this.render(); break;
      case 'quickAdd': Transactions.openNew(); break;
      case 'privacy': {
        const on = document.body.classList.toggle('privacy');
        try { localStorage.setItem('pilotage-privacy', on ? '1' : '0'); } catch (e) { /* ignoré */ }
        this.toast(on ? 'Mode discret activé' : 'Mode discret désactivé');
        break;
      }
      case 'logout':
        if (confirm('Se déconnecter ?')) auth.signOut();
        break;
    }
  },

  header(eyebrow, title, actions = '') {
    return `<header class="top">
      <div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </header>`;
  },

  monthNav() {
    const isCurrent = this.month === U.today().slice(0, 7);
    return `<div class="month-nav">
      <button class="round" data-cmd="prevMonth" aria-label="Mois précédent">‹</button>
      <strong>${U.monthLabel(this.month)}</strong>
      <button class="round" data-cmd="nextMonth" aria-label="Mois suivant">›</button>
      ${isCurrent ? '' : '<button class="link" data-cmd="thisMonth">Revenir au mois en cours</button>'}
    </div>`;
  },

  accountOptions(selected, { none = null, all = false } = {}) {
    const accs = Store.list('accounts')
      .filter(a => all || !a.archived || a.id === selected)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return (none !== null ? `<option value="">${U.esc(none)}</option>` : '') +
      accs.map(a => `<option value="${U.esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${U.esc(a.name)}${a.archived ? ' (archivé)' : ''}</option>`).join('');
  },

  categoryOptions(type, selected) {
    const list = [...(Store.data.settings.categories[type] || [])];
    if (selected && !list.includes(selected)) list.push(selected);
    return list.map(c => `<option value="${U.esc(c)}" ${c === selected ? 'selected' : ''}>${U.esc(c)}</option>`).join('');
  },

  /* ---------- Dialogues et notifications ---------- */

  openDialog(id) {
    const d = document.getElementById(id);
    if (d && !d.open) d.showModal();
  },

  closeDialog(id) {
    const d = document.getElementById(id);
    if (d && d.open) d.close();
  },

  toast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = 'toast'; }, type === 'error' ? 4000 : 2200);
  },

  fail(err) {
    console.error(err);
    const msg = String(err && (err.code || err.message) || err);
    this.toast(msg.toLowerCase().includes('permission')
      ? 'Écriture refusée par la base : vérifie les règles de sécurité'
      : 'Erreur : ' + (err.message || msg), 'error');
  },

  /* ---------- Connexion Google ---------- */

  async signIn() {
    document.getElementById('loginError').hidden = true;
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        try { await auth.signInWithRedirect(provider); } catch (e2) { this.showLoginError(e2); }
      } else {
        this.showLoginError(e);
      }
    }
  },

  showLoginError(e) {
    if (!e) return;
    const messages = {
      'auth/unauthorized-domain': `Ce site n'est pas autorisé. Dans Firebase : Authentication → Paramètres → Domaines autorisés → ajoute « ${location.hostname} ».`,
      'auth/operation-not-allowed': 'La connexion Google n’est pas activée. Dans Firebase : Authentication → Méthode de connexion → Google → Activer.',
      'auth/configuration-not-found': 'Authentication n’est pas encore activé dans Firebase. Ouvre Authentication et clique sur « Commencer ».',
      'auth/popup-closed-by-user': 'Connexion annulée.',
      'auth/cancelled-popup-request': 'Connexion annulée.',
      'auth/network-request-failed': 'Pas de connexion internet.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Clé API invalide : recopie la configuration Firebase dans js/firebase-config.js.',
      'auth/invalid-api-key': 'Clé API invalide : recopie la configuration Firebase dans js/firebase-config.js.'
    };
    const el = document.getElementById('loginError');
    el.textContent = messages[e.code] || `Connexion impossible (${e.code || e.message}).`;
    el.hidden = false;
    console.error(e);
  }
};

App.init();
