/**
 * Firebase Initialization
 * Configure Firebase avec ta clé API
 */

// Ta configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCSLwMERfjyp8JMmzwPL3gCj5s6h_8vU0",
  authDomain: "finances-app-d11be.firebaseapp.com",
  databaseURL: "https://finances-app-d11be-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "finances-app-d11be",
  storageBucket: "finances-app-d11be.appspot.com",
  messagingSenderId: "375981231022",
  appId: "1:375981231022:web:66be958873102d56afd63f"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);

// Référence à la base de données
const database = firebase.database();

// Test de connexion
database.ref('.info/connected').on('value', (snapshot) => {
  if (snapshot.val() === true) {
    console.log('✅ Connecté à Firebase');
  } else {
    console.log('❌ Déconnecté de Firebase');
  }
});
