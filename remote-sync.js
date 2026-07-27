(() => {
  "use strict";

  // Firebase remains optional. When it is configured, it stays the only cloud
  // transport so the two services never compete over one draw state.
  const firebaseConfig = window.DRAW_FIREBASE_CONFIG || {};
  const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.databaseURL);
  let remoteUrl = firebaseEnabled ? "" : String(window.DRAW_REMOTE_SYNC_URL || "").trim();
  const clientId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let started = false;
  let startedRole = "";
  let timer = 0;

  function cleanRoom(value) {
    const room = String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
    return room || "default";
  }
  function roomFromUrl() {
    try { return cleanRoom(new URLSearchParams(location.search).get("room") || "default"); }
    catch { return "default"; }
  }
  let activeRoom = roomFromUrl();
  function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
  function makeUrl(action, callback, room = activeRoom) {
    const url = new URL(remoteUrl);
    url.searchParams.set("action", action);
    url.searchParams.set("room", room);
    url.searchParams.set("t", Date.now());
    if (callback) url.searchParams.set("callback", callback);
    return url.toString();
  }
  async function post(payload) {
    if (!remoteUrl) return;
    const room = activeRoom;
    try {
      await fetch(remoteUrl, { method: "POST", mode: "no-cors", body: JSON.stringify({ ...payload, room }) });
    } catch {
      emit("draw-remote-status", { online: false, room });
    }
  }
  function poll() {
    if (!remoteUrl) return;
    const room = activeRoom;
    const callback = `rapee69Remote_${clientId.replaceAll("-", "_")}_${Date.now()}`;
    const script = document.createElement("script");
    const finish = (data, online) => {
      clearTimeout(timeout);
      script.remove();
      delete window[callback];
      if (!online) { emit("draw-remote-status", { online: false, room }); return; }
      emit("draw-remote-status", { online: true, room, presence: data.presence || {} });
      if (data.state) emit("draw-remote-state", { room, state: data.state });
    };
    const timeout = setTimeout(() => finish(null, false), 6000);
    window[callback] = data => finish(data || {}, true);
    script.onerror = () => finish(null, false);
    script.src = makeUrl("state", callback, room);
    document.head.append(script);
  }
  function beginPolling() {
    if (timer || !remoteUrl) return;
    poll();
    timer = setInterval(() => { if (startedRole) { api.ping(startedRole); poll(); } }, 2000);
  }
  const api = {
    get enabled() { return Boolean(remoteUrl); },
    get room() { return activeRoom; },
    configure(options = {}) {
      if (options.url != null) remoteUrl = String(options.url).trim();
      if (options.room != null) activeRoom = cleanRoom(options.room);
      if (started && remoteUrl) { this.ping(startedRole); poll(); beginPolling(); }
      emit("draw-remote-config", { enabled: Boolean(remoteUrl), room: activeRoom });
      return { enabled: Boolean(remoteUrl), room: activeRoom };
    },
    publishState(state) { post({ action: "state", state }); },
    ping(role) { post({ action: "presence", role, clientId, at: Date.now() }); },
    start(role) {
      startedRole = role || startedRole;
      started = true;
      if (!remoteUrl) return;
      this.ping(startedRole);
      beginPolling();
    }
  };
  window.DrawRemote = api;
})();
