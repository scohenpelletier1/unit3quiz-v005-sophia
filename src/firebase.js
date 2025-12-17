import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase configuration
// Get these values from Firebase Console -> Project Settings -> Your apps -> Web app
const firebaseConfig = {
  apiKey: "AIzaSyBoXAd4ZVguw_MbH6cEKC4YMSmpzdrMQ_I", // Replace with your API key
  authDomain: "unit3quiz-v005-sophia-2e94e.firebaseapp.com",
  projectId: "unit3quiz-v005-sophia-2e94e",
  storageBucket: "unit3quiz-v005-sophia-2e94e.firebasestorage.app",
  messagingSenderId: "438471473832", // Replace with your sender ID
  appId: "1:438471473832:web:ec09edee857ab9f28fa09d", // Replace with your app ID
  measurementId: "G-2NF07YCD1Z"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app

