/**
 * Utilitaires partagés : formatage monétaire, dates, sécurité HTML.
 * Les dates sont manipulées en texte "AAAA-MM-JJ" pour éviter
 * les décalages de fuseau horaire de new Date("AAAA-MM-JJ").
 */
const U = {
  eur(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  },

  // Montant masquable par le mode discret
  money(n, cls = '') {
    return `<span class="money ${cls}">${U.eur(n)}</span>`;
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  },

  // Accepte "12,50", "12.50", "1 200,00"
  num(v) {
    const n = parseFloat(String(v ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  },

  isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  today() {
    return U.isoDate(new Date());
  },

  monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  monthShort(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  },

  addMonths(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  monthsBetween(fromKey, toKey) {
    const [y1, m1] = fromKey.split('-').map(Number);
    const [y2, m2] = toKey.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  },

  addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return U.isoDate(new Date(y, m - 1, d + n));
  },

  monthEnd(key) {
    return `${key}-${String(U.daysInMonth(key)).padStart(2, '0')}`;
  },

  weekday(s) {
    const [y, m, d] = s.split('-').map(Number);
    const w = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return w.charAt(0).toUpperCase() + w.slice(1);
  },

  daysInMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  },

  shortDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  },

  longDate(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  // Comparaison insensible à la casse et aux accents (règles de catégorisation)
  norm(s) {
    return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  },

  ICONS: {
    'Logement': '⌂', 'Alimentation': '🛒', 'Restaurants': '🍽', 'Transport': '🚆', 'Santé': '⚕',
    'Loisirs': '♪', 'Abonnements': '↻', 'Shopping': '🛍', 'Famille': '♥', 'Éducation': '✎',
    'Impôts': '§', 'Frais bancaires': '🏦', 'Voyage': '✈', 'Cadeaux': '🎁', 'Autre': '•',
    'Salaire': '↓', 'Prime': '★', 'Remboursement': '↺', 'Aide / Allocation': '◆',
    'Vente': '⇄', 'Intérêts': '%', 'Autre revenu': '+'
  },

  catIcon(cat) {
    return U.ICONS[cat] || '•';
  }
};
