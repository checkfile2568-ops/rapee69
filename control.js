(() => {
  "use strict";
  const A = window.DrawApp;
  let state = A.loadState();
  let lastDisplayPing = 0;
  let lastMobilePing = 0;
  let drawFocusTimer = 0;
  let highlightTimer = 0;
  let mediaRecorder = null;
  let displayCaptureStream = null;
  let microphoneStream = null;
  let recordingAudioContext = null;
  let recordingChunks = [];
  let localRecordingStartedAt = 0;
  let recordingStartPending = false;
  let recordingNotice = "";
  let recordingAlert = "";
  let recordingFolderHandle = null;
  let recordingSegmentIndex = 0;
  let recordingSegmentStartedAt = 0;
  let recordingSegmentTimer = 0;
  let recordingStopRequested = false;
  let recordingRotateRequested = false;
  let recordingCanvas = null;
  let recordingCanvasContext = null;
  let recordingPreviewVideo = null;
  let recordingDrawFrame = 0;
  let recordingOutputStream = null;
  let recordingStopReason = "";
  const RECORDING_SEGMENT_MS = 10 * 60 * 1000;
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
    modePill:document.getElementById("modePill"), connectionPill:document.getElementById("connectionPill"), readinessList:document.getElementById("readinessList"), stateTime:document.getElementById("stateTime"), firebaseStatus:document.getElementById("controlFirebaseStatus"), liveStageName:document.getElementById("liveStageName"), mobileOnlineBadge:document.getElementById("mobileOnlineBadge"),
    lockedAlert:document.getElementById("lockedAlert"), copySummaryBtn:document.getElementById("copySummaryBtn"), downloadJsonBtn:document.getElementById("downloadJsonBtn"), printBtn:document.getElementById("printBtn"),
    captureBtn:document.getElementById("captureBtn"), captureStageSelect:document.getElementById("captureStageSelect"), resetBtn:document.getElementById("resetBtn"),
    recordStartBtn:document.getElementById("recordStartBtn"), recordStopBtn:document.getElementById("recordStopBtn"), recordStartPanelBtn:document.getElementById("recordStartPanelBtn"), recordStopPanelBtn:document.getElementById("recordStopPanelBtn"), recordFolderBtn:document.getElementById("recordFolderBtn"), recordingPill:document.getElementById("recordingPill"), recordingStatus:document.getElementById("recordingStatus"), recordingResolution:document.getElementById("recordingResolution"), recordingDestination:document.getElementById("recordingDestination"), recordingAlert:document.getElementById("recordingAlert"),
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
  function receive(next){
    const incomingAt = Date.parse(next?.updatedAt || ""), currentAt = Date.parse(state?.updatedAt || "");
    if(Number.isFinite(incomingAt) && Number.isFinite(currentAt) && incomingAt < currentAt) return;
    state = A.normalizeState(next); render();
  }
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
    const mobile = mobileConnectionState();
    const checks = [
      [state.mode === "live", "อยู่โหมดถ่ายทอดสด"],
      [state.confirmed.length === 0 || state.mode === "live", "ไม่มีผลจากโหมดซ้อมค้างอยู่"],
      [!state.locked, "ไม่ได้ล็อกอยู่"],
      [displayConnected(), "เปิดจอนำเสนอแล้ว"],
      [mobile.online, mobile.readinessLabel]
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
    url.searchParams.set("v", "1.9.4");
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
  function mobileAge(){
    const firebaseHeartbeat = Date.parse(state.mobileHeartbeatAt || "");
    const lastSeen = Math.max(lastMobilePing, Number.isFinite(firebaseHeartbeat) ? firebaseHeartbeat : 0);
    return lastSeen ? Math.max(0, Math.round((Date.now() - lastSeen) / 1000)) : null;
  }
  function mobileConnectionState(){
    const age = mobileAge();
    if(age !== null && age < 20) return { online:true, tone:"online", label:"● มือถือควบคุมออนไลน์", readinessLabel:"มือถือควบคุมเชื่อมต่อแล้ว" };
    if(!cloudSyncEnabled()) return { online:false, tone:"waiting", label:"● รอการตั้งค่ามือถือ", readinessLabel:"ยังไม่ได้ตั้งค่าการควบคุมมือถือ" };
    if(age !== null && age < 180) return { online:false, tone:"idle", label:"● มือถือพักหน้าจอ", readinessLabel:"มือถือพักหน้าจอ — QR เดิมยังใช้ได้" };
    return { online:false, tone:"waiting", label:"● รอมือถือเชื่อมต่อ", readinessLabel:"รอมือถือสแกน QR หรือเปิดลิงก์เดิม" };
  }
  function renderMobileOnlineBadge(){
    if(!els.mobileOnlineBadge) return;
    const mobile = mobileConnectionState();
    els.mobileOnlineBadge.className = `header-mobile-status ${mobile.tone}`;
    els.mobileOnlineBadge.textContent = mobile.label;
    els.mobileOnlineBadge.title = mobile.online ? "มือถือพร้อมส่งคำสั่งควบคุม" : "สถานะจะเปลี่ยนเป็นสีเขียวเมื่อมือถือเชื่อมต่ออยู่";
  }
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
  function formatRecordingDuration(startedAt){
    const elapsed = Math.max(0, Date.now() - new Date(startedAt || Date.now()).getTime());
    const total = Math.floor(elapsed / 1000), hours = Math.floor(total / 3600), minutes = Math.floor((total % 3600) / 60), seconds = total % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
  }
  function recordingProfile(){
    return els.recordingResolution?.value === "540"
      ? { key:"540", width:960, height:540, fps:20, videoBitsPerSecond:1200000, audioBitsPerSecond:64000, label:"960 × 540", target:"ประมาณ 90–110 MB / 10 นาที" }
      : { key:"720", width:1280, height:720, fps:24, videoBitsPerSecond:2200000, audioBitsPerSecond:96000, label:"1280 × 720", target:"ประมาณ 160–180 MB / 10 นาที" };
  }
  function recordingFileName(startedAt, segment, profile){
    const date = new Date(startedAt || Date.now());
    const thaiYear = date.getFullYear() + 543;
    const stamp = `${thaiYear}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return `rapee69_${stamp}_${String(segment).padStart(3, "0")}_${profile.key}p.webm`;
  }
  function setRecordingAlert(message = "", tone = ""){
    recordingAlert = message ? { message, tone } : "";
  }
  function localRecordingActive(){ return mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused"; }
  function renderRecording(){
    const active = Boolean(state.recording?.active);
    const localActive = localRecordingActive();
    const busy = active || recordingStartPending;
    const profile = recordingProfile();
    const duration = active ? formatRecordingDuration(state.recording.startedAt) : "";
    const segmentDuration = recordingSegmentStartedAt ? formatRecordingDuration(new Date(recordingSegmentStartedAt).toISOString()) : "00:00:00";
    els.recordingPill.className = `pill ${active ? "recording" : ""}`;
    els.recordingPill.textContent = active
      ? `● ไฟล์ ${String(Math.max(1, recordingSegmentIndex)).padStart(3, "0")} · ${segmentDuration.slice(3)} / 10:00`
      : recordingStartPending ? "กำลังเตรียมบันทึก" : "ยังไม่ได้บันทึก";
    els.recordingStatus.textContent = recordingStartPending
      ? (recordingFolderHandle ? "กำลังเปิดกล่องเลือกทั้งหน้าจอ…" : "กำลังเลือกโฟลเดอร์เก็บงาน…")
      : active
        ? `${localActive ? `กำลังบันทึกทั้งจอ ${profile.label}` : "มีการบันทึกจากหน้าควบคุมเครื่องอื่น"} · ${duration}`
        : recordingNotice || `กดบันทึกเพื่อเลือกโฟลเดอร์และเลือก “ทั้งหน้าจอ” ที่เปิด Meet · ${profile.target}`;
    if(els.recordingDestination) els.recordingDestination.textContent = recordingFolderHandle ? recordingFolderHandle.name : "ยังไม่ได้เลือกโฟลเดอร์";
    if(els.recordingAlert){
      const alert = recordingAlert && typeof recordingAlert === "object" ? recordingAlert : null;
      els.recordingAlert.hidden = !alert;
      els.recordingAlert.textContent = alert?.message || "";
      els.recordingAlert.className = `recording-alert ${alert?.tone || ""}`;
    }
    [els.recordStartBtn, els.recordStartPanelBtn].forEach(button => { button.disabled = busy; button.hidden = active; });
    [els.recordStopBtn, els.recordStopPanelBtn].forEach(button => { button.hidden = !localActive; button.disabled = !localActive; });
    if(els.recordFolderBtn){ els.recordFolderBtn.disabled = busy; els.recordFolderBtn.textContent = recordingFolderHandle ? "เปลี่ยนโฟลเดอร์เก็บงาน" : "เลือกโฟลเดอร์เก็บงาน"; }
    if(els.recordingResolution) els.recordingResolution.disabled = busy;
  }
  async function chooseRecordingFolder(){
    if(localRecordingActive()) return;
    if(!window.DrawFileStore?.chooseFolder){ setRecordingAlert("ไม่พบระบบบันทึกไฟล์ลงเครื่อง โปรดรีเฟรชหน้าแล้วลองใหม่", "error"); render(); return null; }
    recordingStartPending = true; renderRecording();
    try {
      recordingFolderHandle = await window.DrawFileStore.chooseFolder();
      recordingNotice = `เลือกโฟลเดอร์ “${recordingFolderHandle.name}” แล้ว · กดเริ่มบันทึกเพื่อเลือกทั้งจอ`;
      setRecordingAlert(`พร้อมเก็บวิดีโอ ภาพตาราง และไฟล์สำรองลง “${recordingFolderHandle.name}”`, "success");
      return recordingFolderHandle;
    } catch(error) {
      if(error?.name !== "AbortError") setRecordingAlert(error?.message || "ยังไม่ได้เลือกโฟลเดอร์เก็บงาน", "error");
      return null;
    } finally { recordingStartPending = false; renderRecording(); }
  }
  async function restoreRecordingFolder(){
    try {
      const handle = await window.DrawFileStore?.getActiveFolder?.();
      if(handle){ recordingFolderHandle = handle; recordingNotice = `พร้อมใช้โฟลเดอร์ “${handle.name}”`; render(); }
    } catch { /* เลือกใหม่เมื่อเริ่มบันทึก */ }
  }
  async function ensureOutputFolder(){
    if(!recordingFolderHandle) return chooseRecordingFolder();
    if(await window.DrawFileStore?.ensurePermission?.(recordingFolderHandle, true)) return recordingFolderHandle;
    setRecordingAlert("ยังไม่ได้อนุญาตให้ระบบเขียนไฟล์ลงโฟลเดอร์นี้", "error"); render();
    return null;
  }
  async function saveOutputFile(fileName, blob, label){
    const folder = await ensureOutputFolder();
    if(!folder) return false;
    try {
      await window.DrawFileStore.writeBlob(fileName, blob, folder);
      recordingNotice = `บันทึก${label}ลงโฟลเดอร์ “${folder.name}” แล้ว`;
      setRecordingAlert(recordingNotice, "success"); render();
      return true;
    } catch(error) {
      setRecordingAlert(`บันทึก${label}ไม่สำเร็จ โปรดตรวจโฟลเดอร์และพื้นที่ว่าง`, "error"); render();
      return false;
    }
  }
  function cleanupRecordingStreams(){
    clearTimeout(recordingSegmentTimer); recordingSegmentTimer = 0;
    if(recordingDrawFrame) cancelAnimationFrame(recordingDrawFrame);
    recordingDrawFrame = 0;
    recordingOutputStream?.getTracks().forEach(track => track.stop());
    recordingOutputStream = null;
    if(recordingPreviewVideo){ recordingPreviewVideo.pause(); recordingPreviewVideo.srcObject = null; }
    recordingPreviewVideo = null; recordingCanvasContext = null; recordingCanvas = null;
    displayCaptureStream?.getTracks().forEach(track => track.stop());
    microphoneStream?.getTracks().forEach(track => track.stop());
    displayCaptureStream = null; microphoneStream = null;
    if(recordingAudioContext){ recordingAudioContext.close().catch(() => {}); recordingAudioContext = null; }
  }
  async function buildRecordingStream(displayStream, micStream, profile){
    const sourceTrack = displayStream.getVideoTracks()[0];
    if(!sourceTrack) throw new Error("ไม่พบภาพหน้าจอสำหรับบันทึก");
    recordingPreviewVideo = document.createElement("video");
    recordingPreviewVideo.muted = true;
    recordingPreviewVideo.playsInline = true;
    recordingPreviewVideo.srcObject = new MediaStream([sourceTrack]);
    await recordingPreviewVideo.play();
    if(!recordingPreviewVideo.videoWidth){
      await Promise.race([
        new Promise(resolve => recordingPreviewVideo.addEventListener("loadedmetadata", resolve, { once:true })),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
    }
    recordingCanvas = document.createElement("canvas");
    recordingCanvas.width = profile.width;
    recordingCanvas.height = profile.height;
    recordingCanvasContext = recordingCanvas.getContext("2d", { alpha:false });
    const drawFrame = () => {
      const context = recordingCanvasContext, video = recordingPreviewVideo;
      if(!context || !video) return;
      const sourceWidth = video.videoWidth || profile.width;
      const sourceHeight = video.videoHeight || profile.height;
      const scale = Math.min(profile.width / sourceWidth, profile.height / sourceHeight);
      const width = Math.round(sourceWidth * scale), height = Math.round(sourceHeight * scale);
      context.fillStyle = "#000";
      context.fillRect(0, 0, profile.width, profile.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(video, Math.round((profile.width - width) / 2), Math.round((profile.height - height) / 2), width, height);
      recordingDrawFrame = requestAnimationFrame(drawFrame);
    };
    drawFrame();
    const videoTracks = recordingCanvas.captureStream(profile.fps).getVideoTracks();
    const audioStreams = [displayStream, micStream].filter(stream => stream?.getAudioTracks().length);
    if(!audioStreams.length) return new MediaStream(videoTracks);
    recordingAudioContext = new AudioContext();
    const destination = recordingAudioContext.createMediaStreamDestination();
    audioStreams.forEach(stream => recordingAudioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(destination));
    await recordingAudioContext.resume();
    return new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()]);
  }
  function recorderOptions(profile){
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
    const options = { videoBitsPerSecond:profile.videoBitsPerSecond, audioBitsPerSecond:profile.audioBitsPerSecond };
    if(mimeType) options.mimeType = mimeType;
    return options;
  }
  async function completeRecordingSession(){
    cleanupRecordingStreams();
    mediaRecorder = null; recordingChunks = [];
    recordingSegmentStartedAt = 0; recordingRotateRequested = false;
    const reason = recordingStopReason;
    recordingStopReason = "";
    state.recording = { active:false, startedAt:"" };
    if(reason === "capture-ended") setRecordingAlert("การบันทึกหยุดโดยไม่คาดคิด: การแชร์ทั้งจอถูกปิดแล้ว ไฟล์ล่าสุดถูกปิดและบันทึกแล้ว", "error");
    if(reason === "write-failed") setRecordingAlert("บันทึกไฟล์ไม่สำเร็จ โปรดตรวจพื้นที่ว่างและเลือกโฟลเดอร์ใหม่", "error");
    persist(reason === "manual" ? "หยุดบันทึกวิดีโอ" : "จบการบันทึกวิดีโอ");
  }
  async function startRecordingSegment(stream, profile){
    if(!recordingFolderHandle) throw new Error("ยังไม่ได้เลือกโฟลเดอร์เก็บงาน");
    recordingSegmentIndex += 1;
    recordingSegmentStartedAt = Date.now();
    const fileName = recordingFileName(localRecordingStartedAt, recordingSegmentIndex, profile);
    let writable;
    try {
      const fileHandle = await recordingFolderHandle.getFileHandle(fileName, { create:true });
      writable = await fileHandle.createWritable();
    } catch(error) {
      recordingStopReason = "write-failed";
      recordingNotice = "ไม่สามารถสร้างไฟล์วิดีโอในโฟลเดอร์ที่เลือกได้";
      await completeRecordingSession();
      return;
    }
    const recorder = new MediaRecorder(stream, recorderOptions(profile));
    mediaRecorder = recorder;
    let writeQueue = Promise.resolve();
    let writeError = null;
    recorder.addEventListener("dataavailable", event => {
      if(!event.data.size || writeError) return;
      writeQueue = writeQueue.then(() => writable.write(event.data)).catch(error => {
        writeError = error;
        recordingStopReason = "write-failed";
        if(recorder.state === "recording") recorder.stop();
      });
    });
    recorder.addEventListener("stop", async () => {
      clearTimeout(recordingSegmentTimer); recordingSegmentTimer = 0;
      try { await writeQueue; if(writeError) throw writeError; await writable.close(); }
      catch(error) { recordingStopReason = "write-failed"; try { await writable.abort?.(); } catch {} }
      if(mediaRecorder === recorder) mediaRecorder = null;
      const shouldRotate = recordingRotateRequested && !recordingStopReason && !recordingStopRequested;
      if(shouldRotate){
        recordingRotateRequested = false;
        recordingNotice = `บันทึกไฟล์ ${String(recordingSegmentIndex).padStart(3, "0")} สำเร็จแล้ว · เริ่มไฟล์ถัดไปอัตโนมัติ`;
        setRecordingAlert(recordingNotice, "success");
        try { await startRecordingSegment(stream, profile); } catch(error) { recordingStopReason = "write-failed"; await completeRecordingSession(); }
      } else {
        if(!recordingStopReason) recordingStopReason = recordingStopRequested ? "manual" : "capture-ended";
        recordingNotice = recordingStopReason === "manual" ? `บันทึกไฟล์ ${String(recordingSegmentIndex).padStart(3, "0")} สำเร็จแล้ว` : recordingNotice;
        if(recordingStopReason === "manual") setRecordingAlert(recordingNotice, "success");
        await completeRecordingSession();
      }
    }, { once:true });
    recorder.start(1000);
    recordingSegmentTimer = setTimeout(() => {
      if(recorder.state === "recording") { recordingRotateRequested = true; recorder.stop(); }
    }, RECORDING_SEGMENT_MS);
    renderRecording();
  }
  async function startRecording(){
    if(recordingStartPending || state.recording?.active) return;
    if(!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder || !window.showDirectoryPicker){
      setRecordingAlert("โปรดใช้ Chrome หรือ Microsoft Edge เวอร์ชันล่าสุดสำหรับบันทึกทั้งจอลงโฟลเดอร์โดยตรง", "error"); render(); return;
    }
    if(!recordingFolderHandle){
      await chooseRecordingFolder();
      return;
    }
    if(!await window.DrawFileStore.ensurePermission(recordingFolderHandle, true)){
      setRecordingAlert("ยังไม่ได้อนุญาตให้ระบบเขียนไฟล์ลงโฟลเดอร์นี้", "error"); render(); return;
    }
    recordingNotice = ""; setRecordingAlert(); recordingStartPending = true; renderRecording();
    try {
      const profile = recordingProfile();
      displayCaptureStream = await navigator.mediaDevices.getDisplayMedia({ video:{ frameRate:{ ideal:profile.fps, max:30 }, displaySurface:"monitor" }, audio:true, systemAudio:"include", monitorTypeSurfaces:"include", preferCurrentTab:false, selfBrowserSurface:"exclude" });
      try { microphoneStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true } }); }
      catch { microphoneStream = null; }
      recordingOutputStream = await buildRecordingStream(displayCaptureStream, microphoneStream, profile);
      localRecordingStartedAt = Date.now();
      recordingSegmentIndex = 0; recordingSegmentStartedAt = 0; recordingStopRequested = false; recordingRotateRequested = false; recordingStopReason = "";
      state.recording = { active:true, startedAt:new Date(localRecordingStartedAt).toISOString() };
      persist(`เริ่มบันทึกทั้งจอ ${profile.label}`);
      displayCaptureStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if(!recordingStopReason){ recordingStopReason = "capture-ended"; recordingNotice = "การแชร์ทั้งจอถูกปิด ระบบกำลังปิดและบันทึกไฟล์ล่าสุด"; }
        if(localRecordingActive()) mediaRecorder.stop();
      }, { once:true });
      await startRecordingSegment(recordingOutputStream, profile);
    } catch(error) {
      cleanupRecordingStreams(); mediaRecorder = null;
      if(state.recording?.active){ state.recording = { active:false, startedAt:"" }; }
      const message = error?.name === "NotAllowedError" || error?.name === "AbortError" ? "ยังไม่ได้เลือกทั้งจอสำหรับบันทึก" : "เริ่มบันทึกไม่สำเร็จ โปรดลองใหม่";
      recordingNotice = message; setRecordingAlert(message, "error");
    } finally { recordingStartPending = false; renderRecording(); }
  }
  function stopRecording(){
    if(localRecordingActive()){
      recordingStopRequested = true; recordingStopReason = "manual";
      recordingNotice = "กำลังปิดและบันทึกไฟล์วิดีโอ…";
      mediaRecorder.stop(); renderRecording();
    }
  }
  function render(){
    renderSelects(); renderCurrent();
    els.groupASlots.innerHTML = A.buildSlotsHtml(state, "A"); els.groupBSlots.innerHTML = A.buildSlotsHtml(state, "B");
    renderHistory();
    els.scheduleBody.innerHTML = A.buildScheduleRows(state).map(row => `<tr>${row.map(cell => `<td>${A.escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    document.querySelectorAll("[data-stage]").forEach(button => button.classList.toggle("active", button.dataset.stage === state.stage));
    const stageNames = { intro:"หน้าต้อนรับ", format:"รูปแบบการแข่งขัน", draw:"จับฉลาก", official:"ผลการจับฉลาก", summary:"สรุป / ผังแข่งขัน", schedule:"ตารางแข่งขัน" };
    if(els.liveStageName) els.liveStageName.textContent = stageNames[state.stage] || stageNames.intro;
    const live = state.mode === "live";
    els.modePill.textContent = live ? "โหมดถ่ายทอดสด" : "โหมดซ้อม"; els.modePill.className = `pill ${live ? "live" : ""}`; els.rehearsalRandomBtn.hidden = live;
    [els.positionSelect, els.teamSelect, els.confirmBtn, els.clearCurrentBtn, els.undoBtn, els.rehearsalRandomBtn].forEach(el => { el.disabled = state.locked; });
    els.lockBtn.textContent = state.locked ? "🔓 ปลดล็อกผล" : "🔒 ล็อกผล"; els.lockedAlert.hidden = !state.locked;
    els.progressPill.textContent = `ครั้งที่ ${Math.min(state.confirmed.length + 1, 7)} จาก 7`; els.stateTime.textContent = `บันทึกล่าสุด ${A.formatThaiTime(state.updatedAt)}`;
    els.confirmBtn.disabled = state.locked || !state.currentPosition || !state.currentTeamId; els.undoBtn.disabled = state.locked || !state.confirmed.length;
    renderConnection(); renderReadiness(); renderMobileOnlineBadge(); renderMobileSession(); renderFirebaseStatus(); renderRecording();
    clearTimeout(highlightTimer);
    if(state.pendingRevealUntil > Date.now()) highlightTimer = setTimeout(render, state.pendingRevealUntil - Date.now() + 30);
  }
  els.openDisplayBtn.addEventListener("click", () => window.open(displayLink(), "rapee69-display"));
  [els.recordStartBtn, els.recordStartPanelBtn].forEach(button => button.addEventListener("click", startRecording));
  [els.recordStopBtn, els.recordStopPanelBtn].forEach(button => button.addEventListener("click", stopRecording));
  els.recordFolderBtn?.addEventListener("click", chooseRecordingFolder);
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
  function advanceToTeamSelection(){
    const touchDevice = matchMedia("(pointer:coarse)").matches || navigator.maxTouchPoints > 0;
    if(touchDevice) els.teamSelect.scrollIntoView({ behavior:"smooth", block:"center" });
    else els.teamSelect.focus({ preventScroll:true });
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
    state.currentPosition = value; state.stage = "draw"; persist(`แสดงตำแหน่ง ${value}`); requestAnimationFrame(advanceToTeamSelection);
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
  els.downloadJsonBtn.addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
    await saveOutputFile(`rapee69-draw-backup-${new Date().toISOString().slice(0,19).replaceAll(":","-")}.json`, blob, "ไฟล์สำรอง ");
  });
  els.printBtn.addEventListener("click", () => { const url = new URL(displayLink()); url.searchParams.set("print", "1"); url.searchParams.set("stage", "official"); window.open(url, "_blank"); });
  els.captureBtn.addEventListener("click", async () => {
    if(!await ensureOutputFolder()) return;
    const url = new URL(displayLink()); url.searchParams.set("capture", "1"); url.searchParams.set("stage", els.captureStageSelect.value); window.open(url, "_blank");
  });
  els.resetBtn.addEventListener("click", () => { if(prompt("พิมพ์คำว่า RESET เพื่อยืนยันล้างข้อมูลทั้งหมด") !== "RESET") return; state = A.emptyState(); persist("รีเซ็ตระบบทั้งหมด"); });
  if(window.drawChannel) window.drawChannel.addEventListener("message", event => { if(event.data?.type === "display-presence") { lastDisplayPing = Date.now(); render(); } else if(event.data?.state) receive(event.data.state); });
  window.addEventListener("storage", event => { if(event.key === A.STORAGE_KEY) receive(A.loadState()); });
  window.addEventListener("message", event => {
    if(event.origin !== location.origin || event.data?.type !== "rapee69-file-saved") return;
    recordingNotice = `บันทึก${event.data.label || "ไฟล์"} “${event.data.name || ""}” ลงโฟลเดอร์ “${event.data.folder || ""}” แล้ว`;
    setRecordingAlert(recordingNotice, "success"); render();
  });
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
  window.addEventListener("beforeunload", event => {
    if(mediaRecorder?.state === "recording" || mediaRecorder?.state === "paused") { event.preventDefault(); event.returnValue = "กำลังบันทึกวิดีโออยู่"; return; }
    if(state.confirmed.length < 7 && !state.locked){ event.preventDefault(); event.returnValue = "ยังจับฉลากไม่ครบ 7 ทีม และยังไม่ได้ล็อกผล"; }
  });
  window.DrawRemote?.start?.("control"); restoreRecordingFolder(); setInterval(renderConnection, 1000); setInterval(renderReadiness, 1000); setInterval(renderMobileOnlineBadge, 1000); setInterval(renderMobileSession, 1000); setInterval(renderRecording, 1000); updateControlClock(); setInterval(updateControlClock, 1000); render();
})();
