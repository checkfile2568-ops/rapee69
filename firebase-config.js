/*
  Optional Firebase Realtime Database settings for mobile control.
  Leave the values empty to keep the original local / Apps Script behaviour.
  To enable phone-to-computer control, copy the values from Firebase Console
  into this file.  See FIREBASE_MOBILE_SETUP_TH.md for the short Thai guide.

  Firebase web configuration is not a password.  Protect the database with
  Firebase Rules and disable public access after the event.
*/
window.DRAW_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkyGSGKhsIqLffH0uODZdOVfXeLOORF-U",
  authDomain: "court-media-controller.firebaseapp.com",
  databaseURL: "https://court-media-controller-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "court-media-controller",
  storageBucket: "court-media-controller.firebasestorage.app",
  messagingSenderId: "827702442673",
  appId: "1:827702442673:web:71423a035b3d5e2edb4090"
};

// Use the same unique path on the phone, control computer, and display.
window.DRAW_FIREBASE_PATH = "rapee69/live-2569-07-31";

// Small bridge: an action made during the first second of page load is queued
// until firebase-sync.js has finished connecting. No action is lost.
if (window.DRAW_FIREBASE_CONFIG.apiKey && window.DRAW_FIREBASE_CONFIG.projectId && window.DRAW_FIREBASE_CONFIG.databaseURL) {
  window.DrawFirebase = window.DrawFirebase || {
    enabled: true,
    path: window.DRAW_FIREBASE_PATH,
    publishState(state) { window.__DRAW_FIREBASE_PENDING_STATE = state; }
  };
}
