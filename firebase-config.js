/* ==========================================
   NEXUS AI - CONFIGURACIÓN DE FIREBASE
   ========================================== */

// Importamos Firebase SDK desde CDN para uso en el navegador
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  setDoc, 
  query, 
  where,
  limit,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================================
// ⚠️ REEMPLAZA ESTE OBJETO CON TUS CREDENCIALES DE TU PROYECTO "bot nuevo"
// =========================================================================
// Instrucciones para obtener tus credenciales:
// 1. Ve a tu consola de Firebase (https://console.firebase.google.com/)
// 2. Selecciona tu proyecto "bot nuevo" (cuenta jicr1200@gmail.com).
// 3. En la pantalla de inicio del proyecto, haz clic en el icono "</>" (Web).
// 4. Escribe un alias para tu aplicación (ej. "nexus-pwa") y haz clic en "Registrar app".
// 5. Verás un código con un objeto "firebaseConfig". Copia los valores y pégalos aquí abajo:
const firebaseConfig = {
  apiKey: "AIzaSyCy11ISYlKFtDF21sgeMnDSJ6GvLC5IzUo",
  authDomain: "bot-nuevo-bdf67.firebaseapp.com",
  projectId: "bot-nuevo-bdf67",
  storageBucket: "bot-nuevo-bdf67.firebasestorage.app",
  messagingSenderId: "124378699288",
  appId: "1:124378699288:web:de728dc8b1f4c32aba156d",
  measurementId: "G-NQ6YR56BXE"
};
// =========================================================================

let app;
let db;
let isFirebaseEnabled = false;

// Comprobamos si se ha configurado la API Key real
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseEnabled = true;
    console.log("🔥 Firebase conectado con éxito! Realizando sincronización en tiempo real.");
  } catch (error) {
    console.error("❌ Error al inicializar Firebase:", error);
  }
} else {
  console.log("💡 Firebase no está configurado aún. Utilizando base de datos local de respaldo (localStorage).");
}

export { 
  db, 
  isFirebaseEnabled, 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  setDoc, 
  query, 
  where,
  limit,
  orderBy 
};
