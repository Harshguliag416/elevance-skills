// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzFKjni5GJAF30SS90owCSLdyChpug5X4",
  authDomain: "elevanceskills-f8ff6.firebaseapp.com",
  projectId: "elevanceskills-f8ff6",
  storageBucket: "elevanceskills-f8ff6.firebasestorage.app",
  messagingSenderId: "372147647895",
  appId: "1:372147647895:web:ed3945de001d92fcc740d2",
  measurementId: "G-LL39K3H89K",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export { auth, provider };
