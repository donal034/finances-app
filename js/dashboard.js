/**
 * Tableau de bord : vue d'ensemble du mois sélectionné.
 */
const Dashboard = {
  render(el) {
    const m = App.month;
    const isCurrent = m === U.today().slice(0, 7);
    const t = Store.monthTotals(m);
    const budget = Number(Store.data.settings.monthlyBudget) || 0;
    const pct = budget > 0 ? Math.round(t.expense / budget * 100) : 0;
    const accounts = Store.activeAccounts();
    const recent = Store.monthTransactions(m).slice(0, 6);
    const cats = Store.categoryTotals(m, 'expense').slice(0, 6);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));
    const goals = Store.list('goals').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 3);
    const budgets = Store.budgetStatus(m);
    const debts = Store.debtTotals();
    const proj = Store.projection(45);
    const next = proj.events.slice(0, 5);

    const alerts = [];
    accounts.forEach(a => {
      const b = Store.balance(a.id);
      if (b < 0) alerts.push(`${U.esc(a.name)} est à découvert : ${U.money(b)}`);
    });
    if (budget > 0 && t.expense > budget) {
      alerts.push(`Budget global de ${U.monthLabel(m).toLowerCase()} dépassé de ${U.money(t.expense - budget)}`);
    }
    budgets.forEach(b => {
      if (b.level === 'over') alerts.push(`Budget ${U.esc(b.c)} dépassé : ${U.money(b.spent)} sur ${U.money(b.budget)}`);
      else if (b.level === 'warn') alerts.push(`${U.esc(b.c)} : ${Math.round(b.pct)} % du budget utilisé, plus que ${U.money(b.left)}`);
    });
    if (isCurrent && proj.hasCurrent && proj.endOfMonth < 0) {
      alerts.push(`Solde prévu de tes comptes courants au ${U.longDate(proj.monthEnd)} : ${U.money(proj.endOfMonth)}`);
    }

    const name = App.firstName();
    const debtLine = debts.owe || debts.owed
      ? `Dettes ${U.money(-debts.owe)} · créances ${U.money(debts.owed)}` : 'Comptes actifs et investissements';

    el.innerHTML = `
      ${App.header(name ? `Bonjour ${U.esc(name)}` : 'Bonjour', 'Tes finances en un coup d’œil',
        `<button class="btn primary" data-act="transactions.openNew">＋ Opération</button>`)}
      ${App.monthNav()}

      ${alerts.length ? `<div class="alerts">${alerts.map(a => `<div class="alert">⚠ ${a}</div>`).join('')}</div>` : ''}

      ${!accounts.length ? `
        <div class="card onboarding">
          <h2>Commence par ajouter tes comptes</h2>
          <p class="muted">Ajoute chaque compte avec son solde actuel (courant, Livret A, LEP…). Les opérations que tu saisiras ensuite mettront les soldes à jour automatiquement.</p>
          <button class="btn primary" data-act="accounts.openNew">Ajouter un compte</button>
        </div>` : ''}

      <div class="grid">
        <article class="card kpi kpi-hero span-4">
          <span class="kpi-label">Patrimoine net</span>
          <div class="kpi-value">${U.money(Store.netWorth())}</div>
          <span class="muted small">${debtLine}</span>
        </article>
        <article class="card kpi span-4">
          <span class="kpi-label">Revenus du mois</span>
          <div class="kpi-value positive">${U.money(t.income)}</div>
          <span class="muted small">${t.rate !== null ? `Taux d’épargne : ${t.rate} %` : '&nbsp;'}</span>
        </article>
        <article class="card kpi span-4">
          <span class="kpi-label">Dépenses du mois</span>
          <div class="kpi-value negative">${U.money(t.expense)}</div>
          <span class="muted small">Reste : ${U.money(t.savings)}</span>
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Budget du mois</h2><button class="link" data-nav="budgets">Gérer</button></div>
          <div class="donut-wrap">
            <div class="donut ${pct > 100 ? 'over' : ''}" style="--pct:${Math.min(100, pct)}%">
              <strong>${pct} %</strong>
            </div>
            <div class="legend">
              <span><i class="dot spent"></i>${U.money(t.expense)} dépensés</span>
              <span><i class="dot left"></i>${U.money(Math.max(0, budget - t.expense))} disponibles</span>
            </div>
          </div>
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Budgets par catégorie</h2><button class="link" data-nav="budgets">${budgets.length ? 'Voir tout' : 'Définir'}</button></div>
          ${budgets.length ? `<div class="bars">${budgets.slice(0, 4).map(b => `
            <div class="budget-mini ${b.level}">
              <div class="goal-mini-head"><span>${U.esc(b.c)}</span><span class="small">${U.money(b.spent)} / ${U.money(b.budget)}</span></div>
              <div class="progress"><i style="width:${Math.min(100, b.pct)}%"></i></div>
            </div>`).join('')}</div>`
            : `<p class="empty">Fixe un plafond pour l’alimentation, les loisirs ou les sorties : tu seras alerté à 80 % et à 100 %.</p>`}
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>À venir</h2><button class="link" data-nav="recurring">Échéancier</button></div>
          ${proj.hasCurrent ? `<div class="mini-row strong"><span>Solde prévu au ${U.shortDate(proj.monthEnd)}</span>${U.money(proj.endOfMonth, proj.endOfMonth < 0 ? 'negative' : '')}</div>` : ''}
          ${next.length ? `<div class="mini-list">${next.map(e => {
            const r = e.item;
            if (e.kind === 'debt') return `<div class="mini-row"><span>${U.shortDate(e.date)} – ${U.esc(r.name)}</span>${U.money(Store.debtRemaining(r))}</div>`;
            const sign = r.type === 'income' ? '+' : r.type === 'expense' ? '−' : '';
            const cls = r.type === 'income' ? 'positive' : r.type === 'expense' ? 'negative' : 'transfer';
            return `<div class="mini-row"><span>${U.shortDate(e.date)} – ${U.esc(r.label)}</span><span class="${cls}">${sign} ${U.money(r.amount)}</span></div>`;
          }).join('')}</div>` : `<p class="empty">Rien de prévu.<br><button class="link" data-act="recurring.openNew">Ajouter une récurrence</button></p>`}
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Comptes</h2><button class="link" data-nav="accounts">Gérer</button></div>
          ${accounts.length ? `<div class="mini-list">${accounts.map(a => {
            const b = Store.balance(a.id);
            return `<div class="mini-row"><span>${U.esc(a.name)}</span>${U.money(b, b < 0 ? 'negative' : '')}</div>`;
          }).join('')}</div>` : '<p class="empty">Aucun compte.</p>'}
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Objectifs</h2><button class="link" data-nav="goals">Voir tout</button></div>
          ${goals.length ? goals.map(g => {
            const p = Goals.progress(g);
            return `<div class="goal-mini">
              <div class="goal-mini-head"><span>${U.esc(g.icon || '🎯')} ${U.esc(g.name)}</span><span class="muted small">${Math.round(p.pct)} %</span></div>
              <div class="progress"><i style="width:${p.pct}%"></i></div>
            </div>`;
          }).join('') : `<p class="empty">Aucun objectif.<br><button class="link" data-act="goals.openNew">Créer un objectif</button></p>`}
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Dépenses par catégorie</h2></div>
          ${cats.length ? `<div class="bars">${cats.map(([c, v]) => `
            <div class="bar-row">
              <span>${U.esc(c)}</span>
              <div class="bar"><i style="width:${v / maxCat * 100}%"></i></div>
              ${U.money(v)}
            </div>`).join('')}</div>` : '<p class="empty">Pas de dépenses ce mois-ci.</p>'}
        </article>

        <article class="card span-12">
          <div class="card-head"><h2>Dernières opérations</h2><button class="link" data-nav="transactions">Tout voir</button></div>
          ${recent.length ? `<div class="list">${recent.map(tx => Transactions.row(tx, false)).join('')}</div>`
            : '<p class="empty">Aucune opération ce mois-ci.</p>'}
        </article>
      </div>`;
  }
};
