import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbUY7FeEHmfb_3ZEk8ud4B9FQ140Ok4uc",
  authDomain: "evanato-task-manager.firebaseapp.com",
  projectId: "evanato-task-manager",
  storageBucket: "evanato-task-manager.firebasestorage.app",
  messagingSenderId: "789321018449",
  appId: "1:789321018449:web:1f5fbb142a6c87f8471c70"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
