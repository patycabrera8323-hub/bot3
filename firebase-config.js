/* ==========================================
   NEXUS AI - FIREBASE CONFIGURATION
   Connects to Firebase Project 'mi-local-2ac9f'
   using database ID 'ai-studio-d3ccc3e7-3fa0-4dee-a0d6-338edf0f7c53'
   ========================================== */

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

const firebaseConfig = {
  apiKey: "AIzaSyDxR5T2FPw32-NhhcwRwXpANJDV1nYq2E0",
  authDomain: "mi-local-2ac9f.firebaseapp.com",
  projectId: "mi-local-2ac9f",
  storageBucket: "mi-local-2ac9f.firebasestorage.app",
  messagingSenderId: "760341600295",
  appId: "1:760341600295:web:d3d6406752fdfb6cf75602",
  firestoreDatabaseId: "ai-studio-d3ccc3e7-3fa0-4dee-a0d6-338edf0f7c53",
  measurementId: ""
};

let app;
let db;
let isFirebaseEnabled = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId); // Non-default database instance
  isFirebaseEnabled = true;
  console.log("🔥 Connected to Firebase Firestore database: " + firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("❌ Error initializing Firebase:", error);
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
