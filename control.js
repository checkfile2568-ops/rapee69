(() => {
  "use strict";
  const A = window.DrawApp;
  let state = A.loadState();
  let lastDisplayPing = 0;
  let lastMobilePing = 0;
  let drawFocusTimer = 0;
  let highlightTimer = 0;
  let remoteOnline = false;
  let firebaseStatus = { enabled: Boolean(window.DrawFirebase?.enabled), online: false, error: "" };
  const MOBILE_SESSION_STORAGE_KEY = "rapee69_mobile_session_v16";
  let qrLinkRendered = "";
  function cleanRoom(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64); }
  function loadMobileSession(){
    try {
      const saved = JSON.parse(localStorage.getItem(MOBILE_SESSION_STORAGE_KEY) || "null");
      return saved && cleanRoom(saved.room) ? { room:cleanRoom(saved.room), createdAt:Number(saved.createdAt) || Date.now() } : null;
    } catch { return null; }
  }
  function createRoom(){
    const date = new Date().toISOString().slice(2,10).replaceAll("-", "");
    const random = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replaceAll("-", "").slice(0, 6);
    return `r69-${date}-${random}`;
  }
  let mobileSession = loadMobileSession();
  if(mobileSession) window.DrawRemote?.configure?.({ room:mobileSession.room });
  const controlClock = document.getElementById("controlClock");
  const els = {
    openDisplayBtn:document.getElementById("openDisplayBtn"), positionSelect:document.getElementById("positionSelect"), teamSelect:document.getElementById("teamSelect"),
    confirmBtn:document.getElementById("confirmBtn"), clearCurrentBtn:document.getElementById("clearCurrentBtn"),
    undoBtn:document.getElementById("undoBtn"), lockBtn:document.getElementById("lockBtn"), modeBtn:document.getElementById("modeBtn"), rehearsalRandomBtn:document.getElementById("rehearsalRandomBtn"),
    currentRound:document.getElementById("currentRound"), currentPosition:document.getElementById("currentPosition"), currentTeam:document.getElementById("currentTeam"), currentStatus:document.getElementById("currentStatus"), groupASlots:document.getElementById("groupASlots"),
    groupBSlots:document.getElementById("groupBSlots"), historyList:document.getElementById("historyList"), scheduleBody:document.getElementById("scheduleBody"), progressPill:document.getElementById("progressPill"),
    modePill:document.getElementById("modePill"), connectionPill:document.getElementById("connectionPill"), readinessList:document.getElementById("readinessList"), stateTime:document.getElementById("stateTime"), firebaseStatus:document.getElementById("controlFirebaseStatus"),
    lockedAlert:document.getElementById("lockedAlert"), copySummaryBtn:document.getElementById("copySummaryBtn"), downloadJsonBtn:document.getElementById("downloadJsonBtn"), printBtn:document.getElementById("printBtn"),
    captureBtn:document.getElementById("captureBtn"), captureStageSelect:document.getElementById("captureStageSelect"), resetBtn:document.getElementById("resetBtn"),
    startMobileSessionBtn:document.getElementById("startMobileSessionBtn"), renewMobileSessionBtn:document.getElementById("renewMobileSessionBtn"), copyMobileLinkBtn:document.getElementById("copyMobileLinkBtn"),
    mobileSessionPill:document.getElementById("mobileSessionPill"), mobileSessionCode:document.getElementById("mobileSessionCode"), mobileSessionStatus:document.getElementById("mobileSessionStatus"), mobileSessionNote:document.getElementById("mobileSessionNote"), mobileQrCanvas:document.getElementById("mobileQrCanvas")
  };
  const usedPositions = () => new Set(state.confirmed.map(item => item.position));
  const usedTeams = () => new Set(state.confirmed.map(item => Number(item.teamId)));
  const cloudSyncEnabled = () => Boolean(window.DrawFirebase?.enabled || window.DrawRemote?.enabled);
  const firebaseOnlineLabel = "Firebase Realtime API SDK Online";
  const animatedOnlineLabel = () => [...firebaseOnlineLabel].map((char, index) => `<span style="--letter:${index}">${char === " " ? "&nbsp;" : char}</span>`).join("");
  function updateControlClock(){
    if(!controlClock) return;
    const now = new Date();
    const date = new Intl.DateTimeFormat("th-TH", { day:"numeric", month:"long", year:"numeric" }).format(now);
    const time = new Intl.DateTimeFormat("th-TH", { hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
    controlClock.textContent = `${date} · เวลา ${time} น.`;
  }
  const displayConnected = () => Date.now() - lastDisplayPing < 5500;
  function persist(action){ state.lastAction = action; state = A.saveState(state, "update"); render(); }
  function receive(next){ state = A.normalizeState(next); render(); }
  function renderSelects(){
    const positions = usedPositions(), teams = usedTeams(), currentP = state.currentPosition || "", currentT = Number(state.currentTeamId) || null;
    els.positionSelect.innerHTML = `<option value="">— เลือก A1 ถึง B4 —</option>` + A.POSITIONS.filter(p => !positions.has(p) || p === currentP).map(p => `<option value="${p}" ${p === currentP ? "selected" : ""}>${p}</option>`).join("");
    els.teamSelect.innerHTML = `<option value="">— เลือกทีมหมายเลข 1 ถึง 7 —</option>` + A.TEAMS.filter(t => !teams.has(t.id) || t.id === currentT).map(t => `<option value="${t.id}" ${t.id === currentT ? "selected" : ""}>${t.id}. ${A.escapeHtml(t.name)}</option>`).join("");
  }
  function renderCurrent(){
    const team = A.getTeam(state.currentTeamId);
    const roundText = `ครั้งที่ ${Math.min(state.confirmed.length + 1, 7)} จาก 7`;
    els.currentRound.textContent = roundText;
    els.currentPosition.textContent = state.currentPosition || "—";
    els.currentTeam.textContent = team ? `${team.id}. ${team.name}` : "รอจับฉลาก";
    els.currentStatus.textContent = state.currentPosition && team ? "พร้อมยืนยันผลลงตาราง" : state.currentPosition ? "จับโถที่ 2 และเลือกหมายเลขทีม" : "จับโถที่ 1 และเลือกตำแหน่งการแข่งขัน";
    const highlighted = Boolean(team && state.pendingRevealUntil > Date.now());
    els.currentTeam.closest(".current-pair")?.classList.toggle("is-highlighted", highlighted);
  }
  function renderHistory(){
    els.historyList.innerHTML = state.confirmed.length ? state.confirmed.map((item, index) => {
      const team = A.getTeam(item.teamId);
      return `<div class="history-item"><div class="history-num">${index + 1}</div><div class="history-code">${item.position}</div><div><strong>${A.escapeHtml(team?.name || "ไม่พบชื่อทีม")}</strong></div><div class="history-time">${A.formatThaiTime(item.confirmedAt)}</div></div>`;
    }).join("") : `<div class="placeholder">ยังไม่มีผลที่ยืนยัน</div>`;
  }
  function renderConnection(){
    const connected = displayConnected();
    els.connectionPill.textContent = connected ? "● จอนำเสนอเชื่อมต่อแล้ว" : "● ไม่พบจอนำเสนอ";
    els.connectionPill.className = `pill ${connected ? "ok" : "offline"}`;
    els.connectionPill.title = window.DrawFirebase?.enabled ? "ซิงก์ผ่าน Firebase Realtime Database" : (window.DrawRemote?.enabled ? (remoteOnline ? "ตรวจผ่านการซิงก์ข้ามเครื่อง" : "กำลังเชื่อมต่อบริการซิงก์") : "ตรวจจากจอที่เปิดในเบราว์เซอร์/เครื่องเดียวกัน");
  }
  function renderReadiness(){
    const checks = [
      [state.mode === "live", "อยู่โหมดถ่ายทอดสด"],
      [state.confirmed.length === 0 || state.mode === "live", "ไม่มีผลจากโหมดซ้อมค้างอยู่"],
      [!state.locked, "ไม่ได้ล็อกอยู่"],
      [displayConnected(), "เปิดจอนำเสนอแล้ว"]
    ];
    els.readinessList.innerHTML = checks.map(([ok, label]) => `<li class="${ok ? "ready" : "not-ready"}">${ok ? "✓" : "!"} ${label}</li>`).join("");
  }
  function mobileLink(){
    if(!mobileSession) return "";
    const url = new URL("mobile-control.html", location.href);
    url.searchParams.set("room", mobileSession.room);
    return url.toString();
  }
  function displayLink(){
    const url = new URL("display.html", location.href);
    url.searchParams.set("v", "1.7.8");
    if(mobileSession) url.searchParams.set("room", mobileSession.room);
    return url.toString();
  }
  function drawQr(link){
    if(!els.mobileQrCanvas || link === qrLinkRendered) return;
    qrLinkRendered = link;
    els.mobileQrCanvas.replaceChildren();
    if(!link) return;
    if(typeof window.QRCode === "function"){
      const options = { text:link, width:180, height:180, colorDark:"#071a3f", colorLight:"#ffffff" };
      if(window.QRCode.CorrectLevel) options.correctLevel = window.QRCode.CorrectLevel.M;
      new window.QRCode(els.mobileQrCanvas, options);
    } else {
      const error = document.createElement("span");
      error.className = "qr-load-error";
      error.textContent = "โหลด QR ไม่สำเร็จ";
      els.mobileQrCanvas.append(error);
    }
  }
  function renderFirebaseStatus(){
    if(!els.firebaseStatus) return;
    const configured = Boolean(window.DrawFirebase?.enabled || firebaseStatus.enabled);
    els.firebaseStatus.className = `firebase-status ${firebaseStatus.online ? "online typing-online" : configured ? "checking" : "offline"}`;
    els.firebaseStatus.innerHTML = firebaseStatus.online ? animatedOnlineLabel() : configured ? "● Firebase Realtime API SDK กำลังเชื่อมต่อ" : "● Firebase Realtime API SDK ไม่ได้ตั้งค่า";
    els.firebaseStatus.title = firebaseStatus.error || "";
  }
  function mobileAge(){ return lastMobilePing ? Math.max(0, Math.round((Date.now() - lastMobilePing) / 1000)) : null; }
  function renderMobileSession(){
    const ready = cloudSyncEnabled();
    const link = mobileLink();
    els.mobileSessionCode.textContent = mobileSession?.room || "ยังไม่ได้เริ่มรอบ";
    els.copyMobileLinkBtn.disabled = !link;
    els.renewMobileSessionBtn.disabled = !ready;
    if(!ready){
      els.mobileSessionPill.className = "pill offline"; els.mobileSessionPill.textContent = "ต้องตั้งค่า Firebase หรือ Apps Script";
      els.mobileSessionStatus.textContent = "ยังไม่พร้อมเชื่อมข้ามเครือข่าย";
      els.mobileSessionNote.innerHTML = "ตั้งค่า Firebase ใน <code>firebase-config.js</code> หรือใส่ URL ที่ลงท้ายด้วย <code>/exec</code> ใน <code>sync-config.js</code> ก่อน แล้วรีเฟรชหน้านี้";
      drawQr("");
      return;
    }
    if(!mobileSession){
      els.mobileSessionPill.className = "pill offline"; els.mobileSessionPill.textContent = "พร้อมสร้าง QR";
      els.mobileSessionStatus.textContent = "กดเริ่มเพื่อสร้าง QR สำหรับรอบนี้";
      els.mobileSessionNote.textContent = "ระบบจะจำรหัสรอบในคอมเครื่องนี้ และใช้ QR เดิมจนกว่าจะกดสร้างรอบใหม่";
      drawQr("");
      return;
    }
    const age = mobileAge();
    if(age !== null && age < 20){
      els.mobileSessionPill.className = "pill ok"; els.mobileSessionPill.textContent = "● มือถือเชื่อมต่อแล้ว";
      els.mobileSessionStatus.textContent = "มือถือพร้อมควบคุม";
      els.mobileSessionNote.textContent = "หากจอดับ ระบบจะกลับมาเชื่อมต่อเองเมื่อปลุกหน้าจอ โดยไม่ต้องสร้าง QR ใหม่";
    } else if(age !== null && age < 180){
      els.mobileSessionPill.className = "pill offline"; els.mobileSessionPill.textContent = "● มือถือพักหน้าจอ";
      els.mobileSessionStatus.textContent = `ไม่พบสัญญาณ ${age} วินาที — QR เดิมยังใช้ได้`;
      els.mobileSessionNote.textContent = "ปลุกหน้าจอหรือกลับมาที่แท็บเดิม ระบบจะเชื่อมต่ออีกครั้งอัตโนมัติ";
    } else {
      els.mobileSessionPill.className = "pill offline"; els.mobileSessionPill.textContent = "● QR พร้อมให้สแกน";
      els.mobileSessionStatus.textContent = age === null ? "รอมือถือสแกน QR" : `มือถือไม่ได้ใช้งาน ${Math.floor(age / 60)} นาที — QR เดิมยังใช้ได้`;
      els.mobileSessionNote.textContent = "ไม่ต้องสร้าง QR ใหม่: เปิดแท็บเดิมในมือถือ หรือสแกน QR เดิมอีกครั้งหากเบราว์เซอร์ถูกปิด";
    }
    drawQr(link);
  }
  function startMobileSession(newSession = false){
    if(!cloudSyncEnabled()) return alert("ยังไม่ได้ตั้งค่า Firebase หรือ Apps Script");
    if(newSession || !mobileSession){
      mobileSession = { room:createRoom(), createdAt:Date.now() };
      localStorage.setItem(MOBILE_SESSION_STORAGE_KEY, JSON.stringify(mobileSession));
    }
    window.DrawRemote?.configure?.({ room:mobileSession.room });
    persist(`เปิดรอบควบคุมมือถือ ${mobileSession.room}`);
  }
  function render(){
    renderSelects(); renderCurrent();
    els.groupASlots.innerHTML = A.buildSlotsHtml(state, "A"); els.groupBSlots.innerHTML = A.buildSlotsHtml(state, "B");
    renderHistory();
    els.scheduleBody.innerHTML = A.buildScheduleRows(state).map(row => `<tr>${row.map(cell => `<td>${A.escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    document.querySelectorAll("[data-stage]").forEach(button => button.classList.toggle("active", button.dataset.stage === state.stage));
    const live = state.mode === "live";
    els.modePill.textContent = live ? "โหมดถ่ายทอดสด" : "โหมดซ้อม"; els.modePill.className = `pill ${live ? "live" : ""}`; els.rehearsalRandomBtn.hidden = live;
    [els.positionSelect, els.teamSelect, els.confirmBtn, els.clearCurrentBtn, els.undoBtn, els.rehearsalRandomBtn].forEach(el => { el.disabled = state.locked; });
    els.lockBtn.textContent = state.locked ? "🔓 ปลดล็อกผล" : "🔒 ล็อกผล"; els.lockedAlert.hidden = !state.locked;
    els.progressPill.textContent = `ครั้งที่ ${Math.min(state.confirmed.length + 1, 7)} จาก 7`; els.stateTime.textContent = `บันทึกล่าสุด ${A.formatThaiTime(state.updatedAt)}`;
    els.confirmBtn.disabled = state.locked || !state.currentPosition || !state.currentTeamId; els.undoBtn.disabled = state.locked || !state.confirmed.length;
    renderConnection(); renderReadiness(); renderMobileSession(); renderFirebaseStatus();
    clearTimeout(highlightTimer);
    if(state.pendingRevealUntil > Date.now()) highlightTimer = setTimeout(render, state.pendingRevealUntil - Date.now() + 30);
  }
  els.openDisplayBtn.addEventListener("click", () => window.open(displayLink(), "rapee69-display"));
  els.startMobileSessionBtn.addEventListener("click", () => startMobileSession(false));
  els.renewMobileSessionBtn.addEventListener("click", () => {
    if(!confirm("สร้าง QR รอบใหม่ใช่หรือไม่\nมือถือที่เปิดอยู่จะต้องสแกน QR ใหม่")) return;
    startMobileSession(true);
  });
  els.copyMobileLinkBtn.addEventListener("click", async () => {
    const link = mobileLink(); if(!link) return;
    try { await navigator.clipboard.writeText(link); alert("คัดลอกลิงก์ควบคุมมือถือแล้ว"); }
    catch { prompt("คัดลอกลิงก์นี้", link); }
  });
  function focusDrawWorkflow(){
    const target = document.getElementById("drawWorkflow");
    if(!target) return;
    target.scrollIntoView({ behavior:"smooth", block:"center" });
    target.classList.remove("draw-workflow-focus");
    void target.offsetWidth;
    target.classList.add("draw-workflow-focus");
    clearTimeout(drawFocusTimer);
    drawFocusTimer = setTimeout(() => target.classList.remove("draw-workflow-focus"), 3000);
  }
  document.querySelectorAll("[data-stage]").forEach(button => button.addEventListener("click", () => {
    state.stage = button.dataset.stage;
    persist(`เปลี่ยนหน้าจอเป็น ${button.textContent.trim()}`);
    if(button.dataset.stage === "draw") requestAnimationFrame(focusDrawWorkflow);
  }));
  els.positionSelect.addEventListener("change", () => {
    const value = els.positionSelect.value;
    if(!value) return;
    if(usedPositions().has(value) && value !== state.currentPosition) return alert("ตำแหน่งนี้ถูกใช้แล้ว");
    state.currentPosition = value; state.stage = "draw"; persist(`แสดงตำแหน่ง ${value}`);
  });
  els.teamSelect.addEventListener("change", () => {
    const id = Number(els.teamSelect.value), team = A.getTeam(id);
    if(!team) return;
    if(usedTeams().has(id) && id !== Number(state.currentTeamId)) return alert("ทีมนี้ถูกใช้แล้ว");
    state.currentTeamId = id; state.stage = "draw"; state.pendingRevealUntil = Date.now() + 5000; persist(`เลือกทีมหมายเลข ${id}`);
  });
  els.confirmBtn.addEventListener("click", () => {
    const team = A.getTeam(state.currentTeamId);
    if(!state.currentPosition || !team) return alert("ต้องเลือกผลจากทั้ง 2 โถก่อนยืนยัน");
    if(usedPositions().has(state.currentPosition) || usedTeams().has(team.id)) return alert("ตำแหน่งหรือทีมนี้ถูกยืนยันไปแล้ว");
    const result = `${state.currentPosition} — ${team.name}`;
    state.confirmed.push({ position:state.currentPosition, teamId:team.id, confirmedAt:new Date().toISOString() });
    state.currentPosition = ""; state.currentTeamId = null; state.pendingRevealUntil = 0; state.stage = state.confirmed.length === 7 ? "official" : "draw";
    persist(`ยืนยันผล ${result}`);
  });
  els.clearCurrentBtn.addEventListener("click", () => { state.currentPosition = ""; state.currentTeamId = null; state.pendingRevealUntil = 0; persist("ล้างผลคู่ปัจจุบัน"); });
  els.undoBtn.addEventListener("click", () => {
    if(!state.confirmed.length) return;
    const last = state.confirmed.at(-1), team = A.getTeam(last.teamId);
    if(!confirm(`ย้อนกลับผลล่าสุด ${last.position} — ${team?.name || ""} ใช่หรือไม่`)) return;
    state.confirmed.pop(); state.currentPosition = last.position; state.currentTeamId = last.teamId; state.locked = false; state.stage = "draw"; persist("ย้อนกลับผลล่าสุด");
  });
  els.lockBtn.addEventListener("click", () => {
    if(!state.locked && state.confirmed.length < 7 && !confirm("ผลยังไม่ครบ 7 ทีม ต้องการล็อกผลชั่วคราวหรือไม่")) return;
    if(state.locked){ if(prompt("พิมพ์คำว่า ปลดล็อก เพื่อยืนยัน") !== "ปลดล็อก") return alert("คำยืนยันไม่ถูกต้อง"); state.locked = false; persist("ปลดล็อกผล"); }
    else { if(!confirm("ยืนยันล็อกผลการจับฉลาก")) return; state.locked = true; state.stage = state.confirmed.length === 7 ? "summary" : state.stage; persist("ล็อกผลการจับฉลาก"); }
  });
  els.modeBtn.addEventListener("click", () => {
    const target = state.mode === "live" ? "ซ้อม" : "ถ่ายทอดสด";
    if(!confirm(`เปลี่ยนเป็นโหมด${target}และล้างผลปัจจุบันทั้งหมดใช่หรือไม่`)) return;
    state = A.emptyState(); state.mode = target === "ซ้อม" ? "rehearsal" : "live";
    persist(target === "ถ่ายทอดสด" ? "ล้างผลการซ้อมแล้ว — พร้อมเริ่มโหมดถ่ายทอดสด" : "เริ่มโหมดซ้อมด้วยข้อมูลว่าง");
  });
  els.rehearsalRandomBtn.addEventListener("click", () => {
    if(state.mode !== "rehearsal") return;
    const positions = A.POSITIONS.filter(p => !usedPositions().has(p)), teams = A.TEAMS.filter(t => !usedTeams().has(t.id));
    if(!positions.length || !teams.length) return alert("ผลครบแล้ว");
    state.currentPosition = positions[Math.floor(Math.random() * positions.length)]; state.currentTeamId = teams[Math.floor(Math.random() * teams.length)].id; state.pendingRevealUntil = 0; state.stage = "draw"; persist("สุ่มผลสำหรับการซ้อม");
  });
  els.copySummaryBtn.addEventListener("click", async () => {
    const map = A.getPairMap(state), lines = ["ผลการจับฉลากแบ่งสายการแข่งขันฟุตบอล 7 คน วันรพี 69", "วันที่ 31 กรกฎาคม 2569", "", "สาย A", ...["A1","A2","A3"].map(p => `${p} — ${map[p]?.name || "รอผล"}`), "", "สาย B", ...["B1","B2","B3","B4"].map(p => `${p} — ${map[p]?.name || "รอผล"}`)];
    try { await navigator.clipboard.writeText(lines.join("\n")); alert("คัดลอกข้อความสรุปแล้ว"); } catch { prompt("คัดลอกข้อความด้านล่าง", lines.join("\n")); }
  });
  els.downloadJsonBtn.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `rapee69-draw-backup-${new Date().toISOString().slice(0,19).replaceAll(":","-")}.json`; a.click(); URL.revokeObjectURL(url); });
  els.printBtn.addEventListener("click", () => { const url = new URL(displayLink()); url.searchParams.set("print", "1"); url.searchParams.set("stage", "official"); window.open(url, "_blank"); });
  els.captureBtn.addEventListener("click", () => { const url = new URL(displayLink()); url.searchParams.set("capture", "1"); url.searchParams.set("stage", els.captureStageSelect.value); window.open(url, "_blank"); });
  els.resetBtn.addEventListener("click", () => { if(prompt("พิมพ์คำว่า RESET เพื่อยืนยันล้างข้อมูลทั้งหมด") !== "RESET") return; state = A.emptyState(); persist("รีเซ็ตระบบทั้งหมด"); });
  if(window.drawChannel) window.drawChannel.addEventListener("message", event => { if(event.data?.type === "display-presence") { lastDisplayPing = Date.now(); render(); } else if(event.data?.state) receive(event.data.state); });
  window.addEventListener("storage", event => { if(event.key === A.STORAGE_KEY) receive(A.loadState()); });
  window.addEventListener("draw-remote-state", event => {
    if(mobileSession && event.detail.room && event.detail.room !== mobileSession.room) return;
    receive(event.detail.state);
  });
  window.addEventListener("draw-firebase-state", event => receive(event.detail.state));
  window.addEventListener("draw-firebase-status", event => { firebaseStatus = event.detail || firebaseStatus; render(); });
  window.addEventListener("draw-remote-status", event => {
    if(mobileSession && event.detail.room && event.detail.room !== mobileSession.room) return;
    remoteOnline = Boolean(event.detail.online);
    const presence = Object.values(event.detail.presence || {});
    if(presence.some(item => item.role === "display" && Date.now() - item.at < 5500)) lastDisplayPing = Date.now();
    const mobileTimes = presence.filter(item => item.role === "mobile" && Number(item.at)).map(item => Number(item.at));
    if(mobileTimes.length) lastMobilePing = Math.max(lastMobilePing, ...mobileTimes);
    render();
  });
  window.addEventListener("beforeunload", event => { if(state.confirmed.length < 7 && !state.locked){ event.preventDefault(); event.returnValue = "ยังจับฉลากไม่ครบ 7 ทีม และยังไม่ได้ล็อกผล"; } });
  window.DrawRemote?.start?.("control"); setInterval(renderConnection, 1000); setInterval(renderReadiness, 1000); updateControlClock(); setInterval(updateControlClock, 1000); render();
})();
