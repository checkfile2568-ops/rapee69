/*
  Example only — copy this content into firebase-config.js, then fill in the
  values displayed in Firebase Console > Project settings > Your apps > Web app.
*/
window.DRAW_FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE"
};

// Change this to an event-specific value and use exactly the same value on every device.
window.DRAW_FIREBASE_PATH = "rapee69/live-2569-07-31";

if (window.DRAW_FIREBASE_CONFIG.apiKey && window.DRAW_FIREBASE_CONFIG.projectId && window.DRAW_FIREBASE_CONFIG.databaseURL) {
  window.DrawFirebase = window.DrawFirebase || {
    enabled: true,
    path: window.DRAW_FIREBASE_PATH,
    publishState(state) { window.__DRAW_FIREBASE_PENDING_STATE = state; }
  };
}
