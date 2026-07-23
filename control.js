(() => {
  "use strict";
  const A = window.DrawApp;
  let state = A.loadState();
  let lastDisplayPing = 0;
  let remoteOnline = false;
  const els = {
    openDisplayBtn:document.getElementById("openDisplayBtn"), positionSelect:document.getElementById("positionSelect"), teamSelect:document.getElementById("teamSelect"),
    confirmBtn:document.getElementById("confirmBtn"), clearCurrentBtn:document.getElementById("clearCurrentBtn"),
    undoBtn:document.getElementById("undoBtn"), lockBtn:document.getElementById("lockBtn"), modeBtn:document.getElementById("modeBtn"), rehearsalRandomBtn:document.getElementById("rehearsalRandomBtn"),
    currentPosition:document.getElementById("currentPosition"), currentTeam:document.getElementById("currentTeam"), currentStatus:document.getElementById("currentStatus"), groupASlots:document.getElementById("groupASlots"),
    groupBSlots:document.getElementById("groupBSlots"), historyList:document.getElementById("historyList"), scheduleBody:document.getElementById("scheduleBody"), progressPill:document.getElementById("progressPill"),
    modePill:document.getElementById("modePill"), connectionPill:document.getElementById("connectionPill"), readinessList:document.getElementById("readinessList"), stateTime:document.getElementById("stateTime"),
    lockedAlert:document.getElementById("lockedAlert"), copySummaryBtn:document.getElementById("copySummaryBtn"), downloadJsonBtn:document.getElementById("downloadJsonBtn"), printBtn:document.getElementById("printBtn"),
    captureBtn:document.getElementById("captureBtn"), resetBtn:document.getElementById("resetBtn")
  };
  const usedPositions = () => new Set(state.confirmed.map(item => item.position));
  const usedTeams = () => new Set(state.confirmed.map(item => Number(item.teamId)));
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
    els.currentPosition.textContent = state.currentPosition || "—";
    els.currentTeam.textContent = team ? `${team.id}. ${team.name}` : "รอจับฉลาก";
    els.currentStatus.textContent = state.currentPosition && team ? "พร้อมยืนยันผลลงตาราง" : state.currentPosition ? "จับโถที่ 2 และเลือกหมายเลขทีม" : "จับโถที่ 1 และเลือกตำแหน่งการแข่งขัน";
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
    els.connectionPill.title = window.DrawRemote?.enabled ? (remoteOnline ? "ตรวจผ่านการซิงก์ข้ามเครื่อง" : "กำลังเชื่อมต่อบริการซิงก์") : "ตรวจจากจอที่เปิดในเบราว์เซอร์/เครื่องเดียวกัน";
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
    els.progressPill.textContent = `${state.confirmed.length} / 7 ทีม`; els.stateTime.textContent = `บันทึกล่าสุด ${A.formatThaiTime(state.updatedAt)}`;
    els.confirmBtn.disabled = state.locked || !state.currentPosition || !state.currentTeamId; els.undoBtn.disabled = state.locked || !state.confirmed.length;
    renderConnection(); renderReadiness();
  }
  els.openDisplayBtn.addEventListener("click", () => window.open("display.html", "rapee69-display"));
  document.querySelectorAll("[data-stage]").forEach(button => button.addEventListener("click", () => { state.stage = button.dataset.stage; persist(`เปลี่ยนหน้าจอเป็น ${button.textContent.trim()}`); }));
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
    state.currentTeamId = id; state.stage = "draw"; state.pendingRevealUntil = Date.now() + 2500; persist(`เปิดฉลากทีมหมายเลข ${id}`);
  });
  els.confirmBtn.addEventListener("click", () => {
    const team = A.getTeam(state.currentTeamId);
    if(!state.currentPosition || !team) return alert("ต้องเลือกผลจากทั้ง 2 โถก่อนยืนยัน");
    if(usedPositions().has(state.currentPosition) || usedTeams().has(team.id)) return alert("ตำแหน่งหรือทีมนี้ถูกยืนยันไปแล้ว");
    const result = `${state.currentPosition} — ${team.name}`;
    state.confirmed.push({ position:state.currentPosition, teamId:team.id, confirmedAt:new Date().toISOString() });
    state.currentPosition = ""; state.currentTeamId = null; state.pendingRevealUntil = 0; state.stage = state.confirmed.length === 7 ? "summary" : "draw";
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
    state.currentPosition = positions[Math.floor(Math.random() * positions.length)]; state.currentTeamId = teams[Math.floor(Math.random() * teams.length)].id; state.pendingRevealUntil = Date.now() + 2500; state.stage = "draw"; persist("สุ่มผลสำหรับการซ้อม");
  });
  els.copySummaryBtn.addEventListener("click", async () => {
    const map = A.getPairMap(state), lines = ["ผลการจับฉลากแบ่งสายการแข่งขันฟุตบอล 7 คน วันรพี 69", "วันที่ 31 กรกฎาคม 2569", "", "สาย A", ...["A1","A2","A3"].map(p => `${p} — ${map[p]?.name || "รอผล"}`), "", "สาย B", ...["B1","B2","B3","B4"].map(p => `${p} — ${map[p]?.name || "รอผล"}`)];
    try { await navigator.clipboard.writeText(lines.join("\n")); alert("คัดลอกข้อความสรุปแล้ว"); } catch { prompt("คัดลอกข้อความด้านล่าง", lines.join("\n")); }
  });
  els.downloadJsonBtn.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = `rapee69-draw-backup-${new Date().toISOString().slice(0,19).replaceAll(":","-")}.json`; a.click(); URL.revokeObjectURL(url); });
  els.printBtn.addEventListener("click", () => window.open("display.html?print=1&stage=summary", "_blank"));
  els.captureBtn.addEventListener("click", () => window.open("display.html?capture=1&stage=summary", "_blank"));
  els.resetBtn.addEventListener("click", () => { if(prompt("พิมพ์คำว่า RESET เพื่อยืนยันล้างข้อมูลทั้งหมด") !== "RESET") return; state = A.emptyState(); persist("รีเซ็ตระบบทั้งหมด"); });
  if(window.drawChannel) window.drawChannel.addEventListener("message", event => { if(event.data?.type === "display-presence") { lastDisplayPing = Date.now(); render(); } else if(event.data?.state) receive(event.data.state); });
  window.addEventListener("storage", event => { if(event.key === A.STORAGE_KEY) receive(A.loadState()); });
  window.addEventListener("draw-remote-state", event => receive(event.detail.state));
  window.addEventListener("draw-remote-status", event => { remoteOnline = Boolean(event.detail.online); if(Object.values(event.detail.presence || {}).some(item => item.role === "display" && Date.now() - item.at < 5500)) lastDisplayPing = Date.now(); render(); });
  window.addEventListener("beforeunload", event => { if(state.confirmed.length < 7 && !state.locked){ event.preventDefault(); event.returnValue = "ยังจับฉลากไม่ครบ 7 ทีม และยังไม่ได้ล็อกผล"; } });
  window.DrawRemote?.start?.("control"); setInterval(renderConnection, 1000); setInterval(renderReadiness, 1000); render();
})();
