/**
 * Paramètres : budget, catégories, sauvegarde, compte.
 */
const Settings = {
  render(el) {
    const s = Store.data.settings;
    const u = Store.user || {};
    el.innerHTML = `
      ${App.header('Configuration', 'Paramètres')}
      <div class="cards-grid wide">
        <div class="card">
          <h2>Budget mensuel</h2>
          <p class="muted small">Plafond de dépenses utilisé par le tableau de bord et les alertes.</p>
          <div class="field"><label for="setBudget">Montant (€)</label>
            <input id="setBudget" inputmode="decimal" value="${String(s.monthlyBudget).replace('.', ',')}"></div>
          <button class="btn primary" id="saveBudget">Enregistrer le budget</button>
        </div>

        <div class="card">
          <h2>Catégories</h2>
          <p class="muted small">Une catégorie par ligne. Les opérations existantes gardent leur catégorie.</p>
          <div class="field"><label for="setCatExp">Dépenses</label>
            <textarea id="setCatExp" rows="7">${U.esc(s.categories.expense.join('\n'))}</textarea></div>
          <div class="field"><label for="setCatInc">Revenus</label>
            <textarea id="setCatInc" rows="4">${U.esc(s.categories.income.join('\n'))}</textarea></div>
          <button class="btn primary" id="saveCats">Enregistrer les catégories</button>
        </div>

        <div class="card">
          <h2>Sauvegarde</h2>
          <p class="muted small">Télécharge une copie complète de tes données, ou restaure une sauvegarde.</p>
          <div class="stack">
            <button class="btn" id="exportJson">Télécharger une sauvegarde (JSON)</button>
            <button class="btn" id="exportCsv">Exporter les opérations (CSV pour Excel)</button>
            <label class="btn file-btn">Restaurer une sauvegarde<input type="file" id="importJson" accept="application/json,.json" hidden></label>
          </div>
        </div>

        <div class="card">
          <h2>Compte</h2>
          <p class="small">Connecté en tant que <strong>${U.esc(u.email || '')}</strong></p>
          <p class="muted small">Identifiant : <code>${U.esc(u.uid || '')}</code></p>
          <div class="stack">
            <button class="btn" data-cmd="privacy">Activer / désactiver le mode discret</button>
            <button class="btn" data-cmd="logout">Se déconnecter</button>
            <button class="btn danger" id="wipeAll">Supprimer toutes mes données</button>
          </div>
        </div>
      </div>`;

    el.querySelector('#saveBudget').addEventListener('click', () => this.saveBudget());
    el.querySelector('#saveCats').addEventListener('click', () => this.saveCategories());
    el.querySelector('#exportJson').addEventListener('click', () => this.exportJson());
    el.querySelector('#exportCsv').addEventListener('click', () => this.exportCsv());
    el.querySelector('#importJson').addEventListener('change', e => this.importJson(e.target));
    el.querySelector('#wipeAll').addEventListener('click', () => this.wipe());
  },

  saveBudget() {
    const v = U.num(document.getElementById('setBudget').value);
    if (!(v >= 0)) return App.toast('Budget invalide', 'error');
    Store.saveSettings({ ...Store.data.settings, monthlyBudget: U.round2(v) }).catch(e => App.fail(e));
    App.toast('Budget enregistré');
  },

  parseList(id) {
    return [...new Set(document.getElementById(id).value.split('\n').map(x => x.trim()).filter(Boolean))];
  },

  saveCategories() {
    const expense = this.parseList('setCatExp');
    const income = this.parseList('setCatInc');
    if (!expense.length || !income.length) return App.toast('Garde au moins une catégorie de chaque type', 'error');
    Store.saveSettings({ ...Store.data.settings, categories: { expense, income } }).catch(e => App.fail(e));
    App.toast('Catégories enregistrées');
  },

  download(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  exportJson() {
    this.download(JSON.stringify(Store.exportAll(), null, 2), `mon-pilotage-${U.today()}.json`, 'application/json');
    App.toast('Sauvegarde téléchargée');
  },

  exportCsv() {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const types = { income: 'Revenu', expense: 'Dépense', transfer: 'Virement' };
    const lines = [['Date', 'Type', 'Libellé', 'Montant', 'Catégorie', 'Compte', 'Vers le compte', 'Note'].map(q).join(';')];
    Store.transactions().forEach(t => {
      const acc = Store.get('accounts', t.accountId);
      const to = Store.get('accounts', t.toAccountId);
      lines.push([t.date, types[t.type] || t.type, t.label, String(t.amount).replace('.', ','), t.category,
        acc ? acc.name : '', to ? to.name : '', t.note].map(q).join(';'));
    });
    // BOM pour qu'Excel lise correctement les accents
    this.download('\ufeff' + lines.join('\r\n'), `operations-${U.today()}.csv`, 'text/csv;charset=utf-8');
    App.toast('Export CSV téléchargé');
  },

  importJson(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(reader.result); } catch (e) { return App.toast('Fichier illisible : ce n’est pas un JSON valide', 'error'); }
      const known = Store.COLLECTIONS.some(c => obj && obj[c]);
      if (!known) return App.toast('Ce fichier ne contient pas de données Mon Pilotage', 'error');
      if (!confirm('Restaurer cette sauvegarde ? Toutes tes données actuelles seront remplacées.')) return;
      Store.importAll(obj).then(() => App.toast('Sauvegarde restaurée')).catch(e => App.fail(e));
    };
    reader.readAsText(file);
  },

  wipe() {
    const answer = prompt('Cette action efface définitivement toutes tes données.\nTape SUPPRIMER pour confirmer.');
    if (answer !== 'SUPPRIMER') return App.toast('Suppression annulée');
    Store.wipeAll().catch(e => App.fail(e));
    App.toast('Toutes les données ont été supprimées');
  }
};
