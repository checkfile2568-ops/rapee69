(() => {
  "use strict";
  const url = String(window.DRAW_REMOTE_SYNC_URL || "").trim();
  const clientId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let started = false;
  function emit(name, detail){ window.dispatchEvent(new CustomEvent(name, { detail })); }
  async function post(payload){
    if(!url) return;
    try { await fetch(url, { method:"POST", mode:"no-cors", body:JSON.stringify(payload) }); }
    catch { emit("draw-remote-status", { online:false }); }
  }
  function poll(){
    if(!url) return;
    const callback = `rapee69Remote_${clientId.replaceAll("-", "_")}_${Date.now()}`;
    const script = document.createElement("script");
    const finish = (data, online) => {
      clearTimeout(timeout); script.remove(); delete window[callback];
      if(!online){ emit("draw-remote-status", { online:false }); return; }
      emit("draw-remote-status", { online:true, presence:data.presence || {} });
      if(data.state) emit("draw-remote-state", { state:data.state });
    };
    const timeout = setTimeout(() => finish(null, false), 6000);
    window[callback] = data => finish(data || {}, true);
    script.onerror = () => finish(null, false);
    script.src = `${url}${url.includes("?") ? "&" : "?"}action=state&callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
    document.head.append(script);
  }
  window.DrawRemote = {
    enabled: Boolean(url), clientId,
    publishState(state){ post({ action:"state", state }); },
    ping(role){ post({ action:"presence", role, clientId, at:Date.now() }); },
    start(role){ if(started || !url) return; started = true; this.ping(role); poll(); setInterval(() => { this.ping(role); poll(); }, 2000); }
  };
})();
