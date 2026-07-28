(() => {
  "use strict";

  const A = window.DrawApp;
  let state = A.loadState();
  let firebaseStatus = { enabled: false, online: false, error: "" };
  let remoteOnline = false;
  const mobileRoom = String(new URLSearchParams(location.search).get("room") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  const hasQrSession = Boolean(mobileRoom);
  if(hasQrSession) window.DrawRemote?.configure?.({ room:mobileRoom });
  const stageNames = { intro: "หน้าต้อนรับ", format: "รูปแบบการแข่งขัน", draw: "กำลังจับฉลาก", official: "ผลการจับฉลาก", summary: "สรุป/ผังแข่งขัน", schedule: "ตารางแข่งขัน" };
  const els = {
    syncPill: document.getElementById("mobileSyncPill"),
    stageName: document.getElementById("mobileStageName"), progress: document.getElementById("mobileProgress"),
    currentPosition: document.getElementById("mobileCurrentPosition"), currentTeam: document.getElementById("mobileCurrentTeam"), currentStatus: document.getElementById("mobileCurrentStatus"),
    positions: document.getElementById("mobilePositionButtons"), teams: document.getElementById("mobileTeamButtons"),
    confirm: document.getElementById("mobileConfirmBtn"), clear: document.getElementById("mobileClearBtn"), undo: document.getElementById("mobileUndoBtn"), hint: document.getElementById("mobileHint")
  };

  const usedPositions = () => new Set(state.confirmed.map(item => item.position));
  const usedTeams = () => new Set(state.confirmed.map(item => Number(item.teamId)));
  const needsQrSession = () => Boolean(window.DrawRemote?.enabled && !window.DrawFirebase?.enabled);
  const canControl = () => !needsQrSession() || hasQrSession;

  function receive(nextState) {
    state = A.normalizeState(nextState);
    render();
  }

  function persist(action) {
    state.lastAction = action;
    state = A.saveState(state, "mobile-update");
    render();
  }

  function choosePosition(position) {
    if (!canControl() || state.locked || (usedPositions().has(position) && state.currentPosition !== position)) return;
    state.currentPosition = position;
    state.stage = "draw";
    persist(`มือถือเลือกตำแหน่ง ${position}`);
  }

  function chooseTeam(teamId) {
    const team = A.getTeam(teamId);
    if (!canControl() || !team || state.locked || (usedTeams().has(teamId) && Number(state.currentTeamId) !== teamId)) return;
    state.currentTeamId = teamId;
    state.stage = "draw";
    state.pendingRevealUntil = Date.now() + 2500;
    persist(`มือถือเปิดฉลากทีมหมายเลข ${teamId}`);
  }

  function renderSync() {
    const firebaseConfigured = Boolean(window.DrawFirebase?.enabled || firebaseStatus.enabled);
    if (firebaseConfigured) {
      els.syncPill.className = `mobile-sync ${firebaseStatus.online ? "online" : "offline"}`;
      els.syncPill.textContent = firebaseStatus.online ? "● Firebase Realtime API SDK ออนไลน์" : "● Firebase Realtime API SDK กำลังเชื่อมต่อ";
      els.hint.textContent = firebaseStatus.online ? "คำสั่งจากหน้านี้จะส่งไปยังคอมและจอนำเสนอทันที" : "ตรวจสอบอินเทอร์เน็ตและค่า Firebase หากสถานะไม่เปลี่ยนเป็นสีเขียว";
      return;
    }
    if (window.DrawRemote?.enabled) {
      els.syncPill.className = `mobile-sync ${remoteOnline ? "online" : "offline"}`;
      if(!hasQrSession){
        els.syncPill.textContent = "● โปรดสแกน QR จากคอม";
        els.hint.textContent = "เปิดหน้านี้จาก QR ที่หน้าควบคุม เพื่อเลือกห้องควบคุมที่ถูกต้อง";
      } else {
        els.syncPill.textContent = remoteOnline ? "● ซิงก์มือถือพร้อม" : "● Apps Script กำลังเชื่อมต่อ";
        els.hint.textContent = "จอดับแล้วปลุกหน้าจอ ระบบจะเชื่อมต่อ QR เดิมกลับมาเอง คอมยังควบคุมสำรองได้ตามปกติ";
      }
      return;
    }
    els.syncPill.className = "mobile-sync offline";
    els.syncPill.textContent = "● ยังไม่ได้ตั้งค่าซิงก์ข้ามเครื่อง";
    els.hint.textContent = "หน้านี้ใช้งานได้ในเครื่องเดียวกัน; หากใช้คนละเครื่องให้ตั้งค่า Firebase ตามคู่มือ";
  }

  function render() {
    const positions = usedPositions();
    const teams = usedTeams();
    const currentTeam = A.getTeam(state.currentTeamId);
    const locked = state.locked;
    const unavailable = !canControl();

    els.stageName.textContent = stageNames[state.stage] || stageNames.intro;
    els.progress.textContent = `${state.confirmed.length} / 7`;
    document.querySelectorAll("[data-stage]").forEach(button => button.classList.toggle("active", button.dataset.stage === state.stage));

    els.currentPosition.textContent = state.currentPosition || "—";
    els.currentTeam.textContent = currentTeam ? `${currentTeam.id}. ${currentTeam.name}` : "เลือกผลจากโถจริง";
    els.currentStatus.textContent = unavailable ? "โปรดสแกน QR จากหน้าควบคุมก่อนเริ่มใช้งาน" : locked ? "ผลถูกล็อกอยู่ — ให้ใช้คอมพิวเตอร์เมื่อต้องปลดล็อก" : currentTeam && state.currentPosition ? "ตรวจสอบแล้วกดยืนยันผล" : state.currentPosition ? "เลือกหมายเลขทีมจากโถที่ 2" : "เริ่มจากเลือกตำแหน่ง A1–B4";

    els.positions.innerHTML = A.POSITIONS.map(position => {
      const selected = state.currentPosition === position;
      const used = positions.has(position) && !selected;
      return `<button class="mobile-choice ${position.startsWith("A") ? "a" : "b"} ${selected ? "selected" : ""}" data-position="${position}" ${locked || unavailable || used ? "disabled" : ""}>${position}<small>${used ? "ใช้แล้ว" : selected ? "เลือกแล้ว" : ""}</small></button>`;
    }).join("");

    els.teams.innerHTML = A.TEAMS.map(team => {
      const selected = Number(state.currentTeamId) === team.id;
      const used = teams.has(team.id) && !selected;
      return `<button class="mobile-team-choice ${selected ? "selected" : ""}" data-team-id="${team.id}" ${locked || unavailable || used ? "disabled" : ""}><b>${team.id}</b><span>${A.escapeHtml(team.name)}</span><small>${used ? "ใช้แล้ว" : selected ? "เลือกแล้ว" : ""}</small></button>`;
    }).join("");

    els.confirm.disabled = unavailable || locked || !state.currentPosition || !currentTeam;
    els.clear.disabled = unavailable || locked || (!state.currentPosition && !currentTeam);
    els.undo.disabled = unavailable || locked || !state.confirmed.length;
    renderSync();
  }

  document.querySelectorAll("[data-stage]").forEach(button => button.addEventListener("click", () => {
    if(!canControl()) return;
    state.stage = button.dataset.stage;
    persist(`มือถือเปลี่ยนหน้าจอเป็น ${stageNames[state.stage]}`);
  }));

  els.positions.addEventListener("click", event => {
    const button = event.target.closest("[data-position]");
    if (button) choosePosition(button.dataset.position);
  });

  els.teams.addEventListener("click", event => {
    const button = event.target.closest("[data-team-id]");
    if (button) chooseTeam(Number(button.dataset.teamId));
  });

  els.confirm.addEventListener("click", () => {
    const team = A.getTeam(state.currentTeamId);
    if (!canControl() || !state.currentPosition || !team || state.locked) return;
    if (usedPositions().has(state.currentPosition) || usedTeams().has(team.id)) return alert("ตำแหน่งหรือทีมนี้ถูกใช้แล้ว");
    if (!confirm(`ยืนยันผล\n${state.currentPosition} — ${team.name}`)) return;
    state.confirmed.push({ position: state.currentPosition, teamId: team.id, confirmedAt: new Date().toISOString() });
    const result = `${state.currentPosition} — ${team.name}`;
    state.currentPosition = "";
    state.currentTeamId = null;
    state.pendingRevealUntil = 0;
    state.stage = state.confirmed.length === 7 ? "official" : "draw";
    persist(`มือถือยืนยันผล ${result}`);
  });

  els.clear.addEventListener("click", () => {
    if (!canControl() || state.locked || (!state.currentPosition && !state.currentTeamId)) return;
    if (!confirm("ล้างผลคู่ปัจจุบันใช่หรือไม่")) return;
    state.currentPosition = "";
    state.currentTeamId = null;
    state.pendingRevealUntil = 0;
    persist("มือถือ ล้างผลคู่ปัจจุบัน");
  });

  els.undo.addEventListener("click", () => {
    const last = state.confirmed.at(-1);
    const team = last && A.getTeam(last.teamId);
    if (!canControl() || !last || state.locked) return;
    if (!confirm(`ย้อนกลับผลล่าสุด\n${last.position} — ${team?.name || ""}`)) return;
    state.confirmed.pop();
    state.currentPosition = last.position;
    state.currentTeamId = last.teamId;
    state.pendingRevealUntil = 0;
    state.stage = "draw";
    persist("มือถือ ย้อนกลับผลล่าสุด");
  });

  window.drawChannel?.addEventListener("message", event => { if (event.data?.state) receive(event.data.state); });
  window.addEventListener("storage", event => { if (event.key === A.STORAGE_KEY) receive(A.loadState()); });
  window.addEventListener("draw-remote-state", event => {
    if(event.detail.room && window.DrawRemote?.room && event.detail.room !== window.DrawRemote.room) return;
    receive(event.detail.state);
  });
  window.addEventListener("draw-firebase-state", event => receive(event.detail.state));
  window.addEventListener("draw-firebase-status", event => { firebaseStatus = event.detail || firebaseStatus; renderSync(); });
  window.addEventListener("draw-remote-status", event => { remoteOnline = Boolean(event.detail?.online); renderSync(); });
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden && hasQrSession) window.DrawRemote?.ping?.("mobile");
  });
  window.addEventListener("online", () => { if(hasQrSession) window.DrawRemote?.ping?.("mobile"); });
  if(!needsQrSession() || hasQrSession) window.DrawRemote?.start?.("mobile");
  render();
})();
