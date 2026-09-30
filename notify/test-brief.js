/**
 * Tests du brief quotidien, sans réseau ni Firebase.
 * Lancer : node notify/test-brief.js
 */
const { brief, texte, sms } = require('./brief');

let ok = 0, ko = 0;
const t = (cond, msg) => { if (cond) { ok++; console.log('  ✔', msg); } else { ko++; console.log('  ✘', msg); } };
const A = (id, name, type, solde, date = '2026-09-30') =>
  ({ id, name, bank: 'B', type, initialBalance: solde, openingDate: date, archived: false });
const R = (id, o) => ({ id, active: true, startDate: '2026-10-01', kind: 'standard', ...o });

const base = () => ({
  accounts: { a1: A('a1', 'BNP courant', 'checking', 600), a2: A('a2', 'LEP', 'lep', 3007.9) },
  transactions: {},
  recurrings: {
    r1: R('r1', { label: 'Loyer', type: 'expense', amount: 526, day: 29, accountId: 'a1', category: 'Logement' }),
    r2: R('r2', { label: 'Salaire', type: 'income', amount: 1795.92, day: 28, accountId: 'a1', category: 'Salaire' }),
    r3: R('r3', { label: 'Intérim', type: 'income', amount: 90, day: 12, accountId: 'a1', variable: true })
  },
  goals: { g1: { id: 'g1', name: 'Titre de séjour', target: 225, saved: 0, deadline: '2026-11-15' } },
  debts: { d1: { id: 'd1', name: 'Cotisation Allemagne', direction: 'owe', initialAmount: 1500,
                 startDate: '2026-10-01', dueDate: '2026-10-10' } },
  settings: { monthlyBudget: 1255, categoryBudgets: [{ c: 'Restaurants', a: 50 }, { c: 'Alimentation', a: 130 }] }
});

console.log('\n1. Brief de base');
let b = brief(base(), '2026-10-05');
t(b.dispo === 600, 'solde des comptes courants : 600 €');
t(b.total === 3607.9, 'patrimoine total : 3 607,90 €');
t(b.semaine.some(e => e.debt && e.debt.name === 'Cotisation Allemagne'), 'échéance de dette dans la semaine');
t(texte(b).includes('Pilotage — lundi 5 octobre'), 'en-tête daté en français');

console.log('\n2. Découvert anticipé');
const d = base();
d.accounts.a1.initialBalance = 100;      // le loyer du 29 passe avant le salaire du 28 ? non : salaire d'abord
d.recurrings.r2.day = 30;                 // salaire après le loyer
b = brief(d, '2026-10-05');
t(b.alertes.some(a => a.includes('passerait en négatif')), 'alerte de découvert anticipé');
t(b.finDeMois > 0, 'le salaire du 30 rattrape le découvert du 29');

console.log('\n3. Découvert déjà constaté');
const neg = base();
neg.accounts.a1.initialBalance = -46.37;
b = brief(neg, '2026-10-05');
t(b.alertes.some(a => a.includes('à découvert')), 'découvert du jour signalé');
t(!b.alertes.some(a => a.includes('passerait')), 'pas de doublon avec la prévision');

console.log('\n4. Budgets');
const bud = base();
bud.transactions = {
  x1: { id: 'x1', type: 'expense', label: 'Resto', amount: 45, date: '2026-10-03', accountId: 'a1', category: 'Restaurants' },
  x2: { id: 'x2', type: 'expense', label: 'Courses', amount: 140, date: '2026-10-04', accountId: 'a1', category: 'Alimentation' }
};
b = brief(bud, '2026-10-05');
t(b.alertes.some(a => a.includes('Restaurants') && a.includes('90 %')), 'alerte à 90 % sur Restaurants');
t(b.alertes.some(a => a.includes('Alimentation dépassé')), 'dépassement Alimentation signalé');
t(b.mois.expense === 185, 'dépenses du mois : 185 €');

console.log('\n5. Flux pour autrui exclus');
const tp = base();
tp.transactions = { y1: { id: 'y1', type: 'income', label: 'Cotisation reçue', amount: 2000,
                          date: '2026-10-02', accountId: 'a1', thirdParty: true, person: 'Marielle' } };
b = brief(tp, '2026-10-05');
t(b.mois.income === 0, 'les 2 000 € pour autrui ne comptent pas en revenu');
t(b.dispo === 2600, 'mais le solde du compte les intègre');

console.log('\n6. Montant variable à confirmer');
const va = base();
b = brief(va, '2026-10-14');
t(b.pending.length === 1 && b.pending[0].item.label === 'Intérim', 'occurrence variable en attente');
t(b.alertes.some(a => a.includes('à confirmer')), 'alerte de confirmation');
const conf = base();
conf.transactions = {};
conf.transactions['rec_r3_2026-10'] = { id: 'rec_r3_2026-10', type: 'income', label: 'Intérim',
  amount: 90, date: '2026-10-12', accountId: 'a1', recurringId: 'r3' };
b = brief(conf, '2026-10-14');
t(b.pending.length === 0, 'plus rien à confirmer une fois saisie');

console.log('\n7. Objectifs et dettes');
b = brief(base(), '2026-11-05');
t(b.alertes.some(a => a.includes('Titre de séjour') && a.includes('10 jour')), 'objectif proche signalé');
const late = base();
late.debts.d1.dueDate = '2026-09-30';
b = brief(late, '2026-10-05');
t(b.alertes.some(a => a.includes('échéance dépassée')), 'dette en retard signalée');

console.log('\n8. Formats de sortie');
b = brief(bud, '2026-10-05');
const s = sms(b);
t(s.length <= 480, `SMS de ${s.length} caractères, sous la limite`);
t(s.includes('Pilotage'), 'SMS identifiable');
t(texte(b).split('\n').length > 5, 'e-mail détaillé');

console.log('\n9. Robustesse');
const cassé = base();
cassé.transactions = { z1: null, z2: { id: 'z2' }, z3: { id: 'z3', type: 'expense', amount: 10, date: '2026-10-02', accountId: 'a1' } };
b = brief(cassé, '2026-10-05');
t(b.dispo === 590, 'les entrées nulles ou incomplètes sont ignorées sans planter');

console.log('\n10. Données vides');
b = brief({ accounts: {}, transactions: {}, recurrings: {}, settings: {} }, '2026-10-05');
t(b.dispo === 0 && b.alertes.length === 0, 'aucune donnée : aucun plantage');

console.log(`\nRésultat : ${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
