/**
 * Configuration Firebase.
 * Si la connexion échoue avec "api-key-not-valid", recopie ce bloc depuis
 * Firebase > Paramètres du projet > Vos applications > Configuration.
 *
 * Ces valeurs ne sont pas des secrets : elles identifient le projet.
 * La protection des données repose sur l'authentification et les règles
 * de sécurité de la base (voir database.rules.json).
 */
const firebaseConfig = {
  apiKey: "AIzaSyCsLwMERfjlyp8JMmzwPL3gCj5s6h_8vU0",
  authDomain: "finances-app-d11be.firebaseapp.com",
  databaseURL: "https://finances-app-d11be-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "finances-app-d11be",
  storageBucket: "finances-app-d11be.firebasestorage.app",
  messagingSenderId: "375981231022",
  appId: "1:375981231022:web:66be958873102d56afd63f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
