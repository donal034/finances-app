const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ✔', msg); } else { failures++; console.log('  ✘', msg); } };

/* ---------- Évaluateur des règles .validate de database.rules.json ---------- */
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8')).rules;

function wrap(v) {
  return {
    val: () => v,
    isString: () => typeof v === 'string',
    isNumber: () => typeof v === 'number',
    isBoolean: () => typeof v === 'boolean',
    hasChildren: ks => v !== null && typeof v === 'object' && ks.every(k => v[k] !== undefined && v[k] !== null),
    child: k => wrap(v && typeof v === 'object' && v[k] !== undefined ? v[k] : null)
  };
}

function evalExpr(expr, vars, value) {
  const js = expr.replace(/\.matches\(/g, '.match(');
  const names = Object.keys(vars);
  return !!new Function(...names, 'newData', `return (${js});`)(...names.map(n => vars[n]), wrap(value));
}

function validateNode(rule, value, vars, p, errors) {
  if (value === null || value === undefined) return;
  if (rule && rule['.validate'] !== undefined) {
    const v = rule['.validate'];
    if (!(typeof v === 'boolean' ? v : evalExpr(v, vars, value))) errors.push(p);
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      let child = rule ? rule[k] : undefined;
      const nv = { ...vars };
      if (child === undefined && rule) {
        const w = Object.keys(rule).find(x => x.startsWith('$'));
        if (w) { child = rule[w]; nv[w] = k; }
      }
      if (child !== undefined) validateNode(child, value[k], nv, p + '/' + k, errors);
    }
  }
}

/* ---------- Faux Firebase : arbre en mémoire + règles users/{uid} ---------- */
function makeFirebase(state) {
  const listeners = (state.listeners = state.listeners || []);
  let counter = 0;
  const parts = p => p.split('/').filter(Boolean);
  const getAt = p => { let n = state.tree; for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
  const prune = n => { if (n && typeof n === 'object') for (const k of Object.keys(n)) { prune(n[k]); if (n[k] && typeof n[k] === 'object' && !Object.keys(n[k]).length) delete n[k]; } };
  const setAt = (p, v) => {
    const ps = parts(p); let n = state.tree;
    for (let i = 0; i < ps.length - 1; i++) { if (!n[ps[i]] || typeof n[ps[i]] !== 'object') n[ps[i]] = {}; n = n[ps[i]]; }
    const last = ps[ps.length - 1];
    if (v === null || v === undefined) delete n[last];
    else {
      const json = JSON.stringify(v, (k, x) => { if (x === undefined) throw new Error('undefined value (Firebase refuserait)'); return x; });
      n[last] = JSON.parse(json);
    }
    prune(state.tree);
  };
  const allowed = p => { const ps = parts(p); return state.user && ps[0] === 'users' && ps[1] === state.user.uid; };
  const deny = () => Promise.reject(Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' }));
  // Applique l'écriture sur une copie, valide l'espace de l'utilisateur, puis valide ou annule
  const commit = apply => {
    const backup = JSON.stringify(state.tree);
    apply();
    const uid = state.user.uid;
    const errors = [];
    validateNode(RULES.users.$uid, (state.tree.users || {})[uid], { $uid: uid }, 'users/' + uid, errors);
    if (errors.length) {
      state.tree = JSON.parse(backup);
      state.rejected.push(errors);
      return deny();
    }
    state.writes++; fire(); return Promise.resolve();
  };
  const snap = p => ({ val: () => { const v = getAt(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } });
  const fire = () => listeners.slice().forEach(l => l.cb(snap(l.path)));

  function ref(p = '') {
    return {
      path: p,
      child: c => ref(p + '/' + c),
      push: () => { const key = '-N' + String(++counter).padStart(6, '0'); return { key }; },
      set: v => allowed(p) ? commit(() => setAt(p, v)) : deny(),
      update: o => allowed(p) ? commit(() => { for (const [k, v] of Object.entries(o)) setAt(p + '/' + k, v); }) : deny(),
      remove: () => allowed(p) ? commit(() => setAt(p, null)) : deny(),
      on: (ev, cb, err) => { if (!allowed(p)) { setTimeout(() => err && err(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' })), 0); return; } listeners.push({ path: p, cb }); cb(snap(p)); },
      off: () => { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].path === p) listeners.splice(i, 1); }
    };
  }

  const authCbs = [];
  const authObj = {
    get currentUser() { return state.user; },
    onAuthStateChanged(cb) { authCbs.push(cb); setTimeout(() => cb(state.user), 0); },
    signInWithPopup() { state.user = { uid: state.nextUid, email: 'donal@example.com', displayName: 'Donal Ngahan' }; authCbs.forEach(c => c(state.user)); return Promise.resolve(); },
    signInWithRedirect() { return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve(null); },
    signOut() { state.user = null; authCbs.forEach(c => c(null)); return Promise.resolve(); }
  };
  function GoogleAuthProvider() { this.setCustomParameters = () => {}; }
  const authFn = () => authObj; authFn.GoogleAuthProvider = GoogleAuthProvider;
  return { initializeApp() {}, auth: authFn, database: () => ({ ref }) };
}

/* ---------- Démarrage d'un "navigateur" ---------- */
async function boot(state, { confirmAnswer = true, localStorageSeed = null } = {}) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  html = html.replace(/<script[^>]*><\/script>/g, '');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://donal034.github.io/finances-app/', pretendToBeVisual: true,
    beforeParse(w) {
      w.firebase = makeFirebase(state);
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.confirm = () => confirmAnswer;
      w.alert = m => { w.__alerts = (w.__alerts || []).concat(m); };
      w.prompt = () => w.__promptAnswer || null;
      w.scrollTo = () => {};
      w.addEventListener('error', e => errors.push(e.message));
      if (localStorageSeed) for (const [k, v] of Object.entries(localStorageSeed)) w.localStorage.setItem(k, v);
    }
  });
  const w = dom.window;
  w.console.error = (...a) => { const s = a.map(String).join(' '); if (!/PERMISSION|permission/.test(s)) errors.push(s); };
  for (const s of scripts) {
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(ROOT, s), 'utf8');
    w.document.body.appendChild(el);
  }
  await tick();
  return { w, d: w.document, errors };
}
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
const $ = (d, s) => d.querySelector(s);
const setVal = (d, id, v) => { const el = d.getElementById(id); el.value = v; el.dispatchEvent(new d.defaultView.Event('change', { bubbles: true })); };
const submit = (d, id) => d.getElementById(id).dispatchEvent(new d.defaultView.Event('submit', { bubbles: true, cancelable: true }));
const click = (d, el) => el.dispatchEvent(new d.defaultView.MouseEvent('click', { bubbles: true }));
const text = el => el.textContent.replace(/\s+/g, ' ');
const U2 = n => Math.round(n * 100) / 100;
const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\s+/g, ' ');

