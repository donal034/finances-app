/**
 * Envoi du brief quotidien Mon Pilotage.
 * Exécuté par GitHub Actions (voir .github/workflows/notify.yml).
 *
 * Secrets attendus :
 *   FIREBASE_SERVICE_ACCOUNT  JSON du compte de service Firebase
 *   FIREBASE_DATABASE_URL     https://…firebasedatabase.app
 *   PILOTAGE_UID              identifiant de l'utilisateur (Paramètres → Compte)
 *   MAIL_TO, MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   (e-mail, facultatif)
 *   FREE_SMS_USER, FREE_SMS_PASS                                     (SMS Free, facultatif)
 *
 * Options : --dry-run affiche le message sans rien envoyer.
 */
const { brief, texte, sms } = require('./brief');

const DRY = process.argv.includes('--dry-run');

async function lireFirebase() {
  const admin = require('firebase-admin');
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(cred),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  const uid = process.env.PILOTAGE_UID;
  if (!uid) throw new Error('PILOTAGE_UID manquant');
  const snap = await admin.database().ref('users/' + uid).once('value');
  const data = snap.val();
  if (!data) throw new Error(`Aucune donnée sous users/${uid}`);
  return data;
}

async function envoyerMail(sujet, corps) {
  if (!process.env.SMTP_HOST || !process.env.MAIL_TO) return 'e-mail non configuré';
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    subject: sujet,
    text: corps,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.5">${
      corps.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`
  });
  return 'e-mail envoyé';
}

async function envoyerSms(message) {
  if (!process.env.FREE_SMS_USER || !process.env.FREE_SMS_PASS) return 'SMS non configuré';
  const url = 'https://smsapi.free-mobile.fr/sendmsg?user='
    + encodeURIComponent(process.env.FREE_SMS_USER)
    + '&pass=' + encodeURIComponent(process.env.FREE_SMS_PASS)
    + '&msg=' + encodeURIComponent(message);
  const res = await fetch(url);
  const codes = { 400: 'paramètre manquant', 402: 'trop de SMS envoyés', 403: 'service non activé ou identifiants faux', 500: 'erreur du serveur Free' };
  if (!res.ok) throw new Error(`SMS refusé (${res.status}) : ${codes[res.status] || 'inconnu'}`);
  return 'SMS envoyé';
}

(async () => {
  try {
    const data = await lireFirebase();
    const b = brief(data);
    const corps = texte(b);
    console.log(corps);

    if (DRY) { console.log('\n[--dry-run] rien n’a été envoyé'); return; }

    // Rien d'anormal et rien de prévu cette semaine : pas de message inutile
    if (!b.alertes.length && !b.semaine.length && new Date().getDay() !== 1) {
      console.log('\nAucune alerte : pas d’envoi aujourd’hui.');
      return;
    }
    console.log('\n' + await envoyerMail(`Pilotage — ${b.today}`, corps));
    if (b.alertes.length) console.log(await envoyerSms(sms(b)));
    else console.log('SMS non envoyé : aucune alerte');
  } catch (e) {
    console.error('Échec :', e.message);
    process.exit(1);
  }
})();
