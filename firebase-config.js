/* ==========================================
   NEXUS AI - FIREBASE CONFIGURATION
   Connects to original Firebase Project 'bot-nuevo-bdf67'
   using default database instance
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
  apiKey: "AIzaSyCy11ISYlKFtDF21sgeMnDSJ6GvLC5IzUo",
  authDomain: "bot-nuevo-bdf67.firebaseapp.com",
  projectId: "bot-nuevo-bdf67",
  storageBucket: "bot-nuevo-bdf67.firebasestorage.app",
  messagingSenderId: "124378699288",
  appId: "1:124378699288:web:de728dc8b1f4c32aba156d",
  measurementId: "G-NQ6YR56BXE"
};

let app;
let db;
let isFirebaseEnabled = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app); // Connect to default database instance
  isFirebaseEnabled = true;
  console.log("🔥 Connected to Firebase Firestore (default) on project: " + firebaseConfig.projectId);
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
