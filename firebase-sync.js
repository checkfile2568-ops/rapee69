import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, goOnline, onDisconnect, onValue, ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

(() => {
  "use strict";

  const config = window.DRAW_FIREBASE_CONFIG || {};
  const enabled = Boolean(config.apiKey && config.projectId && config.databaseURL);
  const rawPath = String(window.DRAW_FIREBASE_PATH || "rapee69/live-2569-07-31");
  const path = rawPath.replace(/^\/+|\/+$/g, "") || "rapee69/live-2569-07-31";
  const clientId = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replaceAll("-", "");
  let database = null, stateRef = null, presenceRef = null;
  let firstSnapshotReceived = false, connected = false, readable = false, lastError = "";
  let pendingWrite = enabled ? window.__DRAW_FIREBASE_PENDING_STATE || null : null;
  let writeInFlight = false, presenceRole = "", presenceTimer = 0;

  function emitStatus(error = lastError) {
    const online = Boolean(enabled && connected && readable && !error);
    window.dispatchEvent(new CustomEvent("draw-firebase-status", { detail: { enabled, online, path, error } }));
  }
  function fail(error) { lastError = error?.message || String(error || "เชื่อมต่อ Firebase ไม่สำเร็จ"); emitStatus(); }

  function flushWrite() {
    if (!enabled || !stateRef || !connected || writeInFlight || !pendingWrite) return;
    const nextState = pendingWrite;
    pendingWrite = null;
    writeInFlight = true;
    set(stateRef, nextState)
      .then(() => { lastError = ""; emitStatus(); })
      .catch(error => { pendingWrite = nextState; fail(error); })
      .finally(() => {
        writeInFlight = false;
        if (pendingWrite && !lastError) flushWrite();
      });
  }

  function publishState(nextState) {
    if (!enabled) return;
    pendingWrite = nextState;
    flushWrite();
  }

  function publishPresence(role = presenceRole) {
    if (!enabled || !presenceRef || !role) return;
    presenceRole = role;
    set(presenceRef, { role, at: Date.now() }).catch(() => {});
  }

  function startPresence(role) {
    presenceRole = role || presenceRole;
    publishPresence();
    if (!presenceTimer && presenceRole) presenceTimer = setInterval(() => publishPresence(), 8000);
  }

  function reconnect() {
    if (database) goOnline(database);
    flushWrite();
    publishPresence();
  }

  window.DrawFirebase = { enabled, path, publishState, publishPresence, startPresence, reconnect, isOnline: () => Boolean(connected && readable && !lastError) };

  if (!enabled) {
    emitStatus("ยังไม่ได้กรอก Firebase config");
    return;
  }

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    database = getDatabase(app);
    stateRef = ref(database, path);
    presenceRef = ref(database, `${path}-presence/${clientId}`);
    onDisconnect(presenceRef).remove().catch(() => {});

    onValue(ref(database, ".info/connected"), snapshot => {
      connected = snapshot.val() === true;
      if (connected) flushWrite();
      emitStatus();
    });
    onValue(stateRef, snapshot => {
      firstSnapshotReceived = true;
      readable = true;
      lastError = "";
      emitStatus();
      const remoteState = snapshot.val();
      if (remoteState && typeof remoteState === "object") {
        window.dispatchEvent(new CustomEvent("draw-firebase-state", { detail: { state: remoteState } }));
      }
      flushWrite();
    }, error => { readable = false; fail(error); });
    onValue(ref(database, `${path}-presence`), snapshot => {
      const presence = snapshot.val() || {};
      window.dispatchEvent(new CustomEvent("draw-firebase-presence", { detail: { presence } }));
    });
  } catch (error) {
    fail(error);
  }

  window.DrawFirebase.firstSnapshotReceived = () => firstSnapshotReceived;
})();