(async () => {
  const state = { tree: {}, user: null, nextUid: 'uid-donal', writes: 0, rejected: [] };

  console.log('\n1. Démarrage sans session');
  let { w, d, errors } = await boot(state);
  ok(!d.getElementById('loginScreen').hidden, 'écran de connexion affiché');
  ok(d.getElementById('app').hidden, 'application masquée tant que non connecté');

  console.log('\n2. Connexion Google');
  click(d, d.getElementById('btnLogin')); await tick();
  ok(!d.getElementById('app').hidden, 'application affichée après connexion');
  ok(text($(d, '#sec-dashboard')).includes('Bonjour Donal'), 'tableau de bord personnalisé');
  ok(text($(d, '#sec-dashboard')).includes('Commence par ajouter tes comptes'), 'invitation à créer un compte');

  console.log('\n3. Comptes');
  const S = w.eval('Store');
  const today = w.eval('U.today()');
  const addAccount = (name, bank, type, bal) => {
    w.eval('Accounts.openNew()');
    setVal(d, 'accName', name); setVal(d, 'accBank', bank); setVal(d, 'accType', type); setVal(d, 'accInitial', bal);
    submit(d, 'accountForm');
  };
  addAccount('Hello – Courant', 'Hello Bank', 'checking', '269,24');
  addAccount('Livret A', 'BNP', 'livretA', '1000');
  addAccount('BNP – Courant', 'BNP', 'checking', '-110');
  await tick();
  const acc = n => S.list('accounts').find(a => a.name === n);
  ok(S.list('accounts').length === 3, '3 comptes enregistrés dans Firebase sous users/uid-donal');
  ok(!!state.tree.users['uid-donal'].accounts, 'chemin de stockage users/{uid}/accounts');
  ok(S.balance(acc('Hello – Courant').id) === 269.24, 'solde saisi avec virgule : 269,24');
  ok(S.balance(acc('BNP – Courant').id) === -110, 'découvert BNP : -110');
  ok(text($(d, '#sec-dashboard')).includes('à découvert'), 'alerte de découvert affichée');
  ok(S.netWorth() === 1159.24, 'patrimoine net = 1159,24');

  console.log('\n4. Opérations et virements');
  const hello = acc('Hello – Courant').id, livret = acc('Livret A').id;
  w.eval('Transactions.openNew()');
  ok(d.getElementById('dlgTx').open, 'dialogue d’opération ouvert');
  setVal(d, 'txType', 'expense'); setVal(d, 'txAmount', '50'); setVal(d, 'txLabel', 'Courses');
  setVal(d, 'txAccount', hello); setVal(d, 'txCategory', 'Alimentation'); setVal(d, 'txDate', today);
  submit(d, 'txForm'); await tick();
  ok(S.balance(hello) === 219.24, 'dépense de 50 € déduite du compte');

  w.eval('Transactions.openNew()');
  setVal(d, 'txType', 'transfer');
  ok(!d.getElementById('fieldToAccount').hidden && d.getElementById('fieldCategory').hidden, 'champs adaptés au virement');
  setVal(d, 'txAmount', '100'); setVal(d, 'txAccount', hello); setVal(d, 'txToAccount', livret); setVal(d, 'txDate', today);
  submit(d, 'txForm'); await tick();
  ok(S.balance(hello) === 119.24 && S.balance(livret) === 1100, 'virement : −100 sur le courant, +100 sur le Livret A');
  const mt = S.monthTotals(today.slice(0, 7));
  ok(mt.expense === 50 && mt.income === 0, 'le virement ne compte ni en revenu ni en dépense');
  ok(S.netWorth() === 1109.24, 'patrimoine inchangé par le virement (1159,24 − 50)');

  w.eval('Transactions.openNew()');
  setVal(d, 'txAmount', '10'); setVal(d, 'txLabel', ''); submit(d, 'txForm');
  ok(d.getElementById('dlgTx').open, 'libellé vide refusé, dialogue reste ouvert');
  setVal(d, 'txLabel', 'x'); setVal(d, 'txAmount', 'abc'); submit(d, 'txForm');
  ok(d.getElementById('dlgTx').open, 'montant invalide refusé');
  d.getElementById('dlgTx').close();

  const courses = S.list('transactions').find(t => t.label === 'Courses');
  w.eval(`Transactions.edit(${JSON.stringify(courses.id)})`);
  ok(d.getElementById('txAmount').value === '50' && d.getElementById('txCategory').value === 'Alimentation', 'édition : champs pré-remplis');
  setVal(d, 'txAmount', '62,30'); submit(d, 'txForm'); await tick();
  ok(S.get('transactions', courses.id).amount === 62.3 && S.list('transactions').length === 2, 'édition : montant modifié sans doublon');

  console.log('\n5. Sécurité de l’affichage (XSS)');
  w.eval('Transactions.openNew()');
  setVal(d, 'txAmount', '1'); setVal(d, 'txLabel', '<img src=x onerror="window.__pwned=1">'); setVal(d, 'txDate', today);
  submit(d, 'txForm'); await tick();
  w.eval('App.go("transactions")'); await tick();
  ok(!d.querySelector('#sec-transactions img'), 'le HTML du libellé est affiché comme texte');
  ok(!w.__pwned, 'aucun script injecté exécuté');

  console.log('\n6. Opérations récurrentes');
  const threeAgo = w.eval('U.addMonths(U.today().slice(0,7), -3)') + '-01';
  w.eval('Recurring.openNew()');
  setVal(d, 'recType', 'income'); setVal(d, 'recAmount', '1800'); setVal(d, 'recLabel', 'Salaire');
  setVal(d, 'recDay', '1'); setVal(d, 'recStart', threeAgo); setVal(d, 'recAccount', hello); setVal(d, 'recCategory', 'Salaire');
  submit(d, 'recForm'); await tick();
  const sal = () => S.list('transactions').filter(t => t.label === 'Salaire');
  ok(sal().length === 4, `salaire généré pour 4 mois (3 passés + mois en cours) : ${sal().length}`);
  S.generateRecurring(); S.generateRecurring(); await tick();
  ok(sal().length === 4, 'aucun doublon après plusieurs générations');
  const first = sal().sort((a, b) => a.date.localeCompare(b.date))[0];
  S.deleteTransaction(first.id); await tick();
  S.generateRecurring(); await tick();
  ok(sal().length === 3, 'occurrence supprimée non recréée');

  console.log('\n7. Second appareil (même compte)');
  const b2 = await boot(state);
  await tick(20);
  ok(!b2.d.getElementById('app').hidden, 'session active : application affichée directement');
  const S2 = b2.w.eval('Store');
  ok(S2.list('transactions').length === S.list('transactions').length, 'mêmes opérations sur les deux appareils');
  ok(S2.list('transactions').filter(t => t.label === 'Salaire').length === 3, 'pas de doublon de récurrence entre appareils');
  S2.save('transactions', { type: 'expense', label: 'Café (téléphone)', amount: 2.5, date: today, accountId: hello, category: 'Restaurants' });
  await tick();
  ok(!!S.list('transactions').find(t => t.label === 'Café (téléphone)'), 'opération du téléphone visible en temps réel sur l’ordinateur');

  console.log('\n8. Objectifs et investissements');
  w.eval('Goals.openNew()');
  setVal(d, 'goalName', 'Fonds d’urgence'); setVal(d, 'goalTarget', '3000'); setVal(d, 'goalAccount', livret);
  submit(d, 'goalForm'); await tick();
  const g = S.list('goals')[0];
  const gp = w.eval('Goals').progress(g);
  ok(gp.saved === 1100 && Math.round(gp.pct) === 37, 'objectif lié au Livret A : 1100 / 3000 (37 %)');
  w.eval('Investments.openNew()');
  setVal(d, 'invName', 'ETF World'); setVal(d, 'invAmount', '500'); setVal(d, 'invValue', '540'); submit(d, 'invForm'); await tick();
  ok(S.list('investments').length === 1, 'investissement ajouté');

  console.log('\n8b. Budgets par catégorie');
  w.eval('App.go("budgets")');
  const bInput = c => [...d.querySelectorAll('.budget-input')].find(i => i.dataset.cat === c);
  bInput('Alimentation').value = '50';
  bInput('Restaurants').value = '3';
  d.getElementById('bGlobal').value = '1 200';
  click(d, d.getElementById('saveBudgets')); await tick();
  ok(S.data.settings.categoryBudgets.length === 2 && S.data.settings.monthlyBudget === 1200, 'budgets enregistrés (2 catégories, global 1 200 €)');
  const bs = Object.fromEntries(S.budgetStatus(today.slice(0, 7)).map(b => [b.c, b]));
  ok(bs['Alimentation'].level === 'over', 'Alimentation 62,30 / 50 → dépassé');
  ok(bs['Restaurants'].level === 'warn' && Math.round(bs['Restaurants'].pct) === 83, 'Restaurants 2,50 / 3 → alerte à 83 %');
  w.eval('App.go("dashboard")');
  const dash = text(d.getElementById('sec-dashboard'));
  ok(dash.includes('Budget Alimentation dépassé') && dash.includes('Restaurants : 83 %'), 'alertes budgets sur le tableau de bord');
  w.eval('App.go("settings")'); w.eval('Settings.saveCategories()'); await tick();
  ok(S.data.settings.categoryBudgets.length === 2, 'enregistrer les catégories ne supprime pas les budgets');

  console.log('\n8c. Abonnements et échéancier');
  const future = w.eval('U.addDays(U.today(), 3)');
  w.eval('Recurring.openNewSub()');
  ok(d.getElementById('recSub').checked && !d.getElementById('fieldRecSub').hidden, 'formulaire d’abonnement pré-coché');
  setVal(d, 'recAmount', '12,99'); setVal(d, 'recLabel', 'Netflix'); setVal(d, 'recDay', String(Number(future.slice(8))));
  setVal(d, 'recStart', today); setVal(d, 'recAccount', hello);
  submit(d, 'recForm'); await tick();
  const netflix = S.list('recurrings').find(r => r.label === 'Netflix');
  ok(netflix && netflix.kind === 'subscription', 'abonnement enregistré');
  w.eval('Recurring.setTab("subs")');
  ok(text(d.getElementById('sec-recurring')).includes(eur(155.88)), 'coût annuel : 155,88 €');
  const proj = S.projection(45);
  const ev = proj.events.find(e => e.item.label === 'Netflix');
  ok(ev && ev.date === future && ev.effect === -12.99, 'Netflix dans l’échéancier, −12,99 € sur le compte courant');
  w.eval('Recurring.setTab("upcoming")');
  ok(text(d.getElementById('sec-recurring')).includes('Netflix'), 'échéancier affiché');
  w.eval(`Recurring.cancel(${JSON.stringify(netflix.id)})`); await tick();
  ok(!S.projection(45).events.some(e => e.item.label === 'Netflix'), 'abonnement résilié : plus d’échéance à venir');

  console.log('\n8d. Dettes et prêts');
  const nw0 = S.netWorth();
  w.eval('Debts.openNew()');
  setVal(d, 'debtDirection', 'owe'); setVal(d, 'debtName', 'Paul'); setVal(d, 'debtAmount', '500'); setVal(d, 'debtStart', today);
  submit(d, 'debtForm'); await tick();
  const paul = S.list('debts').find(x => x.name === 'Paul');
  ok(paul && S.netWorth() === U2(nw0 - 500), 'dette de 500 € déduite du patrimoine');
  const helloBefore = S.balance(hello);
  w.eval(`Debts.pay(${JSON.stringify(paul.id)})`);
  setVal(d, 'payAmount', '200'); setVal(d, 'payAccount', hello);
  submit(d, 'payForm'); await tick();
  ok(S.debtRemaining(S.get('debts', paul.id)) === 300, 'remboursement de 200 € : reste 300 €');
  ok(S.balance(hello) === U2(helloBefore - 200), 'opération de 200 € créée sur le compte');
  ok(S.netWorth() === U2(nw0 - 500), 'patrimoine cohérent après remboursement');
  w.eval(`Debts.pay(${JSON.stringify(paul.id)})`);
  setVal(d, 'payAmount', '400'); submit(d, 'payForm');
  ok(d.getElementById('dlgPayment').open, 'remboursement supérieur au reste dû refusé');
  d.getElementById('dlgPayment').close();
  w.eval('Debts.openNew()');
  setVal(d, 'debtDirection', 'owed'); setVal(d, 'debtName', 'Marie'); setVal(d, 'debtAmount', '100'); setVal(d, 'debtStart', today);
  submit(d, 'debtForm'); await tick();
  ok(S.netWorth() === U2(nw0 - 400), 'créance de 100 € ajoutée au patrimoine');

  console.log('\n8e. Historique du patrimoine');
  const hist = S.netWorthHistory(12);
  const inv = S.list('investments').reduce((x, i) => x + i.currentValue, 0);
  ok(hist.length === 12 && hist[11].value === U2(S.netWorth() - inv), 'dernier point = patrimoine actuel hors investissements');
  w.eval('App.go("reports")');
  ok(text(d.getElementById('sec-reports')).includes('au moins deux mois'), 'un seul mois d’historique : message explicatif');
  const liv = S.get('accounts', livret);
  await S.save('accounts', { ...liv, openingDate: w.eval('U.addMonths(U.today().slice(0,7), -2)') + '-01' }); await tick();
  w.eval('App.go("reports")');
  ok(!!d.querySelector('#sec-reports .history svg polyline') && S.balance(livret) === 1100, 'compte suivi depuis 2 mois : courbe affichée, solde inchangé');

  console.log('\n8f. Validation des données par les règles Firebase');
  ok(state.rejected.length === 0, `aucune écriture légitime de l’app refusée par les règles${state.rejected.length ? ' : ' + JSON.stringify(state.rejected) : ''}`);
  const base = 'users/uid-donal/';
  const refused = async (p, v) => { let r = false; await w.firebase.database().ref(base + p).set(v).catch(() => { r = true; }); return r; };
  ok(await refused('transactions/x1', { id: 'x1', type: 'expense', label: 'Test', amount: -5, date: today }), 'montant négatif refusé');
  ok(await refused('transactions/x2', { id: 'x2', type: 'vol', label: 'Test', amount: 5, date: today }), 'type inconnu refusé');
  ok(await refused('transactions/x3', { id: 'x3', type: 'expense', label: 'a'.repeat(201), amount: 5, date: today }), 'libellé de plus de 200 caractères refusé');
  ok(await refused('transactions/x4', { id: 'autre', type: 'expense', label: 'Test', amount: 5, date: today }), 'identifiant incohérent refusé');
  ok(await refused('transactions/x5', { id: 'x5', type: 'expense', label: 'Test', amount: 5, date: '22/09/2026' }), 'date mal formée refusée');
  ok(await refused('piratage', { a: 1 }), 'collection inconnue refusée');
  ok(await refused('settings/monthlyBudget', 'beaucoup'), 'budget non numérique refusé');
  ok(!(await refused('transactions/x6', { id: 'x6', type: 'expense', label: 'Valide', amount: 5, date: today })), 'opération valide acceptée');
  await S.deleteTransaction('x6'); await tick();
  state.rejected.length = 0;

  console.log('\n9. Toutes les vues s’affichent sans erreur');
  for (const v of ['dashboard', 'transactions', 'budgets', 'accounts', 'recurring', 'goals', 'debts', 'investments', 'reports', 'settings']) {
    w.eval(`App.go("${v}")`);
    const t = text(d.getElementById('sec-' + v));
    ok(t.length > 50 && !/undefined|NaN|\[object Object\]/.test(t), `vue ${v}`);
  }
  w.eval('App.cmd("prevMonth")'); w.eval('App.go("dashboard")');
  ok(text($(d, '#sec-dashboard')).includes('Revenir au mois en cours'), 'navigation vers le mois précédent');
  w.eval('App.cmd("thisMonth")');

  console.log('\n10. Sauvegarde et restauration');
  const exported = JSON.parse(JSON.stringify(S.exportAll()));
  const before = S.list('transactions').length;
  await S.wipeAll(); await tick();
  ok(S.list('transactions').length === 0, 'données effacées');
  await S.importAll(exported); await tick();
  ok(S.list('transactions').length === before, 'restauration : toutes les opérations reviennent');
  ok(S.balance(livret) === 1100, 'restauration : soldes identiques');

  console.log('\n11. Correction de solde');
  w.eval(`Accounts.reconcile(${JSON.stringify(hello)})`);
  setVal(d, 'recoReal', '1 500,00'); submit(d, 'reconcileForm'); await tick();
  ok(S.balance(hello) === 1500, 'solde aligné sur le relevé (1 500,00)');

  console.log('\n12. Mode discret');
  w.eval('App.cmd("privacy")');
  ok(d.body.classList.contains('privacy'), 'montants floutés');

  console.log('\n13. Isolation entre utilisateurs (règles)');
  await w.eval('auth.signOut()'); await tick();
  ok(!d.getElementById('loginScreen').hidden, 'retour à l’écran de connexion');
  let denied = false;
  await w.firebase.database().ref('users/uid-donal/accounts/x').set({ a: 1 }).catch(() => { denied = true; });
  ok(denied, 'écriture refusée sans authentification');
  state.nextUid = 'uid-autre';
  click(d, d.getElementById('btnLogin')); await tick();
  ok(w.eval('Store').list('accounts').length === 0, 'un autre compte Google ne voit aucune donnée de Donal');
  denied = false;
  await w.firebase.database().ref('users/uid-donal').once?.('value').catch(() => { denied = true; });
  let denied2 = false;
  await w.firebase.database().ref('users/uid-donal/accounts/x').set({ a: 1 }).catch(() => { denied2 = true; });
  ok(denied2, 'un autre utilisateur ne peut pas écrire chez Donal');

  console.log('\n14. Migration depuis l’ancienne version (localStorage)');
  const st2 = { tree: {}, user: null, nextUid: 'uid-migr', writes: 0, rejected: [] };
  const seed = {
    'pilotage-accounts': JSON.stringify([{ id: 1, name: 'BNP', bank: 'BNP', type: 'checking', balance: 3013.4 }]),
    'pilotage-transactions': JSON.stringify([{ id: 2, type: 'expense', label: 'Loyer', amount: 626, category: 'Logement', date: today }]),
    'pilotage-settings': JSON.stringify({ monthlyBudget: 500, goalName: 'Voyage', goalAmount: 15000, goalIcon: '✈️' })
  };
  const m = await boot(st2, { localStorageSeed: seed });
  click(m.d, m.d.getElementById('btnLogin')); await tick(20);
  const SM = m.w.eval('Store');
  ok(SM.list('accounts').length === 1 && SM.list('transactions').length === 1 && SM.list('goals').length === 1, 'compte, opération et objectif importés');
  ok(SM.data.settings.monthlyBudget === 500, 'budget importé');

  ok(state.rejected.length === 0 && st2.rejected.length === 0, `aucune écriture de l’app refusée après la section 8f${state.rejected.length ? ' : ' + JSON.stringify(state.rejected) : ''}`);
  const allErrors = [...errors, ...b2.errors, ...m.errors].filter(e => !/Not implemented/.test(e));
  console.log('\nErreurs JavaScript relevées :', allErrors.length ? allErrors : 'aucune');
  if (allErrors.length) failures++;
  console.log(`\nRésultat : ${passes} réussis, ${failures} échoués`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
