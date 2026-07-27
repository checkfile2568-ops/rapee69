import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, onValue, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

(() => {
  "use strict";

  const config = window.DRAW_FIREBASE_CONFIG || {};
  const enabled = Boolean(config.apiKey && config.projectId && config.databaseURL);
  const rawPath = String(window.DRAW_FIREBASE_PATH || "rapee69/live-2569-07-31");
  const path = rawPath.replace(/^\/+|\/+$/g, "") || "rapee69/live-2569-07-31";
  let stateRef = null;
  let firstSnapshotReceived = false;
  let queuedState = enabled ? window.__DRAW_FIREBASE_PENDING_STATE || null : null;

  function emitStatus(online, error = "") {
    window.dispatchEvent(new CustomEvent("draw-firebase-status", { detail: { enabled, online, path, error } }));
  }

  function publishState(nextState) {
    if (!enabled || !stateRef) {
      if (enabled) queuedState = nextState;
      return;
    }
    set(stateRef, nextState)
      .then(() => emitStatus(true))
      .catch(error => emitStatus(false, error?.message || "เขียนข้อมูลไม่สำเร็จ"));
  }

  window.DrawFirebase = { enabled, path, publishState };

  if (!enabled) {
    emitStatus(false, "ยังไม่ได้กรอก Firebase config");
    return;
  }

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    stateRef = ref(getDatabase(app), path);
    onValue(stateRef, snapshot => {
      firstSnapshotReceived = true;
      emitStatus(true);
      const remoteState = snapshot.val();
      if (remoteState && typeof remoteState === "object") {
        window.dispatchEvent(new CustomEvent("draw-firebase-state", { detail: { state: remoteState } }));
      }
      if (queuedState) {
        const pending = queuedState;
        queuedState = null;
        publishState(pending);
      }
    }, error => emitStatus(false, error?.message || "อ่านข้อมูลไม่สำเร็จ"));
  } catch (error) {
    emitStatus(false, error?.message || "เริ่ม Firebase ไม่สำเร็จ");
  }

  // Kept for diagnostics and to make the one-state design explicit.
  window.DrawFirebase.firstSnapshotReceived = () => firstSnapshotReceived;
})();
