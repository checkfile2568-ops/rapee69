(() => {
  "use strict";

  const VERSION = "1.4";
  const STORAGE_KEY = "rapee69_draw_state_v14";
  const CHANNEL_NAME = "rapee69_draw_channel_v14";
  const STAGES = ["intro", "format", "draw", "summary", "schedule"];
  const MODES = ["live", "rehearsal"];
  const TEAMS = [
    { id: 1, name: "ทีมรวมศาลจังหวัดลพบุรี" }, { id: 2, name: "ทีมอัยการ" },
    { id: 3, name: "ทีมตำรวจภูธรจังหวัดลพบุรี" }, { id: 4, name: "ทีมศูนย์ฝึกและอบรมเด็กและเยาวชนลพบุรี" },
    { id: 5, name: "ทีมทนายความจังหวัดลพบุรี" }, { id: 6, name: "ทีม สภ.ท่าหิน" },
    { id: 7, name: "ทีมเรือนจำกลางลพบุรี" }
  ];
  const POSITIONS = ["A1", "A2", "A3", "B1", "B2", "B3", "B4"];
  const DEFAULT_STATE = {
    version: VERSION, mode: "live", stage: "intro", currentPosition: "", currentTeamId: null,
    confirmed: [], locked: false, lastAction: "พร้อมเริ่มการจับฉลาก", pendingRevealUntil: 0,
    updatedAt: new Date().toISOString()
  };

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function emptyState(){ return clone(DEFAULT_STATE); }
  function normalizeState(raw){
    const state = Object.assign(emptyState(), raw && typeof raw === "object" ? raw : {});
    state.version = VERSION;
    state.mode = MODES.includes(state.mode) ? state.mode : "live";
    state.stage = STAGES.includes(state.stage) ? state.stage : "intro";
    state.locked = Boolean(state.locked);
    state.currentPosition = POSITIONS.includes(state.currentPosition) ? state.currentPosition : "";
    state.currentTeamId = TEAMS.some(team => team.id === Number(state.currentTeamId)) ? Number(state.currentTeamId) : null;
    state.pendingRevealUntil = Number.isFinite(Number(state.pendingRevealUntil)) ? Number(state.pendingRevealUntil) : 0;
    const positions = new Set(), teams = new Set();
    state.confirmed = Array.isArray(state.confirmed) ? state.confirmed.reduce((valid, item) => {
      const position = item && item.position;
      const teamId = Number(item && item.teamId);
      if(POSITIONS.includes(position) && TEAMS.some(team => team.id === teamId) && !positions.has(position) && !teams.has(teamId)){
        positions.add(position); teams.add(teamId);
        valid.push({ position, teamId, confirmedAt: typeof item.confirmedAt === "string" ? item.confirmedAt : new Date().toISOString() });
      }
      return valid;
    }, []) : [];
    if(positions.has(state.currentPosition)) state.currentPosition = "";
    if(teams.has(state.currentTeamId)) state.currentTeamId = null;
    state.lastAction = typeof state.lastAction === "string" ? state.lastAction.slice(0, 240) : DEFAULT_STATE.lastAction;
    state.updatedAt = typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString();
    return state;
  }
  function loadState(){
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch(error){ console.error("Cannot load state", error); return emptyState(); }
  }
  function saveState(nextState, message = "update"){
    const state = normalizeState(nextState);
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if(window.drawChannel) window.drawChannel.postMessage({ type: message, state });
    window.DrawRemote?.publishState?.(state);
    window.dispatchEvent(new CustomEvent("draw-state-changed", { detail: state }));
    return state;
  }
  function resetForLive(){
    const state = emptyState();
    state.lastAction = "ล้างผลการซ้อมแล้ว — พร้อมเริ่มโหมดถ่ายทอดสด";
    return state;
  }
  function getTeam(id){ return TEAMS.find(team => team.id === Number(id)) || null; }
  function getPairMap(state){ const map = {}; state.confirmed.forEach(item => { map[item.position] = getTeam(item.teamId); }); return map; }
  function getResolvedName(state, position){ return getPairMap(state)[position]?.name || position; }
  function formatThaiTime(iso){ try { return new Intl.DateTimeFormat("th-TH", { hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(new Date(iso)); } catch { return ""; } }
  function escapeHtml(value){ return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function buildSlotsHtml(state, group){
    const map = getPairMap(state), newest = state.confirmed.at(-1)?.position;
    return POSITIONS.filter(p => p.startsWith(group)).map(position => {
      const team = map[position], justAdded = team && position === newest;
      return `<div class="slot ${team ? "" : "empty"}${justAdded ? " just-added" : ""}"><div class="slot-code">${position}</div><div class="slot-name">${team ? escapeHtml(team.name) : "รอจับฉลาก"}</div></div>`;
    }).join("");
  }
  function buildScheduleRows(state){
    const n = pos => getResolvedName(state, pos);
    return [["1","18.00–18.20","สาย A","นัดที่ 1",`${n("A1")} พบ ${n("A2")}`],["2","18.25–18.45","สาย B","แมตช์ที่ 1",`${n("B1")} พบ ${n("B2")}`],["3","18.50–19.10","สาย B","แมตช์ที่ 2",`${n("B3")} พบ ${n("B4")}`],["4","19.15–19.35","สาย A","นัดที่ 2",`${n("A1")} พบ ${n("A3")}`],["5","19.40–20.00","สาย B","แมตช์ที่ 3","ผู้ชนะ M1 พบ ผู้ชนะ M2"],["6","20.05–20.25","สาย B","แมตช์ที่ 4","ผู้แพ้ M1 พบ ผู้แพ้ M2"],["7","20.30–20.50","สาย A","นัดที่ 3",`${n("A2")} พบ ${n("A3")}`],["8","20.55–21.15","สาย B","แมตช์ที่ 5","ผู้แพ้ M3 พบ ผู้ชนะ M4"],["9","21.20–21.40","รอบรองฯ","คู่ที่ 1","อันดับ 1 สาย B พบ อันดับ 2 สาย A"],["10","21.45–22.05","รอบรองฯ","คู่ที่ 2","อันดับ 1 สาย A พบ อันดับ 2 สาย B"]];
  }
  function buildGroupATableRows(state){ const map = getPairMap(state); return ["A1","A2","A3"].map(pos => ({ pos, team:map[pos]?.name || "รอจับฉลาก", played:0, win:0, draw:0, lose:0, gf:0, ga:0, gd:0, pts:0 })); }

  window.DrawApp = { VERSION, STORAGE_KEY, CHANNEL_NAME, STAGES, TEAMS, POSITIONS, DEFAULT_STATE, emptyState, resetForLive, normalizeState, loadState, saveState, getTeam, getPairMap, getResolvedName, formatThaiTime, escapeHtml, buildSlotsHtml, buildScheduleRows, buildGroupATableRows };
  try { window.drawChannel = new BroadcastChannel(CHANNEL_NAME); } catch { window.drawChannel = null; }
})();
