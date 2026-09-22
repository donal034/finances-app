/**
 * Rapports : synthèse du mois sélectionné et de son année.
 */
const Reports = {
  render(el) {
    const m = App.month;
    const year = m.slice(0, 4);
    const t = Store.monthTotals(m);
    const budget = Number(Store.data.settings.monthlyBudget) || 0;

    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const rows = months.map(k => ({ k, ...Store.monthTotals(k) }));
    const yIn = U.round2(rows.reduce((s, r) => s + r.income, 0));
    const yOut = U.round2(rows.reduce((s, r) => s + r.expense, 0));
    const active = rows.filter(r => r.income || r.expense).length || 1;
    const max = Math.max(1, ...rows.map(r => Math.max(r.income, r.expense)));
    const yCats = Store.categoryTotals(year, 'expense').slice(0, 8);
    const maxCat = Math.max(1, ...yCats.map(c => c[1]));

    el.innerHTML = `
      ${App.header('Analyse', 'Rapports')}
      ${App.monthNav()}
      <div class="grid">
        <article class="card span-5">
          <div class="card-head"><h2>${U.monthLabel(m)}</h2></div>
          <div class="summary-table">
            <div><span>Revenus</span>${U.money(t.income, 'positive')}</div>
            <div><span>Dépenses</span>${U.money(t.expense, 'negative')}</div>
            <div><span>Budget</span>${U.money(budget)}</div>
            <div><span>État du budget</span><strong class="${t.expense <= budget ? 'positive' : 'negative'}">${t.expense <= budget ? 'Respecté' : 'Dépassé'}</strong></div>
            <div class="total"><span>Reste</span>${U.money(t.savings, t.savings >= 0 ? 'positive' : 'negative')}</div>
            <div><span>Taux d’épargne</span><strong>${t.rate !== null ? t.rate + ' %' : '—'}</strong></div>
          </div>
        </article>

        <article class="card span-7">
          <div class="card-head"><h2>Année ${year}</h2>
            <span class="legend-inline"><i class="dot in"></i>Revenus <i class="dot out"></i>Dépenses</span></div>
          <div class="chart" role="img" aria-label="Revenus et dépenses par mois en ${year}">
            ${rows.map(r => `
              <div class="chart-col ${r.k === m ? 'current' : ''}" title="${U.monthLabel(r.k)} : +${U.eur(r.income)} / −${U.eur(r.expense)}">
                <div class="chart-bars">
                  <i class="in" style="height:${r.income / max * 100}%"></i>
                  <i class="out" style="height:${r.expense / max * 100}%"></i>
                </div>
                <span>${U.monthShort(r.k)}</span>
              </div>`).join('')}
          </div>
          <div class="summary-table compact">
            <div><span>Revenus de l’année</span>${U.money(yIn, 'positive')}</div>
            <div><span>Dépenses de l’année</span>${U.money(yOut, 'negative')}</div>
            <div class="total"><span>Solde de l’année</span>${U.money(yIn - yOut, yIn - yOut >= 0 ? 'positive' : 'negative')}</div>
            <div><span>Moyenne par mois actif</span><span>${U.money(yIn / active)} / ${U.money(yOut / active)}</span></div>
          </div>
        </article>

        <article class="card span-12">
          <div class="card-head"><h2>Évolution du patrimoine sur 12 mois</h2>
            <span class="muted small">Comptes et dettes, hors investissements</span></div>
          ${this.historyChart()}
        </article>

        <article class="card span-12">
          <div class="card-head"><h2>Principales dépenses de ${year}</h2></div>
          ${yCats.length ? `<div class="bars">${yCats.map(([c, v]) => `
            <div class="bar-row"><span>${U.esc(c)}</span>
              <div class="bar"><i style="width:${v / maxCat * 100}%"></i></div>${U.money(v)}</div>`).join('')}</div>`
            : '<p class="empty">Pas encore de dépenses cette année.</p>'}
        </article>
      </div>`;
  },

  historyChart() {
    const hist = Store.netWorthHistory(12);
    const pts = hist.filter(h => h.tracked > 0);
    if (pts.length < 2) {
      return '<p class="empty">La courbe apparaîtra dès que tes comptes auront au moins deux mois d’historique. Pour l’enrichir, date le solde de départ de tes comptes plus tôt et saisis les opérations depuis cette date.</p>';
    }
    const vals = hist.map(h => h.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const W = 1000, H = 220, pad = 12;
    const x = i => pad + i * (W - 2 * pad) / (hist.length - 1);
    const y = v => H - pad - (v - min) / (max - min) * (H - 2 * pad);
    const first = hist.findIndex(h => h.tracked > 0);
    const line = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.value).toFixed(1)}`).slice(first).join(' ');
    const area = `${x(first).toFixed(1)},${H - pad} ${line} ${x(hist.length - 1).toFixed(1)},${H - pad}`;
    const zero = min < 0 && max > 0 ? `<line x1="${pad}" x2="${W - pad}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero-line"/>` : '';
    const last = hist[hist.length - 1], start = hist[first];
    const diff = U.round2(last.value - start.value);
    return `
      <div class="history">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Évolution du patrimoine : de ${U.eur(start.value)} à ${U.eur(last.value)}">
          <polygon points="${area}" class="history-area"/>
          ${zero}
          <polyline points="${line}" class="history-line" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="history-labels">${hist.map(h => `<span title="${U.monthLabel(h.key)} : ${U.eur(h.value)}">${U.monthShort(h.key)}</span>`).join('')}</div>
      </div>
      <div class="summary-table compact">
        <div><span>${U.monthLabel(start.key)}</span>${U.money(start.value)}</div>
        <div><span>Aujourd’hui</span>${U.money(last.value)}</div>
        <div class="total"><span>Évolution</span>${U.money(diff, diff >= 0 ? 'positive' : 'negative')}</div>
      </div>`;
  }
};
