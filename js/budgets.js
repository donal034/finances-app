/**
 * Budgets : plafond global et plafonds par catégorie de dépense.
 * Alerte à 80 % (orange) et à 100 % (rouge).
 */
const Budgets = {
  levelLabel(b) {
    if (b.level === 'over') return `Dépassé de ${U.money(-b.left)}`;
    if (b.level === 'warn') return `Plus que ${U.money(b.left)}`;
    return `Reste ${U.money(b.left)}`;
  },

  render(el) {
    const m = App.month;
    const s = Store.data.settings;
    const spent = Object.fromEntries(Store.categoryTotals(m, 'expense'));
    const status = Object.fromEntries(Store.budgetStatus(m).map(b => [b.c, b]));
    const cats = [...s.categories.expense];
    Object.keys(spent).forEach(c => { if (!cats.includes(c)) cats.push(c); });
    s.categoryBudgets.forEach(b => { if (!cats.includes(b.c)) cats.push(b.c); });

    const t = Store.monthTotals(m);
    const global = Number(s.monthlyBudget) || 0;
    const globalPct = global > 0 ? Math.round(t.expense / global * 100) : 0;
    const totalCat = U.round2(s.categoryBudgets.reduce((x, b) => x + b.a, 0));
    const unbudgeted = U.round2(Object.entries(spent).filter(([c]) => !status[c]).reduce((x, [, v]) => x + v, 0));
    const level = globalPct >= 100 ? 'over' : globalPct >= 80 ? 'warn' : 'ok';

    el.innerHTML = `
      ${App.header('Pilotage', 'Budgets')}
      ${App.monthNav()}
      <div class="grid">
        <article class="card span-4 budget-global ${level}">
          <div class="card-head"><h2>Budget global</h2><span class="muted small">${globalPct} %</span></div>
          <div class="kpi-value">${U.money(t.expense)} <span class="muted small">/ ${U.money(global)}</span></div>
          <div class="progress big"><i style="width:${Math.min(100, globalPct)}%"></i></div>
          <div class="field inline-field"><label for="bGlobal">Plafond mensuel (€)</label>
            <input id="bGlobal" inputmode="decimal" value="${String(global).replace('.', ',')}"></div>
        </article>
        <article class="card span-4">
          <div class="card-head"><h2>Réparti par catégorie</h2></div>
          <div class="kpi-value">${U.money(totalCat)}</div>
          <p class="small ${totalCat > global && global > 0 ? 'negative' : 'muted'}">
            ${global > 0 ? (totalCat > global
              ? `Tes budgets par catégorie dépassent le budget global de ${U.money(totalCat - global)}.`
              : `Encore ${U.money(global - totalCat)} à répartir.`) : 'Aucun budget global défini.'}
          </p>
        </article>
        <article class="card span-4">
          <div class="card-head"><h2>Dépenses hors budget</h2></div>
          <div class="kpi-value ${unbudgeted > 0 ? 'negative' : ''}">${U.money(unbudgeted)}</div>
          <p class="small muted">Dépenses du mois dans des catégories sans plafond.</p>
        </article>
      </div>

      <div class="card">
        <div class="card-head"><h2>Par catégorie</h2><span class="muted small">Laisse vide pour ne pas fixer de plafond</span></div>
        <div class="budget-list">
          ${cats.map(c => {
            const b = status[c];
            const sp = spent[c] || 0;
            return `
              <div class="budget-row ${b ? b.level : 'none'}">
                <div class="budget-cat">
                  <strong>${U.catIcon(c)} ${U.esc(c)}</strong>
                  <small class="muted">${b ? `${U.money(sp)} sur ${U.money(b.budget)}` : `${U.money(sp)} dépensé`}</small>
                </div>
                <div class="budget-bar">
                  ${b ? `<div class="progress"><i style="width:${Math.min(100, b.pct)}%"></i></div>
                         <small>${Math.round(b.pct)} % – ${this.levelLabel(b)}</small>`
                      : '<small class="muted">Pas de plafond</small>'}
                </div>
                <input class="budget-input" data-cat="${U.esc(c)}" inputmode="decimal" placeholder="—"
                  value="${b ? String(b.budget).replace('.', ',') : ''}" aria-label="Plafond ${U.esc(c)} en euros">
              </div>`;
          }).join('')}
        </div>
        <div class="form-actions"><button class="btn primary" id="saveBudgets">Enregistrer les budgets</button></div>
      </div>`;

    el.querySelector('#saveBudgets').addEventListener('click', () => this.save(el));
  },

  save(el) {
    const global = U.num(el.querySelector('#bGlobal').value || '0');
    if (!(global >= 0)) return App.toast('Budget global invalide', 'error');
    const list = [];
    for (const input of el.querySelectorAll('.budget-input')) {
      const raw = input.value.trim();
      if (!raw) continue;
      const a = U.num(raw);
      if (!(a >= 0)) return App.toast(`Montant invalide pour ${input.dataset.cat}`, 'error');
      if (a > 0) list.push({ c: input.dataset.cat, a: U.round2(a) });
    }
    Store.saveSettings({ ...Store.data.settings, monthlyBudget: U.round2(global), categoryBudgets: list })
      .catch(e => App.fail(e));
    App.toast('Budgets enregistrés');
  }
};
