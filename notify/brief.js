/**
 * Calcul du brief quotidien à partir des données Mon Pilotage.
 * Fonctions pures : aucune dépendance réseau, donc testables hors ligne.
 * La logique reprend celle de js/store.js côté application.
 */
const CURRENT_TYPES = ['checking', 'wallet', 'cash'];

const eur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const list = (d, c) => Object.values(d[c] || {}).filter(Boolean);
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dt = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const monthEnd = key => `${key}-${String(daysInMonth(key)).padStart(2, '0')}`;
const jours = (a, b) => Math.round((dt(b) - dt(a)) / 86400000);
const dateFr = s => dt(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

function balance(data, accountId, upTo) {
  const a = (data.accounts || {})[accountId];
  if (!a) return 0;
  let b = Number(a.initialBalance) || 0;
  const from = a.openingDate || '';
  list(data, 'transactions').forEach(t => {
    if (!t || !t.date || t.date < from || t.date > upTo) return;
    const amt = Number(t.amount) || 0;
    if (t.type === 'income' && t.accountId === accountId) b += amt;
    else if (t.type === 'expense' && t.accountId === accountId) b -= amt;
    else if (t.type === 'transfer') {
      if (t.accountId === accountId) b -= amt;
      if (t.toAccountId === accountId) b += amt;
    }
  });
  return r2(b);
}

function occurrenceDate(r, key) {
  const day = Math.min(Number(r.day) || 1, daysInMonth(key));
  return `${key}-${String(day).padStart(2, '0')}`;
}

function upcoming(data, today, days) {
  const end = addDays(today, days);
  const out = [];
  list(data, 'recurrings').forEach(r => {
    if (!r.active || !r.startDate || !(Number(r.amount) > 0)) return;
    const skipped = r.skipped || {};
    let key = today.slice(0, 7);
    if (r.startDate.slice(0, 7) > key) key = r.startDate.slice(0, 7);
    for (let i = 0; i < 24 && key <= end.slice(0, 7); i++) {
      const date = occurrenceDate(r, key);
      const id = `rec_${r.id}_${key}`;
      if (date > today && date <= end && date >= r.startDate && (!r.endDate || date <= r.endDate)
          && !skipped[key] && !(data.transactions || {})[id]) {
        out.push({ date, item: r });
      }
      key = addMonths(key, 1);
    }
  });
  list(data, 'debts').forEach(d => {
    if (d.dueDate && d.dueDate > today && d.dueDate <= end && remaining(d, today) > 0) {
      out.push({ date: d.dueDate, debt: d });
    }
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function pendingVariable(data, today) {
  const out = [];
  list(data, 'recurrings').forEach(r => {
    if (!r.active || !r.variable || !r.startDate) return;
    const skipped = r.skipped || {};
    let key = r.startDate.slice(0, 7);
    for (let i = 0; i < 24 && key <= today.slice(0, 7); i++) {
      const date = occurrenceDate(r, key);
      if (date >= r.startDate && date <= today && (!r.endDate || date <= r.endDate)
          && !skipped[key] && !(data.transactions || {})[`rec_${r.id}_${key}`]) {
        out.push({ date, item: r });
      }
      key = addMonths(key, 1);
    }
  });
  return out;
}

function remaining(d, upTo) {
  if (d.startDate && d.startDate > upTo) return 0;
  const paid = Object.values(d.payments || {})
    .filter(p => p && p.date <= upTo)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, r2((Number(d.initialAmount) || 0) - paid));
}

function effect(e, ids) {
  if (!e.item) return 0;
  const r = e.item, amt = Number(r.amount) || 0;
  if (r.type === 'income') return ids.has(r.accountId) ? amt : 0;
  if (r.type === 'expense') return ids.has(r.accountId) ? -amt : 0;
  return (ids.has(r.toAccountId) ? amt : 0) - (ids.has(r.accountId) ? amt : 0);
}

function monthTotals(data, key) {
  let income = 0, expense = 0;
  list(data, 'transactions').forEach(t => {
    if (!t || t.thirdParty || (t.date || '').slice(0, 7) !== key) return;
    if (t.type === 'income') income += Number(t.amount) || 0;
    else if (t.type === 'expense') expense += Number(t.amount) || 0;
  });
  return { income: r2(income), expense: r2(expense) };
}

function budgetStatus(data, key) {
  const spent = {};
  list(data, 'transactions').forEach(t => {
    if (!t || t.thirdParty || t.type !== 'expense' || !(t.date || '').startsWith(key)) return;
    const c = t.category || 'Autre';
    spent[c] = (spent[c] || 0) + (Number(t.amount) || 0);
  });
  const budgets = ((data.settings || {}).categoryBudgets) || [];
  return budgets.map(b => {
    const s = r2(spent[b.c] || 0);
    const pct = b.a > 0 ? s / b.a * 100 : 0;
    return { c: b.c, budget: b.a, spent: s, left: r2(b.a - s), pct,
             level: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' };
  }).filter(b => b.level !== 'ok').sort((x, y) => y.pct - x.pct);
}

/** Construit le brief du jour. */
function brief(data, today = iso(new Date())) {
  const accounts = list(data, 'accounts').filter(a => !a.archived);
  const courants = accounts.filter(a => CURRENT_TYPES.includes(a.type));
  const ids = new Set(courants.map(a => a.id));
  const dispo = r2(courants.reduce((s, a) => s + balance(data, a.id, today), 0));
  const total = r2(accounts.reduce((s, a) => s + balance(data, a.id, today), 0));

  const events = upcoming(data, today, 45);
  let run = dispo;
  const projete = events.map(e => { run = r2(run + effect(e, ids)); return { ...e, balance: run }; });
  const fin = monthEnd(today.slice(0, 7));
  const finDeMois = projete.filter(e => e.date <= fin).reduce((b, e) => e.balance, dispo);

  const alertes = [];
  courants.forEach(a => {
    const b = balance(data, a.id, today);
    if (b < 0) alertes.push(`${a.name} est à découvert : ${eur(b)}`);
  });
  let run2 = new Map(courants.map(a => [a.id, balance(data, a.id, today)]));
  const vus = new Set();
  projete.forEach(e => {
    courants.forEach(a => {
      const eff = effect(e, new Set([a.id]));
      const nv = r2(run2.get(a.id) + eff);
      run2.set(a.id, nv);
      if (nv < 0 && !vus.has(a.id) && balance(data, a.id, today) >= 0) {
        vus.add(a.id);
        alertes.push(`${a.name} passerait en négatif le ${dateFr(e.date)} : ${eur(nv)}`);
      }
    });
  });
  budgetStatus(data, today.slice(0, 7)).forEach(b => {
    alertes.push(b.level === 'over'
      ? `Budget ${b.c} dépassé : ${eur(b.spent)} sur ${eur(b.budget)}`
      : `${b.c} : ${Math.round(b.pct)} % du budget, plus que ${eur(b.left)}`);
  });
  const pend = pendingVariable(data, today);
  if (pend.length) alertes.push(`${pend.length} opération(s) à montant variable à confirmer`);

  list(data, 'goals').forEach(g => {
    if (!g.deadline) return;
    const j = jours(today, g.deadline);
    if (j < 0 || j > 30) return;
    const linked = g.accountId && (data.accounts || {})[g.accountId];
    const saved = linked ? Math.max(0, balance(data, g.accountId, today)) : (Number(g.saved) || 0);
    const reste = r2((Number(g.target) || 0) - saved);
    if (reste > 0) alertes.push(`Objectif ${g.name} : ${eur(reste)} à réunir en ${j} jour(s)`);
  });
  list(data, 'debts').forEach(d => {
    if (!d.dueDate) return;
    const j = jours(today, d.dueDate);
    const reste = remaining(d, today);
    if (reste <= 0) return;
    if (j < 0) alertes.push(`${d.name} : échéance dépassée, ${eur(reste)} ${d.direction === 'owe' ? 'à payer' : 'à récupérer'}`);
    else if (j <= 14) alertes.push(`${d.name} : ${eur(reste)} ${d.direction === 'owe' ? 'à payer' : 'à récupérer'} dans ${j} jour(s)`);
  });

  const t = monthTotals(data, today.slice(0, 7));
  const semaine = projete.filter(e => e.date <= addDays(today, 7));
  return { today, dispo, total, finDeMois, fin, alertes, semaine, mois: t,
           pending: pend, projete };
}

function texte(b) {
  const L = [];
  L.push(`Pilotage — ${dt(b.today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  L.push('');
  L.push(`Comptes courants : ${eur(b.dispo)}`);
  L.push(`Prévu au ${dateFr(b.fin)} : ${eur(b.finDeMois)}`);
  L.push(`Ce mois : ${eur(b.mois.income)} reçus, ${eur(b.mois.expense)} dépensés`);
  if (b.alertes.length) {
    L.push('');
    b.alertes.forEach(a => L.push(`! ${a}`));
  }
  if (b.semaine.length) {
    L.push('');
    L.push('Cette semaine :');
    b.semaine.forEach(e => {
      if (e.debt) { L.push(`  ${dateFr(e.date)} — ${e.debt.name}`); return; }
      const r = e.item;
      const signe = r.type === 'income' ? '+' : r.type === 'expense' ? '−' : '';
      L.push(`  ${dateFr(e.date)} — ${r.label} ${signe}${eur(r.amount)}${r.variable ? ' (à confirmer)' : ''}`);
    });
  }
  return L.join('\n');
}

/** Version SMS : 480 caractères maximum, l'essentiel seulement. */
function sms(b) {
  const L = [`Pilotage ${dt(b.today).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`,
             `Dispo ${eur(b.dispo)} | fin de mois ${eur(b.finDeMois)}`];
  b.alertes.slice(0, 4).forEach(a => L.push(`! ${a}`));
  const s = L.join('\n');
  return s.length > 480 ? s.slice(0, 477) + '...' : s;
}

module.exports = { brief, texte, sms, balance, upcoming, pendingVariable, budgetStatus,
                   monthTotals, remaining, eur, iso, addDays, monthEnd };
