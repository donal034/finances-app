/**
 * Tableau de bord : vue d'ensemble du mois sélectionné.
 */
const Dashboard = {
  render(el) {
    const m = App.month;
    const t = Store.monthTotals(m);
    const budget = Number(Store.data.settings.monthlyBudget) || 0;
    const pct = budget > 0 ? Math.round(t.expense / budget * 100) : 0;
    const accounts = Store.activeAccounts();
    const recent = Store.monthTransactions(m).slice(0, 6);
    const cats = Store.categoryTotals(m, 'expense');
    const maxCat = Math.max(1, ...cats.map(c => c[1]));
    const goals = Store.list('goals').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 3);

    const alerts = [];
    accounts.forEach(a => {
      const b = Store.balance(a.id);
      if (b < 0) alerts.push(`${U.esc(a.name)} est à découvert : ${U.money(b)}`);
    });
    if (budget > 0 && t.expense > budget) {
      alerts.push(`Budget de ${U.monthLabel(m).toLowerCase()} dépassé de ${U.money(t.expense - budget)}`);
    }

    const name = App.firstName();

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
          <span class="muted small">Comptes actifs et investissements</span>
        </article>
        <article class="card kpi span-4">
          <span class="kpi-label">Revenus du mois</span>
          <div class="kpi-value positive">${U.money(t.income)}</div>
        </article>
        <article class="card kpi span-4">
          <span class="kpi-label">Dépenses du mois</span>
          <div class="kpi-value negative">${U.money(t.expense)}</div>
          <span class="muted small">Reste : ${U.money(t.savings)}${t.rate !== null ? ` · taux d’épargne ${t.rate} %` : ''}</span>
        </article>

        <article class="card span-4">
          <div class="card-head"><h2>Budget du mois</h2><span class="muted small">${U.money(t.expense)} / ${U.money(budget)}</span></div>
          <div class="donut-wrap">
            <div class="donut ${pct > 100 ? 'over' : ''}" style="--pct:${Math.min(100, pct)}%">
              <strong>${pct} %</strong>
            </div>
            <div class="legend">
              <span><i class="dot spent"></i>Dépensé</span>
              <span><i class="dot left"></i>Disponible : ${U.money(Math.max(0, budget - t.expense))}</span>
            </div>
          </div>
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

        <article class="card span-7">
          <div class="card-head"><h2>Dernières opérations</h2><button class="link" data-nav="transactions">Tout voir</button></div>
          ${recent.length ? `<div class="list">${recent.map(tx => Transactions.row(tx, false)).join('')}</div>`
            : '<p class="empty">Aucune opération ce mois-ci.</p>'}
        </article>

        <article class="card span-5">
          <div class="card-head"><h2>Dépenses par catégorie</h2></div>
          ${cats.length ? `<div class="bars">${cats.map(([c, v]) => `
            <div class="bar-row">
              <span>${U.esc(c)}</span>
              <div class="bar"><i style="width:${v / maxCat * 100}%"></i></div>
              ${U.money(v)}
            </div>`).join('')}</div>` : '<p class="empty">Pas de dépenses ce mois-ci.</p>'}
        </article>
      </div>`;
  }
};
