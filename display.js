(() => {
  "use strict";
  const A = window.DrawApp;
  let state = A.loadState();
  const displayMain = document.getElementById("displayMain");
  const liveDate = document.getElementById("liveDate");
  const liveClock = document.getElementById("liveClock");
  const params = new URLSearchParams(location.search);
  const forcedStage = A.STAGES.includes(params.get("stage")) ? params.get("stage") : "";
  let revealTimer;

  const teamListHtml = A.TEAMS.map(team => `
    <div class="team-number"><b>${team.id}</b><span>${A.escapeHtml(team.name)}</span></div>
  `).join("");

  function groupBoardHtml(){
    return `
      <div class="board-grid">
        <div class="group-card group-a">
          <div class="group-head">สาย A — 3 ทีม</div>
          <div class="slot-list">${A.buildSlotsHtml(state, "A")}</div>
        </div>
        <div class="group-card group-b">
          <div class="group-head">สาย B — 4 ทีม</div>
          <div class="slot-list">${A.buildSlotsHtml(state, "B")}</div>
        </div>
      </div>`;
  }

  function remainingDrawHtml(){
    const usedPositions = new Set(state.confirmed.map(item => item.position));
    const usedTeams = new Set(state.confirmed.map(item => Number(item.teamId)));
    const positions = A.POSITIONS.filter(position => !usedPositions.has(position));
    const teams = A.TEAMS.filter(team => !usedTeams.has(team.id));
    return `<section class="remaining-draw" aria-label="ฉลากที่เหลือ">
      <div><strong>ตำแหน่งที่เหลือในโถ</strong><span>${positions.map(item => `<b>${item}</b>`).join("") || "ครบแล้ว"}</span></div>
      <div><strong>หมายเลขทีมที่เหลือในโถ</strong><span>${teams.map(team => `<b>${team.id}</b>`).join("") || "ครบแล้ว"}</span></div>
    </section>`;
  }

  function introSlide(){
    return `
      <section class="slide">
        <div class="slide-inner intro-grid">
          <div class="intro-card">
            <p class="slide-subtitle">ศาลจังหวัดลพบุรี</p>
            <h1>จับฉลากแบ่งสาย<br>ฟุตบอล 7 คน<br>วันรพี 69</h1>
            <div class="intro-details">
              📅 วันศุกร์ที่ 31 กรกฎาคม 2569<br>
              🕑 เวลา 14.00 น.<br>
              🎥 ถ่ายทอดสดผ่าน Google Meet
            </div>
          </div>
          <div>
            <h2 style="margin-bottom:14px">ทีมที่เข้าร่วม 7 ทีม</h2>
            <div class="team-number-list">${teamListHtml}</div>
          </div>
        </div>
      </section>`;
  }

  function formatSlide(){
    return `
      <section class="slide">
        <div class="slide-inner">
          <h1>รูปแบบการแข่งขันและการจับฉลาก</h1>
          <p class="slide-subtitle">ใช้โถตำแหน่ง A1–B4 และโถหมายเลขทีม 1–7</p>
          <div class="format-grid">
            <div class="format-card a">
              <div class="format-big">สาย A</div>
              <ul>
                <li>จำนวน 3 ทีม</li>
                <li>แข่งขันแบบพบกันหมด</li>
                <li>จัดอันดับตามคะแนน และผลต่างประตูได้เสีย</li>
                <li>อันดับ 1 และ 2 เข้ารอบรองชนะเลิศ</li>
              </ul>
            </div>
            <div class="format-card b">
              <div class="format-big">สาย B</div>
              <ul>
                <li>จำนวน 4 ทีม</li>
                <li>Play-off รวม 5 แมตช์</li>
                <li>ระบบแพ้ครบ 2 นัดตกรอบ</li>
                <li>ผู้ชนะ M3 = อันดับ 1 · ผู้ชนะ M5 = อันดับ 2</li>
              </ul>
            </div>
          </div>
          <div class="last-result-bar">
            <div class="last-result-label">ขั้นตอนการจับฉลาก</div>
            <div class="last-result-team">โถที่ 1 จับตำแหน่ง → โถที่ 2 จับหมายเลขทีม → ยืนยันผลลงตาราง</div>
          </div>
        </div>
      </section>`;
  }

  function drawSlide(){
    const team = A.getTeam(state.currentTeamId);
    const revealing = team && Date.now() < state.pendingRevealUntil;
    const last = state.confirmed[state.confirmed.length - 1];
    const lastTeam = last ? A.getTeam(last.teamId) : null;
    let status = "พร้อมเริ่มการจับฉลาก";
    if(state.currentPosition && !team) status = "กำลังรอผลจากโถที่ 2";
    if(state.currentPosition && team) status = "รอผู้ดำเนินรายการยืนยันผล";
    if(!state.currentPosition && state.confirmed.length > 0) status = "ยืนยันผลแล้ว — เตรียมจับครั้งถัดไป";
    if(state.confirmed.length === 7) status = "จับฉลากครบทั้ง 7 ทีมแล้ว";

    return `
      <section class="slide">
        <div class="slide-inner draw-display">
          <div class="live-result">
            <div class="progress-label">ครั้งที่ ${Math.min(state.confirmed.length + 1, 7)} จาก 7</div>
            <div class="big-position">${state.currentPosition || "—"}</div>
            <div class="big-team ${revealing ? "revealing" : ""}">${team ? (revealing ? "กำลังเปิดฉลาก…" : A.escapeHtml(team.name)) : "รอผลจากโถจริง"}</div>
            <div class="live-status">${revealing ? "กำลังเปิดฉลาก…" : status}</div>
          </div>
          <div class="display-board">
            ${groupBoardHtml()}
            <div class="last-result-bar">
              ${last && lastTeam ? `
                <div class="last-result-label">ผลล่าสุด: ${last.position}</div>
                <div class="last-result-team">${A.escapeHtml(lastTeam.name)}</div>
              ` : `
                <div class="last-result-label">ผลล่าสุด</div>
                <div class="last-result-team">ยังไม่มีผลที่ยืนยัน</div>
              `}
            </div>
            ${remainingDrawHtml()}
          </div>
        </div>
      </section>`;
  }

  function buildScoreRows(){
    return A.buildGroupATableRows(state).map(row => `
      <tr>
        <td>${row.pos}</td>
        <td class="team-col">${A.escapeHtml(row.team)}</td>
        <td>${row.played}</td><td>${row.win}</td><td>${row.draw}</td><td>${row.lose}</td>
        <td>${row.gf}</td><td>${row.ga}</td><td>${row.gd}</td><td>${row.pts}</td>
      </tr>
    `).join("");
  }

  function matchBox(title, main, time){
    return `<div class="match-box">
      <div class="match-title">${title}</div>
      <div class="match-main">${main}</div>
      <div class="match-time">${time}</div>
    </div>`;
  }

  function summarySlide(){
    const n = pos => A.getResolvedName(state, pos);

    return `
      <section class="slide">
        <div class="slide-inner summary-slide">
          <h1 style="font-size:clamp(30px,4vw,52px); margin-bottom:10px">สรุปผลการจับฉลากและรูปแบบแข่งขัน</h1>
          <p class="slide-subtitle">${state.confirmed.length === 7 ? "สรุปสาย A ตารางคะแนนรวม · สาย B ผัง Play-off" : `ดำเนินการแล้ว ${state.confirmed.length} จาก 7 ทีม`}</p>

          <div class="summary-grid-advanced">
            <section class="summary-card a">
              <h2>สาย A — ตารางคะแนนรวม</h2>
              <div class="summary-card-body">
                <table class="score-table">
                  <thead>
                    <tr>
                      <th>รหัส</th><th>ทีม</th><th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th><th>ได้</th><th>เสีย</th><th>+/-</th><th>แต้ม</th>
                    </tr>
                  </thead>
                  <tbody>${buildScoreRows()}</tbody>
                </table>
                <div class="rules-note">
                  <strong>หลักเกณฑ์จัดอันดับสาย A</strong><br>
                  ชนะ 3 คะแนน · เสมอ 1 คะแนน · แพ้ 0 คะแนน<br>
                  ใช้เกณฑ์เรียงลำดับ: คะแนน → ผลต่างประตูได้เสีย → ประตูได้ → ผลการแข่งขันระหว่างกัน → ใบแดง/ใบเหลืองน้อยกว่า → จับสลาก
                </div>
              </div>
            </section>

            <section class="summary-card b">
              <h2>สาย B — Play-off 4 ทีม</h2>
              <div class="summary-card-body">
                <div class="playoff-layout">
                  <div class="playoff-column">
                    ${matchBox("แมตช์ที่ 1", `${n("B1")}<br>พบ<br>${n("B2")}`, "เวลา 18.25–18.45 น.")}
                    ${matchBox("แมตช์ที่ 2", `${n("B3")}<br>พบ<br>${n("B4")}`, "เวลา 18.50–19.10 น.")}
                  </div>

                  <div class="playoff-column">
                    <div>
                      <div class="arrow-note">ผู้ชนะ M1 / ผู้ชนะ M2</div>
                      ${matchBox("แมตช์ที่ 3", "ผู้ชนะ แมตช์ที่ 1<br>พบ<br>ผู้ชนะ แมตช์ที่ 2", "เวลา 19.40–20.00 น.")}
                    </div>
                    <div>
                      <div class="arrow-note lose">ผู้แพ้ M1 / ผู้แพ้ M2</div>
                      ${matchBox("แมตช์ที่ 4", "ผู้แพ้ แมตช์ที่ 1<br>พบ<br>ผู้แพ้ แมตช์ที่ 2", "เวลา 20.05–20.25 น.")}
                    </div>
                    <div>
                      <div class="arrow-note">ผู้แพ้ M3 / ผู้ชนะ M4</div>
                      ${matchBox("แมตช์ที่ 5", "ผู้แพ้ แมตช์ที่ 3<br>พบ<br>ผู้ชนะ แมตช์ที่ 4", "เวลา 20.55–21.15 น.")}
                    </div>
                  </div>

                  <div class="playoff-column">
                    <div class="result-box green">
                      <div class="big">อันดับ 1 สาย B</div>
                      <div class="small">ผู้ชนะ แมตช์ที่ 3</div>
                    </div>
                    <div class="result-box red">
                      <div class="big">ตกรอบ</div>
                      <div class="small">ผู้แพ้ แมตช์ที่ 4<br>(แพ้ครบ 2 นัด)</div>
                    </div>
                    <div class="result-box green">
                      <div class="big">อันดับ 2 สาย B</div>
                      <div class="small">ผู้ชนะ แมตช์ที่ 5</div>
                    </div>
                    <div class="result-box red">
                      <div class="big">ตกรอบ</div>
                      <div class="small">ผู้แพ้ แมตช์ที่ 5</div>
                    </div>
                  </div>
                </div>

                <div class="semi-grid">
                  <div class="semi-box">
                    <h3>รอบรองชนะเลิศ คู่ที่ 1</h3>
                    <div class="pair">อันดับ 1 สาย B พบ อันดับ 2 สาย A</div>
                    <div class="time">เวลา 21.20–21.40 น.</div>
                  </div>
                  <div class="semi-box">
                    <h3>รอบรองชนะเลิศ คู่ที่ 2</h3>
                    <div class="pair">อันดับ 1 สาย A พบ อันดับ 2 สาย B</div>
                    <div class="time">เวลา 21.45–22.05 น.</div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div class="last-result-bar" style="margin-top:12px">
            ${state.locked ? '<div class="lock-badge">🔒 ยืนยันและล็อกผลแล้ว</div>' : `<div class="last-result-label">สถานะ</div><div class="last-result-team">${A.escapeHtml(state.lastAction || "พร้อมเริ่มการจับฉลาก")}</div>`}
          </div>
        </div>
      </section>`;
  }

  function scheduleSlide(){
    const rows = A.buildScheduleRows(state)
      .map(row => `<tr>${row.map(cell => `<td>${A.escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `
      <section class="slide">
        <div class="slide-inner">
          <h1 style="font-size:clamp(28px,4vw,54px); margin-bottom:14px">ตารางการแข่งขันฟุตบอล 7 คน</h1>
          <table class="schedule-table">
            <thead>
              <tr><th>ลำดับ</th><th>เวลา</th><th>สาย/รอบ</th><th>รายการ</th><th>คู่แข่งขัน</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="last-result-bar">
            <div class="last-result-label">สรุปจำนวนการแข่งขัน</div>
            <div class="last-result-team">สาย A 3 นัด + สาย B 5 นัด + รอบรองชนะเลิศ 2 นัด = รวม 10 นัด</div>
          </div>
        </div>
      </section>`;
  }

  function render(){
    const renderer = {
      intro:introSlide, format:formatSlide, draw:drawSlide, summary:summarySlide, schedule:scheduleSlide
    }[forcedStage || state.stage] || introSlide;
    displayMain.innerHTML = renderer();
    clearTimeout(revealTimer);
    if(state.pendingRevealUntil > Date.now()) revealTimer = setTimeout(render, state.pendingRevealUntil - Date.now() + 20);
  }

  if(window.drawChannel){
    window.drawChannel.addEventListener("message", event => {
      if(event.data?.state){ state = A.normalizeState(event.data.state); render(); }
    });
  }
  window.addEventListener("storage", event => {
    if(event.key === A.STORAGE_KEY){ state = A.loadState(); render(); }
  });
  window.addEventListener("keydown", event => {
    if(event.key.toLowerCase() === "f"){ document.documentElement.requestFullscreen?.(); return; }
    if("12345".includes(event.key) && !forcedStage){
      state.stage = A.STAGES[Number(event.key) - 1];
      state = A.saveState(state, "stage");
      render();
    }
  });
  window.addEventListener("draw-remote-state", event => { state = A.normalizeState(event.detail.state); render(); });
  function pingDisplay(){
    window.drawChannel?.postMessage({ type:"display-presence", at:Date.now() });
    window.DrawRemote?.ping?.("display");
  }
  function updateClock(){
    const now = new Date();
    if(liveDate) liveDate.textContent = new Intl.DateTimeFormat("th-TH", { day:"numeric", month:"long", year:"numeric" }).format(now);
    if(liveClock){
      const time = new Intl.DateTimeFormat("th-TH", { hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
      liveClock.textContent = `เวลา ${time} น.`;
    }
  }
  async function captureSummary(){
    if(!window.html2canvas){ alert("ยังโหลดเครื่องมือบันทึกภาพไม่สำเร็จ โปรดตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง"); return; }
    const canvas = await window.html2canvas(displayMain, { backgroundColor:"#ffffff", scale:2, useCORS:true });
    const link = document.createElement("a");
    link.download = "rapee69-draw-summary.png"; link.href = canvas.toDataURL("image/png"); link.click();
  }
  window.DrawRemote?.start?.("display");
  pingDisplay(); setInterval(pingDisplay, 2000);
  updateClock(); setInterval(updateClock, 1000);
  render();
  if(params.get("print") === "1") setTimeout(() => window.print(), 600);
  if(params.get("capture") === "1") setTimeout(() => captureSummary(), 800);
})();
