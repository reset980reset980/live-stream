
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, onValue, push, remove, update, onChildAdded, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// NOTE: The user should replace these with their own config from Firebase Console.
// For the demo/instruction, we assume valid environment or placeholder.
const firebaseConfig = {
  apiKey: "AIzaSyDummyKey",
  authDomain: "live-broadcast-dummy.firebaseapp.com",
  databaseURL: "https://live-broadcast-dummy-default-rtdb.firebaseio.com",
  projectId: "live-broadcast-dummy",
  storageBucket: "live-broadcast-dummy.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export const dbRefs = {
  room: (code: string) => ref(db, `rooms/${code}`),
  signals: (code: string) => ref(db, `rooms/${code}/signals`),
  viewers: (code: string) => ref(db, `rooms/${code}/viewers`),
  viewerSignal: (code: string, viewerId: string) => ref(db, `rooms/${code}/signals/${viewerId}`),
};
