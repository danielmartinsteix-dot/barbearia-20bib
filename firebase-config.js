import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoNIs9P0m59xy_w2ZKgMLVU-DmAbn2R94",
  authDomain: "barbearia-20bib.firebaseapp.com",
  projectId: "barbearia-20bib",
  storageBucket: "barbearia-20bib.firebasestorage.app",
  messagingSenderId: "337412190176",
  appId: "1:337412190176:web:b63dcf4cef7e1b62214585"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);